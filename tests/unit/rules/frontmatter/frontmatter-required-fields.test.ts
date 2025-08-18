/**
 * Tests for Frontmatter Required Fields Rules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FrontmatterRequiredFieldsStrictRule,
  FrontmatterRequiredFieldsMinimalRule,
  FrontmatterRequiredFieldsCustomRule,
  createFrontmatterRequiredFieldsRule,
} from '../../../../src/rules/frontmatter/frontmatter-required-fields.js';
import type {
  RuleConfig,
  RuleExecutionContext,
} from '../../../../src/types/rules.js';
import type { MarkdownFile } from '../../../../src/types/common.js';

describe('Frontmatter Required Fields Rules', () => {
  let mockConfig: RuleConfig;
  let mockContext: RuleExecutionContext;

  beforeEach(() => {
    mockConfig = {
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

    mockContext = {
      file: {
        path: 'test.md',
        content: '',
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      },
      vaultPath: '/test/vault',
      dryRun: false,
      verbose: false,
      metadata: {},
    };
  });

  describe('FrontmatterRequiredFieldsStrictRule', () => {
    let rule: FrontmatterRequiredFieldsStrictRule;

    beforeEach(() => {
      rule = new FrontmatterRequiredFieldsStrictRule(mockConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('frontmatter-required-fields.strict');
      expect(rule.name).toBe('Strict Frontmatter Fields');
      expect(rule.category).toBe('frontmatter');
    });

    it('should detect missing frontmatter', async () => {
      mockContext.file.frontmatter = {};
      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe('Missing frontmatter section');
      expect(issues[0].severity).toBe('error');
      expect(issues[0].fixable).toBe(true);
    });

    it('should detect missing required fields', async () => {
      mockContext.file.frontmatter = {
        title: 'Test Note',
        // Missing other required fields
      };

      const issues = await rule.lint(mockContext);

      expect(issues).toHaveLength(5); // Missing aliases, tags, status, date_created, date_updated
      expect(issues.map(i => i.message)).toContain(
        'Missing required frontmatter field: aliases'
      );
      expect(issues.map(i => i.message)).toContain(
        'Missing required frontmatter field: tags'
      );
      expect(issues.map(i => i.message)).toContain(
        'Missing required frontmatter field: status'
      );
    });

    it('should validate field formats', async () => {
      mockContext.file.frontmatter = {
        title: '', // Empty title
        aliases: 'not-an-array', // Should be array
        tags: ['valid-tag'],
        status: 'invalid-status', // Invalid status
        date_created: 'invalid-date', // Invalid date format
        date_updated: '2024-01-01', // Valid date
      };

      const issues = await rule.lint(mockContext);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.map(i => i.message)).toContain(
        'Title must be a non-empty string'
      );
      expect(issues.map(i => i.message)).toContain('aliases must be an array');
      expect(issues.map(i => i.message)).toContain(
        'Status must be one of: draft, in-progress, active, on-hold, archived'
      );
      expect(issues.map(i => i.message)).toContain(
        'date_created must be in YYYY-MM-DD format'
      );
    });

    it('should pass validation with correct frontmatter', async () => {
      mockContext.file.frontmatter = {
        title: 'Test Note',
        aliases: ['alias1', 'alias2'],
        tags: ['tag1', 'tag2'],
        status: 'draft',
        date_created: '2024-01-01',
        date_updated: '2024-01-02',
      };

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should fix missing frontmatter', async () => {
      mockContext.file.content = 'Some content without frontmatter';
      mockContext.file.frontmatter = {};

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].description).toBe('Fixed frontmatter required fields');
      expect(fixes[0].changes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('insert');
    });

    it('should fix missing fields in existing frontmatter', async () => {
      mockContext.file.content = `---
title: Test Note
---
Some content`;
      mockContext.file.frontmatter = {
        title: 'Test Note',
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].changes[0].type).toBe('replace');
      expect(fixes[0].changes[0].newText).toContain('aliases: []');
      expect(fixes[0].changes[0].newText).toContain('tags: []');
      expect(fixes[0].changes[0].newText).toContain('status: draft');
    });

    it('should fix invalid field values', async () => {
      mockContext.file.content = `---
title: Test Note
aliases: not-an-array
status: invalid
date_created: invalid-date
---
Content`;
      mockContext.file.frontmatter = {
        title: 'Test Note',
        aliases: 'not-an-array',
        status: 'invalid',
        date_created: 'invalid-date',
      };

      const issues = await rule.lint(mockContext);
      const fixes = await rule.fix(mockContext, issues);

      expect(fixes).toHaveLength(1);
      const newContent = fixes[0].changes[0].newText as string;
      expect(newContent).toContain('aliases:\n  - not-an-array');
      expect(newContent).toContain('status: draft');
      expect(newContent).toMatch(/date_created: \d{4}-\d{2}-\d{2}/);
    });
  });

  describe('FrontmatterRequiredFieldsMinimalRule', () => {
    let rule: FrontmatterRequiredFieldsMinimalRule;

    beforeEach(() => {
      const minimalConfig = {
        ...mockConfig,
        settings: {
          required_fields: ['title', 'status'],
          auto_fix: true,
          default_status: 'draft',
          date_format: 'YYYY-MM-DD',
          strict_arrays: false,
        },
      };
      rule = new FrontmatterRequiredFieldsMinimalRule(minimalConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('frontmatter-required-fields.minimal');
      expect(rule.name).toBe('Minimal Frontmatter Fields');
    });

    it('should only require minimal fields', async () => {
      mockContext.file.frontmatter = {
        title: 'Test Note',
        status: 'draft',
      };

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should detect missing minimal fields', async () => {
      mockContext.file.frontmatter = {
        title: 'Test Note',
        // Missing status
      };

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(
        'Missing required frontmatter field: status'
      );
    });
  });

  describe('FrontmatterRequiredFieldsCustomRule', () => {
    let rule: FrontmatterRequiredFieldsCustomRule;

    beforeEach(() => {
      const customConfig = {
        ...mockConfig,
        settings: {
          required_fields: ['title', 'tags', 'priority'],
          auto_fix: true,
          default_status: 'draft',
          date_format: 'YYYY-MM-DD',
          custom_fields: {
            priority: 'high',
            project: '',
            author: '',
          },
        },
      };
      rule = new FrontmatterRequiredFieldsCustomRule(customConfig);
    });

    it('should create rule with correct properties', () => {
      expect(rule.id.full).toBe('frontmatter-required-fields.custom');
      expect(rule.name).toBe('Custom Frontmatter Fields');
    });

    it('should validate custom fields', async () => {
      mockContext.file.frontmatter = {
        title: 'Test Note',
        tags: ['test'],
        priority: 'high',
      };

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should detect missing custom fields', async () => {
      mockContext.file.frontmatter = {
        title: 'Test Note',
        tags: ['test'],
        // Missing priority
      };

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(
        'Missing required frontmatter field: priority'
      );
    });

    it('should validate custom field types', async () => {
      mockContext.file.frontmatter = {
        title: 'Test Note',
        tags: ['test'],
        priority: 123, // Should be string according to custom_fields
      };

      const issues = await rule.lint(mockContext);
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(i => i.message.includes('should be of type string'))
      ).toBe(true);
    });
  });

  describe('createFrontmatterRequiredFieldsRule factory', () => {
    it('should create strict rule', () => {
      const rule = createFrontmatterRequiredFieldsRule(
        'frontmatter-required-fields.strict',
        mockConfig
      );
      expect(rule).toBeInstanceOf(FrontmatterRequiredFieldsStrictRule);
      expect(rule.id.full).toBe('frontmatter-required-fields.strict');
    });

    it('should create minimal rule', () => {
      const rule = createFrontmatterRequiredFieldsRule(
        'frontmatter-required-fields.minimal',
        mockConfig
      );
      expect(rule).toBeInstanceOf(FrontmatterRequiredFieldsMinimalRule);
      expect(rule.id.full).toBe('frontmatter-required-fields.minimal');
    });

    it('should create custom rule', () => {
      const rule = createFrontmatterRequiredFieldsRule(
        'frontmatter-required-fields.custom',
        mockConfig
      );
      expect(rule).toBeInstanceOf(FrontmatterRequiredFieldsCustomRule);
      expect(rule.id.full).toBe('frontmatter-required-fields.custom');
    });

    it('should throw error for unknown rule variant', () => {
      expect(() => {
        createFrontmatterRequiredFieldsRule(
          'frontmatter-required-fields.unknown',
          mockConfig
        );
      }).toThrow(
        'Unknown frontmatter required fields rule variant: frontmatter-required-fields.unknown'
      );
    });
  });

  describe('Date validation', () => {
    let rule: FrontmatterRequiredFieldsStrictRule;

    beforeEach(() => {
      rule = new FrontmatterRequiredFieldsStrictRule(mockConfig);
    });

    it('should validate correct date format', async () => {
      mockContext.file.frontmatter = {
        title: 'Test',
        aliases: [],
        tags: [],
        status: 'draft',
        date_created: '2024-01-01',
        date_updated: '2024-12-31',
      };

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should detect invalid date formats', async () => {
      mockContext.file.frontmatter = {
        title: 'Test',
        aliases: [],
        tags: [],
        status: 'draft',
        date_created: '01/01/2024', // Wrong format
        date_updated: '2024-13-01', // Invalid date
      };

      const issues = await rule.lint(mockContext);
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(i =>
          i.message.includes('date_created must be in YYYY-MM-DD format')
        )
      ).toBe(true);
      expect(
        issues.some(i =>
          i.message.includes('date_updated must be in YYYY-MM-DD format')
        )
      ).toBe(true);
    });
  });

  describe('Array validation', () => {
    let rule: FrontmatterRequiredFieldsStrictRule;

    beforeEach(() => {
      rule = new FrontmatterRequiredFieldsStrictRule(mockConfig);
    });

    it('should validate array fields', async () => {
      mockContext.file.frontmatter = {
        title: 'Test',
        aliases: ['alias1', 'alias2'],
        tags: ['tag1', 'tag2'],
        status: 'draft',
        date_created: '2024-01-01',
        date_updated: '2024-01-01',
      };

      const issues = await rule.lint(mockContext);
      expect(issues).toHaveLength(0);
    });

    it('should detect non-array values for array fields', async () => {
      mockContext.file.frontmatter = {
        title: 'Test',
        aliases: 'single-alias', // Should be array
        tags: 'single-tag', // Should be array
        status: 'draft',
        date_created: '2024-01-01',
        date_updated: '2024-01-01',
      };

      const issues = await rule.lint(mockContext);
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(i => i.message.includes('aliases must be an array'))
      ).toBe(true);
      expect(
        issues.some(i => i.message.includes('tags must be an array'))
      ).toBe(true);
    });

    it('should validate array element types in strict mode', async () => {
      mockContext.file.frontmatter = {
        title: 'Test',
        aliases: ['valid', 123, true], // Mixed types
        tags: ['valid', null], // Contains null
        status: 'draft',
        date_created: '2024-01-01',
        date_updated: '2024-01-01',
      };

      const issues = await rule.lint(mockContext);
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(i => i.message.includes('aliases[1] should be a string'))
      ).toBe(true);
      expect(
        issues.some(i => i.message.includes('aliases[2] should be a string'))
      ).toBe(true);
      expect(
        issues.some(i => i.message.includes('tags[1] should be a string'))
      ).toBe(true);
    });
  });

  describe('Status validation', () => {
    let rule: FrontmatterRequiredFieldsStrictRule;

    beforeEach(() => {
      rule = new FrontmatterRequiredFieldsStrictRule(mockConfig);
    });

    it('should validate correct status values', async () => {
      const validStatuses = [
        'draft',
        'in-progress',
        'active',
        'on-hold',
        'archived',
      ];

      for (const status of validStatuses) {
        mockContext.file.frontmatter = {
          title: 'Test',
          aliases: [],
          tags: [],
          status,
          date_created: '2024-01-01',
          date_updated: '2024-01-01',
        };

        const issues = await rule.lint(mockContext);
        expect(issues).toHaveLength(0);
      }
    });

    it('should detect invalid status values', async () => {
      mockContext.file.frontmatter = {
        title: 'Test',
        aliases: [],
        tags: [],
        status: 'invalid-status',
        date_created: '2024-01-01',
        date_updated: '2024-01-01',
      };

      const issues = await rule.lint(mockContext);
      expect(issues.length).toBeGreaterThan(0);
      expect(
        issues.some(i =>
          i.message.includes(
            'Status must be one of: draft, in-progress, active, on-hold, archived'
          )
        )
      ).toBe(true);
    });
  });
});
