/**
 * Markdown parsing utilities with frontmatter extraction and AST generation
 */

import type {
  MarkdownFile,
  MarkdownAST,
  MarkdownNode,
  Heading,
  Link,
  Attachment,
} from '../types/index.js';

/**
 * Simple markdown parser with frontmatter support
 */
export class MarkdownParser {
  /**
   * Parse markdown content into structured data
   */
  async parseMarkdown(
    filePath: string,
    content: string
  ): Promise<MarkdownFile> {
    const frontmatter = this.extractFrontmatter(content);
    const contentWithoutFrontmatter = this.removeFrontmatter(content);

    const headings = this.extractHeadings(contentWithoutFrontmatter);
    const links = this.extractLinks(contentWithoutFrontmatter);
    const attachments = this.extractAttachments(contentWithoutFrontmatter);
    const ast = this.generateAST(contentWithoutFrontmatter);

    return {
      path: filePath,
      content,
      frontmatter,
      headings,
      links,
      attachments,
      ast,
    };
  }

  /**
   * Extract frontmatter from markdown content
   */
  private extractFrontmatter(content: string): Record<string, any> {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return {};
    }

    const yamlContent = frontmatterMatch[1];
    return this.parseYaml(yamlContent);
  }

  /**
   * Simple YAML parser for frontmatter
   */
  private parseYaml(yamlContent: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle array values
      if (trimmed.startsWith('- ')) {
        // This is part of an array, skip for now (simplified implementation)
        continue;
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Handle arrays (simplified)
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1);
        result[key] = arrayContent
          .split(',')
          .map(item => item.trim().replace(/['"]/g, ''));
      } else {
        // Try to parse as number or boolean
        if (value === 'true') {
          result[key] = true;
        } else if (value === 'false') {
          result[key] = false;
        } else if (!isNaN(Number(value)) && value !== '') {
          result[key] = Number(value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Remove frontmatter from content
   */
  private removeFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  }

  /**
   * Extract headings from markdown content
   */
  private extractHeadings(content: string): Heading[] {
    const headings: Heading[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const id = this.generateHeadingId(text);

        headings.push({
          level,
          text,
          line: i + 1,
          id,
        });
      }
    }

    return headings;
  }

  /**
   * Generate heading ID from text
   */
  private generateHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Extract links from markdown content
   */
  private extractLinks(content: string): Link[] {
    const links: Link[] = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Extract wikilinks [[link]]
      const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      while ((match = wikilinkRegex.exec(line)) !== null) {
        const fullMatch = match[0];
        const target = match[1];
        const column = match.index;

        // Handle display text: [[file|display]]
        const [linkTarget, displayText] = target.split('|');

        links.push({
          type: 'internal',
          text: displayText || linkTarget,
          target: linkTarget.trim(),
          line: lineIndex + 1,
          column: column + 1,
        });
      }

      // Extract markdown links [text](url)
      const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      while ((match = markdownLinkRegex.exec(line)) !== null) {
        const text = match[1];
        const target = match[2];
        const column = match.index;

        const isExternal =
          target.startsWith('http') || target.startsWith('https');

        links.push({
          type: isExternal ? 'external' : 'internal',
          text,
          target,
          line: lineIndex + 1,
          column: column + 1,
        });
      }
    }

    return links;
  }

  /**
   * Extract attachments from markdown content
   */
  private extractAttachments(content: string): Attachment[] {
    const attachments: Attachment[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Extract image references ![alt](path)
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      while ((match = imageRegex.exec(line)) !== null) {
        const altText = match[1];
        const path = match[2];
        const name = path.split('/').pop() || path;

        attachments.push({
          name,
          path,
          type: this.getFileType(path),
          size: 0, // Would need file system access to get actual size
          referencedBy: [], // Would be populated by caller
        });
      }

      // Extract wikilink attachments [[attachment.ext]]
      const attachmentRegex =
        /\[\[([^|\]]+\.(png|jpg|jpeg|gif|pdf|mp4|mov|avi))\]\]/gi;
      while ((match = attachmentRegex.exec(line)) !== null) {
        const path = match[1];
        const name = path.split('/').pop() || path;

        attachments.push({
          name,
          path,
          type: this.getFileType(path),
          size: 0,
          referencedBy: [],
        });
      }
    }

    return attachments;
  }

  /**
   * Get file type from extension
   */
  private getFileType(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase() || '';

    const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    const videoTypes = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const audioTypes = ['mp3', 'wav', 'ogg', 'flac'];
    const documentTypes = ['pdf', 'doc', 'docx', 'txt'];

    if (imageTypes.includes(extension)) return 'image';
    if (videoTypes.includes(extension)) return 'video';
    if (audioTypes.includes(extension)) return 'audio';
    if (documentTypes.includes(extension)) return 'document';

    return 'unknown';
  }

  /**
   * Generate a simple AST from markdown content
   */
  private generateAST(content: string): MarkdownAST {
    const lines = content.split('\n');
    const children: MarkdownNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        children.push({
          type: 'heading',
          value: headingMatch[2],
          position: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length + 1 },
          },
        });
        continue;
      }

      // Paragraph (simplified - just non-empty lines that aren't headings)
      if (line.trim()) {
        children.push({
          type: 'paragraph',
          value: line,
          position: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length + 1 },
          },
        });
      }
    }

    return {
      type: 'root',
      children,
    };
  }
}
