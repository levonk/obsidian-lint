/**
 * Tests for Broken Link Detection Rule
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { BrokenLinkDetectionRule } from '../../../../src/rules/linking/broken-link-detection.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

// Mock fetch for external URL testing
global.fetch = vi.fn();

describe('BrokenLinkDetectionRule', () => {
  let tempDir: string;
  let vaultPath: string;
  let rule: BrokenLinkDetectionRule;
  let config: RuleConfig;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-lint-test-'));
    vaultPath = tempDir;

    // Create test files
    await fs.writeFile(
      path.join(vaultPath, 'existing-note.md'),
      '# Existing Note\n\nThis note exists.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'another-note.md'),
      '# Another Note\n\nAnother existing note.'
    );

    // Create attachments directory and files
    await fs.mkdir(path.join(vaultPath, 'attachments'));
    await fs.writeFile(
      path.join(vaultPath, 'attachments', 'image.png'),
      'fake image content'
    );

    config = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: [],
      settings: {
        check_internal_links: true,
        check_external_links: true,
        check_attachments: true,
        auto_fix_internal: true,
        auto_fix_external: true,
        suggest_alternatives: true,
        max_suggestions: 3,
        external_timeout_ms: 1000,
      },
    };
    rule = new BrokenLinkDetectionRule(config);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Internal link detection', () => {
    it('should detect broken internal links', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Link to [[non-existent-note]] and [[existing-note]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'non-existent-note',
            target: 'non-existent-note',
            line: 1,
            column: 10,
          },
          {
            type: 'internal',
            text: 'existing-note',
            target: 'existing-note',
            line: 1,
            column: 35,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);

      // Should only report the broken link
      const brokenLinkIssues = issues.filter(issue =>
        issue.message.includes('Broken internal link')
      );
      expect(brokenLinkIssues).toHaveLength(1);
      expect(brokenLinkIssues[0].message).toContain('non-existent-note');
      expect(brokenLinkIssues[0].severity).toBe('error');
    });

    it('should suggest alternatives for broken internal links', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Link to [[existing-not]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'existing-not',
            target: 'existing-not',
            line: 1,
            column: 10,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Did you mean');
      expect(issues[0].message).toContain('existing-note');
      expect(issues[0].fixable).toBe(true);
    });

    it('should handle fragment links correctly', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content:
          'Link to [[existing-note#section]] and [[non-existent#section]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'existing-note#section',
            target: 'existing-note#section',
            line: 1,
            column: 10,
          },
          {
            type: 'internal',
            text: 'non-existent#section',
            target: 'non-existent#section',
            line: 1,
            column: 40,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);

      // Should only report the broken link (non-existent#section)
      const brokenLinkIssues = issues.filter(issue =>
        issue.message.includes('Broken internal link')
      );
      expect(brokenLinkIssues).toHaveLength(1);
      expect(brokenLinkIssues[0].message).toContain('non-existent#section');
    });

    it('should fix broken internal links with suggestions', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Link to [[existing-not]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'existing-not',
            target: 'existing-not',
            line: 1,
            column: 10,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);
      const fixes = await rule.fix!(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].newText).toBe('[[existing-note]]');
    });
  });

  describe('External link detection', () => {
    it('should detect inaccessible external links', async () => {
      // Mock fetch to return failure
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Link to [broken site](https://broken-example.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'broken site',
            target: 'https://broken-example.com',
            line: 1,
            column: 10,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('may be broken or inaccessible');
      expect(issues[0].severity).toBe('warning');
    });

    it('should not report accessible external links', async () => {
      // Mock fetch to return success
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Link to [working site](https://example.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'working site',
            target: 'https://example.com',
            line: 1,
            column: 10,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);

      // Should not report any issues for accessible links
      const externalLinkIssues = issues.filter(issue =>
        issue.message.includes('may be broken or inaccessible')
      );
      expect(externalLinkIssues).toHaveLength(0);
    });

    it('should fix HTTP to HTTPS when HTTPS is accessible', async () => {
      // Mock fetch to return success for HTTPS
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Link to [site](http://example.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'site',
            target: 'http://example.com',
            line: 1,
            column: 10,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);
      const fixes = await rule.fix!(context, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].newText).toContain('https://example.com');
    });
  });

  describe('Attachment link detection', () => {
    it('should detect missing attachments', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content:
          'Image: ![alt](attachments/missing.png) and ![existing](attachments/image.png).',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [
          {
            name: 'missing.png',
            path: 'attachments/missing.png',
            type: 'image',
            size: 0,
            referencedBy: [],
          },
          {
            name: 'image.png',
            path: 'attachments/image.png',
            type: 'image',
            size: 0,
            referencedBy: [],
          },
        ],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);

      // Should only report the missing attachment
      const missingAttachmentIssues = issues.filter(issue =>
        issue.message.includes('Missing attachment')
      );
      expect(missingAttachmentIssues).toHaveLength(1);
      expect(missingAttachmentIssues[0].message).toContain('missing.png');
      expect(missingAttachmentIssues[0].severity).toBe('error');
    });

    it('should suggest similar attachments for missing ones', async () => {
      // Create a similar attachment
      await fs.writeFile(
        path.join(vaultPath, 'attachments', 'image-similar.png'),
        'fake image content'
      );

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Image: ![alt](attachments/image-sim.png).',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [
          {
            name: 'image-sim.png',
            path: 'attachments/image-sim.png',
            type: 'image',
            size: 0,
            referencedBy: [],
          },
        ],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await rule.lint(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Similar files found');
      expect(issues[0].message).toContain('image-similar.png');
    });
  });

  describe('Case sensitivity handling', () => {
    it('should handle case-insensitive matching when configured', async () => {
      const caseInsensitiveConfig = {
        ...config,
        settings: {
          ...config.settings,
          case_sensitive: false,
        },
      };
      const caseInsensitiveRule = new BrokenLinkDetectionRule(
        caseInsensitiveConfig
      );

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Link to [[EXISTING-NOTE]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'EXISTING-NOTE',
            target: 'EXISTING-NOTE',
            line: 1,
            column: 10,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await caseInsensitiveRule.lint(context);

      // Should not report as broken since case-insensitive matching should find existing-note.md
      const brokenLinkIssues = issues.filter(issue =>
        issue.message.includes('Broken internal link')
      );
      expect(brokenLinkIssues).toHaveLength(0);
    });
  });

  describe('Report-only mode', () => {
    it('should not provide fixes when report_only is enabled', async () => {
      const reportOnlyConfig = {
        ...config,
        settings: {
          ...config.settings,
          report_only: true,
        },
      };
      const reportOnlyRule = new BrokenLinkDetectionRule(reportOnlyConfig);

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'Link to [[existing-not]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'existing-not',
            target: 'existing-not',
            line: 1,
            column: 10,
          },
        ],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const context: RuleExecutionContext = {
        file,
        vaultPath,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await reportOnlyRule.lint(context);
      const fixes = await reportOnlyRule.fix!(context, issues);

      expect(issues).toHaveLength(1); // Should still report issues
      expect(fixes).toHaveLength(0); // But no fixes
    });
  });

  describe('Similarity calculation', () => {
    it('should calculate string similarity correctly', async () => {
      const similarity1 = (rule as any).calculateSimilarity(
        'existing-note',
        'existing-not'
      );
      const similarity2 = (rule as any).calculateSimilarity(
        'existing-note',
        'completely-different'
      );

      expect(similarity1).toBeGreaterThan(0.8); // Very similar
      expect(similarity2).toBeLessThan(0.3); // Very different
      expect(similarity1).toBeGreaterThan(similarity2);
    });

    it('should handle edge cases in similarity calculation', async () => {
      expect((rule as any).calculateSimilarity('', '')).toBe(1.0);
      expect((rule as any).calculateSimilarity('test', '')).toBeLessThan(1.0);
      expect((rule as any).calculateSimilarity('', 'test')).toBeLessThan(1.0);
      expect((rule as any).calculateSimilarity('same', 'same')).toBe(1.0);
    });
  });
});
