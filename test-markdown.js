import { MarkdownParser } from './src/utils/markdown.js';

const parser = new MarkdownParser();

const content = `---
title: "Test"
---

# Heading

This has [[nested [brackets] in link]] content.`;

try {
  const result = await parser.parseMarkdown('/test/note.md', content);
  console.log('Links found:', result.links.length);
  console.log('Links:', result.links);
} catch (error) {
  console.error('Error:', error);
}
