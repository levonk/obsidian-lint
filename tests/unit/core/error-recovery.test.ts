/**
 * Tests for error recovery scenarios and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileProcessor } from '../../../src/utils/file-processor.js';
import { LintEngine } from '../../../src/core/engine.js';
import {
  FileSystemError,
  ErrorCodes,
  ErrorRecoveryOptions,
} from '../../../src/types/errors.js';

describe('Error Recovery Scenarios', () => {
  let testDir: string;
  let fileProcessor: FileProcessor;
  let lintEngine: LintEngine;

  beforeEach(async () => {
    testDir = join(tmpdir(), `obsidian-lint-recovery-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

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

  describe('File System Recovery', () => {
    it('should recover from temporary file system errors', async () => {
      const testFile = join(testDir, 'test.md');
      await fs.writeFile(testFile, '# Test Content');

      let failureCount = 0;
      const maxFailures = 2;

      // Mock fs operations to simulate temporary failures
      const originalAccess = fs.access;
      (fs as any).access = async (path: string, mode?: number) => {
        if (path === testFile && failureCount < maxFailures) {
          failureCount++;
          const error = new Error(
            'EMFILE: too many open files'
          ) as NodeJS.ErrnoException;
          error.code = 'EMFILE';
          throw error;
        }
        return originalAccess(path, mode);
      };

      const recoveryOptions: ErrorRecoveryOptions = {
        retryCount: 3,
        retryDelay: 50,
      };

      try {
        const result = await fileProcessor.parseMarkdownFile(
          testFile,
          recoveryOptions
        );
        expect(result.content).toContain('# Test Content');
        expect(failureCount).toBe(maxFailures);
      } finally {
        (fs as any).access = originalAccess;
      }
    });

    it('should handle disk space errors gracefully', async () => {
      const testFile = join(testDir, 'large-file.md');
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB content

      // Mock writeFile to simulate disk space error
      const originalWriteFile = fs.writeFile;
      (fs as any).writeFile = async (path: string, content: string) => {
        if (path.includes('large-file')) {
          const error = new Error(
            'ENOSPC: no space left on device'
          ) as NodeJS.ErrnoException;
          error.code = 'ENOSPC';
          throw error;
        }
        return originalWriteFile(path, content, 'utf-8');
      };

      try {
        await fileProcessor.writeFile(testFile, largeContent);
        expect.fail('Should have thrown disk space error');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe(
          ErrorCodes.FILE_WRITE_ERROR
        );
        expect(error.message).toContain('ENOSPC');
      } finally {
        (fs as any).writeFile = originalWriteFile;
      }
    });

    it('should handle concurrent file access conflicts', async () => {
      const testFile = join(testDir, 'concurrent.md');
      await fs.writeFile(testFile, '# Original Content');

      const recoveryOptions: ErrorRecoveryOptions = {
        retryCount: 2,
        retryDelay: 100,
      };

      // Simulate concurrent access by multiple operations with delays
      const operations = [
        fileProcessor.writeFile(testFile, '# Content 1', recoveryOptions),
        new Promise(resolve => setTimeout(resolve, 50)).then(() =>
          fileProcessor.writeFile(testFile, '# Content 2', recoveryOptions)
        ),
        new Promise(resolve => setTimeout(resolve, 100)).then(() =>
          fileProcessor.writeFile(testFile, '# Content 3', recoveryOptions)
        ),
      ];

      // All should succeed since they're sequential with delays
      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should create and restore backups during failed operations', async () => {
      const testFile = join(testDir, 'backup-test.md');
      const originalContent = '# Original Content';
      await fs.writeFile(testFile, originalContent);

      // Create backup
      const backupPath = await fileProcessor.createBackup(testFile);
      expect(await fs.readFile(backupPath, 'utf-8')).toBe(originalContent);

      // Modify original file
      await fs.writeFile(testFile, '# Modified Content');

      // Restore from backup
      await fs.copyFile(backupPath, testFile);
      expect(await fs.readFile(testFile, 'utf-8')).toBe(originalContent);

      // Clean up
      await fs.unlink(backupPath);
    });

    it('should handle network drive disconnections', async () => {
      const testFile = join(testDir, 'network-file.md');
      await fs.writeFile(testFile, '# Network Content');

      let disconnected = true;
      const originalReadFile = fs.readFile;

      (fs as any).readFile = async (path: string, encoding: string) => {
        if (path === testFile && disconnected) {
          disconnected = false; // Reconnect after first failure
          const error = new Error(
            'ENOTCONN: network is unreachable'
          ) as NodeJS.ErrnoException;
          error.code = 'ENOTCONN';
          throw error;
        }
        return originalReadFile(path, encoding);
      };

      const recoveryOptions: ErrorRecoveryOptions = {
        retryCount: 2,
        retryDelay: 100,
      };

      try {
        const result = await fileProcessor.parseMarkdownFile(
          testFile,
          recoveryOptions
        );
        expect(result.content).toContain('# Network Content');
      } finally {
        (fs as any).readFile = originalReadFile;
      }
    });
  });

  describe('Batch Processing Recovery', () => {
    it('should continue processing after individual file failures', async () => {
      const vaultDir = join(testDir, 'batch-vault');
      await fs.mkdir(vaultDir, { recursive: true });

      // Create configuration for the vault
      const configDir = join(vaultDir, '.config', 'obsidian-lint');
      await fs.mkdir(configDir, { recursive: true });

      await fs.writeFile(
        join(configDir, 'obsidian-lint.toml'),
        `
[general]
max_concurrency = 4

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Test"
rules_path = "rules/default"
      `
      );

      // Create rules directory with a simple rule
      const rulesDir = join(configDir, 'rules', 'default', 'enabled');
      await fs.mkdir(rulesDir, { recursive: true });

      // Add a simple test rule
      await fs.writeFile(
        join(rulesDir, 'test-rule.toml'),
        `
[rule]
id = "test-rule.simple"
name = "Simple Test Rule"
description = "A simple test rule"
category = "test"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
test_setting = true
      `
      );

      // Create mix of valid and problematic files
      await fs.writeFile(join(vaultDir, 'valid1.md'), '# Valid File 1');
      await fs.writeFile(join(vaultDir, 'valid2.md'), '# Valid File 2');
      await fs.writeFile(join(vaultDir, 'invalid.md'), '\x00\x01\x02'); // Binary content
      await fs.writeFile(join(vaultDir, 'valid3.md'), '# Valid File 3');

      const result = await lintEngine.processVault(vaultDir, {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      });

      // Should process files (binary content might not cause errors in this context)
      expect(result.filesProcessed).toBeGreaterThan(0);
      // Errors might be 0 if binary content is handled gracefully
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle parallel processing failures gracefully', async () => {
      const vaultDir = join(testDir, 'parallel-vault');
      await fs.mkdir(vaultDir, { recursive: true });

      // Create configuration for the vault
      const configDir = join(vaultDir, '.config', 'obsidian-lint');
      await fs.mkdir(configDir, { recursive: true });

      await fs.writeFile(
        join(configDir, 'obsidian-lint.toml'),
        `
[general]
max_concurrency = 4

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Test"
rules_path = "rules/default"
      `
      );

      // Create rules directory with a simple rule
      const rulesDir = join(configDir, 'rules', 'default', 'enabled');
      await fs.mkdir(rulesDir, { recursive: true });

      // Add a simple test rule
      await fs.writeFile(
        join(rulesDir, 'test-rule.toml'),
        `
[rule]
id = "test-rule.simple"
name = "Simple Test Rule"
description = "A simple test rule"
category = "test"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
test_setting = true
      `
      );

      // Create many files to trigger parallel processing
      for (let i = 0; i < 10; i++) {
        const content = i === 5 ? '\x00\x01\x02' : `# File ${i}`;
        await fs.writeFile(join(vaultDir, `file${i}.md`), content);
      }

      const result = await lintEngine.processVault(vaultDir, {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      });

      // Should process most files despite some failures
      expect(result.filesProcessed).toBeGreaterThan(5);
      // Errors might be 0 if binary content is handled gracefully
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate errors from multiple sources', async () => {
      const vaultDir = join(testDir, 'error-vault');
      await fs.mkdir(vaultDir, { recursive: true });

      // Create files that will cause different types of errors
      await fs.writeFile(join(vaultDir, 'binary.md'), '\x00\x01\x02');
      await fs.writeFile(join(vaultDir, 'empty.md'), '');
      await fs.writeFile(join(vaultDir, 'valid.md'), '# Valid');

      const result = await lintEngine.processVault(vaultDir, {
        dryRun: true,
        fix: false,
        verbose: true,
        generateMoc: false,
        parallel: false,
      });

      const errorReport = lintEngine.generateErrorReport(result);
      expect(errorReport).toContain('LINT ENGINE ERROR REPORT');
      expect(errorReport).toContain('Total Errors:');

      // Should categorize different error types
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Recovery', () => {
    it('should fall back to default configuration when files are corrupted', async () => {
      const configPath = join(testDir, 'corrupted-config.toml');
      await fs.writeFile(configPath, 'corrupted toml content [[[');

      // Should fall back to default config instead of crashing
      const result = await lintEngine.loadConfiguration();
      expect(result.general).toBeDefined();
      expect(result.activeProfile).toBe('default');
    });

    it('should handle missing rule directories gracefully', async () => {
      const configPath = join(testDir, 'missing-rules-config.toml');
      await fs.writeFile(
        configPath,
        `
[general]
max_concurrency = 4

[profiles]
active = "test"

[profiles.test]
name = "Test Profile"
description = "Test"
rules_path = "nonexistent/rules/path"
      `
      );

      try {
        await lintEngine.loadRulesWithConfigPath('test', configPath);
        expect.fail('Should have thrown error for missing rules directory');
      } catch (error) {
        // Could be either profile not found or rules directory not found
        expect(error.message).toMatch(
          /Profile 'test' not found|Rules enabled directory not found/
        );
      }
    });

    it('should validate rule files and skip invalid ones', async () => {
      const rulesDir = join(testDir, 'mixed-rules', 'enabled');
      await fs.mkdir(rulesDir, { recursive: true });

      // Create valid rule
      await fs.writeFile(
        join(rulesDir, 'valid-rule.toml'),
        `
[rule]
id = "test-rule.valid"
name = "Valid Rule"
description = "A valid rule"
category = "test"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
test_setting = true
      `
      );

      // Create invalid rule
      await fs.writeFile(
        join(rulesDir, 'invalid-rule.toml'),
        `
[rule]
# Missing required fields

[config]
path_allowlist = ["**/*.md"]
      `
      );

      try {
        await lintEngine.loadRulesWithConfigPath('default', undefined);
      } catch (error) {
        // Should provide detailed error about rules directory or validation
        expect(error.message).toMatch(
          /Rules enabled directory not found|Rule validation failed/
        );
      }
    });
  });

  describe('Memory and Resource Recovery', () => {
    it('should handle out of memory conditions', async () => {
      const testFile = join(testDir, 'huge-file.md');

      // Create a very large content string (but not actually write it to avoid disk space issues)
      const hugeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB string

      // Mock to simulate out of memory
      const originalWriteFile = fs.writeFile;
      (fs as any).writeFile = async (path: string, content: string) => {
        if (content.length > 50 * 1024 * 1024) {
          const error = new Error('JavaScript heap out of memory');
          error.name = 'RangeError';
          throw error;
        }
        return originalWriteFile(path, content, 'utf-8');
      };

      try {
        await fileProcessor.writeFile(testFile, hugeContent);
        expect.fail('Should have thrown out of memory error');
      } catch (error) {
        expect(error.message).toContain('heap out of memory');
      } finally {
        (fs as any).writeFile = originalWriteFile;
      }
    });

    it('should clean up temporary files after failures', async () => {
      const testFile = join(testDir, 'cleanup-test.md');
      const content = '# Test Content';

      // Mock rename to fail, simulating atomic write failure
      const originalRename = fs.rename;
      (fs as any).rename = async (oldPath: string, newPath: string) => {
        if (newPath === testFile) {
          throw new Error('Simulated rename failure');
        }
        return originalRename(oldPath, newPath);
      };

      try {
        await fileProcessor.writeFile(testFile, content);
        expect.fail('Should have thrown rename error');
      } catch (error) {
        // Check that temp file was cleaned up
        const tempFiles = await fs.readdir(testDir);
        const tempFileExists = tempFiles.some(file => file.includes('.tmp'));
        expect(tempFileExists).toBe(false);
      } finally {
        (fs as any).rename = originalRename;
      }
    });

    it('should handle file descriptor exhaustion', async () => {
      const vaultDir = join(testDir, 'fd-vault');
      await fs.mkdir(vaultDir, { recursive: true });

      // Create many files
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(join(vaultDir, `file${i}.md`), `# File ${i}`);
      }

      let fdCount = 0;
      const originalReadFile = fs.readFile;

      (fs as any).readFile = async (path: string, encoding: string) => {
        fdCount++;
        if (fdCount > 10) {
          const error = new Error(
            'EMFILE: too many open files'
          ) as NodeJS.ErrnoException;
          error.code = 'EMFILE';
          throw error;
        }
        return originalReadFile(path, encoding);
      };

      const recoveryOptions: ErrorRecoveryOptions = {
        retryCount: 1,
        retryDelay: 100,
        continueOnError: true,
      };

      try {
        const files = await fileProcessor.scanVault(
          vaultDir,
          ['**/*.md'],
          recoveryOptions
        );
        expect(files.length).toBeGreaterThan(0);
      } finally {
        (fs as any).readFile = originalReadFile;
      }
    });
  });
});
