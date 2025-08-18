/**
 * Tag Management Rules Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LintEngine } from '../../src/core/engine.js';
import { FileProcessor } from '../../src/utils/file-processor.js';
import type { Configuration } from '../../src/types/config.js';
import type { ProcessOptions } from '../../src/types/common.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('Tag Management Rules Integration', () => {
  let tempDir: string;
  let vaultPath: string;
  let engine: LintEngine;
  let fileProcessor: FileProcessor;

  beforeEach(async () => {
    // Create temporary directory for test vault
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-lint-test-'));
    vaultPath = tempDir;

    // Initialize engine and file processor
    engine = new LintEngine();
    fileProcessor = new FileProcessor();

    // Create test vault structure
    await fs.mkdir(path.join(vaultPath, 'Projects'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'Projects', 'Work'), {
      recursive: true,
    });
    await fs.mkdir(path.join(vaultPath, 'Projects', 'Personal'), {
      recursive: true,
    });
    await fs.mkdir(path.join(vaultPath, 'Meta'), { recursive: true });
    await fs.mkdir(
      path.join(
        vaultPath,
        '.config',
        'obsidian-lint',
        'rules',
        'default',
        'enabled',
        'tag'
      ),
      { recursive: true }
    );
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  d;
  escribe('Tag From Folders Rules', () => {
    beforeEach(async () => {
      // Create tag-from-folders rule configuration
      const ruleConfig = `
[rule]
id = "tag-from-folders.hierarchical"
name = "Hierarchical Folder Tags"
description = "Generate hierarchical tags based on folder structure"
category = "tag"

[config]
path_allowlist = ["**/*.md"]
path_denylist = ["Meta/**"]
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
auto_fix = true
exclude_folders = [".git", ".obsidian", "Meta", "Templates"]
max_depth = 5
separator = "/"
case_transform = "lowercase"
replace_spaces = true
space_replacement = "-"
`;

      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'tag',
          'tag-from-folders-hierarchical.toml'
        ),
        ruleConfig
      );

      // Create main configuration
      const mainConfig = `
[general]
vault_root = "${vaultPath}"
dry_run = false
verbose = false
fix = true

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Test profile"
rules_path = "rules/default"
`;

      await fs.mkdir(path.join(vaultPath, '.config', 'obsidian-lint'), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(vaultPath, '.config', 'obsidian-lint', 'obsidian-lint.toml'),
        mainConfig
      );
    });

    it('should generate hierarchical tags from folder structure', async () => {
      // Create test file in nested folder
      const testFile = `---
title: Project Notes
tags: []
---

# Project Notes

Some content about the project.`;

      const filePath = path.join(
        vaultPath,
        'Projects',
        'Work',
        'project-notes.md'
      );
      await fs.writeFile(filePath, testFile);

      // Load configuration and process vault
      const config = await engine.loadConfiguration(
        path.join(vaultPath, '.config', 'obsidian-lint', 'obsidian-lint.toml')
      );

      const options: ProcessOptions = {
        dryRun: false,
        fix: true,
        verbose: false,
        rules: undefined,
        ignore: undefined,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultPath, options);

      // Check that issues were found and fixed
      expect(result.issuesFound.length).toBeGreaterThan(0);
      expect(result.fixesApplied.length).toBeGreaterThan(0);

      // Verify the file was updated with hierarchical tags
      const updatedContent = await fs.readFile(filePath, 'utf-8');
      expect(updatedContent).toContain('projects/work');
      expect(updatedContent).toContain('projects');
    });

    it('should respect exclude_folders setting', async () => {
      // Create test file in excluded folder
      const testFile = `---
title: Template
tags: []
---

# Template

Template content.`;

      const filePath = path.join(vaultPath, 'Meta', 'template.md');
      await fs.writeFile(filePath, testFile);

      const config = await engine.loadConfiguration(
        path.join(vaultPath, '.config', 'obsidian-lint', 'obsidian-lint.toml')
      );

      const options: ProcessOptions = {
        dryRun: false,
        fix: true,
        verbose: false,
        rules: undefined,
        ignore: undefined,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultPath, options);

      // File in Meta folder should not be processed
      const updatedContent = await fs.readFile(filePath, 'utf-8');
      expect(updatedContent).toBe(testFile); // Should be unchanged
    });
  });
  describe('Tag Cleanup Rules', () => {
    beforeEach(async () => {
      // Create tag-cleanup rule configuration
      const ruleConfig = `
[rule]
id = "tag-cleanup.standard"
name = "Tag Cleanup"
description = "Remove redundant, unused, and inconsistent tags"
category = "tag"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
auto_fix = true
remove_duplicates = true
remove_empty_tags = true
normalize_case = true
target_case = "lowercase"
remove_invalid_characters = true
valid_tag_pattern = "^[a-zA-Z0-9_-]+$"
min_tag_length = 2
max_tag_length = 50
remove_numeric_only_tags = true
remove_common_words = true
common_words_list = ["the", "and", "or", "but", "in", "on", "at", "to", "for"]
`;

      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'tag',
          'tag-cleanup.toml'
        ),
        ruleConfig
      );

      // Create main configuration
      const mainConfig = `
[general]
vault_root = "${vaultPath}"
dry_run = false
verbose = false
fix = true

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Test profile"
rules_path = "rules/default"
`;

      await fs.writeFile(
        path.join(vaultPath, '.config', 'obsidian-lint', 'obsidian-lint.toml'),
        mainConfig
      );
    });

    it('should clean up redundant and invalid tags', async () => {
      // Create test file with problematic tags
      const testFile = `---
title: Test Note
tags: [Project, project, PROJECT, "invalid tag!", "", "123", "the", "and", "a"]
---

# Test Note

Content with problematic tags.`;

      const filePath = path.join(vaultPath, 'test-cleanup.md');
      await fs.writeFile(filePath, testFile);

      const config = await engine.loadConfiguration(
        path.join(vaultPath, '.config', 'obsidian-lint', 'obsidian-lint.toml')
      );

      const options: ProcessOptions = {
        dryRun: false,
        fix: true,
        verbose: false,
        rules: undefined,
        ignore: undefined,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultPath, options);

      // Check that tags were cleaned up
      const updatedContent = await fs.readFile(filePath, 'utf-8');

      // Should only contain one instance of "project" (lowercase)
      expect(updatedContent).toContain('project');
      expect(updatedContent).not.toContain('Project');
      expect(updatedContent).not.toContain('PROJECT');

      // Should not contain invalid tags
      expect(updatedContent).not.toContain('invalid tag!');
      expect(updatedContent).not.toContain('123');
      expect(updatedContent).not.toContain('the');
      expect(updatedContent).not.toContain('and');

      // Should not contain empty tags
      expect(updatedContent).not.toMatch(/tags:\s*\[.*"".*\]/);
    });

    it('should handle files with no tags gracefully', async () => {
      // Create test file without tags
      const testFile = `---
title: Simple Note
---

# Simple Note

Just some content.`;

      const filePath = path.join(vaultPath, 'simple-note.md');
      await fs.writeFile(filePath, testFile);

      const config = await engine.loadConfiguration(
        path.join(vaultPath, '.config', 'obsidian-lint', 'obsidian-lint.toml')
      );

      const options: ProcessOptions = {
        dryRun: false,
        fix: true,
        verbose: false,
        rules: undefined,
        ignore: undefined,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultPath, options);

      // File should remain unchanged
      const updatedContent = await fs.readFile(filePath, 'utf-8');
      expect(updatedContent).toBe(testFile);
    });
  });
});
