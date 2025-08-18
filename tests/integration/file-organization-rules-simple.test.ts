/**
 * File Organization Rules Simple Integration Tests
 * Tests the basic functionality of file organization rules
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createFileOrganizationRule } from '../../src/rules/file-organization/index.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../src/types/rules.js';
import { MarkdownParser } from '../../src/utils/markdown.js';
import path from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';

describe('File Organization Rules Simple Integration', () => {
  let tempDir: string;
  let mockConfig: RuleConfig;
  let parser: MarkdownParser;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'obsidian-lint-test-'));
    parser = new MarkdownParser();

    mockConfig = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: ['.*'],
      settings: {
        base_directory: 'Notes',
        update_links: true,
        max_length: 100,
      },
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('File Naming Rules', () => {
    it('should create kebab-case naming rule', async () => {
      const rule = createFileOrganizationRule(
        'file-naming.kebab-case',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('file-naming.kebab-case');
      expect(rule.name).toContain('Kebab Case');
    });

    it('should create camel-case naming rule', async () => {
      const rule = createFileOrganizationRule(
        'file-naming.camel-case',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('file-naming.camel-case');
      expect(rule.name).toContain('Camel Case');
    });

    it('should create space-separated naming rule', async () => {
      const rule = createFileOrganizationRule(
        'file-naming.space-separated',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('file-naming.space-separated');
      expect(rule.name).toContain('Space Separated');
    });

    it('should create mixed-case naming rule', async () => {
      const rule = createFileOrganizationRule(
        'file-naming.mixed-case',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('file-naming.mixed-case');
      expect(rule.name).toContain('Mixed Case');
    });

    it('should detect naming violations', async () => {
      const rule = createFileOrganizationRule(
        'file-naming.kebab-case',
        mockConfig
      );

      // Create test file with invalid name
      const testFilePath = path.join(tempDir, 'My Test File.md');
      const testContent = '# My Test File\n\nThis is a test file.';
      await writeFile(testFilePath, testContent);

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        config: mockConfig,
      };

      // Run lint
      const issues = await rule.lint(context);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].fixable).toBe(true);
    });
  });

  describe('File Path Organization Rules', () => {
    it('should create by-date organization rule', async () => {
      const rule = createFileOrganizationRule(
        'file-path-organization.by-date',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('file-path-organization.by-date');
      expect(rule.name).toContain('By Date');
    });

    it('should create by-topic organization rule', async () => {
      const rule = createFileOrganizationRule(
        'file-path-organization.by-topic',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('file-path-organization.by-topic');
      expect(rule.name).toContain('By Topic');
    });

    it('should create by-type organization rule', async () => {
      const rule = createFileOrganizationRule(
        'file-path-organization.by-type',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('file-path-organization.by-type');
      expect(rule.name).toContain('By Type');
    });

    it('should create flat organization rule', async () => {
      const rule = createFileOrganizationRule(
        'file-path-organization.flat',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('file-path-organization.flat');
      expect(rule.name).toContain('Flat');
    });
  });

  describe('Duplicate File Detection Rules', () => {
    it('should create duplicate detection rule', async () => {
      const rule = createFileOrganizationRule(
        'duplicate-file-detection.default',
        mockConfig
      );
      expect(rule).toBeDefined();
      expect(rule.id.full).toBe('duplicate-file-detection.default');
      expect(rule.name).toContain('Duplicate');
    });

    it('should handle empty files correctly', async () => {
      const emptyConfig = {
        ...mockConfig,
        settings: { ...mockConfig.settings, ignore_empty_files: true },
      };
      const rule = createFileOrganizationRule(
        'duplicate-file-detection.default',
        emptyConfig
      );

      // Create empty file
      const testFilePath = path.join(tempDir, 'empty-file.md');
      await writeFile(testFilePath, '');

      // Parse the file
      const markdownFile = await parser.parseMarkdown(testFilePath, '');
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        config: emptyConfig,
      };

      // Run lint - should not report issues for empty files when configured to ignore them
      const issues = await rule.lint(context);
      expect(issues).toHaveLength(0);
    });
  });

  describe('File Movement and Link Updates', () => {
    it('should support file movement operations', async () => {
      const rule = createFileOrganizationRule(
        'file-naming.kebab-case',
        mockConfig
      );

      // Create test file
      const testFilePath = path.join(tempDir, 'Test File.md');
      const testContent = '# Test File\n\nThis is a test file.';
      await writeFile(testFilePath, testContent);

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        config: mockConfig,
      };

      // Run lint and fix
      const issues = await rule.lint(context);
      if (issues.length > 0) {
        const fixes = await rule.fix(context, issues);
        expect(fixes.length).toBeGreaterThan(0);
        expect(fixes[0].changes[0].type).toBe('move');
        expect(fixes[0].changes[0].newPath).toBeDefined();
      }
    });

    it('should parse markdown files with links correctly', async () => {
      // Create source file with link
      const sourceContent =
        '# Source File\n\nThis links to [[target-file]] and [Target](target-file.md).';
      const sourcePath = path.join(tempDir, 'source.md');
      await writeFile(sourcePath, sourceContent);

      // Parse source file
      const sourceFile = await parser.parseMarkdown(sourcePath, sourceContent);

      // Check that links are parsed
      expect(sourceFile.links).toBeDefined();
      expect(sourceFile.content).toContain('[[target-file]]');
      expect(sourceFile.content).toContain('(target-file.md)');
    });
  });

  describe('Rule Factory Function', () => {
    it('should throw error for unknown rule IDs', async () => {
      expect(() => {
        createFileOrganizationRule('unknown-rule.variant', mockConfig);
      }).toThrow('Unknown file organization rule');
    });

    it('should create all supported rule variants', async () => {
      const ruleIds = [
        'file-naming.kebab-case',
        'file-naming.camel-case',
        'file-naming.space-separated',
        'file-naming.mixed-case',
        'file-path-organization.by-date',
        'file-path-organization.by-topic',
        'file-path-organization.by-type',
        'file-path-organization.flat',
        'duplicate-file-detection.default',
      ];

      for (const ruleId of ruleIds) {
        const rule = createFileOrganizationRule(ruleId, mockConfig);
        expect(rule).toBeDefined();
        expect(rule.id.full).toBe(ruleId);
      }
    });
  });
});
