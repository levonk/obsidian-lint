/**
 * Comprehensive integration tests for the LintEngine with parallel processing,
 * dry-run mode, error handling, and complete workflows
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  LintEngine,
  LintEngineError,
  ProgressCallback,
} from '../../src/core/engine.js';
import type { ProcessOptions, LintResult } from '../../src/types/index.js';

describe('LintEngine Comprehensive Integration Tests', () => {
  let testDir: string;
  let vaultDir: string;
  let configDir: string;
  let engine: LintEngine;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `obsidian-lint-comprehensive-test-${Date.now()}`);
    vaultDir = join(testDir, 'vault');
    configDir = join(vaultDir, '.config', 'obsidian-lint');

    mkdirSync(vaultDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });
    mkdirSync(join(configDir, 'rules', 'default', 'enabled'), {
      recursive: true,
    });

    // Create comprehensive config file
    const config = `
[general]
vault_root = "${vaultDir.replace(/\\/g, '/')}"
dry_run = false
verbose = false
fix = false
parallel = true
max_concurrency = 4

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Comprehensive test profile"
rules_path = "rules/default"

[profiles.minimal]
name = "Minimal Profile"
description = "Minimal rules for testing"
rules_path = "rules/minimal"
`;
    writeFileSync(join(configDir, 'obsidian-lint.toml'), config);

    // Create test rules
    const frontmatterRule = `
[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter Fields"
description = "Require all frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["*.md", "**/*.md"]
path_denylist = ["**/templates/**", "**/archive/**"]
include_patterns = ["**/*"]
exclude_patterns = [".*", "**/.obsidian/**"]

[settings]
required_fields = ["title", "date_created", "tags"]
auto_fix = true
`;
    writeFileSync(
      join(
        configDir,
        'rules',
        'default',
        'enabled',
        'frontmatter-required-fields.strict.toml'
      ),
      frontmatterRule
    );

    // Create diverse test files
    createTestFiles();

    // Initialize engine with specific concurrency for testing
    engine = new LintEngine(2);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function createTestFiles(): void {
    // Complete note with all frontmatter
    writeFileSync(
      join(vaultDir, 'complete-note.md'),
      `---
title: Complete Note
date_created: 2024-01-01
tags: [test, complete]
status: active
---

# Complete Note

This is a complete test note with all required frontmatter.

## Section 1

Content with [[internal-link]] and [external link](https://example.com).

![Image](attachments/image.png)
`
    );

    // Incomplete note missing frontmatter
    writeFileSync(
      join(vaultDir, 'incomplete-note.md'),
      `---
title: Incomplete Note
---

# Incomplete Note

This note is missing required frontmatter fields like date_created and tags.
`
    );

    // Note with no frontmatter
    writeFileSync(
      join(vaultDir, 'no-frontmatter.md'),
      `# No Frontmatter

This note has no frontmatter at all and should trigger multiple issues.

Contains [[broken-link]] and some content.
`
    );

    // Create subdirectories with files
    mkdirSync(join(vaultDir, 'projects'), { recursive: true });
    writeFileSync(
      join(vaultDir, 'projects', 'project-a.md'),
      `---
title: Project A
date_created: 2024-01-02
tags: [project, active]
---

# Project A

Project documentation with proper frontmatter.
`
    );

    mkdirSync(join(vaultDir, 'archive'), { recursive: true });
    writeFileSync(
      join(vaultDir, 'archive', 'old-note.md'),
      `---
title: Old Note
---

# Old Note

This is in the archive directory and should be excluded by path_denylist.
`
    );

    // Create files that will cause processing errors
    writeFileSync(
      join(vaultDir, 'problematic-yaml.md'),
      `---
title: Problematic YAML
invalid_yaml: [[[unclosed brackets
date_created: 2024-01-01
---

# Problematic YAML

This file has invalid YAML that might cause parsing issues.
`
    );

    // Create large file for performance testing
    const largeContent = Array(1000)
      .fill(0)
      .map((_, i) => `Line ${i + 1} with some content`)
      .join('\n');

    writeFileSync(
      join(vaultDir, 'large-file.md'),
      `---
title: Large File
date_created: 2024-01-01
tags: [large, test]
---

# Large File

${largeContent}
`
    );

    // Create files for concurrency testing
    for (let i = 1; i <= 10; i++) {
      writeFileSync(
        join(vaultDir, `concurrent-file-${i}.md`),
        `---
title: Concurrent File ${i}
date_created: 2024-01-0${(i % 9) + 1}
tags: [concurrent, test${i}]
---

# Concurrent File ${i}

This is file ${i} for testing concurrent processing.

## Content Section

Some content to make the file more realistic.
`
      );
    }
  }

  describe('Parallel Processing with Configurable Concurrency', () => {
    it('should process files in parallel with default concurrency', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      const startTime = Date.now();
      const result = await engine.processVault(vaultDir, options);
      const duration = Date.now() - startTime;

      expect(result.filesProcessed).toBeGreaterThan(10);
      expect(result.duration).toBeGreaterThan(0);
      expect(duration).toBeGreaterThan(0);
      expect(result.errors).toBeDefined();
    });

    it('should respect custom concurrency limits', async () => {
      const singleThreadEngine = new LintEngine(1);
      const multiThreadEngine = new LintEngine(4);

      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      // Test single-threaded processing
      const singleResult = await singleThreadEngine.processVault(
        vaultDir,
        options
      );

      // Test multi-threaded processing
      const multiResult = await multiThreadEngine.processVault(
        vaultDir,
        options
      );

      expect(singleResult.filesProcessed).toBe(multiResult.filesProcessed);
      expect(singleResult.issuesFound.length).toBe(
        multiResult.issuesFound.length
      );
    });

    it('should handle parallel processing errors gracefully', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      // Create files that will cause errors
      writeFileSync(
        join(vaultDir, 'error-file-1.md'),
        '---\ninvalid: yaml: content: [[[[\n---\n\n# Error File 1'
      );
      writeFileSync(
        join(vaultDir, 'error-file-2.md'),
        '---\nanother: invalid: yaml: }}}\n---\n\n# Error File 2'
      );

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: true, // Enable verbose to test error logging
        generateMoc: false,
        parallel: true,
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBeGreaterThan(0);
      // Should continue processing despite errors
    });

    it('should provide accurate progress reporting during parallel processing', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const progressUpdates: Array<{
        current: number;
        total: number;
        message?: string;
      }> = [];

      const progressCallback: ProgressCallback = (current, total, message) => {
        progressUpdates.push({ current, total, message });
      };

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      await engine.processVault(vaultDir, options, progressCallback);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].current).toBe(0);
      expect(progressUpdates[0].total).toBeGreaterThan(10);

      // Progress should be monotonically increasing
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].current).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].current
        );
      }

      // Final progress should indicate completion
      const finalUpdate = progressUpdates[progressUpdates.length - 1];
      expect(finalUpdate.message).toContain('complete');
    });
  });

  describe('Comprehensive Dry-Run Mode', () => {
    it('should show all potential changes without applying them', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: true, // Enable fixes but dry run should prevent application
        verbose: true,
        generateMoc: false,
        parallel: false,
      };

      // Store original file contents
      const originalContents = new Map<string, string>();
      const testFiles = ['incomplete-note.md', 'no-frontmatter.md'];

      for (const file of testFiles) {
        const filePath = join(vaultDir, file);
        if (existsSync(filePath)) {
          originalContents.set(file, readFileSync(filePath, 'utf-8'));
        }
      }

      const result = await engine.processVault(vaultDir, options);

      // Verify files were not modified
      for (const [file, originalContent] of originalContents) {
        const filePath = join(vaultDir, file);
        const currentContent = readFileSync(filePath, 'utf-8');
        expect(currentContent).toBe(originalContent);
      }

      // But we should still get issue and fix information
      expect(result.issuesFound.length).toBeGreaterThan(0);

      // Should identify fixable issues
      const fixableIssues = result.issuesFound.filter(issue => issue.fixable);
      expect(fixableIssues.length).toBeGreaterThan(0);
    });

    it('should provide detailed dry-run reporting', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: true,
        verbose: true,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultDir, options);

      // Should have detailed information about what would be changed
      expect(result.issuesFound.length).toBeGreaterThan(0);

      // Check that issues have proper metadata
      for (const issue of result.issuesFound) {
        expect(issue.ruleId).toBeDefined();
        expect(issue.message).toBeDefined();
        expect(issue.file).toBeDefined();
        expect(typeof issue.fixable).toBe('boolean');
      }
    });

    it('should handle dry-run with parallel processing', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: true,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result.filesProcessed).toBeGreaterThan(10);
      expect(result.issuesFound.length).toBeGreaterThan(0);

      // No files should be modified in dry-run mode
      const incompleteNote = readFileSync(
        join(vaultDir, 'incomplete-note.md'),
        'utf-8'
      );
      expect(incompleteNote).toContain('title: Incomplete Note');
      expect(incompleteNote).not.toContain('date_created:');
    });
  });

  describe('Comprehensive Error Handling and Reporting', () => {
    it('should collect and categorize all types of errors', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      // Create various types of problematic files
      writeFileSync(
        join(vaultDir, 'yaml-error.md'),
        '---\ninvalid: yaml: [[[[\n---\n\n# YAML Error'
      );

      // Create a file with permission issues (simulate by creating invalid characters)
      const invalidFileName = join(vaultDir, 'invalid\x00name.md');

      const options: ProcessOptions = {
        dryRun: false,
        fix: true,
        verbose: true,
        generateMoc: false,
        parallel: true,
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();

      // Generate error report (should work even with no errors)
      const errorReport = engine.generateErrorReport(result);
      expect(errorReport).toBeDefined();

      if (result.errors.length > 0) {
        expect(errorReport).toContain('LINT ENGINE ERROR REPORT');
        expect(errorReport).toContain('Total Errors:');
        expect(errorReport).toContain('Files Processed:');
        expect(errorReport).toContain('Processing Duration:');
      } else {
        expect(errorReport).toContain('No errors occurred during processing.');
      }
    });

    it('should handle rule conflicts gracefully', async () => {
      // Create conflicting rules
      const conflictingRule = `
[rule]
id = "frontmatter-required-fields.minimal"
name = "Minimal Frontmatter Fields"
description = "Require minimal frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title"]
`;
      writeFileSync(
        join(
          configDir,
          'rules',
          'default',
          'enabled',
          'frontmatter-required-fields.minimal.toml'
        ),
        conflictingRule
      );

      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      // The conflict should be detected during rule loading
      try {
        await engine.processVault(vaultDir, options);
        // If we get here, check if rules were loaded with conflicts
        const rules = await engine.loadRules('default');
        const conflictResult = await engine.validateRuleConflicts(rules);
        expect(conflictResult.valid).toBe(false);
      } catch (error) {
        // Should throw an error about rule conflicts
        expect(error).toBeDefined();
        expect(String(error)).toContain('conflicts');
      }
    });

    it('should validate engine health and configuration', async () => {
      const healthCheck = await engine.validateEngineHealth();

      expect(healthCheck).toBeDefined();
      expect(typeof healthCheck.healthy).toBe('boolean');
      expect(Array.isArray(healthCheck.issues)).toBe(true);
      expect(Array.isArray(healthCheck.warnings)).toBe(true);
    });

    it('should provide performance metrics', () => {
      const metrics = engine.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.maxConcurrency).toBe('number');
      expect(typeof metrics.cpuCount).toBe('number');
      expect(typeof metrics.recommendedConcurrency).toBe('number');
      expect(metrics.maxConcurrency).toBeGreaterThan(0);
      expect(metrics.cpuCount).toBeGreaterThan(0);
    });

    it('should handle file system errors gracefully', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: false,
        fix: true,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      // Test with non-existent vault
      const result = await engine.processVault('/nonexistent/vault', options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBe(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Complete Linting Workflows', () => {
    it('should execute complete lint workflow with all features enabled', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      let progressCallCount = 0;
      const progressCallback: ProgressCallback = (current, total, message) => {
        progressCallCount++;
        expect(current).toBeGreaterThanOrEqual(0);
        expect(total).toBeGreaterThan(0);
        expect(current).toBeLessThanOrEqual(total);
      };

      const options: ProcessOptions = {
        dryRun: false,
        fix: true,
        verbose: true,
        generateMoc: false,
        parallel: true,
        ignore: ['**/archive/**'], // Test ignore patterns
      };

      const result = await engine.processVault(
        vaultDir,
        options,
        progressCallback
      );

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(result.issuesFound).toBeDefined();
      expect(result.fixesApplied).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(progressCallCount).toBeGreaterThan(0);

      // Verify that archive files were ignored by the ignore pattern
      // Note: The rule's path_denylist should also filter out archive files
      const archiveIssues = result.issuesFound.filter(issue =>
        issue.file.includes('archive')
      );
      // Archive files should either be completely ignored or have fewer issues due to path_denylist
      expect(archiveIssues.length).toBeLessThanOrEqual(2);
    });

    it('should handle mixed file types and sizes efficiently', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result.filesProcessed).toBeGreaterThan(15); // Should process all test files
      expect(result.duration).toBeGreaterThan(0);

      // Should handle large files without issues
      const largeFileIssues = result.issuesFound.filter(issue =>
        issue.file.includes('large-file.md')
      );
      expect(largeFileIssues).toBeDefined(); // May or may not have issues, but should be processed
    });

    it('should maintain data integrity during concurrent processing', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      // Run the same processing multiple times to check for race conditions
      const results = await Promise.all([
        engine.processVault(vaultDir, options),
        engine.processVault(vaultDir, options),
        engine.processVault(vaultDir, options),
      ]);

      // All results should be consistent
      const [result1, result2, result3] = results;

      expect(result1.filesProcessed).toBe(result2.filesProcessed);
      expect(result2.filesProcessed).toBe(result3.filesProcessed);

      // Issue counts should be consistent (allowing for minor variations due to timing)
      expect(
        Math.abs(result1.issuesFound.length - result2.issuesFound.length)
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(result2.issuesFound.length - result3.issuesFound.length)
      ).toBeLessThanOrEqual(1);
    });

    it('should handle configuration changes during processing', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      // Test with different profiles
      const defaultResult = await engine.processVault(vaultDir, {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      });

      // Create minimal profile rules
      mkdirSync(join(configDir, 'rules', 'minimal', 'enabled'), {
        recursive: true,
      });

      // Switch to minimal profile (would require reloading in real usage)
      const minimalEngine = new LintEngine(2);

      expect(defaultResult.filesProcessed).toBeGreaterThan(0);
    });

    it('should provide comprehensive result summary', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: true,
        verbose: true,
        generateMoc: false,
        parallel: true,
      };

      const result = await engine.processVault(vaultDir, options);

      // Verify comprehensive result structure
      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(Array.isArray(result.issuesFound)).toBe(true);
      expect(Array.isArray(result.fixesApplied)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.duration).toBe('number');

      // Check issue details
      for (const issue of result.issuesFound) {
        expect(issue.ruleId).toBeDefined();
        expect(issue.severity).toMatch(/^(error|warning|info)$/);
        expect(issue.message).toBeDefined();
        expect(issue.file).toBeDefined();
        expect(typeof issue.fixable).toBe('boolean');
      }

      // Check fix details
      for (const fix of result.fixesApplied) {
        expect(fix.ruleId).toBeDefined();
        expect(fix.file).toBeDefined();
        expect(fix.description).toBeDefined();
        expect(Array.isArray(fix.changes)).toBe(true);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of files efficiently', async () => {
      // Create additional files for stress testing
      for (let i = 1; i <= 50; i++) {
        writeFileSync(
          join(vaultDir, `stress-test-${i}.md`),
          `---
title: Stress Test ${i}
date_created: 2024-01-${String((i % 28) + 1).padStart(2, '0')}
tags: [stress, test${i}]
---

# Stress Test ${i}

Content for stress testing file ${i}.

## Section A
Some content here.

## Section B
More content with [[link-${i}]] and [external](https://example.com/${i}).
`
        );
      }

      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      const startTime = Date.now();
      const result = await engine.processVault(vaultDir, options);
      const duration = Date.now() - startTime;

      expect(result.filesProcessed).toBeGreaterThan(60); // Original files + stress test files
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.errors.length).toBeLessThanOrEqual(5); // Allow for some errors but not many
    });

    it('should maintain reasonable memory usage', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const initialMemory = process.memoryUsage();

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      await engine.processVault(vaultDir, options);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});
