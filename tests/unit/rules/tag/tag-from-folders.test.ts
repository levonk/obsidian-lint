/**
 * Tag From Folders Rule Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TagFromFoldersHierarchicalRule,
  TagFromFoldersFlatRule,
  TagFromFoldersCustomRule,
  createTagFromFoldersRule,
} from '../../../../src/rules/tag/tag-from-folders.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('TagFromFoldersRule', () => {
  let config: RuleConfig;
  let mockFile: MarkdownFile;
  let context: RuleExecutionContext;

  beforeEach(() => {
    config = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: [],
      settings: {
        auto_fix: true,
        exclude_folders: ['.git', '.obsidian', 'Meta', 'Templates'],
        max_depth: 5,
        separator: '/',
        case_transform: 'lowercase',
        replace_spaces: true,
        space_replacement: '-',
      },
    };

    mockFile = {
      path: '/vault/Projects/Work/Client A/project-notes.md',
      content: `---
title: Project Notes
tags: []
---

# Project Notes

Some content here.`,
      frontmatter: {
        title: 'Project Notes',
        tags: [],
      },
      headings: [{ level: 1, text: 'Project Notes', line: 5 }],
      links: [],
      attachments: [],
    };

    context = {
      file: mockFile,
      vaultPath: '/vault',
      dryRun: false,
      verbose: false,
      metadata: {},
    };
  });

  describe('TagFromFoldersHierarchicalRule', () => {
    it('should create hierarchical tags from folder structure', async () => {
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain(
        'projects/work, projects/work/client-a'
      );
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].fixable).toBe(true);
    });

    it('should fix by adding hierarchical tags', async () => {
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].description).toContain(
        'Updated tags based on folder structure'
      );
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('replace');
    });

    it('should respect max_depth setting', async () => {
      config.settings.max_depth = 2;
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('projects/work');
      expect(issues[0].message).not.toContain('projects/work/client-a');
    });

    it('should exclude configured folders', async () => {
      mockFile.path = '/vault/Meta/Templates/template.md';
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle case transformation', async () => {
      config.settings.case_transform = 'uppercase';
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('PROJECTS/WORK');
    });

    it('should handle space replacement', async () => {
      mockFile.path = '/vault/My Projects/Work Items/note.md';
      config.settings.space_replacement = '_';
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('my_projects/work_items');
    });
  });

  describe('TagFromFoldersFlatRule', () => {
    it('should create flat tags from folder structure', async () => {
      const rule = new TagFromFoldersFlatRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('projects, work, client-a');
      expect(issues[0].severity).toBe('warning');
    });

    it('should fix by adding flat tags', async () => {
      const rule = new TagFromFoldersFlatRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].description).toContain(
        'Updated tags based on folder structure'
      );
    });

    it('should not duplicate existing tags', async () => {
      mockFile.frontmatter.tags = ['projects', 'existing-tag'];
      const rule = new TagFromFoldersFlatRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('work, client-a');
      expect(issues[0].message).not.toContain('projects');
    });
  });

  describe('TagFromFoldersCustomRule', () => {
    beforeEach(() => {
      config.settings.folder_mappings = {
        Projects: ['project', 'work-item'],
        Work: ['professional', 'business'],
        'Client*': ['client-work'],
        Personal: ['personal', 'private'],
      };
    });

    it('should use custom folder mappings', async () => {
      const rule = new TagFromFoldersCustomRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain(
        'project, work-item, professional, business, client-work'
      );
    });

    it('should handle pattern mappings with wildcards', async () => {
      mockFile.path = '/vault/Projects/Client XYZ/note.md';
      const rule = new TagFromFoldersCustomRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('client-work');
    });

    it('should fall back to folder name if no mapping exists', async () => {
      mockFile.path = '/vault/Unmapped/Folder/note.md';
      const rule = new TagFromFoldersCustomRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('unmapped, folder');
    });

    it('should remove duplicate tags from mappings', async () => {
      config.settings.folder_mappings = {
        Projects: ['work', 'project'],
        Work: ['work', 'business'],
      };
      const rule = new TagFromFoldersCustomRule(config);
      const issues = await rule.lint(context);

      // Should only contain 'work' once
      const tags = issues[0].message.match(/work/g);
      expect(tags).toHaveLength(1);
    });
  });

  describe('Factory function', () => {
    it('should create hierarchical rule', () => {
      const rule = createTagFromFoldersRule(
        'tag-from-folders.hierarchical',
        config
      );
      expect(rule).toBeInstanceOf(TagFromFoldersHierarchicalRule);
      expect(rule.id.full).toBe('tag-from-folders.hierarchical');
    });

    it('should create flat rule', () => {
      const rule = createTagFromFoldersRule('tag-from-folders.flat', config);
      expect(rule).toBeInstanceOf(TagFromFoldersFlatRule);
      expect(rule.id.full).toBe('tag-from-folders.flat');
    });

    it('should create custom rule', () => {
      const rule = createTagFromFoldersRule('tag-from-folders.custom', config);
      expect(rule).toBeInstanceOf(TagFromFoldersCustomRule);
      expect(rule.id.full).toBe('tag-from-folders.custom');
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createTagFromFoldersRule('tag-from-folders.unknown', config);
      }).toThrow(
        'Unknown tag-from-folders rule variant: tag-from-folders.unknown'
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle files in vault root', async () => {
      mockFile.path = '/vault/root-note.md';
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle files with no frontmatter', async () => {
      mockFile.frontmatter = {};
      mockFile.content = '# Just a heading\n\nSome content.';
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].fixable).toBe(true);
    });

    it('should handle non-array tags in frontmatter', async () => {
      mockFile.frontmatter.tags = 'single-tag';
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
    });

    it('should not fix when auto_fix is disabled', async () => {
      config.settings.auto_fix = false;
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(0);
    });

    it('should handle empty folder names', async () => {
      mockFile.path = '/vault//double-slash/note.md';
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).not.toContain('//');
    });

    it('should handle special characters in folder names', async () => {
      mockFile.path = '/vault/Folder with spaces & symbols!/note.md';
      const rule = new TagFromFoldersHierarchicalRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('folder-with-spaces-symbols');
    });
  });
});
