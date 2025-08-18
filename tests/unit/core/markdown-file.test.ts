/**
 * Unit tests for MarkdownFile class
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { MarkdownFile } from '../../../src/core/markdown-file.js';
import type { FileChange } from '../../../src/types/index.js';

describe('MarkdownFile', () => {
  const testDir = join(process.cwd(), 'tests', 'temp');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('fromFile', () => {
    it('should create MarkdownFile from file path', async () => {
      const filePath = join(testDir, 'test.md');
      const content = `---
title: "Test Note"
tags: ["test"]
---

# Test Heading

Some content with [[internal link]] and [external](https://example.com).`;

      await fs.writeFile(filePath, content);

      const mdFile = await MarkdownFile.fromFile(filePath);

      expect(mdFile.path).toBe(filePath);
      expect(mdFile.frontmatter.title).toBe('Test Note');
      expect(mdFile.headings).toHaveLength(1);
      expect(mdFile.links).toHaveLength(2);
    });
  });

  describe('fromContent', () => {
    it('should create MarkdownFile from content string', async () => {
      const content = `# Simple Note

Just some content.`;

      const mdFile = await MarkdownFile.fromContent('/test/note.md', content);

      expect(mdFile.path).toBe('/test/note.md');
      expect(mdFile.content).toBe(content);
      expect(mdFile.headings).toHaveLength(1);
    });
  });

  describe('frontmatter manipulation', () => {
    let mdFile: MarkdownFile;

    beforeEach(async () => {
      const content = `---
title: "Original Title"
tags: ["tag1", "tag2"]
---

# Content`;

      mdFile = await MarkdownFile.fromContent('/test/note.md', content);
    });

    it('should update single frontmatter field', () => {
      mdFile.updateFrontmatter('title', 'New Title');

      expect(mdFile.frontmatter.title).toBe('New Title');
      expect(mdFile.content).toContain('title: "New Title"');
    });

    it('should update multiple frontmatter fields', () => {
      mdFile.updateFrontmatterFields({
        title: 'Updated Title',
        status: 'draft',
      });

      expect(mdFile.frontmatter.title).toBe('Updated Title');
      expect(mdFile.frontmatter.status).toBe('draft');
      expect(mdFile.content).toContain('title: "Updated Title"');
      expect(mdFile.content).toContain('status: draft');
    });

    it('should remove frontmatter field', () => {
      mdFile.removeFrontmatterField('tags');

      expect(mdFile.frontmatter.tags).toBeUndefined();
      expect(mdFile.content).not.toContain('tags:');
    });

    it('should handle empty frontmatter', async () => {
      const content = `# No Frontmatter

Just content.`;

      const mdFile = await MarkdownFile.fromContent('/test/note.md', content);
      mdFile.updateFrontmatter('title', 'Added Title');

      expect(mdFile.frontmatter.title).toBe('Added Title');
      expect(mdFile.content).toContain('title: "Added Title"');
    });
  });

  describe('content manipulation', () => {
    it('should update content and reparse', async () => {
      const originalContent = `# Original

Content`;

      const mdFile = await MarkdownFile.fromContent(
        '/test/note.md',
        originalContent
      );

      const newContent = `---
title: "New"
---

# New Heading

New content with [[link]].`;

      await mdFile.updateContent(newContent);

      expect(mdFile.content).toBe(newContent);
      expect(mdFile.frontmatter.title).toBe('New');
      expect(mdFile.headings).toHaveLength(1);
      expect(mdFile.headings[0].text).toBe('New Heading');
      expect(mdFile.links).toHaveLength(1);
    });
  });

  describe('applyChanges', () => {
    let mdFile: MarkdownFile;

    beforeEach(async () => {
      const content = `# Heading

Line 1
Line 2
Line 3`;

      mdFile = await MarkdownFile.fromContent('/test/note.md', content);
    });

    it('should apply insert changes', () => {
      const changes: FileChange[] = [
        {
          type: 'insert',
          line: 2,
          newText: 'Inserted line',
        },
      ];

      mdFile.applyChanges(changes);

      const lines = mdFile.content.split('\n');
      expect(lines[2]).toBe('Inserted line');
    });

    it('should apply delete changes', () => {
      const changes: FileChange[] = [
        {
          type: 'delete',
          line: 2,
        },
      ];

      mdFile.applyChanges(changes);

      const lines = mdFile.content.split('\n');
      expect(lines).toHaveLength(4); // One line removed
      expect(lines[2]).toBe('Line 2'); // Line 1 was removed
    });

    it('should apply replace changes', () => {
      const changes: FileChange[] = [
        {
          type: 'replace',
          line: 2,
          newText: 'Replaced line',
        },
      ];

      mdFile.applyChanges(changes);

      const lines = mdFile.content.split('\n');
      expect(lines[2]).toBe('Replaced line');
    });

    it('should apply text replacement changes', () => {
      const changes: FileChange[] = [
        {
          type: 'replace',
          oldText: 'Line 1',
          newText: 'Modified Line 1',
        },
      ];

      mdFile.applyChanges(changes);

      expect(mdFile.content).toContain('Modified Line 1');
      expect(mdFile.content).not.toContain('Line 1');
    });

    it('should handle multiple changes in correct order', () => {
      const changes: FileChange[] = [
        {
          type: 'replace',
          line: 3,
          newText: 'Replaced Line 2',
        },
        {
          type: 'insert',
          line: 1,
          newText: 'Inserted after heading',
        },
      ];

      mdFile.applyChanges(changes);

      const lines = mdFile.content.split('\n');
      expect(lines[1]).toBe('Inserted after heading');
      expect(lines[4]).toBe('Replaced Line 2'); // Adjusted for insertion
    });
  });

  describe('file operations', () => {
    it('should save file to disk', async () => {
      const filePath = join(testDir, 'save-test.md');
      const content = `# Save Test

Content to save.`;

      const mdFile = await MarkdownFile.fromContent(filePath, content);
      await mdFile.save();

      const saved = await fs.readFile(filePath, 'utf-8');
      expect(saved).toBe(content);
    });

    it('should save file to new location', async () => {
      const originalPath = join(testDir, 'original.md');
      const newPath = join(testDir, 'new-location.md');
      const content = `# Test Content`;

      const mdFile = await MarkdownFile.fromContent(originalPath, content);
      await mdFile.saveAs(newPath);

      expect(mdFile.path).toBe(newPath);

      const saved = await fs.readFile(newPath, 'utf-8');
      expect(saved).toBe(content);
    });

    it('should track modification status', async () => {
      const content = `# Original`;
      const mdFile = await MarkdownFile.fromContent('/test/note.md', content);

      expect(mdFile.isModified()).toBe(false);

      mdFile.updateFrontmatter('title', 'Modified');
      expect(mdFile.isModified()).toBe(true);
    });

    it('should create backup', async () => {
      const filePath = join(testDir, 'backup-test.md');
      const content = `# Backup Test`;

      await fs.writeFile(filePath, content);
      const mdFile = await MarkdownFile.fromFile(filePath);

      const backupPath = await mdFile.createBackup();

      expect(backupPath).toMatch(/\.backup\.\d+$/);

      const backupContent = await fs.readFile(backupPath, 'utf-8');
      expect(backupContent).toBe(content);
    });
  });

  describe('utility methods', () => {
    let mdFile: MarkdownFile;

    beforeEach(async () => {
      const content = `---
title: "Test Note"
tags: ["tag1", "tag2"]
status: "draft"
---

# Main Heading

Some content with multiple words.

## Sub Heading

More content with [[internal link]] and [external](https://example.com).

![[attachment.png]]`;

      mdFile = await MarkdownFile.fromContent('/test/note.md', content);
    });

    it('should get frontmatter as YAML', () => {
      const yaml = mdFile.getFrontmatterYaml();

      expect(yaml).toContain('title: "Test Note"');
      expect(yaml).toContain('tags:\n  - tag1\n  - tag2');
      expect(yaml).toContain('status: draft');
      expect(yaml).toStartWith('---');
      expect(yaml).toEndWith('---');
    });

    it('should get content without frontmatter', () => {
      const content = mdFile.getContentWithoutFrontmatter();

      expect(content).not.toContain('---');
      expect(content).not.toContain('title:');
      expect(content).toStartWith('# Main Heading');
    });

    it('should generate summary', () => {
      const summary = mdFile.getSummary();

      expect(summary).toEqual({
        path: '/test/note.md',
        headingCount: 2,
        linkCount: 2,
        attachmentCount: 1,
        frontmatterFields: ['title', 'tags', 'status'],
        wordCount: expect.any(Number),
      });
      expect(summary.wordCount).toBeGreaterThan(0);
    });

    it('should handle empty frontmatter in YAML generation', async () => {
      const content = `# No Frontmatter

Just content.`;

      const mdFile = await MarkdownFile.fromContent('/test/note.md', content);
      const yaml = mdFile.getFrontmatterYaml();

      expect(yaml).toBe('');
    });
  });

  describe('link resolution', () => {
    it('should find broken internal links', async () => {
      // Create a test file that exists
      const existingFile = join(testDir, 'existing.md');
      await fs.writeFile(existingFile, '# Existing');

      const content = `# Test

Links to [[existing]] and [[nonexistent]].`;

      const mdFile = await MarkdownFile.fromContent(
        join(testDir, 'test.md'),
        content
      );
      const brokenLinks = await mdFile.findBrokenLinks(testDir);

      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].target).toBe('nonexistent');
      expect(brokenLinks[0].isValid).toBe(false);
    });
  });
});
