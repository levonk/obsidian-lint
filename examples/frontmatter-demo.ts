/**
 * Demo of frontmatter validation rules
 */

import { createFrontmatterRequiredFieldsRule } from '../src/rules/frontmatter/frontmatter-required-fields.js';
import type { RuleConfig, RuleExecutionContext } from '../src/types/rules.js';
import type { MarkdownFile } from '../src/types/common.js';

// Example configurations for different rule variants
const strictConfig: RuleConfig = {
  pathAllowlist: ['**/*.md'],
  pathDenylist: [],
  includePatterns: ['**/*'],
  excludePatterns: ['.*'],
  settings: {
    required_fields: [
      'title',
      'aliases',
      'tags',
      'status',
      'date_created',
      'date_updated',
    ],
    auto_fix: true,
    default_status: 'draft',
    date_format: 'YYYY-MM-DD',
  },
};

const minimalConfig: RuleConfig = {
  pathAllowlist: ['**/*.md'],
  pathDenylist: [],
  includePatterns: ['**/*'],
  excludePatterns: ['.*'],
  settings: {
    required_fields: ['title', 'status'],
    auto_fix: true,
    default_status: 'draft',
    date_format: 'YYYY-MM-DD',
  },
};

// Create rule instances
const strictRule = createFrontmatterRequiredFieldsRule(
  'frontmatter-required-fields.strict',
  strictConfig
);
const minimalRule = createFrontmatterRequiredFieldsRule(
  'frontmatter-required-fields.minimal',
  minimalConfig
);

// Example markdown files
const incompleteFile: MarkdownFile = {
  path: 'test-note.md',
  content: `---
title: My Test Note
---

This is a test note with incomplete frontmatter.`,
  frontmatter: {
    title: 'My Test Note',
  },
  headings: [],
  links: [],
  attachments: [],
  ast: { type: 'root', children: [] },
};

const invalidFile: MarkdownFile = {
  path: 'invalid-note.md',
  content: `---
title: ""
aliases: not-an-array
status: invalid-status
date_created: invalid-date
---

This note has invalid frontmatter values.`,
  frontmatter: {
    title: '',
    aliases: 'not-an-array',
    status: 'invalid-status',
    date_created: 'invalid-date',
  },
  headings: [],
  links: [],
  attachments: [],
  ast: { type: 'root', children: [] },
};

const validFile: MarkdownFile = {
  path: 'valid-note.md',
  content: `---
title: Valid Note
aliases:
  - valid-alias
tags:
  - test
  - demo
status: draft
date_created: 2024-01-01
date_updated: 2024-01-02
---

This note has valid frontmatter.`,
  frontmatter: {
    title: 'Valid Note',
    aliases: ['valid-alias'],
    tags: ['test', 'demo'],
    status: 'draft',
    date_created: '2024-01-01',
    date_updated: '2024-01-02',
  },
  headings: [],
  links: [],
  attachments: [],
  ast: { type: 'root', children: [] },
};

async function runDemo() {
  console.log('=== Frontmatter Rules Demo ===\n');

  const context: RuleExecutionContext = {
    file: incompleteFile,
    vaultPath: '/demo/vault',
    dryRun: false,
    verbose: true,
    metadata: {},
  };

  // Test strict rule with incomplete file
  console.log('1. Testing strict rule with incomplete frontmatter:');
  context.file = incompleteFile;
  const strictIssues = await strictRule.lint(context);
  console.log(`Found ${strictIssues.length} issues:`);
  strictIssues.forEach(issue => {
    console.log(`  - ${issue.severity.toUpperCase()}: ${issue.message}`);
  });

  if (strictRule.fix && strictIssues.length > 0) {
    console.log('\nApplying fixes...');
    const fixes = await strictRule.fix(context, strictIssues);
    console.log(`Applied ${fixes.length} fixes:`);
    fixes.forEach(fix => {
      console.log(`  - ${fix.description}`);
    });
  }

  // Test minimal rule with same file
  console.log('\n2. Testing minimal rule with same file:');
  const minimalIssues = await minimalRule.lint(context);
  console.log(`Found ${minimalIssues.length} issues:`);
  minimalIssues.forEach(issue => {
    console.log(`  - ${issue.severity.toUpperCase()}: ${issue.message}`);
  });

  // Test with invalid file
  console.log('\n3. Testing strict rule with invalid frontmatter:');
  context.file = invalidFile;
  const invalidIssues = await strictRule.lint(context);
  console.log(`Found ${invalidIssues.length} issues:`);
  invalidIssues.forEach(issue => {
    console.log(`  - ${issue.severity.toUpperCase()}: ${issue.message}`);
  });

  // Test with valid file
  console.log('\n4. Testing strict rule with valid frontmatter:');
  context.file = validFile;
  const validIssues = await strictRule.lint(context);
  console.log(`Found ${validIssues.length} issues:`);
  if (validIssues.length === 0) {
    console.log('  ✓ All frontmatter fields are valid!');
  }

  // Test path filtering
  console.log('\n5. Testing path filtering:');
  console.log(
    `Should apply to 'notes/test.md': ${strictRule.shouldApplyToFile('notes/test.md')}`
  );
  console.log(
    `Should apply to 'templates/test.md': ${strictRule.shouldApplyToFile('templates/test.md')}`
  );
  console.log(
    `Should apply to 'README.md': ${strictRule.shouldApplyToFile('README.md')}`
  );
}

// Run the demo
runDemo().catch(console.error);
