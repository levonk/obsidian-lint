/**
 * MarkdownFile class with frontmatter extraction and processing capabilities
 */

import type {
  MarkdownFile as IMarkdownFile,
  MarkdownAST,
  Heading,
  Link,
  Attachment,
  FileChange,
} from '../types/index.js';
import { FileProcessor } from '../utils/file-processor.js';
import { MarkdownParser } from '../utils/markdown.js';

/**
 * Represents a markdown file with parsing and manipulation capabilities
 */
export class MarkdownFile implements IMarkdownFile {
  public path: string;
  public content: string;
  public frontmatter: Record<string, any>;
  public headings: Heading[];
  public links: Link[];
  public attachments: Attachment[];
  public ast: MarkdownAST;

  private fileProcessor = new FileProcessor();
  private parser = new MarkdownParser();
  private originalContent: string;

  constructor(data: IMarkdownFile) {
    this.path = data.path;
    this.content = data.content;
    this.frontmatter = data.frontmatter;
    this.headings = data.headings;
    this.links = data.links;
    this.attachments = data.attachments;
    this.ast = data.ast;
    this.originalContent = data.content;
  }

  /**
   * Create MarkdownFile from file path
   */
  static async fromFile(filePath: string): Promise<MarkdownFile> {
    const fileProcessor = new FileProcessor();
    const data = await fileProcessor.parseMarkdownFile(filePath);
    return new MarkdownFile(data);
  }

  /**
   * Create MarkdownFile from content
   */
  static async fromContent(
    filePath: string,
    content: string
  ): Promise<MarkdownFile> {
    const parser = new MarkdownParser();
    const data = await parser.parseMarkdown(filePath, content);
    return new MarkdownFile(data);
  }

  /**
   * Update frontmatter field
   */
  updateFrontmatter(key: string, value: any): void {
    this.frontmatter[key] = value;
    this.regenerateContent();
  }

  /**
   * Add or update multiple frontmatter fields
   */
  updateFrontmatterFields(fields: Record<string, any>): void {
    Object.assign(this.frontmatter, fields);
    this.regenerateContent();
  }

  /**
   * Remove frontmatter field
   */
  removeFrontmatterField(key: string): void {
    delete this.frontmatter[key];
    this.regenerateContent();
  }

  /**
   * Update content and reparse
   */
  async updateContent(newContent: string): Promise<void> {
    const data = await this.parser.parseMarkdown(this.path, newContent);
    this.content = data.content;
    this.frontmatter = data.frontmatter;
    this.headings = data.headings;
    this.links = data.links;
    this.attachments = data.attachments;
    this.ast = data.ast;
  }

  /**
   * Apply file changes
   */
  applyChanges(changes: FileChange[]): void {
    let content = this.content;
    const lines = content.split('\n');

    // Sort changes by line number in reverse order to avoid offset issues
    const sortedChanges = changes
      .filter(change => change.type !== 'move') // Handle moves separately
      .sort((a, b) => (b.line || 0) - (a.line || 0));

    for (const change of sortedChanges) {
      switch (change.type) {
        case 'insert':
          if (change.line !== undefined && change.newText !== undefined) {
            lines.splice(change.line, 0, change.newText);
          }
          break;

        case 'delete':
          if (change.line !== undefined) {
            lines.splice(change.line, 1);
          }
          break;

        case 'replace':
          if (change.line !== undefined && change.newText !== undefined) {
            lines[change.line] = change.newText;
          } else if (change.oldText && change.newText) {
            content = content.replace(change.oldText, change.newText);
          }
          break;
      }
    }

    // Handle move operations
    const moveChanges = changes.filter(change => change.type === 'move');
    for (const change of moveChanges) {
      if (change.oldPath && change.newPath) {
        // Update internal links that reference the moved file
        content = this.updateLinksForMovedFile(
          content,
          change.oldPath,
          change.newPath
        );
      }
    }

    if (sortedChanges.length > 0) {
      content = lines.join('\n');
    }

    // Update content and reparse
    this.updateContent(content);
  }

  /**
   * Save file to disk
   */
  async save(): Promise<void> {
    await this.fileProcessor.writeFile(this.path, this.content);
    this.originalContent = this.content;
  }

  /**
   * Save file to new location
   */
  async saveAs(newPath: string): Promise<void> {
    await this.fileProcessor.writeFile(newPath, this.content);
    this.path = newPath;
    this.originalContent = this.content;
  }

  /**
   * Check if file has been modified
   */
  isModified(): boolean {
    return this.content !== this.originalContent;
  }

  /**
   * Get file stats
   */
  async getStats(): Promise<{ size: number; mtime: Date }> {
    return await this.fileProcessor.getFileStats(this.path);
  }

  /**
   * Create backup of original file
   */
  async createBackup(): Promise<string> {
    return await this.fileProcessor.createBackup(this.path);
  }

  /**
   * Get frontmatter as YAML string
   */
  getFrontmatterYaml(): string {
    if (Object.keys(this.frontmatter).length === 0) {
      return '';
    }

    const yaml = Object.entries(this.frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          const items = value.map(item => `  - ${item}`).join('\n');
          return `${key}:\n${items}`;
        } else if (typeof value === 'string') {
          return `${key}: "${value}"`;
        } else {
          return `${key}: ${value}`;
        }
      })
      .join('\n');

    return `---\n${yaml}\n---`;
  }

  /**
   * Get content without frontmatter
   */
  getContentWithoutFrontmatter(): string {
    const frontmatterYaml = this.getFrontmatterYaml();
    if (!frontmatterYaml) {
      return this.content;
    }

    return this.content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  }

  /**
   * Regenerate content with updated frontmatter
   */
  private regenerateContent(): void {
    const frontmatterYaml = this.getFrontmatterYaml();
    const contentWithoutFrontmatter = this.getContentWithoutFrontmatter();

    if (frontmatterYaml) {
      this.content = `${frontmatterYaml}\n${contentWithoutFrontmatter}`;
    } else {
      this.content = contentWithoutFrontmatter;
    }
  }

  /**
   * Update links when a file is moved
   */
  private updateLinksForMovedFile(
    content: string,
    oldPath: string,
    newPath: string
  ): string {
    const oldName = oldPath.split('/').pop()?.replace(/\.md$/, '') || '';
    const newName = newPath.split('/').pop()?.replace(/\.md$/, '') || '';

    // Update wikilinks
    content = content.replace(
      new RegExp(`\\[\\[${oldName}\\]\\]`, 'g'),
      `[[${newName}]]`
    );

    // Update markdown links
    content = content.replace(
      new RegExp(`\\[([^\\]]+)\\]\\(${oldPath}\\)`, 'g'),
      `[$1](${newPath})`
    );

    return content;
  }

  /**
   * Find broken internal links
   */
  async findBrokenLinks(vaultPath: string): Promise<Link[]> {
    const brokenLinks: Link[] = [];

    for (const link of this.links) {
      if (link.type === 'internal') {
        const targetPath = this.resolveInternalLink(link.target, vaultPath);
        const exists = await this.fileProcessor.fileExists(targetPath);

        if (!exists) {
          brokenLinks.push({
            ...link,
            isValid: false,
          });
        }
      }
    }

    return brokenLinks;
  }

  /**
   * Resolve internal link to file path
   */
  private resolveInternalLink(target: string, vaultPath: string): string {
    // Handle display text: [[file|display]] -> file
    const fileName = target.split('|')[0];

    // Add .md extension if not present
    const fullFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;

    return `${vaultPath}/${fullFileName}`;
  }

  /**
   * Get summary information
   */
  getSummary(): {
    path: string;
    headingCount: number;
    linkCount: number;
    attachmentCount: number;
    frontmatterFields: string[];
    wordCount: number;
  } {
    const contentWithoutFrontmatter = this.getContentWithoutFrontmatter();
    const wordCount = contentWithoutFrontmatter
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0).length;

    return {
      path: this.path,
      headingCount: this.headings.length,
      linkCount: this.links.length,
      attachmentCount: this.attachments.length,
      frontmatterFields: Object.keys(this.frontmatter),
      wordCount,
    };
  }
}
