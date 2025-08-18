/**
 * Link Updater Unit Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  LinkUpdater,
  createLinkUpdater,
} from '../../../src/utils/link-updater.js';
import type { FileChange } from '../../../src/types/common.js';

describe('LinkUpdater', () => {
  let linkUpdater: LinkUpdater;

  beforeEach(() => {
    linkUpdater = new LinkUpdater();
  });

  describe('updateLinksInContent', () => {
    it('should update internal links when files are moved', () => {
      const content = `# Test File

This links to [[other-file]] and [[subfolder/another-file]].

Also links to [[third-file]].`;

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: 'other-file.md',
          newPath: 'moved/other-file.md',
        },
        {
          type: 'move',
          oldPath: 'subfolder/another-file.md',
          newPath: 'new-location/another-file.md',
        },
      ];

      const result = linkUpdater.updateLinksInContent(
        content,
        changes,
        'current-file.md'
      );

      expect(result.updatedContent).toContain('[[moved/other-file]]');
      expect(result.updatedContent).toContain('[[new-location/another-file]]');
      expect(result.updatedContent).toContain('[[third-file]]'); // Unchanged
      expect(result.linksUpdated).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should update markdown links when files are moved', () => {
      const content = `# Test File

This links to [Other File](other-file.md) and [Another](subfolder/another-file.md).

External link: [Google](https://google.com)`;

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: 'other-file.md',
          newPath: 'moved/other-file.md',
        },
        {
          type: 'move',
          oldPath: 'subfolder/another-file.md',
          newPath: 'new-location/another-file.md',
        },
      ];

      const result = linkUpdater.updateLinksInContent(
        content,
        changes,
        'current-file.md'
      );

      expect(result.updatedContent).toContain(
        '[Other File](moved/other-file.md)'
      );
      expect(result.updatedContent).toContain(
        '[Another](new-location/another-file.md)'
      );
      expect(result.updatedContent).toContain('[Google](https://google.com)'); // External link unchanged
      expect(result.linksUpdated).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should not update links when no matching files are moved', () => {
      const content = `# Test File

This links to [[other-file]] and [[another-file]].`;

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: 'different-file.md',
          newPath: 'moved/different-file.md',
        },
      ];

      const result = linkUpdater.updateLinksInContent(
        content,
        changes,
        'current-file.md'
      );

      expect(result.updatedContent).toBe(content); // No changes
      expect(result.linksUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed internal and markdown links', () => {
      const content = `# Test File

Internal: [[test-file]]
Markdown: [Test File](test-file.md)
External: [Google](https://google.com)`;

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: 'test-file.md',
          newPath: 'moved/test-file.md',
        },
      ];

      const result = linkUpdater.updateLinksInContent(
        content,
        changes,
        'current-file.md'
      );

      expect(result.updatedContent).toContain('[[moved/test-file]]');
      expect(result.updatedContent).toContain(
        '[Test File](moved/test-file.md)'
      );
      expect(result.updatedContent).toContain('[Google](https://google.com)'); // Unchanged
      expect(result.linksUpdated).toBeGreaterThan(0);
    });

    it('should handle relative paths correctly', () => {
      const content = `# Test File

This links to [[../parent-file]] and [[./sibling-file]].`;

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: 'parent-file.md',
          newPath: 'new-location/parent-file.md',
        },
        {
          type: 'move',
          oldPath: 'subfolder/sibling-file.md',
          newPath: 'subfolder/moved/sibling-file.md',
        },
      ];

      const result = linkUpdater.updateLinksInContent(
        content,
        changes,
        'subfolder/current-file.md'
      );

      expect(result.updatedContent).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should handle delete operations gracefully', () => {
      const content = `# Test File

This links to [[test-file]].`;

      const changes: FileChange[] = [
        {
          type: 'delete',
          oldPath: 'test-file.md',
        },
      ];

      const result = linkUpdater.updateLinksInContent(
        content,
        changes,
        'current-file.md'
      );

      // Delete operations don't update links, just remove files
      expect(result.updatedContent).toBe(content);
      expect(result.linksUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('updateLinksInVault', () => {
    it('should update links across multiple files in vault', async () => {
      const vaultFiles = new Map([
        ['file1.md', '# File 1\n\nLinks to [[file2]] and [[file3]].'],
        ['file2.md', '# File 2\n\nLinks to [File 3](file3.md).'],
        ['file3.md', '# File 3\n\nNo links here.'],
      ]);

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: 'file2.md',
          newPath: 'moved/file2.md',
        },
        {
          type: 'move',
          oldPath: 'file3.md',
          newPath: 'moved/file3.md',
        },
      ];

      const results = await linkUpdater.updateLinksInVault(vaultFiles, changes);

      expect(results.size).toBeGreaterThan(0);

      // Check that file1.md has updated links
      const file1Result = results.get('file1.md');
      expect(file1Result).toBeDefined();
      if (file1Result) {
        expect(file1Result.linksUpdated).toBeGreaterThan(0);
        expect(file1Result.errors).toHaveLength(0);
      }
    });

    it('should return empty results when no links need updating', async () => {
      const vaultFiles = new Map([
        ['file1.md', '# File 1\n\nNo links here.'],
        ['file2.md', '# File 2\n\nAlso no links.'],
      ]);

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: 'file3.md',
          newPath: 'moved/file3.md',
        },
      ];

      const results = await linkUpdater.updateLinksInVault(vaultFiles, changes);

      expect(results.size).toBe(0);
    });
  });

  describe('createLinkUpdater factory', () => {
    it('should create a LinkUpdater instance', () => {
      const updater = createLinkUpdater();
      expect(updater).toBeInstanceOf(LinkUpdater);
    });
  });
});
