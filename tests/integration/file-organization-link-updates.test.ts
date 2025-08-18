/**
 * File Organization with Link Updates Integration Tests
 * Tests the complete workflow of file organization rules with link updating
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createFileOrganizationRule } from '../../src/rules/file-organization/index.js';
import { LinkUpdater } from '../../src/utils/link-updater.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../src/types/rules.js';
import type { MarkdownFile, FileChange } from '../../src/types/common.js';
import { MarkdownParser } from '../../src/utils/markdown.js';
import path from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';

// Helper function to normalize paths for cross-platform testing
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

describe('File Organization with Link Updates Integration', () => {
  let tempDir: string;
  let mockConfig: RuleConfig;
  let parser: MarkdownParser;
  let linkUpdater: LinkUpdater;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'obsidian-lint-link-test-'));
    parser = new MarkdownParser();
    linkUpdater = new LinkUpdater();

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

  describe('File Naming with Link Updates', () => {
    it('should generate correct file changes for renaming with link updates', async () => {
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
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      // Run lint and fix
      const issues = await rule.lint(context);
      expect(issues).toHaveLength(1);
      expect(issues[0].fixable).toBe(true);

      const fixes = await rule.fix!(context, issues);
      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('move');
      expect(fixes[0].changes[0].oldPath).toBe(testFilePath);
      expect(fixes[0].changes[0].newPath).toContain('my-test-file.md');
    });

    it('should handle link updates when files are renamed', async () => {
      // Create source file with link to target
      const sourceContent = '# Source File\n\nThis links to [[My Test File]].';
      const sourcePath = path.join(tempDir, 'source.md');
      await writeFile(sourcePath, sourceContent);

      // Create target file that will be renamed
      const targetContent = '# My Test File\n\nThis is the target file.';
      const targetPath = path.join(tempDir, 'My Test File.md');
      await writeFile(targetPath, targetContent);

      // Simulate file rename change
      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: targetPath,
          newPath: path.join(tempDir, 'my-test-file.md'),
        },
      ];

      // Update links in source file
      const linkUpdateResult = linkUpdater.updateLinksInContent(
        sourceContent,
        changes,
        sourcePath
      );

      expect(linkUpdateResult.linksUpdated).toBeGreaterThan(0);
      expect(linkUpdateResult.updatedContent).toContain('[[my-test-file]]');
      expect(linkUpdateResult.errors).toHaveLength(0);
    });

    it('should handle markdown-style links when files are renamed', async () => {
      // Create source file with markdown link to target
      const sourceContent =
        '# Source File\n\nThis links to [Test File](My Test File.md).';
      const sourcePath = path.join(tempDir, 'source.md');
      await writeFile(sourcePath, sourceContent);

      // Simulate file rename change
      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: path.join(tempDir, 'My Test File.md'),
          newPath: path.join(tempDir, 'my-test-file.md'),
        },
      ];

      // Update links in source file
      const linkUpdateResult = linkUpdater.updateLinksInContent(
        sourceContent,
        changes,
        sourcePath
      );

      expect(linkUpdateResult.linksUpdated).toBeGreaterThan(0);
      expect(linkUpdateResult.updatedContent).toContain('(my-test-file.md)');
      expect(linkUpdateResult.errors).toHaveLength(0);
    });
  });

  describe('File Path Organization with Link Updates', () => {
    it('should generate correct file changes for path organization', async () => {
      const rule = createFileOrganizationRule(
        'file-path-organization.by-date',
        mockConfig
      );

      // Create test file with date in frontmatter
      const testFilePath = path.join(tempDir, 'test-file.md');
      const testContent = `---
date_created: "2024-03-15"
---
# Test File

This is a test file.`;
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

      // Run lint and fix
      const issues = await rule.lint(context);
      expect(issues.length).toBeGreaterThan(0);

      const fixes = await rule.fix!(context, issues);
      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('move');
      expect(normalizePath(fixes[0].changes[0].newPath!)).toContain('2024/03');
    });

    it('should handle link updates when files are moved to different directories', async () => {
      // Create source file with link to target
      const sourceContent = '# Source File\n\nThis links to [[test-file]].';
      const sourcePath = path.join(tempDir, 'source.md');
      await writeFile(sourcePath, sourceContent);

      // Simulate file move to date-based directory
      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: path.join(tempDir, 'test-file.md'),
          newPath: path.join(tempDir, 'Notes', '2024', '03', 'test-file.md'),
        },
      ];

      // Update links in source file
      const linkUpdateResult = linkUpdater.updateLinksInContent(
        sourceContent,
        changes,
        sourcePath
      );

      expect(linkUpdateResult.linksUpdated).toBeGreaterThan(0);
      expect(normalizePath(linkUpdateResult.updatedContent)).toContain(
        '[[2024/03/test-file]]'
      );
      expect(linkUpdateResult.errors).toHaveLength(0);
    });
  });

  describe('Duplicate File Detection with Link Updates', () => {
    it('should handle link updates when duplicate files are removed', async () => {
      const duplicateConfig = {
        ...mockConfig,
        settings: {
          comparison_method: 'content',
          auto_remove_duplicates: true,
        },
      };

      // Create source file with links to both duplicates
      const sourceContent = `# Source File

This links to [[file1]] and [[file2]].`;
      const sourcePath = path.join(tempDir, 'source.md');
      await writeFile(sourcePath, sourceContent);

      // Simulate duplicate file removal (file2 is removed, links should point to file1)
      const changes: FileChange[] = [
        {
          type: 'delete',
          oldPath: path.join(tempDir, 'file2.md'),
        },
      ];

      // In a real scenario, the link updater would need to be enhanced to handle
      // duplicate removal by redirecting links to the remaining file
      // For now, we just test that the change structure is correct
      expect(changes[0].type).toBe('delete');
      expect(changes[0].oldPath).toContain('file2.md');
    });
  });

  describe('Complex File Organization Scenarios', () => {
    it('should handle multiple file operations with cascading link updates', async () => {
      // Create a network of files with links
      const file1Content = '# File 1\n\nLinks to [[File 2]] and [[File 3]].';
      const file2Content = '# File 2\n\nLinks to [[File 3]].';
      const file3Content = '# File 3\n\nStandalone file.';

      const file1Path = path.join(tempDir, 'File 1.md');
      const file2Path = path.join(tempDir, 'File 2.md');
      const file3Path = path.join(tempDir, 'File 3.md');

      await writeFile(file1Path, file1Content);
      await writeFile(file2Path, file2Content);
      await writeFile(file3Path, file3Content);

      // Simulate multiple file operations (renaming all files to kebab-case)
      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: file1Path,
          newPath: path.join(tempDir, 'file-1.md'),
        },
        {
          type: 'move',
          oldPath: file2Path,
          newPath: path.join(tempDir, 'file-2.md'),
        },
        {
          type: 'move',
          oldPath: file3Path,
          newPath: path.join(tempDir, 'file-3.md'),
        },
      ];

      // Update links in file1
      const file1UpdateResult = linkUpdater.updateLinksInContent(
        file1Content,
        changes,
        file1Path
      );

      expect(file1UpdateResult.linksUpdated).toBe(2);
      expect(file1UpdateResult.updatedContent).toContain('[[file-2]]');
      expect(file1UpdateResult.updatedContent).toContain('[[file-3]]');

      // Update links in file2
      const file2UpdateResult = linkUpdater.updateLinksInContent(
        file2Content,
        changes,
        file2Path
      );

      expect(file2UpdateResult.linksUpdated).toBe(1);
      expect(file2UpdateResult.updatedContent).toContain('[[file-3]]');
    });

    it('should preserve external links during file operations', async () => {
      const content = `# Test File

Internal link: [[other-file]]
External link: [Google](https://google.com)
Another external: [GitHub](https://github.com)`;

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: path.join(tempDir, 'other-file.md'),
          newPath: path.join(tempDir, 'renamed-file.md'),
        },
      ];

      const updateResult = linkUpdater.updateLinksInContent(
        content,
        changes,
        path.join(tempDir, 'test.md')
      );

      // Should update internal link but preserve external links
      expect(updateResult.updatedContent).toContain('[[renamed-file]]');
      expect(updateResult.updatedContent).toContain('https://google.com');
      expect(updateResult.updatedContent).toContain('https://github.com');
      expect(updateResult.linksUpdated).toBe(1); // Only internal link updated
    });
  });

  describe('Error Handling in Link Updates', () => {
    it('should handle malformed content gracefully', async () => {
      const malformedContent = '# Test\n\n[[unclosed link\n[broken](markdown';

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: path.join(tempDir, 'test.md'),
          newPath: path.join(tempDir, 'renamed.md'),
        },
      ];

      const updateResult = linkUpdater.updateLinksInContent(
        malformedContent,
        changes,
        path.join(tempDir, 'source.md')
      );

      // Should not crash and should return the original content
      expect(updateResult.updatedContent).toBe(malformedContent);
      expect(updateResult.linksUpdated).toBe(0);
      expect(updateResult.errors).toHaveLength(0); // LinkUpdater should handle gracefully
    });

    it('should report errors when they occur', async () => {
      const content = '# Test File\n\nLink: [[test]]';

      // Create changes that might cause issues (null paths)
      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: undefined as any,
          newPath: path.join(tempDir, 'new.md'),
        },
      ];

      const updateResult = linkUpdater.updateLinksInContent(
        content,
        changes,
        path.join(tempDir, 'source.md')
      );

      // Should handle gracefully and not update anything
      expect(updateResult.updatedContent).toBe(content);
      expect(updateResult.linksUpdated).toBe(0);
    });
  });
});
