/**
 * Tag Based Paths Rule Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TagBasedPathsEnforceRule,
  TagBasedPathsSuggestRule,
  TagBasedPathsIgnoreRule,
  createTagBasedPathsRule,
} from '../../../../src/rules/tag/tag-based-paths.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('TagBasedPathsRule', () => {
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
        tag_to_path_mappings: {
          project: 'Projects',
          work: 'Work',
          personal: 'Personal',
        },
        path_template: '{primary_tag}/{secondary_tag}',
        primary_tag_priority: ['project', 'work', 'personal'],
        create_missing_directories: true,
        update_links: true,
        exclude_tags: ['meta', 'template', 'draft'],
        max_path_depth: 3,
        path_separator: '/',
        case_transform: 'lowercase',
        replace_spaces: true,
        space_replacement: '-',
      },
    };

    mockFile = {
      path: '/vault/random-location/project-notes.md',
      content: `---
title: Project Notes
tags: [project, client-work, urgent]
---

# Project Notes

Some content here.`,
      frontmatter: {
        title: 'Project Notes',
        tags: ['project', 'client-work', 'urgent'],
      },
      headings: [{ level: 1, text: 'Project Notes', line: 6 }],
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

  describe('TagBasedPathsEnforceRule', () => {
    it('should detect path mismatch and suggest correct path', async () => {
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain(
        'File must be moved to tag-based path'
      );
      expect(issues[0].message).toContain(
        'Projects/client-work/project-notes.md'
      );
      expect(issues[0].severity).toBe('error');
      expect(issues[0].fixable).toBe(true);
    });

    it('should fix by moving file to correct path', async () => {
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].description).toContain('Move file to tag-based path');
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('move');
      expect(fixes[0].changes[0].newPath).toBe(
        '/vault/Projects/client-work/project-notes.md'
      );
      expect(fixes[0].changes[0].updateLinks).toBe(true);
    });

    it('should use primary tag priority for path selection', async () => {
      mockFile.frontmatter.tags = ['urgent', 'work', 'project'];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      // Should use 'project' as primary tag due to priority
      expect(issues[0].message).toContain('Projects/work/project-notes.md');
    });

    it('should apply tag-to-path mappings', async () => {
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      // 'project' should map to 'Projects' directory
      expect(issues[0].message).toContain('Projects/');
    });

    it('should handle path template variables', async () => {
      config.settings.path_template = '{primary_tag}/archive/{filename}';
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain(
        'Projects/archive/project-notes/project-notes.md'
      );
    });

    it('should respect max_path_depth setting', async () => {
      config.settings.max_path_depth = 1;
      config.settings.path_template =
        '{primary_tag}/{secondary_tag}/{all_tags}';
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      // Should only use first path segment
      expect(issues[0].message).toContain('Projects/project-notes.md');
    });

    it('should exclude configured tags', async () => {
      mockFile.frontmatter.tags = ['meta', 'project', 'client-work'];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      // Should not use 'meta' tag in path
      expect(issues[0].message).not.toContain('meta');
      expect(issues[0].message).toContain('Projects/client-work');
    });

    it('should handle case transformation', async () => {
      config.settings.case_transform = 'uppercase';
      mockFile.frontmatter.tags = ['Project Management', 'client-work'];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('PROJECT-MANAGEMENT');
    });

    it('should handle space replacement', async () => {
      config.settings.space_replacement = '_';
      mockFile.frontmatter.tags = ['project management', 'client work'];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('project_management');
      expect(issues[0].message).toContain('client_work');
    });

    it('should not create issues when file is already in correct location', async () => {
      mockFile.path = '/vault/Projects/client-work/project-notes.md';
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });
  });

  describe('TagBasedPathsSuggestRule', () => {
    it('should suggest path changes with info severity', async () => {
      const rule = new TagBasedPathsSuggestRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain(
        'Consider moving file to tag-based path'
      );
      expect(issues[0].severity).toBe('info');
      expect(issues[0].fixable).toBe(false);
    });

    it('should not provide auto-fix in suggest mode', async () => {
      const rule = new TagBasedPathsSuggestRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(0);
    });

    it('should still calculate expected paths correctly', async () => {
      const rule = new TagBasedPathsSuggestRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain(
        'Projects/client-work/project-notes.md'
      );
    });
  });

  describe('TagBasedPathsIgnoreRule', () => {
    it('should not create any issues', async () => {
      const rule = new TagBasedPathsIgnoreRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should not provide any fixes', async () => {
      const rule = new TagBasedPathsIgnoreRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(0);
    });
  });

  describe('Factory function', () => {
    it('should create enforce rule', () => {
      const rule = createTagBasedPathsRule('tag-based-paths.enforce', config);
      expect(rule).toBeInstanceOf(TagBasedPathsEnforceRule);
      expect(rule.id.full).toBe('tag-based-paths.enforce');
    });

    it('should create suggest rule', () => {
      const rule = createTagBasedPathsRule('tag-based-paths.suggest', config);
      expect(rule).toBeInstanceOf(TagBasedPathsSuggestRule);
      expect(rule.id.full).toBe('tag-based-paths.suggest');
    });

    it('should create ignore rule', () => {
      const rule = createTagBasedPathsRule('tag-based-paths.ignore', config);
      expect(rule).toBeInstanceOf(TagBasedPathsIgnoreRule);
      expect(rule.id.full).toBe('tag-based-paths.ignore');
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createTagBasedPathsRule('tag-based-paths.unknown', config);
      }).toThrow(
        'Unknown tag-based-paths rule variant: tag-based-paths.unknown'
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle files with no tags', async () => {
      mockFile.frontmatter.tags = [];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle files with only excluded tags', async () => {
      mockFile.frontmatter.tags = ['meta', 'template', 'draft'];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle non-array tags in frontmatter', async () => {
      mockFile.frontmatter.tags = 'project';
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Projects');
    });

    it('should handle missing frontmatter', async () => {
      mockFile.frontmatter = {};
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should not fix when auto_fix is disabled', async () => {
      config.settings.auto_fix = false;
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(0);
    });

    it('should handle tags with special characters', async () => {
      mockFile.frontmatter.tags = [
        'project/management',
        'client:work',
        'urgent!',
      ];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      // Special characters should be removed from path
      expect(issues[0].message).not.toContain('/management');
      expect(issues[0].message).not.toContain(':work');
      expect(issues[0].message).not.toContain('urgent!');
    });

    it('should handle empty path template variables', async () => {
      config.settings.path_template = '{primary_tag}/{secondary_tag}';
      mockFile.frontmatter.tags = ['project']; // Only one tag
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      // Should handle missing secondary tag gracefully
      expect(issues[0].message).toContain('Projects/project-notes.md');
    });

    it('should handle complex path templates', async () => {
      config.settings.path_template =
        'Archive/{primary_tag}/Year-2024/{filename}-backup';
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain(
        'Archive/Projects/Year-2024/project-notes-backup/project-notes.md'
      );
    });

    it('should handle tags that match exclude patterns', async () => {
      mockFile.frontmatter.tags = [
        'project',
        'meta-analysis',
        'template-based',
      ];
      config.settings.exclude_tags = ['meta*', 'template*'];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      // Should only use 'project' tag
      expect(issues[0].message).toContain('Projects/project-notes.md');
    });

    it('should handle very long tag names', async () => {
      const longTag =
        'very-long-tag-name-that-exceeds-normal-length-limits-and-should-be-handled-gracefully';
      mockFile.frontmatter.tags = ['project', longTag];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain(longTag);
    });

    it('should handle duplicate tags', async () => {
      mockFile.frontmatter.tags = [
        'project',
        'project',
        'client-work',
        'client-work',
      ];
      const rule = new TagBasedPathsEnforceRule(config);
      const issues = await rule.lint(context);

      // Should handle duplicates without issues
      expect(issues[0].message).toContain('Projects/client-work');
    });
  });
});
