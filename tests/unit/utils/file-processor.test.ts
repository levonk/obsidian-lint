/**
 * Unit tests for file processor utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { FileProcessor } from '../../../src/utils/file-processor.js';

describe('FileProcessor', () => {
  const processor = new FileProcessor();
  const testDir = join(process.cwd(), 'tests', 'temp');

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('scanVault', () => {
    beforeEach(async () => {
      // Create test vault structure
      await fs.mkdir(join(testDir, 'notes'), { recursive: true });
      await fs.mkdir(join(testDir, 'attachments'), { recursive: true });
      await fs.mkdir(join(testDir, 'templates'), { recursive: true });

      await fs.writeFile(join(testDir, 'notes', 'note1.md'), '# Note 1');
      await fs.writeFile(join(testDir, 'notes', 'note2.md'), '# Note 2');
      await fs.writeFile(
        join(testDir, 'attachments', 'image.png'),
        'fake image'
      );
      await fs.writeFile(
        join(testDir, 'templates', 'template.md'),
        '# Template'
      );
      await fs.writeFile(join(testDir, 'README.md'), '# README');
    });

    it('should scan for markdown files with default pattern', async () => {
      const files = await processor.scanVault(testDir);

      expect(files).toHaveLength(4);
      expect(files.some(f => f.includes('note1.md'))).toBe(true);
      expect(files.some(f => f.includes('note2.md'))).toBe(true);
      expect(files.some(f => f.includes('template.md'))).toBe(true);
      expect(files.some(f => f.includes('README.md'))).toBe(true);
    });

    it('should scan with custom patterns', async () => {
      const files = await processor.scanVault(testDir, ['notes/**/*.md']);

      expect(files).toHaveLength(2);
      expect(files.every(f => f.includes('notes/'))).toBe(true);
    });

    it('should handle empty directory', async () => {
      const emptyDir = join(testDir, 'empty');
      await fs.mkdir(emptyDir);

      const files = await processor.scanVault(emptyDir);
      expect(files).toHaveLength(0);
    });

    it('should ignore common directories', async () => {
      await fs.mkdir(join(testDir, 'node_modules'), { recursive: true });
      await fs.mkdir(join(testDir, '.git'), { recursive: true });
      await fs.writeFile(
        join(testDir, 'node_modules', 'package.md'),
        '# Package'
      );
      await fs.writeFile(join(testDir, '.git', 'config.md'), '# Config');

      const files = await processor.scanVault(testDir);

      expect(files.some(f => f.includes('node_modules'))).toBe(false);
      expect(files.some(f => f.includes('.git'))).toBe(false);
    });
  });

  describe('parseMarkdownFile', () => {
    it('should parse markdown file from disk', async () => {
      const filePath = join(testDir, 'test.md');
      const content = `---
title: "Test"
---

# Test Note`;

      await fs.writeFile(filePath, content);

      const result = await processor.parseMarkdownFile(filePath);

      expect(result.path).toBe(filePath);
      expect(result.content).toBe(content);
      expect(result.frontmatter.title).toBe('Test');
      expect(result.headings).toHaveLength(1);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = join(testDir, 'nonexistent.md');

      await expect(processor.parseMarkdownFile(filePath)).rejects.toThrow();
    });
  });

  describe('writeFile', () => {
    it('should write file atomically', async () => {
      const filePath = join(testDir, 'output.md');
      const content = '# Test Content';

      await processor.writeFile(filePath, content);

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);
    });

    it('should create directories if needed', async () => {
      const filePath = join(testDir, 'deep', 'nested', 'file.md');
      const content = '# Deep File';

      await processor.writeFile(filePath, content);

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const filePath = join(testDir, 'existing.md');

      await fs.writeFile(filePath, 'Original content');
      await processor.writeFile(filePath, 'New content');

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe('New content');
    });
  });

  describe('moveFile', () => {
    it('should move file successfully', async () => {
      const sourcePath = join(testDir, 'source.md');
      const destPath = join(testDir, 'dest.md');
      const content = '# Source File';

      await fs.writeFile(sourcePath, content);
      await processor.moveFile(sourcePath, destPath);

      // Source should not exist
      await expect(fs.access(sourcePath)).rejects.toThrow();

      // Destination should exist with correct content
      const moved = await fs.readFile(destPath, 'utf-8');
      expect(moved).toBe(content);
    });

    it('should create destination directory', async () => {
      const sourcePath = join(testDir, 'source.md');
      const destPath = join(testDir, 'subdir', 'dest.md');
      const content = '# Source File';

      await fs.writeFile(sourcePath, content);
      await processor.moveFile(sourcePath, destPath);

      const moved = await fs.readFile(destPath, 'utf-8');
      expect(moved).toBe(content);
    });

    it('should throw error if destination exists', async () => {
      const sourcePath = join(testDir, 'source.md');
      const destPath = join(testDir, 'dest.md');

      await fs.writeFile(sourcePath, 'Source');
      await fs.writeFile(destPath, 'Destination');

      await expect(processor.moveFile(sourcePath, destPath)).rejects.toThrow();
    });

    it("should throw error if source doesn't exist", async () => {
      const sourcePath = join(testDir, 'nonexistent.md');
      const destPath = join(testDir, 'dest.md');

      await expect(processor.moveFile(sourcePath, destPath)).rejects.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(testDir, 'exists.md');
      await fs.writeFile(filePath, 'Content');

      const exists = await processor.fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const filePath = join(testDir, 'nonexistent.md');

      const exists = await processor.fileExists(filePath);
      expect(exists).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('should return file stats', async () => {
      const filePath = join(testDir, 'stats.md');
      const content = '# Test Content';
      await fs.writeFile(filePath, content);

      const stats = await processor.getFileStats(filePath);

      expect(stats.size).toBe(content.length);
      expect(stats.mtime).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = join(testDir, 'nonexistent.md');

      await expect(processor.getFileStats(filePath)).rejects.toThrow();
    });
  });

  describe('filterFilesByPatterns', () => {
    const files = [
      '/vault/notes/note1.md',
      '/vault/notes/note2.md',
      '/vault/templates/template.md',
      '/vault/attachments/image.png',
      '/vault/README.md',
    ];

    it('should include all files with default patterns', () => {
      const filtered = processor.filterFilesByPatterns(files);
      expect(filtered).toHaveLength(5);
    });

    it('should filter by include patterns', () => {
      const filtered = processor.filterFilesByPatterns(files, ['**/notes/**']);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(f => f.includes('/notes/'))).toBe(true);
    });

    it('should filter by exclude patterns', () => {
      const filtered = processor.filterFilesByPatterns(
        files,
        ['**/*'],
        ['**/templates/**', '**/*.png']
      );
      expect(filtered).toHaveLength(3);
      expect(filtered.some(f => f.includes('template'))).toBe(false);
      expect(filtered.some(f => f.includes('.png'))).toBe(false);
    });

    it('should handle complex patterns', () => {
      const filtered = processor.filterFilesByPatterns(
        files,
        ['**/*.md'],
        ['**/templates/**']
      );
      expect(filtered).toHaveLength(3);
      expect(filtered.every(f => f.endsWith('.md'))).toBe(true);
      expect(filtered.some(f => f.includes('template'))).toBe(false);
    });
  });

  describe('copyFile', () => {
    it('should copy file successfully', async () => {
      const sourcePath = join(testDir, 'source.md');
      const destPath = join(testDir, 'copy.md');
      const content = '# Source Content';

      await fs.writeFile(sourcePath, content);
      await processor.copyFile(sourcePath, destPath);

      // Both files should exist
      const sourceContent = await fs.readFile(sourcePath, 'utf-8');
      const destContent = await fs.readFile(destPath, 'utf-8');

      expect(sourceContent).toBe(content);
      expect(destContent).toBe(content);
    });
  });

  describe('createBackup', () => {
    it('should create backup with timestamp', async () => {
      const filePath = join(testDir, 'original.md');
      const content = '# Original Content';

      await fs.writeFile(filePath, content);
      const backupPath = await processor.createBackup(filePath);

      expect(backupPath).toMatch(/\.backup\.\d+$/);

      const backupContent = await fs.readFile(backupPath, 'utf-8');
      expect(backupContent).toBe(content);
    });
  });
});
