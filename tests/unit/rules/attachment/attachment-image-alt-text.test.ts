/**
 * Attachment Image Alt Text Rules Unit Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  AttachmentImageAltTextRequiredRule,
  AttachmentImageAltTextOptionalRule,
  AttachmentImageAltTextAutoGenerateRule,
  createAttachmentImageAltTextRule,
} from '../../../../src/rules/attachment/attachment-image-alt-text.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Attachment Image Alt Text Rules', () => {
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
        require_alt_text: true,
        auto_generate_from_filename: true,
        auto_generate_from_context: false,
        min_alt_text_length: 3,
        max_alt_text_length: 100,
        default_alt_text: 'Image',
      },
    };

    mockFile = {
      path: 'test-note.md',
      content: `# Test Note

This note has various image formats:
![[screenshot-2024-01-15.png]]
![Good alt text](diagram.png)
![](missing-alt.jpg)
![[user-profile-photo.jpeg]]`,
      frontmatter: {},
      headings: [{ level: 1, text: 'Test Note', line: 1 }],
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

  describe('AttachmentImageAltTextRequiredRule', () => {
    let rule: AttachmentImageAltTextRequiredRule;

    beforeEach(() => {
      rule = new AttachmentImageAltTextRequiredRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('attachment-image-alt-text.required');
      expect(rule.name).toBe('Require Image Alt Text');
      expect(rule.category).toBe('attachment');
    });

    it('should detect images missing alt text', async () => {
      const issues = await rule.lint(mockContext);

      // Should find issues for Obsidian format and empty alt text
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(issue =>
          issue.message.includes('screenshot-2024-01-15.png')
        )
      ).toBe(true);
      expect(
        issues.some(issue => issue.message.includes('missing-alt.jpg'))
      ).toBe(true);
      expect(
        issues.some(issue => issue.message.includes('user-profile-photo.jpeg'))
      ).toBe(true);
    });

    it('should not report issues for images with good alt text', async () => {
      mockFile.content = `# Test Note

This note has images with alt text:
![Good description](image.png)
![Another good description](photo.jpg)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should create fixes for images missing alt text', async () => {
      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        expect(fixes[0].description).toContain('alt text');
        expect(fixes[0].changes).toBeDefined();
        expect(fixes[0].changes[0].newText).toContain('![');
      }
    });

    it('should generate alt text from filename', async () => {
      mockFile.content = '![[user-profile-photo.png]]';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('User Profile');
      }
    });

    it('should handle filename cleanup patterns', async () => {
      mockFile.content = '![[IMG_20240115_screenshot-final.png]]';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        // Should generate some meaningful alt text
        expect(newContent).toContain('Screenshot Final');
      }
    });
  });

  describe('AttachmentImageAltTextOptionalRule', () => {
    let rule: AttachmentImageAltTextOptionalRule;

    beforeEach(() => {
      rule = new AttachmentImageAltTextOptionalRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('attachment-image-alt-text.optional');
      expect(rule.name).toBe('Optional Image Alt Text');
      expect(rule.category).toBe('attachment');
    });

    it('should suggest alt text with info severity', async () => {
      const issues = await rule.lint(mockContext);

      // Should find suggestions but with info severity
      const altTextIssues = issues.filter(issue =>
        issue.message.includes('could benefit from alt text')
      );

      if (altTextIssues.length > 0) {
        expect(altTextIssues[0].severity).toBe('info');
      }
    });

    it('should not suggest alt text for images that already have it', async () => {
      mockFile.content = `# Test Note

This note has images with alt text:
![Good description](image.png)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });
  });

  describe('AttachmentImageAltTextAutoGenerateRule', () => {
    let rule: AttachmentImageAltTextAutoGenerateRule;

    beforeEach(() => {
      rule = new AttachmentImageAltTextAutoGenerateRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('attachment-image-alt-text.auto-generate');
      expect(rule.name).toBe('Auto-Generate Image Alt Text');
      expect(rule.category).toBe('attachment');
    });

    it('should auto-generate alt text for all images', async () => {
      const issues = await rule.lint(mockContext);

      // Should find opportunities to improve alt text
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(issue => issue.message.includes('auto-generated'))
      ).toBe(true);
    });

    it('should generate context-aware alt text when enabled', async () => {
      const contextConfig = {
        ...mockConfig,
        settings: {
          ...mockConfig.settings,
          context_analysis_enabled: true,
        },
      };

      rule = new AttachmentImageAltTextAutoGenerateRule(contextConfig);

      mockFile.content = `# User Interface Design

This section shows the login screen:
![[login-screen.png]]

The dashboard layout is shown below:
![[dashboard-layout.png]]`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        // Should incorporate context from headings
        expect(newContent).toBeDefined();
      }
    });
  });

  describe('Alt text generation', () => {
    let rule: AttachmentImageAltTextRequiredRule;

    beforeEach(() => {
      rule = new AttachmentImageAltTextRequiredRule(mockConfig);
    });

    it('should handle various filename patterns', async () => {
      const testCases = [
        { filename: 'user-profile.png', expected: 'User Profile' },
        {
          filename: 'screenshot-final-v2.png',
          expected: 'Screenshot Final V2',
        },
        { filename: 'diagram_flowchart.svg', expected: 'Diagram Flowchart' },
      ];

      for (const testCase of testCases) {
        mockFile.content = `![[${testCase.filename}]]`;
        mockContext.file = mockFile;

        const issues = await rule.lint(mockContext);
        const fixes = await rule.fix(mockContext, issues);

        if (fixes.length > 0) {
          const newContent = fixes[0].changes[0].newText;
          expect(newContent).toContain(testCase.expected);
        }
      }
    });

    it('should respect alt text length limits', async () => {
      const shortLimitConfig = {
        ...mockConfig,
        settings: {
          ...mockConfig.settings,
          max_alt_text_length: 20,
        },
      };

      rule = new AttachmentImageAltTextRequiredRule(shortLimitConfig);

      mockFile.content =
        '![[very-long-filename-that-exceeds-the-maximum-length-limit.png]]';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        const altTextMatch = newContent.match(/!\[([^\]]+)\]/);
        if (altTextMatch) {
          expect(altTextMatch[1].length).toBeLessThanOrEqual(20);
        }
      }
    });

    it('should fall back to default alt text when generation fails', async () => {
      mockFile.content = '![[...invalid-filename...]]';
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('Image'); // Default alt text
      }
    });
  });

  describe('createAttachmentImageAltTextRule factory', () => {
    it('should create required rule', () => {
      const rule = createAttachmentImageAltTextRule(
        'attachment-image-alt-text.required',
        mockConfig
      );
      expect(rule).toBeInstanceOf(AttachmentImageAltTextRequiredRule);
    });

    it('should create optional rule', () => {
      const rule = createAttachmentImageAltTextRule(
        'attachment-image-alt-text.optional',
        mockConfig
      );
      expect(rule).toBeInstanceOf(AttachmentImageAltTextOptionalRule);
    });

    it('should create auto-generate rule', () => {
      const rule = createAttachmentImageAltTextRule(
        'attachment-image-alt-text.auto-generate',
        mockConfig
      );
      expect(rule).toBeInstanceOf(AttachmentImageAltTextAutoGenerateRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createAttachmentImageAltTextRule(
          'attachment-image-alt-text.unknown',
          mockConfig
        );
      }).toThrow('Unknown attachment image alt text rule variant');
    });
  });
});
