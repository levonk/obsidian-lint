/**
 * Unit tests for markdown parsing utilities
 */

import { describe, it, expect } from 'bun:test';
import { MarkdownParser } from '../../../src/utils/markdown.js';

describe('MarkdownParser', () => {
  const parser = new MarkdownParser();

  describe('parseMarkdown', () => {
    it('should parse basic markdown with frontmatter', async () => {
      const content = `---
title: "Test Note"
tags: ["test", "markdown"]
date: 2024-01-01
---

# Main Heading

This is a test note with some content.

## Sub Heading

More content here.`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      expect(result.path).toBe('/test/note.md');
      expect(result.content).toBe(content);
      expect(result.frontmatter.title).toBe('Test Note');
      expect(result.frontmatter.tags).toEqual(['test', 'markdown']);
      expect(result.frontmatter.date).toEqual(new Date('2024-01-01'));
      expect(result.headings).toHaveLength(2);
      expect(result.headings[0]).toEqual({
        level: 1,
        text: 'Main Heading',
        line: expect.any(Number),
        id: 'main-heading',
      });
    });

    it('should parse markdown without frontmatter', async () => {
      const content = `# Simple Note

Just some content without frontmatter.`;

      const result = await parser.parseMarkdown('/test/simple.md', content);

      expect(result.frontmatter).toEqual({});
      expect(result.headings).toHaveLength(1);
      expect(result.headings[0].text).toBe('Simple Note');
    });

    it('should extract wikilinks correctly', async () => {
      const content = `# Test Note

This links to [[Another Note]] and [[Note with Display|Custom Text]].

Also links to [[third-note]].`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      expect(result.links).toHaveLength(3);
      expect(result.links[0]).toEqual({
        type: 'internal',
        text: 'Another Note',
        target: 'Another Note',
        line: expect.any(Number),
        column: expect.any(Number),
      });
      expect(result.links[1]).toEqual({
        type: 'internal',
        text: 'Note with Display',
        target: 'Note with Display|Custom Text',
        line: expect.any(Number),
        column: expect.any(Number),
      });
    });

    it('should extract markdown links correctly', async () => {
      const content = `# Test Note

This is an [external link](https://example.com) and an [internal link](./other-note.md).`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      const externalLink = result.links.find(l => l.type === 'external');
      const internalLink = result.links.find(l => l.type === 'internal');

      expect(externalLink).toBeDefined();
      expect(externalLink?.target).toBe('https://example.com');
      expect(internalLink).toBeDefined();
      expect(internalLink?.target).toBe('./other-note.md');
    });

    it('should extract image attachments', async () => {
      const content = `# Test Note

Here's an image: ![Alt text](./images/photo.jpg)

And a wikilink image: ![[screenshot.png]]`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      expect(result.attachments).toHaveLength(2);

      const wikiAttachment = result.attachments.find(
        a => a.name === 'screenshot.png'
      );
      const markdownAttachment = result.attachments.find(
        a => a.name === 'photo.jpg'
      );

      expect(wikiAttachment).toEqual({
        name: 'screenshot.png',
        path: 'screenshot.png',
        type: '.png',
        size: 0,
        referencedBy: ['/test/note.md'],
      });
      expect(markdownAttachment).toEqual({
        name: 'photo.jpg',
        path: './images/photo.jpg',
        type: '.jpg',
        size: 0,
        referencedBy: ['/test/note.md'],
      });
    });

    it('should extract various attachment types', async () => {
      const content = `# Test Note

PDF: ![[document.pdf]]
Video: ![[video.mp4]]
Audio: ![[audio.mp3]]
Archive: ![[data.zip]]`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      expect(result.attachments).toHaveLength(4);
      expect(result.attachments.map(a => a.type)).toEqual([
        '.pdf',
        '.mp4',
        '.mp3',
        '.zip',
      ]);
    });

    it('should handle complex heading structures', async () => {
      const content = `# Level 1

## Level 2

### Level 3 with **bold** and *italic*

#### Level 4

## Another Level 2`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      expect(result.headings).toHaveLength(5);
      expect(result.headings.map(h => h.level)).toEqual([1, 2, 3, 4, 2]);
      expect(result.headings[2].text).toBe('Level 3 with bold and italic');
      expect(result.headings[2].id).toBe('level-3-with-bold-and-italic');
    });

    it('should handle empty content', async () => {
      const result = await parser.parseMarkdown('/test/empty.md', '');

      expect(result.content).toBe('');
      expect(result.frontmatter).toEqual({});
      expect(result.headings).toHaveLength(0);
      expect(result.links).toHaveLength(0);
      expect(result.attachments).toHaveLength(0);
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const content = `---
title: "Test
invalid: yaml: content
---

# Content`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      // Should still parse the content even if frontmatter is malformed
      expect(result.frontmatter).toEqual({});
      expect(result.headings).toHaveLength(1);
      expect(result.headings[0].text).toBe('Content');
    });
  });

  describe('heading ID generation', () => {
    it('should generate valid heading IDs', async () => {
      const content = `# Simple Heading
## Heading with Numbers 123
### Heading with Special Characters!@#$%
#### Heading    with    Multiple    Spaces`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      expect(result.headings[0].id).toBe('simple-heading');
      expect(result.headings[1].id).toBe('heading-with-numbers-123');
      expect(result.headings[2].id).toBe('heading-with-special-characters');
      expect(result.headings[3].id).toBe('heading-with-multiple-spaces');
    });
  });

  describe('link extraction edge cases', () => {
    it('should handle nested brackets', async () => {
      const content = `# Test

This has [[nested [brackets] in link]] content.`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      expect(result.links).toHaveLength(1);
      expect(result.links[0].target).toBe('nested [brackets] in link');
    });

    it('should handle multiple links on same line', async () => {
      const content = `Links: [[first]] and [[second]] and [third](http://example.com)`;

      const result = await parser.parseMarkdown('/test/note.md', content);

      expect(result.links).toHaveLength(3);
      expect(result.links.map(l => l.target)).toEqual([
        'first',
        'second',
        'http://example.com',
      ]);
    });
  });
});
