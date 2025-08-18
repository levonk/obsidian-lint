/**
 * Duplicate File Detection Rule Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  DuplicateFileDetectionRule,
  createDuplicateFileDetectionRule,
} from '../../../../src/rules/file-organization/duplicate-file-detection.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Duplicate File Detection Rule', () => {
  let mockConfig: RuleConfig;
  let mockFile: MarkdownFile;
  let mockContext: RuleExecutionContext;
  let rule: DuplicateFileDetectionRule;

  beforeEach(() => {
    mockConfig = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: ['.*'],
      settings: {
        comparison_method: 'content',
        ignore_empty_files: true,
        ignore_whitespace: false,
        min_file_size: 0,
        auto_remove_duplicates: false,
        preserve_newest: true,
        preserve_in_priority_paths: ['Projects/', 'Important/'],
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

    rule = new DuplicateFileDetectionRule(mockConfig);
  });

  afterEach(() => {
    rule.clearCache();
  });

  it('should create rule with correct properties', () => {
    expect(rule.id.full).toBe('duplicate-file-detection.default');
    expect(rule.name).toBe('Duplicate File Detection');
    expect(rule.category).toBe('file-organization');
  });

  it('should not report issues for unique files', async () => {
    const issues = await rule.lint(mockContext);
    expect(issues).toHaveLength(0);
  });

  it('should detect content duplicates', async () => {
    // First file
    const issues1 = await rule.lint(mockContext);
    expect(issues1).toHaveLength(0);

    // Second file with same content
    const duplicateFile = {
      ...mockFile,
      path: 'duplicate-file.md',
    };
    const duplicateContext = {
      ...mockContext,
      file: duplicateFile,
    };

    const issues2 = await rule.lint(duplicateContext);
    expect(issues2).toHaveLength(1);
    expect(issues2[0].message).toContain('content duplicate');
    expect(issues2[0].message).toContain('test-file.md');
  });

  it('should detect name duplicates when comparison_method is name', async () => {
    mockConfig.settings.comparison_method = 'name';
    rule = new DuplicateFileDetectionRule(mockConfig);

    // First file
    await rule.lint(mockContext);

    // Second file with same name but different content
    const duplicateFile = {
      ...mockFile,
      path: 'subfolder/test-file.md',
      content: '# Different Content\n\nThis is different.',
    };
    const duplicateContext = {
      ...mockContext,
      file: duplicateFile,
    };

    const issues = await rule.lint(duplicateContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('name duplicate');
  });

  it('should detect both content and name duplicates when comparison_method is both', async () => {
    mockConfig.settings.comparison_method = 'both';
    rule = new DuplicateFileDetectionRule(mockConfig);

    // First file
    await rule.lint(mockContext);

    // Second file with same name and content
    const duplicateFile = {
      ...mockFile,
      path: 'subfolder/test-file.md',
    };
    const duplicateContext = {
      ...mockContext,
      file: duplicateFile,
    };

    const issues = await rule.lint(duplicateContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('both duplicate');
  });

  it('should ignore empty files when ignore_empty_files is true', async () => {
    const emptyFile = {
      ...mockFile,
      content: '',
      path: 'empty-file.md',
    };
    const emptyContext = {
      ...mockContext,
      file: emptyFile,
    };

    const issues = await rule.lint(emptyContext);
    expect(issues).toHaveLength(0);
  });

  it('should ignore whitespace differences when ignore_whitespace is true', async () => {
    mockConfig.settings.ignore_whitespace = true;
    rule = new DuplicateFileDetectionRule(mockConfig);

    // First file
    await rule.lint(mockContext);

    // Second file with different whitespace
    const whitespaceFile = {
      ...mockFile,
      path: 'whitespace-file.md',
      content: '#   Test   File   \n\n   Content   here.   ',
    };
    const whitespaceContext = {
      ...mockContext,
      file: whitespaceFile,
    };

    const issues = await rule.lint(whitespaceContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('content duplicate');
  });

  it('should ignore files smaller than min_file_size', async () => {
    mockConfig.settings.min_file_size = 100;
    rule = new DuplicateFileDetectionRule(mockConfig);

    const smallFile = {
      ...mockFile,
      content: 'Small',
      path: 'small-file.md',
    };
    const smallContext = {
      ...mockContext,
      file: smallFile,
    };

    const issues = await rule.lint(smallContext);
    expect(issues).toHaveLength(0);
  });

  it('should create fix to remove duplicate when auto_remove_duplicates is true', async () => {
    mockConfig.settings.auto_remove_duplicates = true;
    rule = new DuplicateFileDetectionRule(mockConfig);

    // First file
    await rule.lint(mockContext);

    // Second file (duplicate)
    const duplicateFile = {
      ...mockFile,
      path: 'duplicate-file.md',
    };
    const duplicateContext = {
      ...mockContext,
      file: duplicateFile,
    };

    const issues = await rule.lint(duplicateContext);
    const fixes = await rule.fix(duplicateContext, issues);

    expect(fixes).toHaveLength(1);
    expect(fixes[0].changes[0].type).toBe('delete');
    expect(fixes[0].changes[0].oldPath).toBe('duplicate-file.md');
  });

  it('should not create fix when auto_remove_duplicates is false', async () => {
    // First file
    await rule.lint(mockContext);

    // Second file (duplicate)
    const duplicateFile = {
      ...mockFile,
      path: 'duplicate-file.md',
    };
    const duplicateContext = {
      ...mockContext,
      file: duplicateFile,
    };

    const issues = await rule.lint(duplicateContext);
    const fixes = await rule.fix(duplicateContext, issues);

    expect(fixes).toHaveLength(0);
  });

  it('should preserve files in priority paths', async () => {
    // File in priority path
    const priorityFile = {
      ...mockFile,
      path: 'Projects/important-file.md',
    };
    const priorityContext = {
      ...mockContext,
      file: priorityFile,
    };

    await rule.lint(priorityContext);

    // Duplicate file not in priority path
    const duplicateFile = {
      ...mockFile,
      path: 'duplicate-file.md',
    };
    const duplicateContext = {
      ...mockContext,
      file: duplicateFile,
    };

    const issues = await rule.lint(duplicateContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Projects/important-file.md');
  });

  it('should get all duplicate groups', async () => {
    // Add multiple files with duplicates
    await rule.lint(mockContext);

    const duplicate1 = {
      ...mockFile,
      path: 'duplicate1.md',
    };
    await rule.lint({ ...mockContext, file: duplicate1 });

    const unique = {
      ...mockFile,
      path: 'unique.md',
      content: 'Unique content',
    };
    await rule.lint({ ...mockContext, file: unique });

    const groups = rule.getAllDuplicateGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(2);
    expect(groups[0].duplicateType).toBe('content');
  });

  describe('createDuplicateFileDetectionRule factory', () => {
    it('should create default rule', () => {
      const rule = createDuplicateFileDetectionRule(
        'duplicate-file-detection.default',
        mockConfig
      );
      expect(rule).toBeInstanceOf(DuplicateFileDetectionRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createDuplicateFileDetectionRule(
          'duplicate-file-detection.unknown',
          mockConfig
        );
      }).toThrow('Unknown duplicate file detection rule variant');
    });
  });
});
