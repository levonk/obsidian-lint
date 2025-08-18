/**
 * Tests for MOC Linking Rules
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  MocLinkingAutomaticRule,
  MocLinkingManualRule,
  MocLinkingHybridRule,
} from '../../../../src/rules/linking/moc-linking.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('MOC Linking Rules', () => {
  let tempDir: string;
  let vaultPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-lint-test-'));
    vaultPath = tempDir;

    // Create directory structure with notes
    await fs.mkdir(path.join(vaultPath, 'projects'));
    await fs.mkdir(path.join(vaultPath, 'MOCs'));

    // Create notes in projects directory
    await fs.writeFile(
      path.join(vaultPath, 'projects', 'project-a.md'),
      '# Project A\n\nThis is project A.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'projects', 'project-b.md'),
      '# Project B\n\nThis is project B.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'projects', 'project-c.md'),
      '# Project C\n\nThis is project C.'
    );

    // Create existing MOC
    await fs.writeFile(
      path.join(vaultPath, 'MOCs', 'projects MOC.md'),
      '# Projects MOC\n\n## Overview\n\nThis is a Map of Content for the projects directory.\n\n## Contents\n\n- [[project-a]]\n- [[project-b]]\n'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('MocLinkingAutomaticRule', () => {
    let rule: MocLinkingAutomaticRule;
    let config: RuleConfig;

    beforeEach(() => {
      config = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          moc_directory: 'MOCs',
          moc_suffix: ' MOC',
          min_files_for_moc: 2,
          auto_create_mocs: true,
          auto_link_to_moc: true,
          auto_link_from_moc: true,
        },
      };
      rule = new MocLinkingAutomaticRule(config);
    });

    it('should detect missing MOC content', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'MOCs', 'projects MOC.md'),
        content:
          '# Projects MOC\n\n## Overview\n\nThis is a Map of Content for the projects directory.\n\n## Contents\n\n- [[project-a]]\n- [[project-b]]\n',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'project-a',
            target: 'project-a',
            line: 7,
            column: 3,
          },
          {
            type: 'internal',
            text: 'project-b',
            target: 'project-b',
            line: 8,
            column: 3,
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

      // Should detect missing link to project-c
      const missingLinkIssues = issues.filter(issue =>
        issue.message.includes('MOC missing link to')
      );
      expect(missingLinkIssues).toHaveLength(1);
      expect(missingLinkIssues[0].message).toContain('project-c');
    });

    it('should detect missing MOC for directory', async () => {
      // Create a new directory with enough files
      await fs.mkdir(path.join(vaultPath, 'research'));
      await fs.writeFile(
        path.join(vaultPath, 'research', 'topic-1.md'),
        '# Topic 1\n\nResearch topic 1.'
      );
      await fs.writeFile(
        path.join(vaultPath, 'research', 'topic-2.md'),
        '# Topic 2\n\nResearch topic 2.'
      );

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'research', 'topic-1.md'),
        content: '# Topic 1\n\nResearch topic 1.',
        frontmatter: {},
        headings: [],
        links: [],
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

      // Should detect missing MOC file
      const missingMocIssues = issues.filter(issue =>
        issue.message.includes('Missing MOC file')
      );
      expect(missingMocIssues).toHaveLength(1);
      expect(missingMocIssues[0].message).toContain('research MOC.md');
    });

    it('should detect missing link to MOC from note', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'projects', 'project-a.md'),
        content: '# Project A\n\nThis is project A.',
        frontmatter: {},
        headings: [],
        links: [],
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

      // Should detect missing link to MOC
      const missingMocLinkIssues = issues.filter(issue =>
        issue.message.includes('should link to its MOC')
      );
      expect(missingMocLinkIssues).toHaveLength(1);
      expect(missingMocLinkIssues[0].message).toContain('projects MOC.md');
    });

    it('should create missing MOC files', async () => {
      // Create a new directory with enough files but no MOC
      await fs.mkdir(path.join(vaultPath, 'research'));
      await fs.writeFile(
        path.join(vaultPath, 'research', 'topic-1.md'),
        '# Topic 1\n\nResearch topic 1.'
      );
      await fs.writeFile(
        path.join(vaultPath, 'research', 'topic-2.md'),
        '# Topic 2\n\nResearch topic 2.'
      );

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'research', 'topic-1.md'),
        content: '# Topic 1\n\nResearch topic 1.',
        frontmatter: {},
        headings: [],
        links: [],
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

      // Should create the MOC file
      const mocCreationFixes = fixes.filter(fix =>
        fix.file.includes('research MOC.md')
      );
      expect(mocCreationFixes).toHaveLength(1);
      expect(mocCreationFixes[0].changes[0].newText).toContain(
        '# research MOC'
      );
      expect(mocCreationFixes[0].changes[0].newText).toContain('[[topic-1]]');
      expect(mocCreationFixes[0].changes[0].newText).toContain('[[topic-2]]');
    });

    it('should update MOC content with missing links', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'MOCs', 'projects MOC.md'),
        content:
          '# Projects MOC\n\n## Overview\n\nThis is a Map of Content for the projects directory.\n\n## Contents\n\n- [[project-a]]\n- [[project-b]]\n',
        frontmatter: {},
        headings: [],
        links: [
          {
            type: 'internal',
            text: 'project-a',
            target: 'project-a',
            line: 7,
            column: 3,
          },
          {
            type: 'internal',
            text: 'project-b',
            target: 'project-b',
            line: 8,
            column: 3,
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

      // Should update MOC content
      const mocUpdateFixes = fixes.filter(fix =>
        fix.file.includes('projects MOC.md')
      );
      expect(mocUpdateFixes).toHaveLength(1);
      expect(mocUpdateFixes[0].changes[0].newText).toContain('[[project-c]]');
    });

    it('should add link to MOC in notes', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'projects', 'project-a.md'),
        content: '# Project A\n\nThis is project A.',
        frontmatter: {},
        headings: [],
        links: [],
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

      // Should add link to MOC
      const mocLinkFixes = fixes.filter(fix =>
        fix.file.includes('project-a.md')
      );
      expect(mocLinkFixes).toHaveLength(1);
      expect(mocLinkFixes[0].changes[0].newText).toContain('[[projects MOC]]');
    });
  });

  describe('MocLinkingManualRule', () => {
    let rule: MocLinkingManualRule;

    beforeEach(() => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          moc_directory: 'MOCs',
          moc_suffix: ' MOC',
          min_files_for_moc: 2,
        },
      };
      rule = new MocLinkingManualRule(config);
    });

    it('should report MOC opportunities without fixing', async () => {
      const file: MarkdownFile = {
        path: path.join(vaultPath, 'projects', 'project-a.md'),
        content: '# Project A\n\nThis is project A.',
        frontmatter: {},
        headings: [],
        links: [],
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

      // Should report issues but not provide fixes
      expect(issues.length).toBeGreaterThan(0);
      expect(fixes).toHaveLength(0);
    });
  });

  describe('MocLinkingHybridRule', () => {
    let rule: MocLinkingHybridRule;

    beforeEach(() => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          moc_directory: 'MOCs',
          moc_suffix: ' MOC',
          min_files_for_moc: 2,
        },
      };
      rule = new MocLinkingHybridRule(config);
    });

    it('should create MOCs but not auto-link from notes', async () => {
      // Create a new directory with enough files but no MOC
      await fs.mkdir(path.join(vaultPath, 'research'));
      await fs.writeFile(
        path.join(vaultPath, 'research', 'topic-1.md'),
        '# Topic 1\n\nResearch topic 1.'
      );
      await fs.writeFile(
        path.join(vaultPath, 'research', 'topic-2.md'),
        '# Topic 2\n\nResearch topic 2.'
      );

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'research', 'topic-1.md'),
        content: '# Topic 1\n\nResearch topic 1.',
        frontmatter: {},
        headings: [],
        links: [],
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

      // Should create MOC but not add links from notes to MOC
      const mocCreationFixes = fixes.filter(fix =>
        fix.file.includes('research MOC.md')
      );
      const noteLinkFixes = fixes.filter(fix =>
        fix.file.includes('topic-1.md')
      );

      expect(mocCreationFixes).toHaveLength(1);
      expect(noteLinkFixes).toHaveLength(0);
    });
  });

  describe('MOC file detection', () => {
    it('should correctly identify MOC files', async () => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {},
      };
      const rule = new MocLinkingAutomaticRule(config);

      expect(
        (rule as any).isMocFile(path.join(vaultPath, 'MOCs', 'projects MOC.md'))
      ).toBe(true);
      expect(
        (rule as any).isMocFile(
          path.join(vaultPath, 'projects', 'project-a.md')
        )
      ).toBe(false);
      expect(
        (rule as any).isMocFile(path.join(vaultPath, 'some-topic MOC.md'))
      ).toBe(true);
    });
  });

  describe('Link format handling', () => {
    it('should format links according to settings', async () => {
      const wikilinkConfig: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          link_format: 'wikilink',
        },
      };
      const wikilinkRule = new MocLinkingAutomaticRule(wikilinkConfig);

      const markdownConfig: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          link_format: 'markdown',
        },
      };
      const markdownRule = new MocLinkingAutomaticRule(markdownConfig);

      expect((wikilinkRule as any).formatLink('test-note')).toBe(
        '[[test-note]]'
      );
      expect((markdownRule as any).formatLink('test-note')).toBe(
        '[test-note](test-note.md)'
      );
    });
  });

  describe('Directory scanning', () => {
    it('should respect minimum files threshold', async () => {
      // Create directory with only one file
      await fs.mkdir(path.join(vaultPath, 'single-file'));
      await fs.writeFile(
        path.join(vaultPath, 'single-file', 'only-file.md'),
        '# Only File\n\nThis is the only file.'
      );

      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          min_files_for_moc: 2,
        },
      };
      const rule = new MocLinkingAutomaticRule(config);

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'single-file', 'only-file.md'),
        content: '# Only File\n\nThis is the only file.',
        frontmatter: {},
        headings: [],
        links: [],
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

      // Should not suggest MOC for directory with insufficient files
      const mocIssues = issues.filter(issue =>
        issue.message.includes('Missing MOC file')
      );
      expect(mocIssues).toHaveLength(0);
    });

    it('should exclude specified directories', async () => {
      const config: RuleConfig = {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: [],
        settings: {
          exclude_directories: ['projects'],
          min_files_for_moc: 2,
        },
      };
      const rule = new MocLinkingAutomaticRule(config);

      const file: MarkdownFile = {
        path: path.join(vaultPath, 'projects', 'project-a.md'),
        content: '# Project A\n\nThis is project A.',
        frontmatter: {},
        headings: [],
        links: [],
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

      // Should not suggest MOC for excluded directory
      const mocIssues = issues.filter(
        issue =>
          issue.message.includes('Missing MOC file') ||
          issue.message.includes('should link to its MOC')
      );
      expect(mocIssues).toHaveLength(0);
    });
  });
});
