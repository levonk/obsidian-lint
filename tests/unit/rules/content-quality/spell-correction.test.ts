/**
 * Tests for Spell Correction Rules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpellCorrectionAutoFixRule,
  SpellCorrectionSuggestOnlyRule,
  SpellCorrectionIgnoreRule,
  createSpellCorrectionRule,
} from '../../../../src/rules/content-quality/spell-correction.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Spell Correction Rules', () => {
  let defaultConfig: RuleConfig;
  let mockContext: RuleExecutionContext;

  beforeEach(() => {
    defaultConfig = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: [],
      includePatterns: ['**/*'],
      excludePatterns: [],
      settings: {},
    };

    mockContext = {
      file: {} as MarkdownFile,
      vaultPath: '/test/vault',
      dryRun: false,
      verbose: false,
      metadata: {},
    };
  });

  describe('SpellCorrectionAutoFixRule', () => {
    it('should create rule with correct ID', () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);

      expect(rule.id.major).toBe('spell-correction');
      expect(rule.id.minor).toBe('auto-fix');
      expect(rule.id.full).toBe('spell-correction.auto-fix');
      expect(rule.name).toBe('Spell Correction Auto-fix');
      expect(rule.category).toBe('content-quality');
    });

    it('should detect common spelling errors', async () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: '# Test Document\n\nThis is a teh test with recieve error.',
        frontmatter: {},
        headings: [{ level: 1, text: 'Test Document', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(issue => issue.message.includes('teh'))).toBe(true);
      expect(issues.some(issue => issue.message.includes('recieve'))).toBe(
        true
      );
    });

    it('should provide suggestions for misspelled words', async () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: 'The word teh is misspelled.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      const tehIssue = issues.find(issue => issue.message.includes('teh'));
      expect(tehIssue).toBeDefined();
      expect(tehIssue!.message).toContain('suggestions: the');
    });

    it('should fix spelling errors automatically', async () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: 'The word teh is misspelled.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix!(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('replace');
      expect(fixes[0].changes[0].newText).toContain('the');
    });

    it('should ignore words in code blocks when configured', async () => {
      const rule = new SpellCorrectionAutoFixRule({
        ...defaultConfig,
        settings: { ignore_code_blocks: true },
      });

      mockContext.file = {
        path: 'test.md',
        content: 'Regular teh error.\n\n```\nCode teh error\n```',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should only find the error outside the code block
      expect(issues.length).toBe(1);
    });

    it('should ignore words in links when configured', async () => {
      const rule = new SpellCorrectionAutoFixRule({
        ...defaultConfig,
        settings: { ignore_links: true },
      });

      mockContext.file = {
        path: 'test.md',
        content: 'Regular teh error. [Link with teh error](http://example.com)',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should only find the error outside the link
      expect(issues.length).toBe(1);
    });

    it('should respect custom dictionary', async () => {
      const rule = new SpellCorrectionAutoFixRule({
        ...defaultConfig,
        settings: { custom_dictionary: ['customword', 'specialterm'] },
      });

      mockContext.file = {
        path: 'test.md',
        content: 'This customword and specialterm are valid.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should not flag custom dictionary words
      expect(issues.length).toBe(0);
    });

    it('should respect ignore words list', async () => {
      const rule = new SpellCorrectionAutoFixRule({
        ...defaultConfig,
        settings: { ignore_words: ['teh', 'recieve'] },
      });

      mockContext.file = {
        path: 'test.md',
        content: 'This teh and recieve should be ignored.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should not flag ignored words
      expect(issues.length).toBe(0);
    });

    it('should respect minimum word length', async () => {
      const rule = new SpellCorrectionAutoFixRule({
        ...defaultConfig,
        settings: { min_word_length: 4 },
      });

      mockContext.file = {
        path: 'test.md',
        content: 'Short xyz word and longer unknownword.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should only flag words >= min_word_length
      expect(issues.every(issue => !issue.message.includes('xyz'))).toBe(true);
    });

    it('should skip uppercase words (likely acronyms)', async () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: 'This API and HTTP are acronyms.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should not flag uppercase words
      expect(issues.every(issue => !issue.message.includes('API'))).toBe(true);
      expect(issues.every(issue => !issue.message.includes('HTTP'))).toBe(true);
    });

    it('should skip words with numbers', async () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: 'Version v1.2.3 and item123 contain numbers.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should not flag words with numbers
      expect(issues.every(issue => !issue.message.includes('v1.2.3'))).toBe(
        true
      );
      expect(issues.every(issue => !issue.message.includes('item123'))).toBe(
        true
      );
    });
  });

  describe('SpellCorrectionSuggestOnlyRule', () => {
    it('should create rule with correct ID', () => {
      const rule = new SpellCorrectionSuggestOnlyRule(defaultConfig);

      expect(rule.id.major).toBe('spell-correction');
      expect(rule.id.minor).toBe('suggest-only');
      expect(rule.id.full).toBe('spell-correction.suggest-only');
    });

    it('should detect errors but not auto-fix', async () => {
      const rule = new SpellCorrectionSuggestOnlyRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: 'This teh is misspelled.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix!(mockContext, issues);

      expect(issues.length).toBeGreaterThan(0);
      expect(fixes).toHaveLength(0); // Should not auto-fix
    });
  });

  describe('SpellCorrectionIgnoreRule', () => {
    it('should create rule with correct ID', () => {
      const rule = new SpellCorrectionIgnoreRule(defaultConfig);

      expect(rule.id.major).toBe('spell-correction');
      expect(rule.id.minor).toBe('ignore');
      expect(rule.id.full).toBe('spell-correction.ignore');
    });

    it('should not detect any spelling errors', async () => {
      const rule = new SpellCorrectionIgnoreRule(defaultConfig);
      mockContext.file = {
        path: 'test.md',
        content: 'This teh recieve definately has many errors.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(0); // Should ignore all spelling errors
    });
  });

  describe('Content Extraction', () => {
    it('should check headings when enabled', async () => {
      const rule = new SpellCorrectionAutoFixRule({
        ...defaultConfig,
        settings: { check_headings: true, check_content: false },
      });

      mockContext.file = {
        path: 'test.md',
        content: '# Heading with teh error\n\nContent with recieve error.',
        frontmatter: {},
        headings: [{ level: 1, text: 'Heading with teh error', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should only find error in heading
      expect(issues.some(issue => issue.message.includes('teh'))).toBe(true);
      expect(issues.every(issue => !issue.message.includes('recieve'))).toBe(
        true
      );
    });

    it('should check content when enabled', async () => {
      const rule = new SpellCorrectionAutoFixRule({
        ...defaultConfig,
        settings: { check_headings: false, check_content: true },
      });

      mockContext.file = {
        path: 'test.md',
        content: '# Heading with teh error\n\nContent with recieve error.',
        frontmatter: {},
        headings: [{ level: 1, text: 'Heading with teh error', line: 1 }],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should only find error in content
      expect(issues.some(issue => issue.message.includes('recieve'))).toBe(
        true
      );
      expect(issues.every(issue => !issue.message.includes('teh'))).toBe(true);
    });

    it('should ignore frontmatter when configured', async () => {
      const rule = new SpellCorrectionAutoFixRule({
        ...defaultConfig,
        settings: { ignore_frontmatter: true },
      });

      mockContext.file = {
        path: 'test.md',
        content: '---\ntitle: Teh Title\n---\n\nContent here.',
        frontmatter: { title: 'Teh Title' },
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should not flag errors in frontmatter
      expect(issues.every(issue => !issue.message.includes('Teh'))).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create auto-fix rule', () => {
      const rule = createSpellCorrectionRule(
        'spell-correction.auto-fix',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(SpellCorrectionAutoFixRule);
    });

    it('should create suggest-only rule', () => {
      const rule = createSpellCorrectionRule(
        'spell-correction.suggest-only',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(SpellCorrectionSuggestOnlyRule);
    });

    it('should create ignore rule', () => {
      const rule = createSpellCorrectionRule(
        'spell-correction.ignore',
        defaultConfig
      );
      expect(rule).toBeInstanceOf(SpellCorrectionIgnoreRule);
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createSpellCorrectionRule('spell-correction.unknown', defaultConfig);
      }).toThrow('Unknown spell correction rule variant');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);
      mockContext.file = {
        path: 'empty.md',
        content: '',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(0);
    });

    it('should handle content with only whitespace', async () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);
      mockContext.file = {
        path: 'whitespace.md',
        content: '   \n\n   \t   \n',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(0);
    });

    it('should handle markdown formatting removal', async () => {
      const rule = new SpellCorrectionAutoFixRule(defaultConfig);
      mockContext.file = {
        path: 'formatted.md',
        content: 'This **teh** and *recieve* have formatting.',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      const issues = await rule.lint(mockContext);

      // Should detect errors despite markdown formatting
      expect(issues.some(issue => issue.message.includes('teh'))).toBe(true);
      expect(issues.some(issue => issue.message.includes('recieve'))).toBe(
        true
      );
    });
  });
});
