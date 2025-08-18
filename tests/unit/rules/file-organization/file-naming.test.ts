/**
 * File Naming Rules Unit Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  FileNamingKebabCaseRule,
  FileNamingCamelCaseRule,
  FileNamingSpaceSeparatedRule,
  FileNamingMixedCaseRule,
  createFileNamingRule,
} from '../../../../src/rules/file-organization/file-naming.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('File Naming Rules', () => {
  let mockConfig: RuleConfig;
  let mockFile: MarkdownFile;
  let mockContext: RuleExecutionContext;

  beforeEach(() => {
    mockConfig = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: ['.*'],
      settings: {
        allow_numbers: true,
        allow_underscores: false,
        max_length: 100,
        update_links: true,
      },
    };

    mockFile = {
      path: 'test-file.md',
      content: '# Test File\n\nContent here.',
      frontmatter: {},
      headings: [{ level: 1, text: 'Test File', line: 1 }],
      links: [],
      attachments: [],
      ast: { type: 'root', children: [] },
    };

    mockContext = {
      file: mockFile,
      vaultPath: '/test/vault',
      dryRun: false,
      verbose: false,
      metadata: {},
    };
  });

  describe('FileNamingKebabCaseRule', () => {
    let rule: FileNamingKebabCaseRule;

    beforeEach(() => {
      rule = new FileNamingKebabCaseRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('file-naming.kebab-case');
      expect(rule.name).toBe('Kebab Case File Naming');
      expect(rule.category).toBe('file-naming');
    });

    it('should pass valid kebab-case file names', async () => {
      mockFile.path = 'valid-kebab-case-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should detect invalid file names', async () => {
      mockFile.path = 'Invalid File Name.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toContain('kebab-case convention');
    });

    it('should detect file names that are too long', async () => {
      const longName = 'a'.repeat(101);
      mockFile.path = `${longName}.md`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].message).toContain('exceeds maximum length');
    });

    it('should fix invalid file names', async () => {
      mockFile.path = 'Invalid File Name.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('move');
      expect(fixes[0].changes[0].newPath).toBe('invalid-file-name.md');
    });

    it('should handle underscores based on settings', async () => {
      mockConfig.settings.allow_underscores = true;
      rule = new FileNamingKebabCaseRule(mockConfig);

      mockFile.path = 'file_with_underscores.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should handle numbers based on settings', async () => {
      mockConfig.settings.allow_numbers = false;
      rule = new FileNamingKebabCaseRule(mockConfig);

      mockFile.path = 'file-with-123-numbers.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
    });
  });

  describe('FileNamingCamelCaseRule', () => {
    let rule: FileNamingCamelCaseRule;

    beforeEach(() => {
      rule = new FileNamingCamelCaseRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('file-naming.camel-case');
      expect(rule.name).toBe('Camel Case File Naming');
    });

    it('should pass valid camelCase file names', async () => {
      mockFile.path = 'validCamelCaseFile.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should detect invalid camelCase file names', async () => {
      mockFile.path = 'invalid-file-name.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('camelCase convention');
    });

    it('should fix invalid file names to camelCase', async () => {
      mockFile.path = 'invalid-file-name.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes[0].newPath).toBe('invalidFileName.md');
    });
  });

  describe('FileNamingSpaceSeparatedRule', () => {
    let rule: FileNamingSpaceSeparatedRule;

    beforeEach(() => {
      rule = new FileNamingSpaceSeparatedRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('file-naming.space-separated');
      expect(rule.name).toBe('Space Separated File Naming');
    });

    it('should pass valid space-separated file names', async () => {
      mockFile.path = 'Valid Space Separated File.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should detect invalid space-separated file names', async () => {
      mockFile.path = 'invalid-file-name.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('space-separated convention');
    });

    it('should fix invalid file names to space-separated', async () => {
      mockFile.path = 'invalid-file-name.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes[0].newPath).toBe('invalid file name.md');
    });
  });

  describe('FileNamingMixedCaseRule', () => {
    let rule: FileNamingMixedCaseRule;

    beforeEach(() => {
      rule = new FileNamingMixedCaseRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('file-naming.mixed-case');
      expect(rule.name).toBe('Mixed Case File Naming');
    });

    it('should pass various valid mixed case file names', async () => {
      // Enable underscores for mixed case rule
      const mixedCaseConfig = {
        ...mockConfig,
        settings: { ...mockConfig.settings, allow_underscores: true },
      };
      rule = new FileNamingMixedCaseRule(mixedCaseConfig);

      const validNames = [
        'Mixed Case File.md',
        'mixed-case-file.md',
        'mixedCaseFile.md',
        'Mixed_Case_File.md',
      ];

      for (const name of validNames) {
        mockFile.path = name;
        mockContext.file = mockFile;

        const issues = await rule.lint(mockContext);
        expect(issues).toHaveLength(0);
      }
    });

    it('should detect files with invalid characters', async () => {
      mockFile.path = 'invalid@file#name.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('invalid characters');
    });
  });

  describe('createFileNamingRule factory', () => {
    it('should create kebab-case rule', () => {
      const rule = createFileNamingRule('file-naming.kebab-case', mockConfig);
      expect(rule).toBeInstanceOf(FileNamingKebabCaseRule);
    });

    it('should create camel-case rule', () => {
      const rule = createFileNamingRule('file-naming.camel-case', mockConfig);
      expect(rule).toBeInstanceOf(FileNamingCamelCaseRule);
    });

    it('should create space-separated rule', () => {
      const rule = createFileNamingRule(
        'file-naming.space-separated',
        mockConfig
      );
      expect(rule).toBeInstanceOf(FileNamingSpaceSeparatedRule);
    });

    it('should create mixed-case rule', () => {
      const rule = createFileNamingRule('file-naming.mixed-case', mockConfig);
      expect(rule).toBeInstanceOf(FileNamingMixedCaseRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createFileNamingRule('file-naming.unknown', mockConfig);
      }).toThrow('Unknown file naming rule variant');
    });
  });
});
