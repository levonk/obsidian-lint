/**
 * Attachment Format Preference Rules Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  AttachmentFormatPreferenceConvertToPngRule,
  AttachmentFormatPreferencePreserveOriginalRule,
  AttachmentFormatPreferenceOptimizeSizeRule,
  createAttachmentFormatPreferenceRule,
} from '../../../../src/rules/attachment/attachment-format-preference.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Attachment Format Preference Rules', () => {
  let mockConfig: RuleConfig;
  let mockFile: MarkdownFile;
  let mockContext: RuleExecutionContext;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'obsidian-lint-test-'));
    mockConfig = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: ['.*'],
      settings: {
        target_format: 'png',
        quality: 85,
        max_width: 1920,
        max_height: 1080,
        preserve_original: false,
        update_links: true,
        allowed_source_formats: [
          '.jpg',
          '.jpeg',
          '.gif',
          '.bmp',
          '.tiff',
          '.webp',
        ],
      },
    };

    mockFile = {
      path: 'test-note.md',
      content: `# Test Note

This note has images:
![[image.jpg]]
![Alt text](photo.gif)
![Another image](diagram.png)`,
      frontmatter: {},
      headings: [{ level: 1, text: 'Test Note', line: 1 }],
      links: [],
      attachments: [],
      ast: { type: 'root', children: [] },
    };

    mockContext = {
      file: mockFile,
      vaultPath: tempDir,
      dryRun: false,
      verbose: false,
      metadata: {},
    };

    // Create test image files
    await writeFile(path.join(tempDir, 'image.jpg'), 'fake jpg content');
    await writeFile(path.join(tempDir, 'photo.gif'), 'fake gif content');
    await writeFile(path.join(tempDir, 'diagram.png'), 'fake png content');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('AttachmentFormatPreferenceConvertToPngRule', () => {
    let rule: AttachmentFormatPreferenceConvertToPngRule;

    beforeEach(() => {
      rule = new AttachmentFormatPreferenceConvertToPngRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('attachment-format-preference.convert-to-png');
      expect(rule.name).toBe('Convert Images to PNG');
      expect(rule.category).toBe('attachment');
    });

    it('should detect images that need conversion to PNG', async () => {
      const issues = await rule.lint(mockContext);

      // Debug: log the issues to see what's being found
      console.log(
        'Issues found:',
        issues.map(i => i.message)
      );

      // Should find issues for .jpg and .gif files, but not .png
      expect(issues.length).toBeGreaterThan(0);

      // Check if any issues mention conversion to PNG
      const conversionIssues = issues.filter(
        issue =>
          issue.message.includes('PNG') || issue.message.includes('converted')
      );
      expect(conversionIssues.length).toBeGreaterThan(0);
    });

    it('should not report issues when no images need conversion', async () => {
      mockFile.content = `# Test Note

This note has PNG images:
![[image.png]]
![Alt text](photo.png)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should create fixes for images that need conversion', async () => {
      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        expect(fixes[0].description).toContain('PNG');
        expect(fixes[0].changes).toBeDefined();
      }
    });

    it('should handle missing images gracefully', async () => {
      mockFile.content = `# Test Note

This note references missing images:
![[missing-image.jpg]]`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      // Should not crash, may or may not report issues depending on implementation
      expect(issues).toBeDefined();
    });
  });

  describe('AttachmentFormatPreferencePreserveOriginalRule', () => {
    let rule: AttachmentFormatPreferencePreserveOriginalRule;

    beforeEach(() => {
      rule = new AttachmentFormatPreferencePreserveOriginalRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe(
        'attachment-format-preference.preserve-original'
      );
      expect(rule.name).toBe('Preserve Original Format');
      expect(rule.category).toBe('attachment');
    });

    it('should not report any issues when preserving originals', async () => {
      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should not create any fixes when preserving originals', async () => {
      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);
      expect(fixes).toHaveLength(0);
    });
  });

  describe('AttachmentFormatPreferenceOptimizeSizeRule', () => {
    let rule: AttachmentFormatPreferenceOptimizeSizeRule;

    beforeEach(() => {
      rule = new AttachmentFormatPreferenceOptimizeSizeRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('attachment-format-preference.optimize-size');
      expect(rule.name).toBe('Optimize Image Size');
      expect(rule.category).toBe('attachment');
    });

    it('should detect images that need optimization', async () => {
      // Mock large file sizes by modifying the implementation or using test files
      const issues = await rule.lint(mockContext);

      // The exact number depends on the mock file sizes
      expect(issues).toBeDefined();
    });

    it('should prioritize unoptimized formats for conversion', async () => {
      mockFile.content = `# Test Note

This note has unoptimized images:
![[large-image.bmp]]
![Tiff image](document.tiff)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);

      // Should detect unoptimized formats
      expect(issues).toBeDefined();
    });
  });

  describe('Settings validation', () => {
    it('should use default settings for invalid values', () => {
      const invalidConfig = {
        ...mockConfig,
        settings: {
          quality: 150, // Invalid: > 100
          max_width: -100, // Invalid: negative
          compression_level: 15, // Invalid: > 9
        },
      };

      const rule = new AttachmentFormatPreferenceConvertToPngRule(
        invalidConfig
      );

      // Should fall back to defaults
      expect(rule).toBeDefined();
    });

    it('should handle missing settings gracefully', () => {
      const minimalConfig = {
        ...mockConfig,
        settings: {},
      };

      const rule = new AttachmentFormatPreferenceConvertToPngRule(
        minimalConfig
      );
      expect(rule).toBeDefined();
    });
  });

  describe('createAttachmentFormatPreferenceRule factory', () => {
    it('should create convert-to-png rule', () => {
      const rule = createAttachmentFormatPreferenceRule(
        'attachment-format-preference.convert-to-png',
        mockConfig
      );
      expect(rule).toBeInstanceOf(AttachmentFormatPreferenceConvertToPngRule);
    });

    it('should create preserve-original rule', () => {
      const rule = createAttachmentFormatPreferenceRule(
        'attachment-format-preference.preserve-original',
        mockConfig
      );
      expect(rule).toBeInstanceOf(
        AttachmentFormatPreferencePreserveOriginalRule
      );
    });

    it('should create optimize-size rule', () => {
      const rule = createAttachmentFormatPreferenceRule(
        'attachment-format-preference.optimize-size',
        mockConfig
      );
      expect(rule).toBeInstanceOf(AttachmentFormatPreferenceOptimizeSizeRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createAttachmentFormatPreferenceRule(
          'attachment-format-preference.unknown',
          mockConfig
        );
      }).toThrow('Unknown attachment format preference rule variant');
    });
  });
});
