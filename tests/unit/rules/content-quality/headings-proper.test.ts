/**
 * Tests for Headings Proper Rules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HeadingsProperTitleMatchRule,
  HeadingsProperHierarchyEnforcedRule,
  HeadingsProperFlexibleRule,
  createHeadingsProperRule,
} from '../../../../src/rules/content-quality/headings-proper.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Headings Proper Rules', () => {
  let defaultConfig: RuleConfig;
  let mockContext: RuleExecutionContext;

  beforeEach(() => {
    defaultConfig = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: [],
      settings: {},
    };

    mockContext = {
      file: {} as MarkdownFile,
      vaultPath: '/test/vault',
      dryRun: false,
      verbose: false,
      metadata: {},
    };
  });

  describe('HeadingsProperTitleMatchRule', () => {
    it('should create rule with correct ID', () => {
      const rule = new HeadingsProperTitleMatchRule(defaultConfig);

      expect(rule.id.major).toBe('headings-proper');
      expect(rule.id.minor).toBe('title-match');
      expect(rule.id.full).toBe('headings-proper.title-match');
      expect(rule.name).toBe('Headings Title Match');
      expect(rule.category).toBe('content-quality');
    });

    it('should detect missing H1 heading', async () => {
      const rule = new HeadingsProperTitleMatchRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: 'Some content without headings',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain(
        'Document should have at least one heading'
      );
      expect(issues[0].severity).toBe('warning');
    });

    it('should detect title mismatch between H1 and frontmatter', async () => {
      const rule = new HeadingsProperTitleMatchRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: '# Different Title\n\nContent here',
        frontmatter: { title: 'Original Title' },
        headings: [{ level: 1, text: 'Different Title', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('does not match frontmatter title');
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].line).toBe(1);
    });

    it('should detect multiple H1 headings', async () => {
      const rule = new HeadingsProperTitleMatchRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: '# First Title\n\n# Second Title\n\nContent',
        frontmatter: {},
        headings: [
          { level: 1, text: 'First Title', line: 1 },
          { level: 1, text: 'Second Title', line: 3 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('should have only one H1 heading');
      expect(issues[0].line).toBe(3);
    });

    it('should detect empty headings', async () => {
      const rule = new HeadingsProperTitleMatchRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: '# \n\n## Valid Heading\n\nContent',
        frontmatter: {},
        headings: [
          { level: 1, text: '', line: 1 },
          { level: 2, text: 'Valid Heading', line: 3 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Empty heading found');
      expect(issues[0].severity).toBe('error');
      expect(issues[0].line).toBe(1);
    });

    it('should fix title mismatch by updating H1', async () => {
      const rule = new HeadingsProperTitleMatchRule({
        ...defaultConfig,
        settings: { auto_fix: true },
      });

      mockContext.file = {
        path: 'test.md',
        content: '# Different Title\n\nContent here',
        frontmatter: { title: 'Correct Title' },
        headings: [{ level: 1, text: 'Different Title', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix!(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('replace');
      expect(fixes[0].changes[0].newText).toBe('# Correct Title');
    });

    it('should add missing H1 heading', async () => {
      const rule = new HeadingsProperTitleMatchRule({
        ...defaultConfig,
        settings: { auto_fix: true },
      });

      mockContext.file = {
        path: 'test.md',
        content: 'Content without heading',
        frontmatter: { title: 'Test Title' },
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix!(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('insert');
      expect(fixes[0].changes[0].newText).toContain('# Test Title');
    });
  });

  describe('HeadingsProperHierarchyEnforcedRule', () => {
    it('should create rule with correct ID', () => {
      const rule = new HeadingsProperHierarchyEnforcedRule(defaultConfig);

      expect(rule.id.major).toBe('headings-proper');
      expect(rule.id.minor).toBe('hierarchy-enforced');
      expect(rule.id.full).toBe('headings-proper.hierarchy-enforced');
    });

    it('should detect heading hierarchy violations', async () => {
      const rule = new HeadingsProperHierarchyEnforcedRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: '# Title\n\n### Skipped Level\n\nContent',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Title', line: 1 },
          { level: 3, text: 'Skipped Level', line: 3 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Heading hierarchy violation');
      expect(issues[0].message).toContain('H3 follows H1');
      expect(issues[0].line).toBe(3);
    });

    it('should validate proper heading hierarchy', async () => {
      const rule = new HeadingsProperHierarchyEnforcedRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: '# Title\n\n## Section\n\n### Subsection\n\nContent',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Title', line: 1 },
          { level: 2, text: 'Section', line: 3 },
          { level: 3, text: 'Subsection', line: 5 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(0);
    });
  });

  describe('HeadingsProperFlexibleRule', () => {
    it('should create rule with correct ID and flexible settings', () => {
      const rule = new HeadingsProperFlexibleRule(defaultConfig);

      expect(rule.id.major).toBe('headings-proper');
      expect(rule.id.minor).toBe('flexible');
      expect(rule.id.full).toBe('headings-proper.flexible');
    });

    it('should be more lenient with heading requirements', async () => {
      const rule = new HeadingsProperFlexibleRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: '### Starting with H3\n\n# H1 Later\n\nContent',
        frontmatter: { title: 'Different Title' },
        headings: [
          { level: 3, text: 'Starting with H3', line: 1 },
          { level: 1, text: 'H1 Later', line: 3 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Flexible rule should be more permissive
      expect(issues.length).toBeLessThan(3); // Fewer issues than strict rules
    });
  });

  describe('Title Case Functionality', () => {
    it('should detect non-title case headings when enabled', async () => {
      const rule = new HeadingsProperTitleMatchRule({
        ...defaultConfig,
        settings: { title_case: true },
      });

      mockContext.file = {
        path: 'test.md',
        content: '# this is not title case\n\nContent',
        frontmatter: {},
        headings: [{ level: 1, text: 'this is not title case', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(
        issues.some(issue => issue.message.includes('should use title case'))
      ).toBe(true);
    });

    it('should fix title case when auto_fix is enabled', async () => {
      const rule = new HeadingsProperTitleMatchRule({
        ...defaultConfig,
        settings: { title_case: true, auto_fix: true },
      });

      mockContext.file = {
        path: 'test.md',
        content: '# this is not title case\n\nContent',
        frontmatter: {},
        headings: [{ level: 1, text: 'this is not title case', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);
      const titleCaseIssues = issues.filter(issue =>
        issue.message.includes('should use title case')
      );

      if (titleCaseIssues.length > 0) {
        const fixes = await rule.fix!(mockContext, titleCaseIssues);
        expect(fixes).toHaveLength(1);
        expect(fixes[0].changes[0].newText).toBe('# This Is Not Title Case');
      }
    });
  });

  describe('Factory Function', () => {
    it('should create title-match rule', () => {
      const rule = createHeadingsProperRule(
        'headings-proper.title-match',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(HeadingsProperTitleMatchRule);
    });

    it('should create hierarchy-enforced rule', () => {
      const rule = createHeadingsProperRule(
        'headings-proper.hierarchy-enforced',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(HeadingsProperHierarchyEnforcedRule);
    });

    it('should create flexible rule', () => {
      const rule = createHeadingsProperRule(
        'headings-proper.flexible',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(HeadingsProperFlexibleRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createHeadingsProperRule('headings-proper.unknown', defaultConfig);
      }).toThrow('Unknown headings proper rule variant');
    });
  });

  describe('Edge Cases', () => {
    it('should handle file with no content', async () => {
      const rule = new HeadingsProperTitleMatchRule(defaultConfig);
      mockContext.file = {
        path: 'empty.md',
        content: '',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('should have at least one heading');
    });

    it('should handle maximum heading level validation', async () => {
      const rule = new HeadingsProperTitleMatchRule({
        ...defaultConfig,
        settings: { max_heading_level: 3 },
      });

      mockContext.file = {
        path: 'test.md',
        content: '# Title\n\n#### Too Deep\n\nContent',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Title', line: 1 },
          { level: 4, text: 'Too Deep', line: 3 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(
        issues.some(issue =>
          issue.message.includes('exceeds maximum allowed level')
        )
      ).toBe(true);
    });
  });
});
