/**
 * Tests for External Linking Rules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LinkingExternalValidateUrlsRule,
  LinkingExternalPreserveAsIsRule,
  LinkingExternalConvertFormatRule,
} from '../../../../src/rules/linking/linking-external.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

// Mock fetch for URL validation tests
global.fetch = vi.fn();

describe('External Linking Rules', () => {
  const vaultPath = '/test/vault';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LinkingExternalValidateUrlsRule', () => {
    let rule: LinkingExternalValidateUrlsRule;
    let config: RuleConfig;

    beforeEach(() => {
      config = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          validate_urls: true,
          check_accessibility: true,
          timeout_ms: 1000,
        },
      };
      rule = new LinkingExternalValidateUrlsRule(config);
    });

    it('should detect invalid URL formats', async () => {
      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content: 'This is an [invalid link](not-a-url).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'invalid link',
            target: 'not-a-url',
            line: 1,
            column: 12,
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
      expect(issues[0].message).toContain('Invalid URL format');
      expect(issues[0].severity).toBe('error');
    });

    it('should suggest HTTPS for HTTP links', async () => {
      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content: 'This is an [HTTP link](http://example.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'HTTP link',
            target: 'http://example.com',
            line: 1,
            column: 12,
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

      // Should have at least one HTTPS suggestion issue
      const httpsIssues = issues.filter(issue =>
        issue.message.includes('Consider using HTTPS')
      );
      expect(httpsIssues).toHaveLength(1);
      expect(httpsIssues[0].severity).toBe('warning');
      expect(httpsIssues[0].fixable).toBe(true);
    });

    it('should check URL accessibility when enabled', async () => {
      // Mock fetch to return a failed response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content: 'This is a [broken link](https://broken-example.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'broken link',
            target: 'https://broken-example.com',
            line: 1,
            column: 12,
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
      expect(issues[0].message).toContain('may not be accessible');
      expect(issues[0].severity).toBe('warning');
    });

    it('should validate domain restrictions', async () => {
      const restrictedConfig = {
        ...config,
        settings: {
          ...config.settings,
          blocked_domains: ['blocked-site.com'],
          allowed_domains: ['allowed-site.com'],
        },
      };
      const restrictedRule = new LinkingExternalValidateUrlsRule(
        restrictedConfig
      );

      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content:
          'Links to [blocked](https://blocked-site.com) and [other](https://other-site.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'blocked',
            target: 'https://blocked-site.com',
            line: 1,
            column: 10,
          },
          {
            type: 'external',
            text: 'other',
            target: 'https://other-site.com',
            line: 1,
            column: 50,
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

      const issues = await restrictedRule.lint(context);

      // Should have domain restriction issues
      const blockedDomainIssues = issues.filter(issue =>
        issue.message.includes('blocked domain')
      );
      const nonAllowedDomainIssues = issues.filter(issue =>
        issue.message.includes('non-allowed domain')
      );

      expect(blockedDomainIssues.length).toBeGreaterThanOrEqual(1);
      expect(nonAllowedDomainIssues.length).toBeGreaterThanOrEqual(1);
    });

    it('should fix HTTP to HTTPS when HTTPS is accessible', async () => {
      // Mock fetch to return success for HTTPS
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content: 'This is an [HTTP link](http://example.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'HTTP link',
            target: 'http://example.com',
            line: 1,
            column: 12,
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

  describe('LinkingExternalPreserveAsIsRule', () => {
    let rule: LinkingExternalPreserveAsIsRule;

    beforeEach(() => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {},
      };
      rule = new LinkingExternalPreserveAsIsRule(config);
    });

    it('should not report format issues', async () => {
      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content:
          'Mixed formats: [markdown](https://example.com) and [[https://example.org|wikilink]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'markdown',
            target: 'https://example.com',
            line: 1,
            column: 15,
          },
          {
            type: 'external',
            text: 'wikilink',
            target: 'https://example.org',
            line: 1,
            column: 50,
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
      // Should not report format consistency issues
      expect(issues.every(issue => !issue.message.includes('format'))).toBe(
        true
      );
    });

    it('should not auto-fix anything', async () => {
      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content: 'HTTP link: [example](http://example.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'example',
            target: 'http://example.com',
            line: 1,
            column: 12,
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

      expect(fixes).toHaveLength(0);
    });
  });

  describe('LinkingExternalConvertFormatRule', () => {
    let rule: LinkingExternalConvertFormatRule;

    beforeEach(() => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          preferred_format: 'markdown',
        },
      };
      rule = new LinkingExternalConvertFormatRule(config);
    });

    it('should detect format inconsistencies', async () => {
      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content: 'Wikilink format: [[https://example.com|Example]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'Example',
            target: 'https://example.com',
            line: 1,
            column: 18,
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
      expect(
        issues.some(issue =>
          issue.message.includes('markdown [text](url) format')
        )
      ).toBe(true);
    });

    it('should convert wikilinks to markdown format', async () => {
      // Mock successful HTTPS check
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content: 'Convert [[https://example.com|Example]] to markdown.',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'Example',
            target: 'https://example.com',
            line: 1,
            column: 9,
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
      const formatFix = fixes[0].changes.find(change =>
        change.newText?.includes('[Example](https://example.com)')
      );
      expect(formatFix).toBeDefined();
    });

    it('should handle HTTP to HTTPS conversion', async () => {
      // Mock successful HTTPS check
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const file: MarkdownFile = {
        path: '/test/vault/test.md',
        content: 'HTTP link: [Example](http://example.com).',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'external',
            text: 'Example',
            target: 'http://example.com',
            line: 1,
            column: 12,
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
      const httpsFix = fixes[0].changes.find(change =>
        change.newText?.includes('https://example.com')
      );
      expect(httpsFix).toBeDefined();
    });
  });

  describe('Link format detection', () => {
    it('should correctly identify markdown and wikilink formats', async () => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {},
      };
      const rule = new LinkingExternalConvertFormatRule(config);

      // Test markdown format detection
      expect((rule as any).detectLinkFormat('[text](url)')).toBe('markdown');

      // Test wikilink format detection
      expect((rule as any).detectLinkFormat('[[url|text]]')).toBe('wikilink');
      expect((rule as any).detectLinkFormat('[[url]]')).toBe('wikilink');
    });
  });

  describe('URL validation', () => {
    it('should validate URL formats correctly', async () => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {},
      };
      const rule = new LinkingExternalValidateUrlsRule(config);

      // Valid URLs
      expect((rule as any).isValidUrl('https://example.com')).toBe(true);
      expect((rule as any).isValidUrl('http://example.com')).toBe(true);
      expect((rule as any).isValidUrl('https://example.com/path?query=1')).toBe(
        true
      );

      // Invalid URLs
      expect((rule as any).isValidUrl('not-a-url')).toBe(false);
      expect((rule as any).isValidUrl('example.com')).toBe(false);
      expect((rule as any).isValidUrl('')).toBe(false);
    });

    it('should extract domains correctly', async () => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {},
      };
      const rule = new LinkingExternalValidateUrlsRule(config);

      expect((rule as any).extractDomain('https://example.com')).toBe(
        'example.com'
      );
      expect(
        (rule as any).extractDomain('http://subdomain.example.com/path')
      ).toBe('subdomain.example.com');
      expect((rule as any).extractDomain('invalid-url')).toBe(null);
    });
  });
});
