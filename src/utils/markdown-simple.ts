/**
 * Simple markdown parsing utilities for testing
 */

import matter from 'gray-matter';

export class SimpleMarkdownParser {
  async parseMarkdown(filePath: string, content: string) {
    let frontmatter = {};
    let markdownContent = content;

    try {
      const parsed = matter(content);
      frontmatter = parsed.data;
      markdownContent = parsed.content;
    } catch (error) {
      console.warn(`Failed to parse frontmatter in ${filePath}:`, error);
      markdownContent = content;
    }

    return {
      path: filePath,
      content,
      frontmatter,
      headings: [],
      links: [],
      attachments: [],
      ast: { type: 'root', children: [] },
    };
  }
}
