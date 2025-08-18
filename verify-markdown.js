import { MarkdownParser } from './src/utils/markdown.js';

const parser = new MarkdownParser();

const content = `---
title: "Test Note"
tags: ["test"]
---

# Main Heading

This has [[internal link]] and [external](https://example.com).

![[attachment.png]]`;

try {
  const result = await parser.parseMarkdown('/test/note.md', content);

  console.log('✅ Parsing successful!');
  console.log('Frontmatter:', result.frontmatter);
  console.log('Headings:', result.headings.length);
  console.log('Links:', result.links.length);
  console.log('Attachments:', result.attachments.length);

  // Test nested brackets
  const nestedContent = `# Test

This has [[nested [brackets] in link]] content.`;

  const nestedResult = await parser.parseMarkdown(
    '/test/nested.md',
    nestedContent
  );
  console.log(
    '✅ Nested brackets test:',
    nestedResult.links.length > 0 ? 'PASS' : 'FAIL'
  );
} catch (error) {
  console.error('❌ Error:', error);
}
