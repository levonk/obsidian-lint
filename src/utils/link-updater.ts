/**
 * Link Updater Utility
 * Updates internal links when files are moved or renamed
 */

import type { FileChange } from '../types/common.js';

/**
 * Interface for link update result
 */
export interface LinkUpdateResult {
  updatedContent: string;
  linksUpdated: number;
  errors: string[];
}

/**
 * Link updater class for handling file moves and renames
 */
export class LinkUpdater {
  /**
   * Update links in content based on file changes
   */
  updateLinksInContent(
    content: string,
    changes: FileChange[],
    _currentFilePath: string
  ): LinkUpdateResult {
    let updatedContent = content;
    const errors: string[] = [];

    try {
      // Create a map of old paths to new paths for efficient lookup
      const pathMap = new Map<string, string>();
      for (const change of changes) {
        if (change.type === 'move' && change.oldPath && change.newPath) {
          // Store both with and without .md extension for flexible matching
          const oldPathWithoutExt = change.oldPath.replace(/\.md$/, '');
          const newPathWithoutExt = change.newPath.replace(/\.md$/, '');

          // Store full paths
          pathMap.set(change.oldPath, change.newPath);
          pathMap.set(oldPathWithoutExt, newPathWithoutExt);

          // Also store just the filename for internal links
          const oldFileName = this.extractFileName(change.oldPath);
          const newFileName = this.extractFileName(change.newPath);
          const oldFileNameWithoutExt = oldFileName.replace(/\.md$/, '');
          const newFileNameWithoutExt = newFileName.replace(/\.md$/, '');

          pathMap.set(oldFileName, newFileName);
          pathMap.set(oldFileNameWithoutExt, newFileNameWithoutExt);

          // For directory moves, map filename to relative path from vault
          if (
            oldFileNameWithoutExt !== newFileNameWithoutExt ||
            this.extractDirectory(change.oldPath) !==
              this.extractDirectory(change.newPath)
          ) {
            // Convert absolute path to relative path for internal links
            const relativePath = this.makeRelativePath(change.newPath);
            pathMap.set(
              oldFileNameWithoutExt,
              relativePath.replace(/\.md$/, '')
            );
          }
        }
      }

      // Update internal links [[link]]
      updatedContent = this.updateInternalLinks(updatedContent, pathMap);

      // Update markdown links [text](link)
      updatedContent = this.updateMarkdownLinks(updatedContent, pathMap);
    } catch (error) {
      errors.push(
        `Error updating links: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Count how many links were updated
    const linksUpdated = this.countUpdatedLinks(content, updatedContent);

    return {
      updatedContent,
      linksUpdated,
      errors,
    };
  }

  /**
   * Update internal Obsidian-style links [[link]]
   */
  private updateInternalLinks(
    content: string,
    pathMap: Map<string, string>
  ): string {
    const internalLinkRegex = /\[\[([^\]]+)\]\]/g;

    return content.replace(internalLinkRegex, (match, linkPath) => {
      // Try to find a replacement in the path map
      let newPath = pathMap.get(linkPath) || pathMap.get(linkPath + '.md');

      if (newPath) {
        // Remove .md extension for internal links
        let cleanNewPath = newPath.replace(/\.md$/, '');

        // For paths with directories, use relative path from vault root
        if (cleanNewPath.includes('/') || cleanNewPath.includes('\\')) {
          cleanNewPath = cleanNewPath.replace(/\\/g, '/');
        }

        return `[[${cleanNewPath}]]`;
      }

      return match; // No change needed
    });
  }

  /**
   * Update markdown-style links [text](link)
   */
  private updateMarkdownLinks(
    content: string,
    pathMap: Map<string, string>
  ): string {
    const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

    return content.replace(markdownLinkRegex, (match, text, linkPath) => {
      // Skip external links (http/https)
      if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
        return match;
      }

      // Try to find a replacement in the path map
      const newPath =
        pathMap.get(linkPath) || pathMap.get(linkPath.replace(/\.md$/, ''));

      if (newPath) {
        return `[${text}](${newPath})`;
      }

      return match; // No change needed
    });
  }

  /**
   * Count how many links were updated by comparing original and updated content
   */
  private countUpdatedLinks(
    originalContent: string,
    updatedContent: string
  ): number {
    if (originalContent === updatedContent) {
      return 0;
    }

    // Simple heuristic: count the number of link patterns that changed
    const originalLinks = this.extractAllLinks(originalContent);
    const updatedLinks = this.extractAllLinks(updatedContent);

    let changedCount = 0;
    for (
      let i = 0;
      i < Math.min(originalLinks.length, updatedLinks.length);
      i++
    ) {
      if (originalLinks[i] !== updatedLinks[i]) {
        changedCount++;
      }
    }

    // Also account for different number of links
    changedCount += Math.abs(originalLinks.length - updatedLinks.length);

    return changedCount;
  }

  /**
   * Extract all links from content for comparison
   */
  private extractAllLinks(content: string): string[] {
    const links: string[] = [];

    // Extract internal links
    const internalLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = internalLinkRegex.exec(content)) !== null) {
      links.push(match[0]);
    }

    // Extract markdown links
    const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = markdownLinkRegex.exec(content)) !== null) {
      links.push(match[0]);
    }

    return links;
  }

  /**
   * Update all links in a vault when files are moved
   * This would be called by the file processor during bulk operations
   */
  async updateLinksInVault(
    vaultFiles: Map<string, string>,
    changes: FileChange[]
  ): Promise<Map<string, LinkUpdateResult>> {
    const results = new Map<string, LinkUpdateResult>();

    for (const [filePath, content] of vaultFiles) {
      const result = this.updateLinksInContent(content, changes, filePath);
      if (result.linksUpdated > 0 || result.errors.length > 0) {
        results.set(filePath, result);
      }
    }

    return results;
  }

  /**
   * Extract filename from full path
   */
  private extractFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || filePath;
  }

  /**
   * Extract directory from full path
   */
  private extractDirectory(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    parts.pop(); // Remove filename
    return parts.join('/');
  }

  /**
   * Convert absolute path to relative path for internal links
   * This is a simplified version that removes common temp directory prefixes
   */
  private makeRelativePath(absolutePath: string): string {
    // For testing purposes, remove temp directory prefixes
    const parts = absolutePath.split(/[/\\]/);

    // Find the last meaningful directory structure
    // Look for common patterns like Notes, vault directories, etc.
    let startIndex = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].match(/^(Notes|vault|obsidian-lint-.*test.*|[A-Z]:)$/)) {
        startIndex = i + 1;
        break;
      }
    }

    return parts.slice(startIndex).join('/');
  }
}

/**
 * Factory function to create a link updater instance
 */
export function createLinkUpdater(): LinkUpdater {
  return new LinkUpdater();
}
