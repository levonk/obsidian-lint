/**
 * Tests for Internal Linking Rules
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  LinkingInternalStrictBracketsRule,
  LinkingInternalFlexibleRule,
  LinkingInternalAutoConvertRule,
} from '../../../../src/rules/linking/linking-internal.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Internal Linking Rules', () => {
  let tempDir: string;
  let vaultPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-lint-test-'));
    vaultPath = tempDir;

    // Create test files
    await fs.writeFile(
      path.join(vaultPath, 'existing-note.md'),
      '# Existing Note\n\nThis note exists.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Another Note.md'),
      '# Another Note\n\nThis is another note.'
    );
    await fs.mkdir(path.join(vaultPath, 'subfolder'));
    await fs.writeFile(
      path.join(vaultPath, 'subfolder', 'nested-note.md'),
      '# Nested Note\n\nThis is nested.'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('LinkingInternalStrictBracketsRule', () => {
    let rule: LinkingInternalStrictBracketsRule;
    let config: RuleConfig;

    beforeEach(() => {
      config = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          enforce_double_brackets: true,
          auto_convert: true,
          check_file_existence: true,
        },
      };
      rule = new LinkingInternalStrictBracketsRule(config);
    });

    it('should detect markdown-style internal links', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content:
          'This is a [link to existing note](existing-note.md) in markdown format.',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'link to existing note',
            target: 'existing-note',
            line: 1,
            column: 11,
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
      expect(issues[0].message).toContain('should use double bracket format');
      expect(issues[0].fixable).toBe(true);
    });

    it('should detect broken internal links', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'This links to [[non-existent-note]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'non-existent-note',
            target: 'non-existent-note',
            line: 1,
            column: 16,
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
      expect(issues[0].message).toContain('Broken internal link');
      expect(issues[0].severity).toBe('error');
    });

    it('should suggest alternatives for broken links', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'This links to [[existing-not]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'existing-not',
            target: 'existing-not',
            line: 1,
            column: 16,
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
    });

    it('should fix markdown-style internal links', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'This is a [link](existing-note.md) to convert.',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'link',
            target: 'existing-note',
            line: 1,
            column: 11,
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
      expect(fixes[0].changes[0].newText).toBe('[[existing-note|link]]');
    });

    it('should fix broken links with suggestions', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content: 'This links to [[existing-not]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'existing-not',
            target: 'existing-not',
            line: 1,
            column: 16,
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

  describe('LinkingInternalFlexibleRule', () => {
    let rule: LinkingInternalFlexibleRule;

    beforeEach(() => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {},
      };
      rule = new LinkingInternalFlexibleRule(config);
    });

    it('should allow both wikilinks and markdown links', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content:
          'Both [[existing-note]] and [another](Another Note.md) are fine.',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'existing-note',
            target: 'existing-note',
            line: 1,
            column: 6,
          },
          {
            type: 'internal',
            text: 'another',
            target: 'Another Note',
            line: 1,
            column: 25,
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
      // Should only report broken links, not format issues
      expect(issues.every(issue => issue.message.includes('Broken'))).toBe(
        true
      );
    });
  });

  describe('LinkingInternalAutoConvertRule', () => {
    let rule: LinkingInternalAutoConvertRule;

    beforeEach(() => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {},
      };
      rule = new LinkingInternalAutoConvertRule(config);
    });

    it('should auto-convert and suggest fixes', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'test.md'),
        content:
          'Convert [this link](existing-note.md) and fix [[broken-link]].',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'this link',
            target: 'existing-note',
            line: 1,
            column: 9,
          },
          {
            type: 'internal',
            text: 'broken-link',
            target: 'broken-link',
            line: 1,
            column: 45,
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
      expect(fixes[0].changes.length).toBeGreaterThan(0);
    });
  });

  describe('Case sensitivity handling', () => {
    it('should handle case-insensitive matching when configured', async () => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          case_sensitive: false,
        },
      };
      const rule = new LinkingInternalStrictBracketsRule(config);

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

      const issues = await rule.lint(context);
      // Should not report as broken since case-insensitive matching should find existing-note.md
      expect(issues.every(issue => !issue.message.includes('Broken'))).toBe(
        true
      );
    });
  });
});
