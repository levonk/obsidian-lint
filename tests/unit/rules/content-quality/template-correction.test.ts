/**
 * Tests for Template Correction Rules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TemplateCorrectionEnforceTemplatesRule,
  TemplateCorrectionSuggestTemplatesRule,
  TemplateCorrectionFlexibleRule,
  createTemplateCorrectionRule,
} from '../../../../src/rules/content-quality/template-correction.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Template Correction Rules', () => {
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

  describe('TemplateCorrectionEnforceTemplatesRule', () => {
    it('should create rule with correct ID', () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);

      expect(rule.id.major).toBe('template-correction');
      expect(rule.id.minor).toBe('enforce-templates');
      expect(rule.id.full).toBe('template-correction.enforce-templates');
      expect(rule.name).toBe('Template Correction Enforce');
      expect(rule.category).toBe('content-quality');
    });

    it('should detect missing template declaration in frontmatter', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'meeting-notes.md',
        content: '# Meeting Notes\n\n## Attendees\n\n## Agenda\n\nContent here',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Meeting Notes', line: 1 },
          { level: 2, text: 'Attendees', line: 3 },
          { level: 2, text: 'Agenda', line: 5 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(
        issues.some(
          issue =>
            issue.message.includes('Detected template type') &&
            issue.message.includes('no template declared')
        )
      ).toBe(true);
    });

    it('should suggest appropriate template based on content', async () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'project-planning.md',
        content:
          '# Project Plan\n\n## Objectives\n\n## Timeline\n\n## Resources',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Project Plan', line: 1 },
          { level: 2, text: 'Objectives', line: 3 },
          { level: 2, text: 'Timeline', line: 5 },
          { level: 2, text: 'Resources', line: 7 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(
        issues.some(issue => issue.message.includes('Consider using template'))
      ).toBe(true);
    });

    it('should detect missing required sections', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'meeting.md',
        content: '# Meeting Notes\n\n## Attendees\n\nContent here',
        frontmatter: { template: 'meeting-notes' },
        headings: [
          { level: 1, text: 'Meeting Notes', line: 1 },
          { level: 2, text: 'Attendees', line: 3 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should detect missing sections like Agenda, Discussion, Action Items, Next Steps
      expect(
        issues.some(issue => issue.message.includes('Missing required section'))
      ).toBe(true);
    });

    it('should validate template variables in frontmatter', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'daily-note.md',
        content: '# Daily Note\n\n## Tasks\n\n## Notes',
        frontmatter: { template: 'daily-note' },
        headings: [
          { level: 1, text: 'Daily Note', line: 1 },
          { level: 2, text: 'Tasks', line: 3 },
          { level: 2, text: 'Notes', line: 5 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should detect missing template variables like 'date'
      expect(
        issues.some(
          issue =>
            issue.message.includes('Template variable') &&
            issue.message.includes('not found in frontmatter')
        )
      ).toBe(true);
    });

    it('should detect unknown sections when not allowed', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'meeting.md',
        content:
          '# Meeting Notes\n\n## Attendees\n\n## Custom Section\n\n## Agenda',
        frontmatter: { template: 'meeting-notes' },
        headings: [
          { level: 1, text: 'Meeting Notes', line: 1 },
          { level: 2, text: 'Attendees', line: 3 },
          { level: 2, text: 'Custom Section', line: 5 },
          { level: 2, text: 'Agenda', line: 7 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(
        issues.some(
          issue =>
            issue.message.includes('Unknown section') &&
            issue.message.includes('Custom Section')
        )
      ).toBe(true);
    });

    it('should fix missing template declaration', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'meeting.md',
        content: '# Meeting Notes\n\n## Attendees\n\n## Agenda',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Meeting Notes', line: 1 },
          { level: 2, text: 'Attendees', line: 3 },
          { level: 2, text: 'Agenda', line: 5 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix!(mockContext, issues);

      expect(fixes.length).toBeGreaterThan(0);
      expect(
        fixes.some(fix =>
          fix.changes.some(change => change.newText?.includes('template:'))
        )
      ).toBe(true);
    });

    it('should add missing sections', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'meeting.md',
        content: '# Meeting Notes\n\n## Attendees\n\nContent',
        frontmatter: { template: 'meeting-notes' },
        headings: [
          { level: 1, text: 'Meeting Notes', line: 1 },
          { level: 2, text: 'Attendees', line: 3 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix!(mockContext, issues);

      expect(fixes.length).toBeGreaterThan(0);
      expect(
        fixes.some(fix =>
          fix.changes.some(
            change => change.type === 'insert' && change.newText?.includes('##')
          )
        )
      ).toBe(true);
    });
  });

  describe('TemplateCorrectionSuggestTemplatesRule', () => {
    it('should create rule with correct ID', () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);

      expect(rule.id.major).toBe('template-correction');
      expect(rule.id.minor).toBe('suggest-templates');
      expect(rule.id.full).toBe('template-correction.suggest-templates');
    });

    it('should suggest templates without enforcing', async () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'book-notes.md',
        content: '# Book Review\n\n## Summary\n\n## Rating\n\nContent',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Book Review', line: 1 },
          { level: 2, text: 'Summary', line: 3 },
          { level: 2, text: 'Rating', line: 5 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(
        issues.some(
          issue =>
            issue.message.includes('Consider using template') &&
            issue.severity === 'info'
        )
      ).toBe(true);
    });

    it('should not auto-fix by default', async () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'book-notes.md',
        content: '# Book Review\n\n## Summary',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Book Review', line: 1 },
          { level: 2, text: 'Summary', line: 3 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix!(mockContext, issues);

      expect(fixes).toHaveLength(0); // Should not auto-fix
    });
  });

  describe('TemplateCorrectionFlexibleRule', () => {
    it('should create rule with correct ID', () => {
      const rule = new TemplateCorrectionFlexibleRule(defaultConfig);

      expect(rule.id.major).toBe('template-correction');
      expect(rule.id.minor).toBe('flexible');
      expect(rule.id.full).toBe('template-correction.flexible');
    });

    it('should be very permissive with template requirements', async () => {
      const rule = new TemplateCorrectionFlexibleRule(defaultConfig);
      mockContext.file = {
        path: 'random-notes.md',
        content: '# Random Notes\n\n## Whatever\n\n## Custom Stuff',
        frontmatter: {},
        headings: [
          { level: 1, text: 'Random Notes', line: 1 },
          { level: 2, text: 'Whatever', line: 3 },
          { level: 2, text: 'Custom Stuff', line: 5 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should have minimal or no issues
      expect(issues.length).toBeLessThan(2);
    });
  });

  describe('Template Detection', () => {
    it('should detect meeting template from content patterns', async () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'weekly-sync.md',
        content:
          '# Weekly Sync\n\nAttendees: John, Jane\n\nAgenda items:\n- Item 1\n\nAction items:\n- [ ] Task 1',
        frontmatter: {},
        headings: [{ level: 1, text: 'Weekly Sync', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(
        issues.some(issue => issue.message.includes('Meeting Notes'))
      ).toBe(true);
    });

    it('should detect project template from content patterns', async () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'new-feature.md',
        content:
          '# New Feature\n\nObjectives:\n- Goal 1\n\nTimeline:\n- Phase 1\n\nResources needed:\n- Developer',
        frontmatter: {},
        headings: [{ level: 1, text: 'New Feature', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues.some(issue => issue.message.includes('Project Plan'))).toBe(
        true
      );
    });

    it('should detect daily note template from filename pattern', async () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);
      mockContext.file = {
        path: '2024-01-15.md',
        content:
          '# 2024-01-15\n\nTasks for today:\n- [ ] Task 1\n\nReflection:\nGood day',
        frontmatter: {},
        headings: [{ level: 1, text: '2024-01-15', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues.some(issue => issue.message.includes('Daily Note'))).toBe(
        true
      );
    });

    it('should detect book review template from content patterns', async () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'book-review.md',
        content:
          '# The Great Book\n\nAuthor: Famous Writer\n\nRating: 4/5\n\nSummary:\nGreat book about things.',
        frontmatter: {},
        headings: [{ level: 1, text: 'The Great Book', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues.some(issue => issue.message.includes('Book Review'))).toBe(
        true
      );
    });
  });

  describe('Section Order Validation', () => {
    it('should detect section order violations', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule({
        ...defaultConfig,
        settings: {
          section_order: ['Attendees', 'Agenda', 'Discussion', 'Action Items'],
        },
      });

      mockContext.file = {
        path: 'meeting.md',
        content: '# Meeting\n\n## Agenda\n\n## Attendees\n\n## Discussion',
        frontmatter: { template: 'meeting-notes' },
        headings: [
          { level: 1, text: 'Meeting', line: 1 },
          { level: 2, text: 'Agenda', line: 3 },
          { level: 2, text: 'Attendees', line: 5 },
          { level: 2, text: 'Discussion', line: 7 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(
        issues.some(issue =>
          issue.message.includes('appears out of expected order')
        )
      ).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create enforce-templates rule', () => {
      const rule = createTemplateCorrectionRule(
        'template-correction.enforce-templates',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(TemplateCorrectionEnforceTemplatesRule);
    });

    it('should create suggest-templates rule', () => {
      const rule = createTemplateCorrectionRule(
        'template-correction.suggest-templates',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(TemplateCorrectionSuggestTemplatesRule);
    });

    it('should create flexible rule', () => {
      const rule = createTemplateCorrectionRule(
        'template-correction.flexible',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(TemplateCorrectionFlexibleRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createTemplateCorrectionRule(
          'template-correction.unknown',
          defaultConfig
        );
      }).toThrow('Unknown template correction rule variant');
    });
  });

  describe('Edge Cases', () => {
    it('should handle file with no headings', async () => {
      const rule = new TemplateCorrectionSuggestTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'no-headings.md',
        content: 'Just some plain text content without any structure.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should handle gracefully without errors
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle empty content', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);
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

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle template with all required sections present', async () => {
      const rule = new TemplateCorrectionEnforceTemplatesRule(defaultConfig);
      mockContext.file = {
        path: 'complete-meeting.md',
        content:
          '# Meeting Notes\n\n## Attendees\n\n## Agenda\n\n## Discussion\n\n## Action Items\n\n## Next Steps',
        frontmatter: { template: 'meeting-notes' },
        headings: [
          { level: 1, text: 'Meeting Notes', line: 1 },
          { level: 2, text: 'Attendees', line: 3 },
          { level: 2, text: 'Agenda', line: 5 },
          { level: 2, text: 'Discussion', line: 7 },
          { level: 2, text: 'Action Items', line: 9 },
          { level: 2, text: 'Next Steps', line: 11 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should have minimal issues since all sections are present
      const sectionIssues = issues.filter(issue =>
        issue.message.includes('Missing required section')
      );
      expect(sectionIssues).toHaveLength(0);
    });
  });
});
