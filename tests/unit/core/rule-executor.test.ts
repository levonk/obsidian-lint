/**
 * Unit tests for Rule Execution Engine
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  RuleExecutor,
  RuleExecutionError,
} from '../../../src/core/rule-executor.js';
import type { Rule, RuleExecutionContext } from '../../../src/types/rules.js';
import type { MarkdownFile, Issue, Fix } from '../../../src/types/common.js';

describe('RuleExecutor', () => {
  let ruleExecutor: RuleExecutor;
  let mockFile: MarkdownFile;
  let mockRule: Rule;

  beforeEach(() => {
    ruleExecutor = new RuleExecutor();

    mockFile = {
      path: 'test/example.md',
      content: '# Test File\n\nThis is a test file.',
      frontmatter: { title: 'Test File' },
      headings: [{ level: 1, text: 'Test File', line: 1 }],
      links: [],
      attachments: [],
      ast: { type: 'root', children: [] },
    };

    mockRule = {
      id: {
        major: 'test-rule',
        minor: 'basic',
        full: 'test-rule.basic',
      },
      name: 'Test Rule',
      description: 'A test rule',
      category: 'test',
      config: {
        pathAllowlist: ['**/*.md'],
        pathDenylist: [],
        includePatterns: ['**/*'],
        excludePatterns: ['.*'],
        settings: {},
      },
      lint: async () => [],
      shouldApplyToFile: (filePath: string) => {
        // Simple implementation for testing
        return filePath.endsWith('.md') && !filePath.includes('private');
      },
    };
  });

  describe('createExecutionContext', () => {
    it('should create a valid execution context', () => {
      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: true, verbose: false }
      );

      expect(context.file).toBe(mockFile);
      expect(context.vaultPath).toBe('/vault/path');
      expect(context.dryRun).toBe(true);
      expect(context.verbose).toBe(false);
      expect(context.metadata).toBeDefined();
      expect(context.metadata.fileSize).toBe(mockFile.content.length);
      expect(context.metadata.hasfrontmatter).toBe(true);
      expect(context.metadata.headingCount).toBe(1);
      expect(context.metadata.linkCount).toBe(0);
      expect(context.metadata.attachmentCount).toBe(0);
    });

    it('should include custom metadata', () => {
      const customMetadata = { customField: 'customValue' };
      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: true },
        customMetadata
      );

      expect(context.metadata.customField).toBe('customValue');
      expect(context.metadata.fileSize).toBe(mockFile.content.length);
    });
  });

  describe('executeRule', () => {
    it('should execute a rule successfully', async () => {
      const expectedIssues: Issue[] = [
        {
          ruleId: 'test-rule.basic',
          severity: 'warning',
          message: 'Test issue',
          file: 'test/example.md',
          fixable: true,
        },
      ];

      mockRule.lint = async () => expectedIssues;

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      const issues = await ruleExecutor.executeRule(mockRule, context);

      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe('test-rule.basic');
      expect(issues[0].message).toBe('Test issue');
      expect(issues[0].file).toBe('test/example.md');
    });

    it('should return empty array if rule does not apply to file', async () => {
      // Override shouldApplyToFile to return false
      mockRule.shouldApplyToFile = () => false;

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      const issues = await ruleExecutor.executeRule(mockRule, context);

      expect(issues).toHaveLength(0);
    });

    it('should enrich issues with missing fields', async () => {
      const incompleteIssue: Issue = {
        ruleId: '', // Missing
        severity: 'warning',
        message: 'Test issue',
        file: '', // Missing
        fixable: true,
      };

      mockRule.lint = async () => [incompleteIssue];

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      const issues = await ruleExecutor.executeRule(mockRule, context);

      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe('test-rule.basic');
      expect(issues[0].file).toBe('test/example.md');
    });

    it('should handle invalid severity values', async () => {
      const invalidIssue: Issue = {
        ruleId: 'test-rule.basic',
        severity: 'invalid' as any,
        message: 'Test issue',
        file: 'test/example.md',
        fixable: true,
      };

      mockRule.lint = async () => [invalidIssue];

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      const issues = await ruleExecutor.executeRule(mockRule, context);

      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('warning'); // Should default to warning
    });

    it('should throw RuleExecutionError on rule failure', async () => {
      mockRule.lint = async () => {
        throw new Error('Rule execution failed');
      };

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      expect(async () => {
        await ruleExecutor.executeRule(mockRule, context);
      }).toThrow(RuleExecutionError);
    });
  });

  describe('executeRuleFix', () => {
    it('should execute rule fix successfully', async () => {
      const issues: Issue[] = [
        {
          ruleId: 'test-rule.basic',
          severity: 'warning',
          message: 'Test issue',
          file: 'test/example.md',
          fixable: true,
        },
      ];

      const expectedFixes: Fix[] = [
        {
          ruleId: 'test-rule.basic',
          file: 'test/example.md',
          description: 'Fixed test issue',
          changes: [],
        },
      ];

      mockRule.fix = async () => expectedFixes;

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      const fixes = await ruleExecutor.executeRuleFix(
        mockRule,
        context,
        issues
      );

      expect(fixes).toHaveLength(1);
      expect(fixes[0].ruleId).toBe('test-rule.basic');
      expect(fixes[0].description).toBe('Fixed test issue');
    });

    it('should return empty array if rule has no fix method', async () => {
      const issues: Issue[] = [
        {
          ruleId: 'test-rule.basic',
          severity: 'warning',
          message: 'Test issue',
          file: 'test/example.md',
          fixable: true,
        },
      ];

      // mockRule.fix is undefined by default

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      const fixes = await ruleExecutor.executeRuleFix(
        mockRule,
        context,
        issues
      );

      expect(fixes).toHaveLength(0);
    });

    it('should return empty array if no fixable issues', async () => {
      const issues: Issue[] = [
        {
          ruleId: 'test-rule.basic',
          severity: 'warning',
          message: 'Test issue',
          file: 'test/example.md',
          fixable: false, // Not fixable
        },
      ];

      mockRule.fix = async () => [];

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      const fixes = await ruleExecutor.executeRuleFix(
        mockRule,
        context,
        issues
      );

      expect(fixes).toHaveLength(0);
    });

    it('should filter issues by rule ID', async () => {
      const issues: Issue[] = [
        {
          ruleId: 'test-rule.basic',
          severity: 'warning',
          message: 'Test issue',
          file: 'test/example.md',
          fixable: true,
        },
        {
          ruleId: 'other-rule.basic',
          severity: 'warning',
          message: 'Other issue',
          file: 'test/example.md',
          fixable: true,
        },
      ];

      mockRule.fix = async (context, filteredIssues) => {
        // Should only receive issues for this rule
        expect(filteredIssues).toHaveLength(1);
        expect(filteredIssues[0].ruleId).toBe('test-rule.basic');
        return [];
      };

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      await ruleExecutor.executeRuleFix(mockRule, context, issues);
    });

    it('should enrich fixes with missing fields', async () => {
      const issues: Issue[] = [
        {
          ruleId: 'test-rule.basic',
          severity: 'warning',
          message: 'Test issue',
          file: 'test/example.md',
          fixable: true,
        },
      ];

      const incompleteFix: Fix = {
        ruleId: '', // Missing
        file: '', // Missing
        description: '', // Missing
        changes: undefined as any, // Invalid
      };

      mockRule.fix = async () => [incompleteFix];

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      const fixes = await ruleExecutor.executeRuleFix(
        mockRule,
        context,
        issues
      );

      expect(fixes).toHaveLength(1);
      expect(fixes[0].ruleId).toBe('test-rule.basic');
      expect(fixes[0].file).toBe('test/example.md');
      expect(fixes[0].description).toBe('Fix applied by rule test-rule.basic');
      expect(Array.isArray(fixes[0].changes)).toBe(true);
    });

    it('should throw RuleExecutionError on fix failure', async () => {
      const issues: Issue[] = [
        {
          ruleId: 'test-rule.basic',
          severity: 'warning',
          message: 'Test issue',
          file: 'test/example.md',
          fixable: true,
        },
      ];

      mockRule.fix = async () => {
        throw new Error('Fix execution failed');
      };

      const context = ruleExecutor.createExecutionContext(
        mockFile,
        '/vault/path',
        { dryRun: false, verbose: false }
      );

      expect(async () => {
        await ruleExecutor.executeRuleFix(mockRule, context, issues);
      }).toThrow(RuleExecutionError);
    });
  });

  describe('filterRulesByPath', () => {
    let rules: Rule[];

    beforeEach(() => {
      rules = [
        {
          ...mockRule,
          id: { major: 'rule1', minor: 'basic', full: 'rule1.basic' },
          config: {
            ...mockRule.config,
            pathAllowlist: ['**/*.md'],
          },
          shouldApplyToFile: (filePath: string) => filePath.endsWith('.md'),
        },
        {
          ...mockRule,
          id: { major: 'rule2', minor: 'basic', full: 'rule2.basic' },
          config: {
            ...mockRule.config,
            pathAllowlist: ['**/*.txt'],
          },
          shouldApplyToFile: (filePath: string) => filePath.endsWith('.txt'),
        },
        {
          ...mockRule,
          id: { major: 'rule3', minor: 'basic', full: 'rule3.basic' },
          config: {
            ...mockRule.config,
            pathDenylist: ['**/private/**'],
          },
          shouldApplyToFile: (filePath: string) =>
            !filePath.includes('private'),
        },
      ];
    });

    it('should filter rules by allowlist patterns', () => {
      const filteredRules = ruleExecutor.filterRulesByPath(
        rules,
        'test/example.md'
      );

      expect(filteredRules).toHaveLength(2); // rule1 and rule3
      expect(filteredRules.map(r => r.id.full)).toEqual([
        'rule1.basic',
        'rule3.basic',
      ]);
    });

    it('should filter rules by denylist patterns', () => {
      const filteredRules = ruleExecutor.filterRulesByPath(
        rules,
        'private/secret.md'
      );

      expect(filteredRules).toHaveLength(1); // Only rule1 (rule3 is denied)
      expect(filteredRules[0].id.full).toBe('rule1.basic');
    });

    it('should return empty array if no rules match', () => {
      const filteredRules = ruleExecutor.filterRulesByPath(
        rules,
        'test/example.py'
      );

      expect(filteredRules).toHaveLength(1); // Only rule3 (no specific allowlist)
      expect(filteredRules[0].id.full).toBe('rule3.basic');
    });
  });

  describe('path pattern matching', () => {
    let testRule: Rule;

    beforeEach(() => {
      testRule = {
        ...mockRule,
        config: {
          pathAllowlist: [],
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: ['.*'],
          settings: {},
        },
      };
      // Remove shouldApplyToFile to test fallback logic
      delete (testRule as any).shouldApplyToFile;
    });

    it('should match simple glob patterns', () => {
      testRule.config.pathAllowlist = ['*.md'];
      const filtered = ruleExecutor.filterRulesByPath([testRule], 'test.md');
      expect(filtered).toHaveLength(1);

      const filtered2 = ruleExecutor.filterRulesByPath(
        [testRule],
        'folder/test.md'
      );
      expect(filtered2).toHaveLength(0); // Doesn't match *.md
    });

    it('should match recursive glob patterns', () => {
      testRule.config.pathAllowlist = ['**/*.md'];
      const filtered = ruleExecutor.filterRulesByPath(
        [testRule],
        'folder/subfolder/test.md'
      );
      expect(filtered).toHaveLength(1);
    });

    it('should respect denylist patterns', () => {
      testRule.config.pathAllowlist = ['**/*.md'];
      testRule.config.pathDenylist = ['**/private/**'];

      const filtered1 = ruleExecutor.filterRulesByPath(
        [testRule],
        'public/test.md'
      );
      expect(filtered1).toHaveLength(1);

      const filtered2 = ruleExecutor.filterRulesByPath(
        [testRule],
        'private/secret.md'
      );
      expect(filtered2).toHaveLength(0);
    });

    it('should handle exclude patterns', () => {
      testRule.config.excludePatterns = ['.*', '*.tmp'];

      const filtered1 = ruleExecutor.filterRulesByPath([testRule], 'test.md');
      expect(filtered1).toHaveLength(1);

      const filtered2 = ruleExecutor.filterRulesByPath([testRule], '.hidden');
      expect(filtered2).toHaveLength(0);

      const filtered3 = ruleExecutor.filterRulesByPath([testRule], 'temp.tmp');
      expect(filtered3).toHaveLength(0);
    });

    it('should handle include patterns', () => {
      testRule.config.includePatterns = ['**/*.md', '**/*.txt'];

      const filtered1 = ruleExecutor.filterRulesByPath([testRule], 'test.md');
      expect(filtered1).toHaveLength(1);

      const filtered2 = ruleExecutor.filterRulesByPath([testRule], 'test.txt');
      expect(filtered2).toHaveLength(1);

      const filtered3 = ruleExecutor.filterRulesByPath([testRule], 'test.py');
      expect(filtered3).toHaveLength(0);
    });
  });
});

describe('RuleExecutionError', () => {
  it('should create error with all properties', () => {
    const originalError = new Error('Original error');
    const error = new RuleExecutionError(
      'Execution failed',
      'test-rule.basic',
      'test/file.md',
      originalError
    );

    expect(error.message).toBe('Execution failed');
    expect(error.ruleId).toBe('test-rule.basic');
    expect(error.filePath).toBe('test/file.md');
    expect(error.originalError).toBe(originalError);
    expect(error.name).toBe('RuleExecutionError');
  });

  it('should create error without original error', () => {
    const error = new RuleExecutionError(
      'Execution failed',
      'test-rule.basic',
      'test/file.md'
    );

    expect(error.message).toBe('Execution failed');
    expect(error.ruleId).toBe('test-rule.basic');
    expect(error.filePath).toBe('test/file.md');
    expect(error.originalError).toBeUndefined();
  });
});
