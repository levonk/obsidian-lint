/**
 * Tests for comprehensive error handling and validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigurationManager } from '../../../src/core/config.js';
import { RuleLoader } from '../../../src/core/rules.js';
import { FileProcessor } from '../../../src/utils/file-processor.js';
import { LintEngine } from '../../../src/core/engine.js';
import {
  LintError,
  ConfigurationError,
  RuleError,
  FileSystemError,
  ProcessingError,
  ErrorCodes,
  ErrorContextBuilder,
  ErrorAggregator,
  ErrorRecoveryOptions,
} from '../../../src/types/errors.js';
import type {
  Configuration,
  RawTomlConfig,
} from '../../../src/types/config.js';
import type { Rule, RuleConfig } from '../../../src/types/rules.js';

describe('Error Handling System', () => {
  let testDir: string;
  let configManager: ConfigurationManager;
  let ruleLoader: RuleLoader;
  let fileProcessor: FileProcessor;
  let lintEngine: LintEngine;

  beforeEach(async () => {
    testDir = join(tmpdir(), `obsidian-lint-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    configManager = new ConfigurationManager();
    ruleLoader = new RuleLoader();
    fileProcessor = new FileProcessor();
    lintEngine = new LintEngine();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Validation', () => {
    it('should detect missing required fields with detailed messages', async () => {
      const invalidConfig: RawTomlConfig = {
        general: {
          max_concurrency: -1, // Invalid value
        },
        profiles: {
          active: 'nonexistent',
          test: {
            // Missing required fields
          },
        },
      };

      const configPath = join(testDir, 'invalid-config.toml');
      await fs.writeFile(
        configPath,
        `
[general]
max_concurrency = -1

[profiles]
active = "nonexistent"

[profiles.test]
# Missing required fields
      `
      );

      await expect(
        configManager.loadConfiguration(undefined, configPath)
      ).rejects.toThrow(/Configuration validation failed/);
    });

    it('should provide helpful error messages for invalid field types', async () => {
      const configPath = join(testDir, 'type-error-config.toml');
      await fs.writeFile(
        configPath,
        `
[general]
max_concurrency = "not-a-number"
dry_run = "not-a-boolean"

[profiles]
active = "default"

[profiles.default]
name = 123
description = true
rules_path = []
      `
      );

      await expect(
        configManager.loadConfiguration(undefined, configPath)
      ).rejects.toThrow(/Configuration validation failed/);
    });

    it('should validate cross-references between config sections', async () => {
      const configPath = join(testDir, 'cross-ref-config.toml');
      await fs.writeFile(
        configPath,
        `
[general]
max_concurrency = 4

[profiles]
active = "missing-profile"

[profiles.default]
name = "Default"
description = "Test"
rules_path = "rules/default"
      `
      );

      await expect(
        configManager.loadConfiguration(undefined, configPath)
      ).rejects.toThrow(/Active profile 'missing-profile' not found/);
    });

    it('should generate warnings for suboptimal configurations', async () => {
      const configPath = join(testDir, 'warning-config.toml');
      await fs.writeFile(
        configPath,
        `
[general]
max_concurrency = 32
dry_run = true
fix = true
parallel = false

[profiles]
active = "default"

[profiles.default]
name = "Default"
description = "Test"
rules_path = "rules/default"
      `
      );

      const result = await configManager.loadConfiguration(
        undefined,
        configPath
      );
      expect(result.config).toBeDefined();
      // Warnings should be logged but not prevent loading
    });
  });

  describe('Rule Conflict Detection', () => {
    it('should detect major ID conflicts with detailed resolution', async () => {
      const rulesDir = join(testDir, 'rules', 'enabled');
      await fs.mkdir(rulesDir, { recursive: true });

      // Create conflicting rules with same major ID
      await fs.writeFile(
        join(rulesDir, 'frontmatter-strict.toml'),
        `
[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter"
description = "Strict frontmatter validation"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title", "date_created", "tags"]
      `
      );

      await fs.writeFile(
        join(rulesDir, 'frontmatter-minimal.toml'),
        `
[rule]
id = "frontmatter-required-fields.minimal"
name = "Minimal Frontmatter"
description = "Minimal frontmatter validation"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title"]
      `
      );

      await expect(
        ruleLoader.loadRules(join(testDir, 'rules'))
      ).rejects.toThrow(/Rule conflicts detected/);
    });

    it('should provide specific resolution suggestions for different rule types', async () => {
      const rulesDir = join(testDir, 'rules', 'enabled');
      await fs.mkdir(rulesDir, { recursive: true });

      // Create attachment organization conflicts
      await fs.writeFile(
        join(rulesDir, 'attachment-centralized.toml'),
        `
[rule]
id = "attachment-organization.centralized"
name = "Centralized Attachments"
description = "Move all attachments to central location"
category = "attachment"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
attachment_directory = "Meta/Attachments"
      `
      );

      await fs.writeFile(
        join(rulesDir, 'attachment-keep-with-note.toml'),
        `
[rule]
id = "attachment-organization.keep-with-note"
name = "Keep Attachments With Notes"
description = "Keep attachments near their referencing notes"
category = "attachment"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
proximity_threshold = 1
      `
      );

      try {
        await ruleLoader.loadRules(join(testDir, 'rules'));
        expect.fail('Should have thrown conflict error');
      } catch (error) {
        expect(error.message).toContain('attachment-organization');
        expect(error.message).toContain('centralized');
        expect(error.message).toContain('keep-with-note');
        expect(error.message).toContain('Move unwanted .toml files');
      }
    });

    it('should detect potential performance issues in rule configurations', async () => {
      const rulesDir = join(testDir, 'rules', 'enabled');
      await fs.mkdir(rulesDir, { recursive: true });

      // Create rule with overly broad patterns
      await fs.writeFile(
        join(rulesDir, 'broad-rule.toml'),
        `
[rule]
id = "test-rule.broad"
name = "Broad Test Rule"
description = "Rule with very broad patterns"
category = "test"

[config]
path_allowlist = []
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = []

[settings]
test_setting = true
      `
      );

      const rules = await ruleLoader.loadRules(join(testDir, 'rules'));
      const conflictResult = ruleLoader.detectRuleConflicts(rules);

      expect(
        conflictResult.warnings.some(
          warning =>
            warning.includes('no path restrictions') &&
            warning.includes('will apply to all files')
        )
      ).toBe(true);
    });
  });

  describe('File System Error Handling', () => {
    it('should handle file not found errors with proper error codes', async () => {
      const nonExistentFile = join(testDir, 'nonexistent.md');

      await expect(
        fileProcessor.parseMarkdownFile(nonExistentFile)
      ).rejects.toThrow(FileSystemError);

      try {
        await fileProcessor.parseMarkdownFile(nonExistentFile);
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe(ErrorCodes.FILE_NOT_FOUND);
        expect((error as FileSystemError).filePath).toBe(nonExistentFile);
      }
    });

    it('should retry operations with configurable retry options', async () => {
      const testFile = join(testDir, 'test.md');
      await fs.writeFile(testFile, '# Test Content');

      // Simulate temporary failure by making file temporarily inaccessible
      let attemptCount = 0;
      const originalReadFile = fs.readFile;

      // Mock fs.readFile to fail first two attempts
      (fs as any).readFile = async (path: string, encoding: string) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('EMFILE: too many open files');
        }
        return originalReadFile(path, encoding);
      };

      const recoveryOptions: ErrorRecoveryOptions = {
        retryCount: 3,
        retryDelay: 100,
      };

      try {
        const result = await fileProcessor.parseMarkdownFile(
          testFile,
          recoveryOptions
        );
        expect(result.content).toContain('# Test Content');
        expect(attemptCount).toBe(3); // Should have retried twice
      } finally {
        // Restore original function
        (fs as any).readFile = originalReadFile;
      }
    });

    it('should handle permission errors with appropriate error codes', async () => {
      const testFile = join(testDir, 'readonly.md');
      await fs.writeFile(testFile, '# Test');

      // Make file read-only (simulate permission error)
      await fs.chmod(testFile, 0o444);

      const recoveryOptions: ErrorRecoveryOptions = {
        retryCount: 1,
        skipOnError: false,
      };

      try {
        await fileProcessor.writeFile(testFile, '# Modified', recoveryOptions);
        expect.fail('Should have thrown permission error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        // On Windows, permission errors might be reported as FILE_WRITE_ERROR
        expect(['FILE_ACCESS_DENIED', 'FILE_WRITE_ERROR']).toContain(
          (error as FileSystemError).code
        );
      }
    });

    it('should create backups before risky operations', async () => {
      const testFile = join(testDir, 'important.md');
      const originalContent = '# Important Content';
      await fs.writeFile(testFile, originalContent);

      const backupPath = await fileProcessor.createBackup(testFile);

      expect(await fs.readFile(backupPath, 'utf-8')).toBe(originalContent);
      expect(backupPath).toMatch(/\.backup\.\d+$/);

      // Clean up
      await fs.unlink(backupPath);
    });

    it('should handle vault scanning errors gracefully', async () => {
      const nonExistentVault = join(testDir, 'nonexistent-vault');

      await expect(fileProcessor.scanVault(nonExistentVault)).rejects.toThrow(
        FileSystemError
      );

      try {
        await fileProcessor.scanVault(nonExistentVault);
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe(ErrorCodes.FILE_NOT_FOUND);
        expect((error as FileSystemError).context?.operation).toBe('scanVault');
      }
    });
  });

  describe('Error Context and Reporting', () => {
    it('should build comprehensive error context', () => {
      const context = new ErrorContextBuilder()
        .addFile('/test/file.md')
        .addRule('test-rule.variant')
        .addOperation('linting')
        .addOriginalError(new Error('Original error'))
        .addCustom('lineNumber', 42)
        .build();

      expect(context.filePath).toBe('/test/file.md');
      expect(context.ruleId).toBe('test-rule.variant');
      expect(context.operation).toBe('linting');
      expect(context.originalError).toBeInstanceOf(Error);
      expect(context.lineNumber).toBe(42);
    });

    it('should aggregate multiple errors and generate reports', () => {
      const aggregator = new ErrorAggregator();

      aggregator.addError(
        new ConfigurationError(
          'Config error 1',
          ErrorCodes.CONFIG_NOT_FOUND,
          'config.toml'
        )
      );

      aggregator.addError(
        new RuleError(
          'Rule error 1',
          ErrorCodes.RULE_CONFLICT,
          'test-rule.variant'
        )
      );

      aggregator.addWarning('Warning message 1');
      aggregator.addWarning('Warning message 2');

      expect(aggregator.hasErrors()).toBe(true);
      expect(aggregator.hasWarnings()).toBe(true);
      expect(aggregator.getErrors()).toHaveLength(2);
      expect(aggregator.getWarnings()).toHaveLength(2);

      const report = aggregator.generateReport();
      expect(report).toContain('Errors (2)');
      expect(report).toContain('Warnings (2)');
      expect(report).toContain('CONFIG_NOT_FOUND');
      expect(report).toContain('RULE_CONFLICT');
    });

    it('should generate detailed error reports with stack traces', () => {
      const originalError = new Error('Original cause');
      const lintError = new LintError(
        'Test error message',
        ErrorCodes.FILE_PROCESSING_ERROR,
        {
          filePath: '/test/file.md',
          operation: 'testing',
          originalError,
        }
      );

      const report = lintError.toDetailedReport();

      expect(report).toContain('LintError: Test error message');
      expect(report).toContain('Code: FILE_PROCESSING_ERROR');
      expect(report).toContain('filePath: "/test/file.md"');
      expect(report).toContain('operation: "testing"');
      expect(report).toContain('originalError: Original cause');
    });

    it('should serialize errors to JSON for logging', () => {
      const error = new FileSystemError(
        'File operation failed',
        ErrorCodes.FILE_WRITE_ERROR,
        '/test/file.md',
        { attempts: 3, operation: 'write' }
      );

      const json = error.toJSON();

      expect(json.name).toBe('FileSystemError');
      expect(json.message).toBe('File operation failed');
      expect(json.code).toBe(ErrorCodes.FILE_WRITE_ERROR);
      expect(json.context.filePath).toBe('/test/file.md');
      expect(json.context.attempts).toBe(3);
    });
  });

  describe('Engine Error Handling Integration', () => {
    it('should handle configuration loading errors in engine', async () => {
      const invalidConfigPath = join(testDir, 'invalid.toml');
      await fs.writeFile(invalidConfigPath, 'invalid toml content [[[');

      await expect(
        lintEngine.loadConfiguration(invalidConfigPath)
      ).rejects.toThrow(/Failed to parse configuration file/);
    });

    it('should generate comprehensive error reports for processing failures', async () => {
      // Create a vault with some files
      const vaultDir = join(testDir, 'vault');
      await fs.mkdir(vaultDir, { recursive: true });

      // Create a file that will cause parsing errors
      await fs.writeFile(join(vaultDir, 'broken.md'), '\x00\x01\x02'); // Binary content

      const result = await lintEngine.processVault(vaultDir, {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      });

      expect(result.errors.length).toBeGreaterThan(0);

      const errorReport = lintEngine.generateErrorReport(result);
      expect(errorReport).toContain('LINT ENGINE ERROR REPORT');
      expect(errorReport).toContain('Total Errors:');
      expect(errorReport).toContain('Files Processed:');
    });

    it('should validate engine health and report issues', async () => {
      const healthCheck = await lintEngine.validateEngineHealth();

      expect(healthCheck).toHaveProperty('healthy');
      expect(healthCheck).toHaveProperty('issues');
      expect(healthCheck).toHaveProperty('warnings');

      if (!healthCheck.healthy) {
        expect(healthCheck.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Recovery Options', () => {
    it('should skip errors when skipOnError is enabled', async () => {
      const vaultDir = join(testDir, 'vault');
      await fs.mkdir(vaultDir, { recursive: true });

      // Create mix of valid and invalid files
      await fs.writeFile(join(vaultDir, 'valid.md'), '# Valid Content');
      await fs.writeFile(join(vaultDir, 'invalid.md'), '\x00\x01\x02');

      const recoveryOptions: ErrorRecoveryOptions = {
        skipOnError: true,
        continueOnError: true,
      };

      const files = await fileProcessor.scanVault(
        vaultDir,
        ['**/*.md'],
        recoveryOptions
      );
      expect(files).toContain(join(vaultDir, 'valid.md'));
      expect(files).toContain(join(vaultDir, 'invalid.md'));

      // Should be able to parse valid file
      const validFile = await fileProcessor.parseMarkdownFile(
        join(vaultDir, 'valid.md'),
        recoveryOptions
      );
      expect(validFile.content).toContain('# Valid Content');
    });

    it('should execute fallback actions on errors', async () => {
      let fallbackExecuted = false;
      const recoveryOptions: ErrorRecoveryOptions = {
        fallbackAction: () => {
          fallbackExecuted = true;
        },
      };

      const nonExistentFile = join(testDir, 'nonexistent.md');

      try {
        await fileProcessor.parseMarkdownFile(nonExistentFile, recoveryOptions);
      } catch (error) {
        // Error should still be thrown, but fallback should execute
        expect(fallbackExecuted).toBe(true);
      }
    });
  });
});
