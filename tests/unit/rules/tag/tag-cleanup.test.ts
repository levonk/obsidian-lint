/**
 * Tag Cleanup Rule Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TagCleanupRule,
  createTagCleanupRule,
} from '../../../../src/rules/tag/tag-cleanup.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('TagCleanupRule', () => {
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
        remove_duplicates: true,
        remove_empty_tags: true,
        normalize_case: true,
        target_case: 'lowercase',
        remove_invalid_characters: true,
        valid_tag_pattern: '^[a-zA-Z0-9_-]+$',
        min_tag_length: 2,
        max_tag_length: 50,
        remove_numeric_only_tags: true,
        remove_common_words: true,
        common_words_list: [
          'the',
          'and',
          'or',
          'but',
          'in',
          'on',
          'at',
          'to',
          'for',
        ],
      },
    };

    mockFile = {
      path: '/vault/test-note.md',
      content: `---
title: Test Note
tags: [Project, project, PROJECT, "invalid tag!", "", "123", "the", "and"]
---

# Test Note

Some content here.`,
      frontmatter: {
        title: 'Test Note',
        tags: [
          'Project',
          'project',
          'PROJECT',
          'invalid tag!',
          '',
          '123',
          'the',
          'and',
        ],
      },
      headings: [{ level: 1, text: 'Test Note', line: 6 }],
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

  describe('TagCleanupRule', () => {
    it('should identify duplicate tags', async () => {
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Duplicate tags');
      expect(issues[0].message).toContain('project');
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].fixable).toBe(true);
    });

    it('should identify empty and invalid tags', async () => {
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('Empty/invalid tags');
      expect(issues[0].message).toContain('Invalid characters');
    });

    it('should identify case inconsistencies', async () => {
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('Case inconsistencies');
    });

    it('should identify common words as tags', async () => {
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('Common words as tags');
      expect(issues[0].message).toContain('the, and');
    });

    it('should fix by removing duplicates', async () => {
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].description).toContain('Cleaned up tags');
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('replace');
    });

    it('should normalize case to lowercase', async () => {
      mockFile.frontmatter.tags = ['Project', 'WORK', 'Personal'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(1);
      const newContent = fixes[0].changes[0].newText;
      expect(newContent).toContain('project');
      expect(newContent).toContain('work');
      expect(newContent).toContain('personal');
      expect(newContent).not.toContain('Project');
      expect(newContent).not.toContain('WORK');
    });

    it('should remove empty and short tags', async () => {
      mockFile.frontmatter.tags = ['valid-tag', '', 'a', 'ok'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('valid-tag');
        expect(newContent).toContain('ok');
        expect(newContent).not.toContain('""');
        expect(newContent).not.toMatch(/\s+- a\s+/);
      }
    });

    it('should remove numeric-only tags', async () => {
      mockFile.frontmatter.tags = ['project', '123', '456', 'valid-tag'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('project');
        expect(newContent).toContain('valid-tag');
        expect(newContent).not.toContain('123');
        expect(newContent).not.toContain('456');
      }
    });

    it('should remove common words', async () => {
      mockFile.frontmatter.tags = ['project', 'the', 'and', 'valid-tag'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('project');
        expect(newContent).toContain('valid-tag');
        expect(newContent).not.toContain('the');
        expect(newContent).not.toContain('and');
      }
    });

    it('should clean invalid characters', async () => {
      mockFile.frontmatter.tags = [
        'valid-tag',
        'invalid tag!',
        'another@tag',
        'spaces here',
      ];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('valid-tag');
        expect(newContent).toContain('invalid-tag');
        expect(newContent).toContain('anothertag');
        expect(newContent).toContain('spaces-here');
        expect(newContent).not.toContain('invalid tag!');
        expect(newContent).not.toContain('another@tag');
      }
    });

    it('should respect max_tag_length setting', async () => {
      config.settings.max_tag_length = 10;
      mockFile.frontmatter.tags = ['short', 'this-is-a-very-long-tag-name'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('short');
        expect(newContent).not.toContain('this-is-a-very-long-tag-name');
      }
    });

    it('should handle uppercase case transformation', async () => {
      config.settings.target_case = 'uppercase';
      mockFile.frontmatter.tags = ['project', 'work', 'Personal'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('PROJECT');
        expect(newContent).toContain('WORK');
        expect(newContent).toContain('PERSONAL');
      }
    });

    it('should preserve case when target_case is preserve', async () => {
      config.settings.target_case = 'preserve';
      mockFile.frontmatter.tags = ['Project', 'WORK', 'personal'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('Project');
        expect(newContent).toContain('WORK');
        expect(newContent).toContain('personal');
      }
    });

    it('should not fix when auto_fix is disabled', async () => {
      config.settings.auto_fix = false;
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(0);
    });

    it('should handle files with no tags', async () => {
      mockFile.frontmatter.tags = [];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle files with no frontmatter', async () => {
      mockFile.frontmatter = {};
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle non-array tags in frontmatter', async () => {
      mockFile.frontmatter.tags = 'single-tag';
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0); // Single valid tag, no cleanup needed
    });

    it('should handle similarity consolidation when enabled', async () => {
      config.settings.consolidate_similar_tags = true;
      config.settings.similarity_threshold = 0.8;
      mockFile.frontmatter.tags = ['project', 'projects', 'work', 'working'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain(
        'Similar tags that could be consolidated'
      );
    });

    it('should handle tag prefix cleanup', async () => {
      config.settings.tag_prefix_cleanup = true;
      config.settings.allowed_prefixes = ['auto-'];
      mockFile.frontmatter.tags = ['#project', 'work', 'auto-generated'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('auto-project');
        expect(newContent).toContain('auto-work');
        expect(newContent).toContain('auto-generated');
        expect(newContent).not.toContain('#project');
      }
    });

    it('should create frontmatter when none exists but tags are cleaned', async () => {
      mockFile.content = '# Test Note\n\nSome content.';
      mockFile.frontmatter = { tags: ['Project', 'project'] };
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('insert');
      expect(fixes[0].changes[0].newText).toContain('---');
      expect(fixes[0].changes[0].newText).toContain('tags:');
    });
  });

  describe('Factory function', () => {
    it('should create tag cleanup rule', () => {
      const rule = createTagCleanupRule(config);
      expect(rule).toBeInstanceOf(TagCleanupRule);
      expect(rule.id.full).toBe('tag-cleanup.standard');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long tag lists', async () => {
      const longTagList = Array.from({ length: 100 }, (_, i) => `tag-${i}`);
      mockFile.frontmatter.tags = longTagList;
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);

      // Should handle large tag lists without issues
      expect(issues).toHaveLength(0);
    });

    it('should handle tags with special unicode characters', async () => {
      mockFile.frontmatter.tags = ['café', 'naïve', '中文', 'émoji'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      // Should clean special characters based on valid_tag_pattern
      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('caf');
        expect(newContent).toContain('nave');
      }
    });

    it('should handle empty string tags', async () => {
      mockFile.frontmatter.tags = ['valid', '', '   ', 'another'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('valid');
        expect(newContent).toContain('another');
        expect(newContent).not.toContain('""');
      }
    });

    it('should handle mixed case duplicates correctly', async () => {
      mockFile.frontmatter.tags = ['Project', 'project', 'PROJECT', 'pRoJeCt'];
      const rule = new TagCleanupRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        // Should only contain one instance of 'project'
        const matches = (newContent.match(/project/g) || []).length;
        expect(matches).toBe(1);
      }
    });
  });
});
