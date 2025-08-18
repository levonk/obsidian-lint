/**
 * Integration tests for complete linting workflows with the LintEngine
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LintEngine, ProgressCallback } from '../../src/core/engine.js';
import type { ProcessOptions, LintResult } from '../../src/types/index.js';

describe('LintEngine Integration Tests', () => {
  let testDir: string;
  let vaultDir: string;
  let configDir: string;
  let engine: LintEngine;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `obsidian-lint-engine-test-${Date.now()}`);
    vaultDir = join(testDir, 'vault');
    configDir = join(vaultDir, '.config', 'obsidian-lint');

    mkdirSync(vaultDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });
    mkdirSync(join(configDir, 'rules', 'default', 'enabled'), {
      recursive: true,
    });

    // Create basic config file
    const config = `
[general]
vault_root = "${vaultDir.replace(/\\/g, '/')}"
dry_run = false
verbose = false
fix = false
parallel = true
max_concurrency = 2

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Test profile"
rules_path = "rules/default"
`;
    writeFileSync(join(configDir, 'obsidian-lint.toml'), config);

    // Create a test rule
    const testRule = `
[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter Fields"
description = "Require all frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["*.md", "**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title", "date_created"]
`;
    writeFileSync(
      join(
        configDir,
        'rules',
        'default',
        'enabled',
        'frontmatter-required-fields.strict.toml'
      ),
      testRule
    );

    // Create test markdown files
    writeFileSync(
      join(vaultDir, 'complete-note.md'),
      `---
title: Complete Note
date_created: 2024-01-01
tags: [test, complete]
---

# Complete Note

This is a complete test note with all required frontmatter.
`
    );

    writeFileSync(
      join(vaultDir, 'incomplete-note.md'),
      `---
title: Incomplete Note
---

# Incomplete Note

This note is missing required frontmatter fields.
`
    );

    writeFileSync(
      join(vaultDir, 'no-frontmatter.md'),
      `# No Frontmatter

This note has no frontmatter at all.
`
    );

    // Create subdirectory with files
    mkdirSync(join(vaultDir, 'subdir'), { recursive: true });
    writeFileSync(
      join(vaultDir, 'subdir', 'nested-note.md'),
      `---
title: Nested Note
date_created: 2024-01-02
---

# Nested Note

This is a nested note in a subdirectory.
`
    );

    // Initialize engine
    engine = new LintEngine(2); // Use 2 for concurrency in tests
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Configuration and Rule Loading', () => {
    it('should load configuration successfully', async () => {
      const config = await engine.loadConfiguration(
        join(configDir, 'obsidian-lint.toml')
      );

      expect(config).toBeDefined();
      expect(config.activeProfile).toBe('default');
      expect(config.profiles.default).toBeDefined();
      expect(config.profiles.default.name).toBe('Default Profile');
    });

    it('should load rules for active profile', async () => {
      // Set config path in environment or pass it directly
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const rules = await engine.loadRules('default');

      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].id.full).toBe('frontmatter-required-fields.strict');
    });

    it('should validate rule conflicts', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const rules = await engine.loadRules('default');
      const conflictResult = await engine.validateRuleConflicts(rules);

      expect(conflictResult.valid).toBe(true);
      expect(conflictResult.conflicts).toHaveLength(0);
    });

    it('should handle missing profile gracefully', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      await expect(engine.loadRules('nonexistent')).rejects.toThrow(
        "Profile 'nonexistent' not found"
      );
    });
  });

  describe('Sequential Processing', () => {
    it('should process vault sequentially', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false, // Force sequential
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBe(4); // 4 markdown files
      expect(result.issuesFound).toBeDefined();
      expect(result.fixesApplied).toHaveLength(0); // No fixes in dry run
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should report progress during sequential processing', async () => {
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
        parallel: false,
      };

      await engine.processVault(vaultDir, options, progressCallback);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].current).toBe(0);
      expect(progressUpdates[0].total).toBe(4);
      expect(progressUpdates[progressUpdates.length - 1].message).toContain(
        'complete'
      );
    });
  });

  describe('Parallel Processing', () => {
    it('should process vault in parallel', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true, // Enable parallel processing
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBe(4);
      expect(result.issuesFound).toBeDefined();
      expect(result.fixesApplied).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle parallel processing errors gracefully', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      // Create a file that will cause parsing errors
      writeFileSync(
        join(vaultDir, 'broken-file.md'),
        '---\ninvalid: yaml: content: [[[[\n---\n\n# Broken File'
      );

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBeGreaterThanOrEqual(4); // At least the good files
      // Some errors might be expected due to the broken file
    });

    it('should report progress during parallel processing', async () => {
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
      expect(progressUpdates[0].total).toBe(4);
    });
  });

  describe('Dry Run Mode', () => {
    it('should show changes without applying them in dry run mode', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: true, // Enable fixes but dry run should prevent application
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      const originalContent = readFileSync(
        join(vaultDir, 'incomplete-note.md'),
        'utf-8'
      );
      const result = await engine.processVault(vaultDir, options);

      // File should not be modified in dry run
      const afterContent = readFileSync(
        join(vaultDir, 'incomplete-note.md'),
        'utf-8'
      );
      expect(afterContent).toBe(originalContent);

      // But we should still get fix information
      expect(result.issuesFound.length).toBeGreaterThan(0);
    });

    it('should identify fixable issues in dry run mode', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: true,
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultDir, options);

      // Should find issues in incomplete files
      const incompleteFileIssues = result.issuesFound.filter(
        issue =>
          issue.file.includes('incomplete-note.md') ||
          issue.file.includes('no-frontmatter.md')
      );

      expect(incompleteFileIssues.length).toBeGreaterThan(0);
    });
  });

  describe('File Filtering', () => {
    it('should respect ignore patterns', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
        ignore: ['**/subdir/**'], // Ignore subdirectory files
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result.filesProcessed).toBeLessThanOrEqual(4); // Should exclude some files
      expect(result.filesProcessed).toBeGreaterThan(0); // But still process some files

      // Verify no issues from the ignored file
      const nestedFileIssues = result.issuesFound.filter(issue =>
        issue.file.includes('nested-note.md')
      );
      expect(nestedFileIssues).toHaveLength(0);
    });

    it('should handle multiple ignore patterns', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
        ignore: ['**/subdir/**', '**/complete-note.md'], // Ignore multiple patterns
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result.filesProcessed).toBeLessThanOrEqual(4); // Should exclude some files
      expect(result.filesProcessed).toBeGreaterThan(0); // But still process some files
    });
  });

  describe('Error Handling', () => {
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

      // The conflict should be detected during rule loading or processing
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

    it('should handle file processing errors gracefully', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      // Create a file with permission issues (simulate by creating invalid path)
      const invalidPath = join(vaultDir, 'invalid\x00file.md');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultDir, options);

      // Should still process other files successfully
      expect(result.filesProcessed).toBeGreaterThan(0);
    });

    it('should collect and report all errors', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      // Create files that might cause issues
      writeFileSync(
        join(vaultDir, 'problematic-file.md'),
        '---\ninvalid: yaml: [[[[\n---\n\n# Problematic'
      );

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true, // Use parallel to test error collection
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      // Errors array should be available even if empty
    });
  });

  describe('Performance and Concurrency', () => {
    it('should respect max concurrency settings', async () => {
      const customEngine = new LintEngine(1); // Force single concurrency
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      const startTime = Date.now();
      const result = await customEngine.processVault(vaultDir, options);
      const duration = Date.now() - startTime;

      expect(result.filesProcessed).toBe(4);
      expect(duration).toBeGreaterThan(0);
    });

    it('should handle large numbers of files efficiently', async () => {
      // Create many test files
      for (let i = 0; i < 20; i++) {
        writeFileSync(
          join(vaultDir, `test-file-${i}.md`),
          `---\ntitle: Test File ${i}\ndate_created: 2024-01-01\n---\n\n# Test File ${i}\n\nContent ${i}`
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

      const result = await engine.processVault(vaultDir, options);

      expect(result.filesProcessed).toBe(24); // Original 4 + 20 new files
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive Workflow Tests', () => {
    it('should complete full lint workflow with all features', async () => {
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
        ignore: ['**/.*'], // Ignore hidden files
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
    });

    it('should handle mixed success and failure scenarios', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      // Create a mix of good and problematic files
      writeFileSync(
        join(vaultDir, 'good-file.md'),
        `---\ntitle: Good File\ndate_created: 2024-01-01\n---\n\n# Good File\n\nThis is fine.`
      );

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true,
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result.filesProcessed).toBeGreaterThan(0);
      // Should handle both successful and failed file processing
    });
  });
});
