/**
 * Integration Tests for Content Quality Rules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHeadingsProperRule,
  createSpellCorrectionRule,
  createTemplateCorrectionRule,
} from '../../src/rules/content-quality/index.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../src/types/rules.js';
import type { MarkdownFile } from '../../src/types/common.js';

describe('Content Quality Rules Integration', () => {
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

  describe('Combined Rule Execution', () => {
    it('should run all content quality rules on a complex document', async () => {
      const headingsRule = createHeadingsProperRule(
        'headings-proper.title-match',
        defaultConfig
      );
      const spellRule = createSpellCorrectionRule(
        'spell-correction.suggest-only',
        defaultConfig
      );
      const templateRule = createTemplateCorrectionRule(
        'template-correction.suggest-templates',
        defaultConfig
      );

      mockContext.file = {
        path: 'meeting-notes.md',
        content: `# Meeting Notez

## Attendees
- John Doe
- Jane Smith

## Agenda
This is teh agenda for our meeting.

### Item 1
Discuss the recieve process.

### Item 2
Review the project timeline.

## Discussion
We talked about various things.

## Action Items
- [ ] Fix the speling errors
- [ ] Update documentation

## Next Steps
Follow up next week.`,
        frontmatter: { title: 'Meeting Notes' },
        headings: [
          { level: 1, text: 'Meeting Notez', line: 1 },
          { level: 2, text: 'Attendees', line: 3 },
          { level: 2, text: 'Agenda', line: 7 },
          { level: 3, text: 'Item 1', line: 10 },
          { level: 3, text: 'Item 2', line: 13 },
          { level: 2, text: 'Discussion', line: 16 },
          { level: 2, text: 'Action Items', line: 19 },
          { level: 2, text: 'Next Steps', line: 23 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      // Run all rules
      const headingIssues = await headingsRule.lint(mockContext);
      const spellIssues = await spellRule.lint(mockContext);
      const templateIssues = await templateRule.lint(mockContext);

      // Verify each rule type found issues
      expect(headingIssues.length).toBeGreaterThan(0);
      expect(spellIssues.length).toBeGreaterThan(0);
      expect(templateIssues.length).toBeGreaterThan(0);

      // Verify specific issues
      expect(
        headingIssues.some(issue =>
          issue.message.includes('does not match frontmatter title')
        )
      ).toBe(true);

      expect(
        spellIssues.some(
          issue =>
            issue.message.includes('teh') ||
            issue.message.includes('recieve') ||
            issue.message.includes('speling')
        )
      ).toBe(true);

      expect(
        templateIssues.some(
          issue =>
            issue.message.includes('template') ||
            issue.message.includes('Meeting Notes')
        )
      ).toBe(true);
    });

    it('should handle rules with different severity levels', async () => {
      const headingsRule = createHeadingsProperRule(
        'headings-proper.hierarchy-enforced',
        defaultConfig
      );
      const spellRule = createSpellCorrectionRule(
        'spell-correction.auto-fix',
        defaultConfig
      );
      const templateRule = createTemplateCorrectionRule(
        'template-correction.enforce-templates',
        defaultConfig
      );

      mockContext.file = {
        path: 'problematic.md',
        content: `# Title

#### Skipped Levels

This has teh spelling error.

## Random Section`,
        frontmatter: {},
        headings: [
          { level: 1, text: 'Title', line: 1 },
          { level: 4, text: 'Skipped Levels', line: 3 },
          { level: 2, text: 'Random Section', line: 7 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const headingIssues = await headingsRule.lint(mockContext);
      const spellIssues = await spellRule.lint(mockContext);
      const templateIssues = await templateRule.lint(mockContext);

      // Check severity levels
      expect(headingIssues.some(issue => issue.severity === 'warning')).toBe(
        true
      );
      expect(spellIssues.some(issue => issue.severity === 'info')).toBe(true);
      expect(templateIssues.some(issue => issue.severity === 'info')).toBe(
        true
      );
    });

    it('should handle auto-fix capabilities across rules', async () => {
      const headingsRule = createHeadingsProperRule(
        'headings-proper.title-match',
        {
          ...defaultConfig,
          settings: { auto_fix: true },
        }
      );

      const spellRule = createSpellCorrectionRule(
        'spell-correction.auto-fix',
        defaultConfig
      );

      const templateRule = createTemplateCorrectionRule(
        'template-correction.enforce-templates',
        defaultConfig
      );

      mockContext.file = {
        path: 'fixable.md',
        content: `# Wrong Title

This has teh error.`,
        frontmatter: { title: 'Correct Title' },
        headings: [{ level: 1, text: 'Wrong Title', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      // Get issues and fixes
      const headingIssues = await headingsRule.lint(mockContext);
      const spellIssues = await spellRule.lint(mockContext);
      const templateIssues = await templateRule.lint(mockContext);

      const headingFixes = await headingsRule.fix!(mockContext, headingIssues);
      const spellFixes = await spellRule.fix!(mockContext, spellIssues);
      const templateFixes = await templateRule.fix!(
        mockContext,
        templateIssues
      );

      // Verify fixes are available
      expect(headingFixes.length).toBeGreaterThan(0);
      expect(spellFixes.length).toBeGreaterThan(0);

      // Verify fix content
      expect(headingFixes[0].changes[0].newText).toBe('# Correct Title');
      expect(spellFixes[0].changes[0].newText).toContain('the');
    });
  });

  describe('Rule Interaction and Conflicts', () => {
    it('should handle overlapping rule concerns gracefully', async () => {
      const headingsRule = createHeadingsProperRule(
        'headings-proper.title-match',
        {
          ...defaultConfig,
          settings: { title_case: true },
        }
      );

      const spellRule = createSpellCorrectionRule(
        'spell-correction.suggest-only',
        {
          ...defaultConfig,
          settings: { check_headings: true },
        }
      );

      mockContext.file = {
        path: 'overlap.md',
        content: `# this has teh error

Content here.`,
        frontmatter: { title: 'This Has The Error' },
        headings: [{ level: 1, text: 'this has teh error', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const headingIssues = await headingsRule.lint(mockContext);
      const spellIssues = await spellRule.lint(mockContext);

      // Both rules should detect issues in the heading
      expect(
        headingIssues.some(
          issue =>
            issue.message.includes('title case') ||
            issue.message.includes('does not match')
        )
      ).toBe(true);

      expect(spellIssues.some(issue => issue.message.includes('teh'))).toBe(
        true
      );
    });

    it('should handle template and heading rule interactions', async () => {
      const headingsRule = createHeadingsProperRule(
        'headings-proper.hierarchy-enforced',
        defaultConfig
      );
      const templateRule = createTemplateCorrectionRule(
        'template-correction.enforce-templates',
        defaultConfig
      );

      mockContext.file = {
        path: 'meeting.md',
        content: `# Meeting Notes

#### Deep Section

## Attendees`,
        frontmatter: { template: 'meeting-notes' },
        headings: [
          { level: 1, text: 'Meeting Notes', line: 1 },
          { level: 4, text: 'Deep Section', line: 3 },
          { level: 2, text: 'Attendees', line: 5 },
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const headingIssues = await headingsRule.lint(mockContext);
      const templateIssues = await templateRule.lint(mockContext);

      // Heading rule should detect hierarchy violation
      expect(
        headingIssues.some(issue =>
          issue.message.includes('hierarchy violation')
        )
      ).toBe(true);

      // Template rule should detect missing sections and unknown section
      expect(
        templateIssues.some(
          issue =>
            issue.message.includes('Missing required section') ||
            issue.message.includes('Unknown section')
        )
      ).toBe(true);
    });
  });

  describe('Performance with Multiple Rules', () => {
    it('should handle large documents efficiently', async () => {
      const rules = [
        createHeadingsProperRule('headings-proper.flexible', defaultConfig),
        createSpellCorrectionRule(
          'spell-correction.suggest-only',
          defaultConfig
        ),
        createTemplateCorrectionRule(
          'template-correction.flexible',
          defaultConfig
        ),
      ];

      // Create a large document
      const largeContent = Array.from(
        { length: 100 },
        (_, i) =>
          `## Section ${i + 1}\n\nThis is content for section ${i + 1} with some teh errors.\n\n`
      ).join('');

      const largeHeadings = Array.from({ length: 100 }, (_, i) => ({
        level: 2,
        text: `Section ${i + 1}`,
        line: i * 4 + 1,
      }));

      mockContext.file = {
        path: 'large-document.md',
        content: `# Large Document\n\n${largeContent}`,
        frontmatter: {},
        headings: [
          { level: 1, text: 'Large Document', line: 1 },
          ...largeHeadings,
        ],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const startTime = Date.now();

      // Run all rules
      const results = await Promise.all(
        rules.map(rule => rule.lint(mockContext))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Should return results for all rules
      expect(results).toHaveLength(3);
      results.forEach(issues => {
        expect(Array.isArray(issues)).toBe(true);
      });
    });
  });

  describe('Configuration Variations', () => {
    it('should respect different configuration settings', async () => {
      const strictConfig = {
        ...defaultConfig,
        settings: {
          auto_fix: true,
          enforce_templates: true,
          title_case: true,
          check_headings: true,
          check_content: true,
        },
      };

      const lenientConfig = {
        ...defaultConfig,
        settings: {
          auto_fix: false,
          suggest_only: true,
          flexible: true,
          ignore_code_blocks: true,
        },
      };

      const strictRules = [
        createHeadingsProperRule('headings-proper.title-match', strictConfig),
        createSpellCorrectionRule('spell-correction.auto-fix', strictConfig),
        createTemplateCorrectionRule(
          'template-correction.enforce-templates',
          strictConfig
        ),
      ];

      const lenientRules = [
        createHeadingsProperRule('headings-proper.flexible', lenientConfig),
        createSpellCorrectionRule(
          'spell-correction.suggest-only',
          lenientConfig
        ),
        createTemplateCorrectionRule(
          'template-correction.flexible',
          lenientConfig
        ),
      ];

      mockContext.file = {
        path: 'test.md',
        content: `# test title

This has teh error.

\`\`\`
Code with teh error
\`\`\``,
        frontmatter: { title: 'Test Title' },
        headings: [{ level: 1, text: 'test title', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      // Run strict rules
      const strictResults = await Promise.all(
        strictRules.map(rule => rule.lint(mockContext))
      );

      // Run lenient rules
      const lenientResults = await Promise.all(
        lenientRules.map(rule => rule.lint(mockContext))
      );

      // Strict rules should find more issues
      const strictIssueCount = strictResults.reduce(
        (sum, issues) => sum + issues.length,
        0
      );
      const lenientIssueCount = lenientResults.reduce(
        (sum, issues) => sum + issues.length,
        0
      );

      expect(strictIssueCount).toBeGreaterThanOrEqual(lenientIssueCount);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed content gracefully', async () => {
      const rules = [
        createHeadingsProperRule('headings-proper.title-match', defaultConfig),
        createSpellCorrectionRule(
          'spell-correction.suggest-only',
          defaultConfig
        ),
        createTemplateCorrectionRule(
          'template-correction.suggest-templates',
          defaultConfig
        ),
      ];

      mockContext.file = {
        path: 'malformed.md',
        content: null as any, // Intentionally malformed
        frontmatter: undefined as any,
        headings: null as any,
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      // Rules should handle malformed input without throwing
      for (const rule of rules) {
        await expect(rule.lint(mockContext)).resolves.toBeDefined();
      }
    });

    it('should handle empty or minimal content', async () => {
      const rules = [
        createHeadingsProperRule('headings-proper.flexible', defaultConfig),
        createSpellCorrectionRule('spell-correction.ignore', defaultConfig),
        createTemplateCorrectionRule(
          'template-correction.flexible',
          defaultConfig
        ),
      ];

      mockContext.file = {
        path: 'minimal.md',
        content: '',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      // All rules should handle empty content gracefully
      for (const rule of rules) {
        const issues = await rule.lint(mockContext);
        expect(Array.isArray(issues)).toBe(true);
      }
    });
  });
});
