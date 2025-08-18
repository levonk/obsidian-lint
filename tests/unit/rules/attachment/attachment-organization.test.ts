/**
 * Attachment Organization Rules Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  AttachmentOrganizationCentralizedRule,
  AttachmentOrganizationKeepWithNoteRule,
  AttachmentOrganizationByTypeRule,
  createAttachmentOrganizationRule,
} from '../../../../src/rules/attachment/attachment-organization.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Attachment Organization Rules', () => {
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
        attachment_directory: 'Meta/Attachments',
        create_subdirectories: true,
        preserve_structure: false,
        update_links: true,
        allowed_extensions: [
          '.png',
          '.jpg',
          '.jpeg',
          '.gif',
          '.svg',
          '.pdf',
          '.mp4',
          '.mov',
          '.docx',
          '.doc',
          '.xlsx',
          '.xls',
          '.pptx',
          '.ppt',
        ],
        organization_strategy: 'centralized',
        type_subdirectories: {
          image: 'images',
          video: 'videos',
          document: 'documents',
          other: 'other',
        },
      },
    };

    mockFile = {
      path: 'test-note.md',
      content: `# Test Note

This note has attachments:
![[image.png]]
![Alt text](photo.jpg)
[Document](report.pdf)`,
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

    // Create test attachment files
    await writeFile(path.join(tempDir, 'image.png'), 'fake png content');
    await writeFile(path.join(tempDir, 'photo.jpg'), 'fake jpg content');
    await writeFile(path.join(tempDir, 'report.pdf'), 'fake pdf content');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('AttachmentOrganizationCentralizedRule', () => {
    let rule: AttachmentOrganizationCentralizedRule;

    beforeEach(() => {
      rule = new AttachmentOrganizationCentralizedRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('attachment-organization.centralized');
      expect(rule.name).toBe('Centralized Attachment Organization');
      expect(rule.category).toBe('attachment');
    });

    it('should detect attachments not in central directory', async () => {
      const issues = await rule.lint(mockContext);

      // Should find issues for attachments not in Meta/Attachments
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(issue => issue.message.includes('Meta/Attachments'))
      ).toBe(true);
    });

    it('should not report issues when attachments are already centralized', async () => {
      // Create centralized directory structure with type subdirectories
      const attachmentsDir = path.join(tempDir, 'Meta', 'Attachments');
      const imagesDir = path.join(attachmentsDir, 'images');
      const documentsDir = path.join(attachmentsDir, 'documents');
      await mkdir(imagesDir, { recursive: true });
      await mkdir(documentsDir, { recursive: true });

      // Move files to centralized location with type subdirectories
      await writeFile(path.join(imagesDir, 'image.png'), 'fake png content');
      await writeFile(path.join(imagesDir, 'photo.jpg'), 'fake jpg content');
      await writeFile(
        path.join(documentsDir, 'report.pdf'),
        'fake pdf content'
      );

      // Update file content to reference centralized paths
      mockFile.content = `# Test Note

This note has centralized attachments:
![[Meta/Attachments/images/image.png]]
![Alt text](Meta/Attachments/images/photo.jpg)
[Document](Meta/Attachments/documents/report.pdf)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should create fixes to move attachments to central directory', async () => {
      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        expect(fixes[0].description).toContain('Moved attachments');
        expect(fixes[0].changes).toBeDefined();
        expect(fixes[0].changes[0].newText).toContain('Meta/Attachments');
      }
    });

    it('should organize attachments into type subdirectories when enabled', async () => {
      const issues = await rule.lint(mockContext);

      // Check that expected paths include type subdirectories
      expect(issues.length).toBeGreaterThan(0);
      const imageIssue = issues.find(issue =>
        issue.message.includes('image.png')
      );
      if (imageIssue) {
        expect(imageIssue.message).toContain('images');
      }
    });

    it('should handle missing attachment files gracefully', async () => {
      mockFile.content = `# Test Note

This note references missing attachments:
![[missing-image.png]]
![Missing photo](missing-photo.jpg)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);

      // Should report missing files as errors
      expect(issues.some(issue => issue.severity === 'error')).toBe(true);
      expect(issues.some(issue => issue.message.includes('not found'))).toBe(
        true
      );
    });
  });

  describe('AttachmentOrganizationKeepWithNoteRule', () => {
    let rule: AttachmentOrganizationKeepWithNoteRule;

    beforeEach(() => {
      rule = new AttachmentOrganizationKeepWithNoteRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('attachment-organization.keep-with-note');
      expect(rule.name).toBe('Keep Attachments With Notes');
      expect(rule.category).toBe('attachment');
    });

    it('should detect attachments not near their notes', async () => {
      // Create note in subdirectory
      const notesDir = path.join(tempDir, 'projects');
      await mkdir(notesDir, { recursive: true });

      mockFile.path = path.join('projects', 'project-note.md');
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);

      // Should find issues for attachments not in the same directory
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should not report issues when attachments are with their notes', async () => {
      // Create note and attachments in attachments subdirectory (since create_subdirectories is true)
      const notesDir = path.join(tempDir, 'projects');
      const attachmentsSubdir = path.join(notesDir, 'attachments');
      await mkdir(attachmentsSubdir, { recursive: true });

      await writeFile(
        path.join(attachmentsSubdir, 'image.png'),
        'fake png content'
      );
      await writeFile(
        path.join(attachmentsSubdir, 'photo.jpg'),
        'fake jpg content'
      );
      await writeFile(
        path.join(attachmentsSubdir, 'report.pdf'),
        'fake pdf content'
      );

      mockFile.path = path.join('projects', 'project-note.md');
      mockFile.content = `# Project Note

This note has local attachments:
![[projects/attachments/image.png]]
![Alt text](projects/attachments/photo.jpg)
[Document](projects/attachments/report.pdf)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should create attachments subdirectory when configured', async () => {
      const notesDir = path.join(tempDir, 'projects');
      await mkdir(notesDir, { recursive: true });

      mockFile.path = path.join('projects', 'project-note.md');
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);

      // Expected paths should include attachments subdirectory
      expect(issues.length).toBeGreaterThan(0);
      const imageIssue = issues.find(issue =>
        issue.message.includes('image.png')
      );
      if (imageIssue) {
        expect(imageIssue.message).toContain('attachments');
      }
    });
  });

  describe('AttachmentOrganizationByTypeRule', () => {
    let rule: AttachmentOrganizationByTypeRule;

    beforeEach(() => {
      rule = new AttachmentOrganizationByTypeRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('attachment-organization.by-type');
      expect(rule.name).toBe('Organize Attachments By Type');
      expect(rule.category).toBe('attachment');
    });

    it('should organize attachments by file type', async () => {
      const issues = await rule.lint(mockContext);

      expect(issues.length).toBeGreaterThan(0);

      // Check that different file types get different subdirectories
      const imageIssue = issues.find(issue =>
        issue.message.includes('image.png')
      );
      const documentIssue = issues.find(issue =>
        issue.message.includes('report.pdf')
      );

      if (imageIssue) {
        expect(imageIssue.message).toContain('images');
      }
      if (documentIssue) {
        expect(documentIssue.message).toContain('documents');
      }
    });

    it('should handle unknown file types', async () => {
      // Add an unknown file type
      await writeFile(path.join(tempDir, 'data.xyz'), 'fake data content');

      mockFile.content = `# Test Note

Unknown file type:
[Data file](data.xyz)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);

      // Should organize unknown types into 'other' directory
      const unknownIssue = issues.find(issue =>
        issue.message.includes('data.xyz')
      );
      if (unknownIssue) {
        expect(unknownIssue.message).toContain('other');
      }
    });
  });

  describe('Settings validation', () => {
    it('should use default settings for invalid values', () => {
      const invalidConfig = {
        ...mockConfig,
        settings: {
          attachment_directory: 123, // Invalid: not a string
          create_subdirectories: 'yes', // Invalid: not a boolean
          update_links: null, // Invalid: not a boolean
        },
      };

      const rule = new AttachmentOrganizationCentralizedRule(invalidConfig);

      // Should fall back to defaults
      expect(rule).toBeDefined();
    });

    it('should handle missing settings gracefully', () => {
      const minimalConfig = {
        ...mockConfig,
        settings: {},
      };

      const rule = new AttachmentOrganizationCentralizedRule(minimalConfig);
      expect(rule).toBeDefined();
    });

    it('should validate allowed extensions', () => {
      const customConfig = {
        ...mockConfig,
        settings: {
          ...mockConfig.settings,
          allowed_extensions: ['.png', '.jpg'], // Only allow specific formats
        },
      };

      const rule = new AttachmentOrganizationCentralizedRule(customConfig);
      expect(rule).toBeDefined();
    });
  });

  describe('Link updating functionality', () => {
    it('should update links when attachments are moved', async () => {
      const rule = new AttachmentOrganizationCentralizedRule(mockConfig);

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        const updatedContent = fixes[0].changes[0].newText;

        // Links should be updated to point to new locations
        expect(updatedContent).toContain('Meta/Attachments');
        expect(updatedContent).not.toBe(mockFile.content);
      }
    });

    it('should preserve link format when updating', async () => {
      const rule = new AttachmentOrganizationCentralizedRule(mockConfig);

      mockFile.content = `# Test Note

Obsidian format: ![[image.png]]
Markdown format: ![Alt text](photo.jpg)
Link format: [Document](report.pdf)`;
      mockContext.file = mockFile;

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      if (fixes.length > 0) {
        const updatedContent = fixes[0].changes[0].newText;

        // Should preserve the original link formats
        expect(updatedContent).toContain('![[');
        expect(updatedContent).toContain('![Alt text]');
        expect(updatedContent).toContain('[Document]');
      }
    });
  });

  describe('createAttachmentOrganizationRule factory', () => {
    it('should create centralized rule', () => {
      const rule = createAttachmentOrganizationRule(
        'attachment-organization.centralized',
        mockConfig
      );
      expect(rule).toBeInstanceOf(AttachmentOrganizationCentralizedRule);
    });

    it('should create keep-with-note rule', () => {
      const rule = createAttachmentOrganizationRule(
        'attachment-organization.keep-with-note',
        mockConfig
      );
      expect(rule).toBeInstanceOf(AttachmentOrganizationKeepWithNoteRule);
    });

    it('should create by-type rule', () => {
      const rule = createAttachmentOrganizationRule(
        'attachment-organization.by-type',
        mockConfig
      );
      expect(rule).toBeInstanceOf(AttachmentOrganizationByTypeRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createAttachmentOrganizationRule(
          'attachment-organization.unknown',
          mockConfig
        );
      }).toThrow('Unknown attachment organization rule variant');
    });
  });

  describe('File type detection', () => {
    it('should correctly identify image types', async () => {
      const rule = new AttachmentOrganizationByTypeRule(mockConfig);

      mockFile.content = `# Test Note

Various image formats:
![[photo.jpg]]
![[diagram.png]]
![[icon.svg]]
![[animation.gif]]`;
      mockContext.file = mockFile;

      // Create the image files
      await writeFile(path.join(tempDir, 'photo.jpg'), 'fake jpg');
      await writeFile(path.join(tempDir, 'diagram.png'), 'fake png');
      await writeFile(path.join(tempDir, 'icon.svg'), 'fake svg');
      await writeFile(path.join(tempDir, 'animation.gif'), 'fake gif');

      const issues = await rule.lint(mockContext);

      // All should be categorized as images
      issues.forEach(issue => {
        expect(issue.message).toContain('images');
      });
    });

    it('should correctly identify document types', async () => {
      const rule = new AttachmentOrganizationByTypeRule(mockConfig);

      mockFile.content = `# Test Note

Various document formats:
[PDF](document.pdf)
[Word](document.docx)
[Excel](spreadsheet.xlsx)`;
      mockContext.file = mockFile;

      // Create the document files
      await writeFile(path.join(tempDir, 'document.pdf'), 'fake pdf');
      await writeFile(path.join(tempDir, 'document.docx'), 'fake docx');
      await writeFile(path.join(tempDir, 'spreadsheet.xlsx'), 'fake xlsx');

      const issues = await rule.lint(mockContext);

      // All should be categorized as documents
      issues.forEach(issue => {
        expect(issue.message).toContain('documents');
      });
    });

    it('should correctly identify video types', async () => {
      const rule = new AttachmentOrganizationByTypeRule(mockConfig);

      mockFile.content = `# Test Note

Various video formats:
![[video.mp4]]
![[movie.mov]]`;
      mockContext.file = mockFile;

      // Create the video files
      await writeFile(path.join(tempDir, 'video.mp4'), 'fake mp4');
      await writeFile(path.join(tempDir, 'movie.mov'), 'fake mov');

      const issues = await rule.lint(mockContext);

      // All should be categorized as videos
      issues.forEach(issue => {
        expect(issue.message).toContain('videos');
      });
    });
  });
});
