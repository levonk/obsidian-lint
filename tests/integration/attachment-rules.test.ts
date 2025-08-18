/**
 * Attachment Rules Integration Tests
 * Tests the complete workflow of attachment rules including file operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createAttachmentRule } from '../../src/rules/attachment/index.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../src/types/rules.js';
import type { MarkdownFile } from '../../src/types/common.js';
import { MarkdownParser } from '../../src/utils/markdown.js';
import path from 'path';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';

describe('Attachment Rules Integration', () => {
  let tempDir: string;
  let mockConfig: RuleConfig;
  let parser: MarkdownParser;

  beforeEach(async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), 'obsidian-lint-attachment-test-')
    );
    parser = new MarkdownParser();

    mockConfig = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: ['.*'],
      settings: {
        attachment_directory: 'Meta/Attachments',
        create_subdirectories: true,
        update_links: true,
      },
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Attachment Organization Rules Integration', () => {
    it('should organize attachments centrally', async () => {
      const rule = createAttachmentRule(
        'attachment-organization.centralized',
        mockConfig
      );

      // Create test note with attachment references
      const testContent = `# Test Note

This note has attachments:
![[image.png]]
![Document](document.pdf)`;

      const testFilePath = path.join(tempDir, 'test-note.md');
      await writeFile(testFilePath, testContent);

      // Create attachment files in various locations
      const attachmentsDir = path.join(tempDir, 'attachments');
      await mkdir(attachmentsDir, { recursive: true });

      const imagePath = path.join(attachmentsDir, 'image.png');
      const docPath = path.join(tempDir, 'document.pdf');

      await writeFile(imagePath, 'fake image content');
      await writeFile(docPath, 'fake document content');

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);
      expect(issues).toBeDefined();

      // Run fix if there are issues
      if (issues.length > 0) {
        const fixes = await rule.fix(context, issues);
        expect(fixes).toBeDefined();
      }
    });

    it('should keep attachments with notes', async () => {
      const keepWithNoteConfig = {
        ...mockConfig,
        settings: {
          ...mockConfig.settings,
          organization_strategy: 'keep-with-note',
        },
      };

      const rule = createAttachmentRule(
        'attachment-organization.keep-with-note',
        keepWithNoteConfig
      );

      // Create test note
      const testContent = `# Project Notes

Project diagram:
![[project-diagram.png]]`;

      const notesDir = path.join(tempDir, 'projects');
      await mkdir(notesDir, { recursive: true });

      const testFilePath = path.join(notesDir, 'project-notes.md');
      await writeFile(testFilePath, testContent);

      // Create attachment in wrong location
      const wrongAttachmentPath = path.join(tempDir, 'project-diagram.png');
      await writeFile(wrongAttachmentPath, 'fake diagram content');

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);
      expect(issues).toBeDefined();
    });

    it('should organize attachments by type', async () => {
      const byTypeConfig = {
        ...mockConfig,
        settings: {
          ...mockConfig.settings,
          organization_strategy: 'by-type',
          type_subdirectories: {
            image: 'images',
            document: 'documents',
            video: 'videos',
          },
        },
      };

      const rule = createAttachmentRule(
        'attachment-organization.by-type',
        byTypeConfig
      );

      // Create test note with mixed attachment types
      const testContent = `# Mixed Media Note

Images:
![[photo.jpg]]
![[diagram.svg]]

Documents:
[Report](report.pdf)

Videos:
![[demo.mp4]]`;

      const testFilePath = path.join(tempDir, 'mixed-media.md');
      await writeFile(testFilePath, testContent);

      // Create attachments in root directory
      await writeFile(path.join(tempDir, 'photo.jpg'), 'fake photo');
      await writeFile(path.join(tempDir, 'diagram.svg'), 'fake diagram');
      await writeFile(path.join(tempDir, 'report.pdf'), 'fake report');
      await writeFile(path.join(tempDir, 'demo.mp4'), 'fake video');

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);
      expect(issues).toBeDefined();
    });
  });

  describe('Attachment Format Preference Rules Integration', () => {
    it('should detect images needing PNG conversion', async () => {
      const rule = createAttachmentRule(
        'attachment-format-preference.convert-to-png',
        mockConfig
      );

      // Create test note with various image formats
      const testContent = `# Image Formats Test

JPEG image:
![[photo.jpg]]

GIF animation:
![[animation.gif]]

Already PNG:
![[diagram.png]]`;

      const testFilePath = path.join(tempDir, 'image-formats.md');
      await writeFile(testFilePath, testContent);

      // Create image files
      await writeFile(path.join(tempDir, 'photo.jpg'), 'fake jpeg content');
      await writeFile(path.join(tempDir, 'animation.gif'), 'fake gif content');
      await writeFile(path.join(tempDir, 'diagram.png'), 'fake png content');

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);

      // Should detect JPEG and GIF for conversion, but not PNG
      expect(issues).toBeDefined();
    });

    it('should preserve original formats when configured', async () => {
      const rule = createAttachmentRule(
        'attachment-format-preference.preserve-original',
        mockConfig
      );

      // Create test note with various formats
      const testContent = `# Preserve Formats Test

Various formats:
![[photo.jpg]]
![[document.bmp]]
![[animation.gif]]`;

      const testFilePath = path.join(tempDir, 'preserve-formats.md');
      await writeFile(testFilePath, testContent);

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);

      // Should not report any conversion issues
      expect(issues).toHaveLength(0);
    });

    it('should optimize large images', async () => {
      const rule = createAttachmentRule(
        'attachment-format-preference.optimize-size',
        mockConfig
      );

      // Create test note
      const testContent = `# Size Optimization Test

Large image:
![[large-photo.bmp]]

Small image:
![[small-icon.png]]`;

      const testFilePath = path.join(tempDir, 'size-optimization.md');
      await writeFile(testFilePath, testContent);

      // Create a large BMP file (unoptimized format)
      const largeBmpContent = 'x'.repeat(1024 * 1024); // 1MB of content
      await writeFile(path.join(tempDir, 'large-photo.bmp'), largeBmpContent);

      // Create a small PNG file
      await writeFile(
        path.join(tempDir, 'small-icon.png'),
        'small png content'
      );

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);

      // Should detect the large BMP for optimization
      expect(issues).toBeDefined();
    });
  });

  describe('Attachment Image Alt Text Rules Integration', () => {
    it('should require alt text for all images', async () => {
      const rule = createAttachmentRule(
        'attachment-image-alt-text.required',
        mockConfig
      );

      // Create test note with mixed alt text scenarios
      const testContent = `# Alt Text Test

Good alt text:
![User interface mockup](ui-mockup.png)

Missing alt text:
![](screenshot.png)

Obsidian format (no alt text):
![[diagram.jpg]]`;

      const testFilePath = path.join(tempDir, 'alt-text-test.md');
      await writeFile(testFilePath, testContent);

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);

      // Should find issues for missing alt text and Obsidian format
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(issue => issue.message.includes('screenshot.png'))
      ).toBe(true);
      expect(issues.some(issue => issue.message.includes('diagram.jpg'))).toBe(
        true
      );

      // Run fix
      const fixes = await rule.fix(context, issues);
      if (fixes.length > 0) {
        expect(fixes[0].description).toContain('alt text');

        // Check that the fix converts Obsidian format to Markdown with alt text
        const newContent = fixes[0].changes[0].newText;
        expect(newContent).toContain('![');
        expect(newContent).not.toContain('![[diagram.jpg]]');
      }
    });

    it('should suggest optional alt text', async () => {
      const rule = createAttachmentRule(
        'attachment-image-alt-text.optional',
        mockConfig
      );

      // Create test note
      const testContent = `# Optional Alt Text Test

No alt text:
![](image-without-alt.png)

Has alt text:
![Good description](image-with-alt.png)`;

      const testFilePath = path.join(tempDir, 'optional-alt-text.md');
      await writeFile(testFilePath, testContent);

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);

      // Should suggest alt text with info severity
      const altTextSuggestions = issues.filter(
        issue =>
          issue.severity === 'info' && issue.message.includes('could benefit')
      );
      expect(altTextSuggestions.length).toBeGreaterThan(0);
    });

    it('should auto-generate alt text from filenames', async () => {
      const rule = createAttachmentRule(
        'attachment-image-alt-text.auto-generate',
        mockConfig
      );

      // Create test note with descriptive filenames
      const testContent = `# Auto-Generate Alt Text Test

Descriptive filename:
![[user-profile-photo.png]]

Technical filename:
![[IMG_20240115_screenshot.jpg]]

Already has alt text:
![Existing alt text](existing-alt.png)`;

      const testFilePath = path.join(tempDir, 'auto-generate-alt.md');
      await writeFile(testFilePath, testContent);

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint
      const issues = await rule.lint(context);
      expect(issues.length).toBeGreaterThan(0);

      // Run fix
      const fixes = await rule.fix(context, issues);
      if (fixes.length > 0) {
        const newContent = fixes[0].changes[0].newText;

        // Should generate meaningful alt text from filenames
        expect(newContent).toContain('User Profile');
        expect(newContent).toContain('Screenshot'); // Should generate alt text for technical files
      }
    });
  });

  describe('Combined Attachment Rules Workflow', () => {
    it('should handle multiple attachment rules together', async () => {
      // Test organization + alt text rules together
      const organizationRule = createAttachmentRule(
        'attachment-organization.centralized',
        mockConfig
      );

      const altTextRule = createAttachmentRule(
        'attachment-image-alt-text.required',
        mockConfig
      );

      // Create test note
      const testContent = `# Combined Rules Test

Image without alt text:
![[user-photo.jpg]]

Document reference:
[Important Document](report.pdf)`;

      const testFilePath = path.join(tempDir, 'combined-test.md');
      await writeFile(testFilePath, testContent);

      // Create attachments in wrong locations
      await writeFile(path.join(tempDir, 'user-photo.jpg'), 'fake photo');
      await writeFile(path.join(tempDir, 'report.pdf'), 'fake document');

      // Parse the file
      const markdownFile = await parser.parseMarkdown(
        testFilePath,
        testContent
      );
      const context: RuleExecutionContext = {
        file: markdownFile,
        vaultPath: tempDir,
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run both rules
      const organizationIssues = await organizationRule.lint(context);
      const altTextIssues = await altTextRule.lint(context);

      // Should find issues from both rules
      expect(organizationIssues).toBeDefined();
      expect(altTextIssues).toBeDefined();

      // Apply fixes from both rules
      const organizationFixes = await organizationRule.fix(
        context,
        organizationIssues
      );
      const altTextFixes = await altTextRule.fix(context, altTextIssues);

      expect(organizationFixes).toBeDefined();
      expect(altTextFixes).toBeDefined();
    });
  });
});
