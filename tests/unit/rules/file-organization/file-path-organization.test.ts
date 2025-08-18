/**
 * File Path Organization Rules Unit Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  FilePathOrganizationByDateRule,
  FilePathOrganizationByTopicRule,
  FilePathOrganizationByTypeRule,
  FilePathOrganizationFlatRule,
  createFilePathOrganizationRule,
} from '../../../../src/rules/file-organization/file-path-organization.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';
import path from 'path';

// Helper function to normalize paths for cross-platform testing
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

describe('File Path Organization Rules', () => {
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
        base_directory: 'Notes',
        create_subdirectories: true,
        update_links: true,
        preserve_existing_structure: false,
        date_format: 'YYYY/MM',
        topic_extraction_method: 'frontmatter',
        max_depth: 3,
      },
    };

    mockFile = {
      path: 'test-file.md',
      content: '# Test File\n\nContent here.',
      frontmatter: {
        date_created: '2024-01-15',
        topic: 'testing',
        type: 'note',
        tags: ['test', 'example'],
      },
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

  describe('FilePathOrganizationByDateRule', () => {
    let rule: FilePathOrganizationByDateRule;

    beforeEach(() => {
      rule = new FilePathOrganizationByDateRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('file-path-organization.by-date');
      expect(rule.name).toBe('By Date File Organization');
      expect(rule.category).toBe('file-organization');
    });

    it('should organize file by date from frontmatter', async () => {
      mockFile.path = 'test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/2024/01/test-file.md'
      );
    });

    it('should extract date from filename if frontmatter missing', async () => {
      mockFile.frontmatter = {};
      mockFile.path = '2024-01-15-daily-note.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/2024/01/2024-01-15-daily-note.md'
      );
    });

    it('should not report issues if file is already in correct location', async () => {
      mockFile.path = 'Notes/2024/01/test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should create fix to move file to correct date-based location', async () => {
      mockFile.path = 'test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('move');
      expect(normalizePath(fixes[0].changes[0].newPath)).toBe(
        'Notes/2024/01/test-file.md'
      );
    });

    it('should respect preserve_existing_structure setting', async () => {
      mockConfig.settings.preserve_existing_structure = true;
      rule = new FilePathOrganizationByDateRule(mockConfig);

      mockFile.path = 'wrong-location/test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });
  });

  describe('FilePathOrganizationByTopicRule', () => {
    let rule: FilePathOrganizationByTopicRule;

    beforeEach(() => {
      rule = new FilePathOrganizationByTopicRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('file-path-organization.by-topic');
      expect(rule.name).toBe('By Topic File Organization');
    });

    it('should organize file by topic from frontmatter', async () => {
      mockFile.path = 'test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/testing/test-file.md'
      );
    });

    it('should extract topic from tags if topic field missing', async () => {
      mockFile.frontmatter = { tags: ['project', 'work'] };
      mockFile.path = 'test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/project/test-file.md'
      );
    });

    it('should extract topic from filename when method is filename', async () => {
      mockConfig.settings.topic_extraction_method = 'filename';
      rule = new FilePathOrganizationByTopicRule(mockConfig);

      mockFile.path = 'project-important-note.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/project/project-important-note.md'
      );
    });

    it('should extract topic from content when method is content', async () => {
      mockConfig.settings.topic_extraction_method = 'content';
      rule = new FilePathOrganizationByTopicRule(mockConfig);

      mockFile.frontmatter = {};
      mockFile.headings = [{ level: 1, text: 'Research Notes', line: 1 }];
      mockFile.path = 'test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/Research Notes/test-file.md'
      );
    });

    it('should use miscellaneous folder when no topic found', async () => {
      mockFile.frontmatter = {};
      mockFile.headings = [];
      mockFile.path = 'test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Miscellaneous/test-file.md'
      );
    });
  });

  describe('FilePathOrganizationByTypeRule', () => {
    let rule: FilePathOrganizationByTypeRule;

    beforeEach(() => {
      mockConfig.settings.type_mapping = {
        daily: 'Daily Notes',
        meeting: 'Meetings',
        project: 'Projects',
        note: 'General Notes',
      };
      rule = new FilePathOrganizationByTypeRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('file-path-organization.by-type');
      expect(rule.name).toBe('By Type File Organization');
    });

    it('should organize file by type from frontmatter', async () => {
      mockFile.path = 'test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/General Notes/test-file.md'
      );
    });

    it('should extract type from tags', async () => {
      mockFile.frontmatter = { tags: ['daily', 'routine'] };
      mockFile.path = 'test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/Daily Notes/test-file.md'
      );
    });

    it('should extract type from filename patterns', async () => {
      mockFile.frontmatter = {};
      mockFile.path = 'meeting-notes-2024.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'Notes/Meetings/meeting-notes-2024.md'
      );
    });

    it('should use general folder when no type found', async () => {
      mockFile.frontmatter = {};
      mockFile.path = 'unknown-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain(
        'General/unknown-file.md'
      );
    });
  });

  describe('FilePathOrganizationFlatRule', () => {
    let rule: FilePathOrganizationFlatRule;

    beforeEach(() => {
      rule = new FilePathOrganizationFlatRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('file-path-organization.flat');
      expect(rule.name).toBe('Flat File Organization');
    });

    it('should organize all files in flat structure', async () => {
      mockFile.path = 'deep/nested/folder/test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(normalizePath(issues[0].message)).toContain('Notes/test-file.md');
    });

    it('should not report issues if file is already in base directory', async () => {
      mockFile.path = 'Notes/test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Directory depth validation', () => {
    it('should detect files nested too deeply', async () => {
      mockConfig.settings.max_depth = 2;
      const rule = new FilePathOrganizationByDateRule(mockConfig);

      mockFile.path = 'very/deep/nested/folder/structure/test-file.md';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(
        issues.some(issue => issue.message.includes('nested too deeply'))
      ).toBe(true);
    });
  });

  describe('createFilePathOrganizationRule factory', () => {
    it('should create by-date rule', () => {
      const rule = createFilePathOrganizationRule(
        'file-path-organization.by-date',
        mockConfig
      );
      expect(rule).toBeInstanceOf(FilePathOrganizationByDateRule);
    });

    it('should create by-topic rule', () => {
      const rule = createFilePathOrganizationRule(
        'file-path-organization.by-topic',
        mockConfig
      );
      expect(rule).toBeInstanceOf(FilePathOrganizationByTopicRule);
    });

    it('should create by-type rule', () => {
      const rule = createFilePathOrganizationRule(
        'file-path-organization.by-type',
        mockConfig
      );
      expect(rule).toBeInstanceOf(FilePathOrganizationByTypeRule);
    });

    it('should create flat rule', () => {
      const rule = createFilePathOrganizationRule(
        'file-path-organization.flat',
        mockConfig
      );
      expect(rule).toBeInstanceOf(FilePathOrganizationFlatRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createFilePathOrganizationRule(
          'file-path-organization.unknown',
          mockConfig
        );
      }).toThrow('Unknown file path organization rule variant');
    });
  });
});
