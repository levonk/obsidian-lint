/**
 * Tag From Context Rule Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TagFromContextAutomaticRule,
  TagFromContextManualRule,
  TagFromContextHybridRule,
  createTagFromContextRule,
} from '../../../../src/rules/tag/tag-from-context.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('TagFromContextRule', () => {
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
        min_word_frequency: 2,
        max_tags_per_note: 10,
        keyword_patterns: [],
        exclude_words: [
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
        case_transform: 'lowercase',
        content_analysis: {
          analyze_headings: true,
          analyze_links: true,
          analyze_bold_text: true,
          analyze_code_blocks: false,
        },
        manual_tag_markers: ['#tag:', 'tags:', 'keywords:'],
        context_weight: {
          headings: 3.0,
          links: 2.0,
          bold_text: 1.5,
          repeated_words: 1.0,
        },
      },
    };

    mockFile = {
      path: '/vault/project-management.md',
      content: `---
title: Project Management
tags: []
---

# Project Management Best Practices

This document covers **project management** methodologies and **agile development** practices.

## Scrum Framework

The scrum framework is essential for project management. Scrum involves:
- Sprint planning
- Daily standups
- Sprint reviews

## Kanban Methodology

Kanban is another project management approach that focuses on **continuous delivery**.

Links to related topics:
- [[Agile Development]]
- [[Team Collaboration]]
- [[Software Development]]

#tag: methodology, framework
tags: planning, organization`,
      frontmatter: {
        title: 'Project Management',
        tags: [],
      },
      headings: [
        { level: 1, text: 'Project Management Best Practices', line: 6 },
        { level: 2, text: 'Scrum Framework', line: 10 },
        { level: 2, text: 'Kanban Methodology', line: 17 },
      ],
      links: [
        { text: 'Agile Development', target: 'Agile Development', line: 22 },
        { text: 'Team Collaboration', target: 'Team Collaboration', line: 23 },
        {
          text: 'Software Development',
          target: 'Software Development',
          line: 24,
        },
      ],
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

  describe('TagFromContextAutomaticRule', () => {
    it('should suggest tags based on content analysis', async () => {
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Suggested context-based tags');
      expect(issues[0].message).toContain('project');
      expect(issues[0].message).toContain('management');
      expect(issues[0].severity).toBe('info');
    });

    it('should weight headings higher than regular content', async () => {
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      // Words from headings should have higher confidence scores
      expect(issues[0].message).toMatch(/project.*\([\d.]+\)/);
      expect(issues[0].message).toMatch(/management.*\([\d.]+\)/);
    });

    it('should analyze bold text with medium weight', async () => {
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('agile');
      expect(issues[0].message).toContain('development');
    });

    it('should analyze links with appropriate weight', async () => {
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('collaboration');
      expect(issues[0].message).toContain('software');
    });

    it('should fix by adding high-confidence tags', async () => {
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].description).toContain('Added context-based tags');
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('replace');
    });

    it('should respect max_tags_per_note setting', async () => {
      config.settings.max_tags_per_note = 3;
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        // Extract tags from the fix description
        const tagsAdded = fixes[0].description.match(
          /Added context-based tags: (.+)/
        )?.[1];
        if (tagsAdded) {
          const tagCount = tagsAdded.split(', ').length;
          expect(tagCount).toBeLessThanOrEqual(3);
        }
      }
    });

    it('should exclude common stop words', async () => {
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).not.toContain('the');
      expect(issues[0].message).not.toContain('and');
      expect(issues[0].message).not.toContain('for');
    });

    it('should respect min_word_frequency setting', async () => {
      config.settings.min_word_frequency = 5;
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      // With high frequency requirement, fewer tags should be suggested
      expect(issues).toHaveLength(0);
    });
  });

  describe('TagFromContextManualRule', () => {
    it('should extract manual tag markers', async () => {
      const rule = new TagFromContextManualRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('methodology');
      expect(issues[0].message).toContain('framework');
      expect(issues[0].message).toContain('planning');
      expect(issues[0].message).toContain('organization');
    });

    it('should fix by adding only manually marked tags', async () => {
      const rule = new TagFromContextManualRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].description).toContain(
        'methodology, framework, planning, organization'
      );
    });

    it('should handle multiple manual tag markers', async () => {
      mockFile.content += '\nkeywords: testing, quality\n#tag: automation';
      const rule = new TagFromContextManualRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('testing');
      expect(issues[0].message).toContain('quality');
      expect(issues[0].message).toContain('automation');
    });

    it('should ignore content-based suggestions in manual mode', async () => {
      // Remove manual markers
      mockFile.content = mockFile.content
        .replace(/#tag:.*\n/g, '')
        .replace(/tags:.*\n/g, '');
      const rule = new TagFromContextManualRule(config);
      const issues = await rule.lint(context);

      // Should not suggest automatic tags, only manual ones
      expect(issues).toHaveLength(0);
    });

    it('should handle comma and semicolon separated tags', async () => {
      mockFile.content = mockFile.content.replace(
        '#tag: methodology, framework',
        '#tag: methodology; framework, testing'
      );
      const rule = new TagFromContextManualRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('methodology');
      expect(issues[0].message).toContain('framework');
      expect(issues[0].message).toContain('testing');
    });
  });

  describe('TagFromContextHybridRule', () => {
    it('should combine manual and automatic tag suggestions', async () => {
      const rule = new TagFromContextHybridRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      // Should contain both manual tags and high-confidence automatic tags
      expect(issues[0].message).toContain('methodology'); // Manual
      expect(issues[0].message).toContain('framework'); // Manual
      expect(issues[0].message).toContain('project'); // Automatic
      expect(issues[0].message).toContain('management'); // Automatic
    });

    it('should prioritize manual tags over automatic ones', async () => {
      const rule = new TagFromContextHybridRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const addedTags = fixes[0].description;
        // Manual tags should be included
        expect(addedTags).toContain('methodology');
        expect(addedTags).toContain('framework');
      }
    });

    it('should apply different confidence thresholds', async () => {
      // Test with content that has low-frequency words
      mockFile.content =
        'This is a simple note with uncommon words like xenophobia and zygote.';
      const rule = new TagFromContextHybridRule(config);
      const issues = await rule.lint(context);

      // Low-frequency automatic tags should not be included
      expect(issues[0]?.message || '').not.toContain('xenophobia');
      expect(issues[0]?.message || '').not.toContain('zygote');
    });

    it('should handle mixed manual and automatic tags without duplicates', async () => {
      // Add manual tag that might also be suggested automatically
      mockFile.content += '\n#tag: project, management';
      const rule = new TagFromContextHybridRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const addedTags = fixes[0].description.toLowerCase();
        // Should not contain duplicates
        const projectMatches = (addedTags.match(/project/g) || []).length;
        const managementMatches = (addedTags.match(/management/g) || []).length;
        expect(projectMatches).toBeLessThanOrEqual(1);
        expect(managementMatches).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Factory function', () => {
    it('should create automatic rule', () => {
      const rule = createTagFromContextRule(
        'tag-from-context.automatic',
        config
      );
      expect(rule).toBeInstanceOf(TagFromContextAutomaticRule);
      expect(rule.id.full).toBe('tag-from-context.automatic');
    });

    it('should create manual rule', () => {
      const rule = createTagFromContextRule('tag-from-context.manual', config);
      expect(rule).toBeInstanceOf(TagFromContextManualRule);
      expect(rule.id.full).toBe('tag-from-context.manual');
    });

    it('should create hybrid rule', () => {
      const rule = createTagFromContextRule('tag-from-context.hybrid', config);
      expect(rule).toBeInstanceOf(TagFromContextHybridRule);
      expect(rule.id.full).toBe('tag-from-context.hybrid');
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createTagFromContextRule('tag-from-context.unknown', config);
      }).toThrow(
        'Unknown tag-from-context rule variant: tag-from-context.unknown'
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle files with no content', async () => {
      mockFile.content = '---\ntitle: Empty\ntags: []\n---\n';
      mockFile.headings = [];
      mockFile.links = [];
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should handle files with only code blocks when code analysis is disabled', async () => {
      mockFile.content = '```javascript\nconst project = "management";\n```';
      config.settings.content_analysis.analyze_code_blocks = false;
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      expect(issues).toHaveLength(0);
    });

    it('should not fix when auto_fix is disabled', async () => {
      config.settings.auto_fix = false;
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      expect(fixes).toHaveLength(0);
    });

    it('should handle existing tags without duplication', async () => {
      mockFile.frontmatter.tags = ['project', 'existing-tag'];
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);
      const fixes = await rule.fix(context, issues);

      if (fixes.length > 0) {
        const addedTags = fixes[0].description;
        expect(addedTags).not.toContain('project'); // Already exists
        expect(addedTags).toContain('management'); // Should be added
      }
    });

    it('should handle malformed manual tag markers', async () => {
      mockFile.content += '\n#tag:\ntags: \nkeywords: valid-tag';
      const rule = new TagFromContextManualRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('valid-tag');
      expect(issues[0].message).not.toContain('undefined');
    });

    it('should apply case transformation to suggested tags', async () => {
      config.settings.case_transform = 'uppercase';
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('PROJECT');
      expect(issues[0].message).toContain('MANAGEMENT');
    });

    it('should handle tag prefix setting', async () => {
      config.settings.tag_prefix = 'auto-';
      const rule = new TagFromContextAutomaticRule(config);
      const issues = await rule.lint(context);

      expect(issues[0].message).toContain('auto-project');
      expect(issues[0].message).toContain('auto-management');
    });
  });
});
