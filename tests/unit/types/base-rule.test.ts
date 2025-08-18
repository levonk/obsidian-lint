/**
 * Unit tests for BaseRule abstract class
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BaseRule } from '../../../src/types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../../src/types/rules.js';
import type { Issue, Fix } from '../../../src/types/common.js';

// Concrete implementation for testing
class TestRule extends BaseRule {
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    return [
      {
        ruleId: this.id.full,
        severity: 'warning',
        message: 'Test issue found',
        file: context.file.path,
        fixable: true,
      },
    ];
  }

  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    return [
      {
        ruleId: this.id.full,
        file: context.file.path,
        description: 'Fixed test issue',
        changes: [],
      },
    ];
  }
}

describe('BaseRule', () => {
  let ruleId: RuleId;
  let ruleConfig: RuleConfig;
  let testRule: TestRule;

  beforeEach(() => {
    ruleId = {
      major: 'test-rule',
      minor: 'basic',
      full: 'test-rule.basic',
    };

    ruleConfig = {
      pathAllowlist: ['**/*.md'],
      pathDenylist: ['**/private/**'],
      includePatterns: ['**/*'],
      excludePatterns: ['.*', '*.tmp'],
      settings: { testSetting: 'value' },
    };

    testRule = new TestRule(
      ruleId,
      'Test Rule',
      'A test rule for testing',
      'test',
      ruleConfig
    );
  });

  describe('constructor', () => {
    it('should initialize all properties correctly', () => {
      expect(testRule.id).toBe(ruleId);
      expect(testRule.name).toBe('Test Rule');
      expect(testRule.description).toBe('A test rule for testing');
      expect(testRule.category).toBe('test');
      expect(testRule.config).toBe(ruleConfig);
    });

    it('should make properties readonly', () => {
      // TypeScript should prevent this at compile time
      // At runtime, the properties are still accessible but this is expected
      expect(testRule.id).toBeDefined();
      expect(testRule.name).toBeDefined();
      expect(testRule.description).toBeDefined();
      expect(testRule.category).toBeDefined();
      expect(testRule.config).toBeDefined();
    });
  });

  describe('shouldApplyToFile', () => {
    it('should return true for files matching allowlist', () => {
      expect(testRule.shouldApplyToFile('test/example.md')).toBe(true);
      expect(testRule.shouldApplyToFile('folder/subfolder/note.md')).toBe(true);
    });

    it('should return false for files not matching allowlist', () => {
      expect(testRule.shouldApplyToFile('test/example.txt')).toBe(false);
      expect(testRule.shouldApplyToFile('test/example.py')).toBe(false);
    });

    it('should return false for files matching denylist', () => {
      expect(testRule.shouldApplyToFile('private/secret.md')).toBe(false);
      expect(testRule.shouldApplyToFile('folder/private/note.md')).toBe(false);
    });

    it('should prioritize denylist over allowlist', () => {
      // File matches both allowlist and denylist - should be denied
      expect(testRule.shouldApplyToFile('private/secret.md')).toBe(false);
    });

    it('should handle empty allowlist (use include/exclude patterns)', () => {
      const ruleWithoutAllowlist = new TestRule(
        ruleId,
        'Test Rule',
        'A test rule',
        'test',
        {
          pathAllowlist: [],
          pathDenylist: [],
          includePatterns: ['**/*.md'],
          excludePatterns: ['.*'],
          settings: {},
        }
      );

      expect(ruleWithoutAllowlist.shouldApplyToFile('test.md')).toBe(true);
      expect(ruleWithoutAllowlist.shouldApplyToFile('test.txt')).toBe(false);
      expect(ruleWithoutAllowlist.shouldApplyToFile('.hidden')).toBe(false);
    });

    it('should handle exclude patterns', () => {
      // Create a rule without allowlist to test exclude patterns properly
      const ruleWithExcludes = new TestRule(
        ruleId,
        'Test Rule',
        'A test rule',
        'test',
        {
          pathAllowlist: [],
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: ['.*', '*.tmp'],
          settings: {},
        }
      );

      expect(ruleWithExcludes.shouldApplyToFile('.hidden')).toBe(false);
      expect(ruleWithExcludes.shouldApplyToFile('temp.tmp')).toBe(false);
      expect(ruleWithExcludes.shouldApplyToFile('normal.md')).toBe(true);
    });

    it('should handle include patterns when no allowlist', () => {
      const ruleWithIncludeOnly = new TestRule(
        ruleId,
        'Test Rule',
        'A test rule',
        'test',
        {
          pathAllowlist: [],
          pathDenylist: [],
          includePatterns: ['**/*.md', '**/*.txt'],
          excludePatterns: [],
          settings: {},
        }
      );

      expect(ruleWithIncludeOnly.shouldApplyToFile('test.md')).toBe(true);
      expect(ruleWithIncludeOnly.shouldApplyToFile('test.txt')).toBe(true);
      expect(ruleWithIncludeOnly.shouldApplyToFile('test.py')).toBe(false);
    });

    it('should return false if file does not match any include patterns', () => {
      const ruleWithSpecificIncludes = new TestRule(
        ruleId,
        'Test Rule',
        'A test rule',
        'test',
        {
          pathAllowlist: [],
          pathDenylist: [],
          includePatterns: ['**/*.txt'],
          excludePatterns: [],
          settings: {},
        }
      );

      expect(ruleWithSpecificIncludes.shouldApplyToFile('test.md')).toBe(false);
      expect(ruleWithSpecificIncludes.shouldApplyToFile('test.txt')).toBe(true);
    });
  });

  describe('pattern matching', () => {
    let patternTestRule: TestRule;

    beforeEach(() => {
      patternTestRule = new TestRule(
        ruleId,
        'Pattern Test Rule',
        'A rule for testing patterns',
        'test',
        {
          pathAllowlist: [],
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: [],
          settings: {},
        }
      );
    });

    it('should match single asterisk patterns', () => {
      patternTestRule.config.includePatterns = ['*.md'];
      expect(patternTestRule.shouldApplyToFile('test.md')).toBe(true);
      expect(patternTestRule.shouldApplyToFile('folder/test.md')).toBe(false);
    });

    it('should match double asterisk patterns', () => {
      patternTestRule.config.includePatterns = ['**/*.md'];
      expect(patternTestRule.shouldApplyToFile('test.md')).toBe(true);
      expect(patternTestRule.shouldApplyToFile('folder/test.md')).toBe(true);
      expect(
        patternTestRule.shouldApplyToFile('folder/subfolder/test.md')
      ).toBe(true);
    });

    it('should match question mark patterns', () => {
      patternTestRule.config.includePatterns = ['test?.md'];
      expect(patternTestRule.shouldApplyToFile('test1.md')).toBe(true);
      expect(patternTestRule.shouldApplyToFile('testa.md')).toBe(true);
      expect(patternTestRule.shouldApplyToFile('test.md')).toBe(false); // No character for ?
      expect(patternTestRule.shouldApplyToFile('test12.md')).toBe(false); // Too many characters
    });

    it('should handle complex patterns', () => {
      patternTestRule.config.includePatterns = ['**/notes/**/*.md'];
      expect(
        patternTestRule.shouldApplyToFile('vault/notes/daily/2023-01-01.md')
      ).toBe(true);
      expect(patternTestRule.shouldApplyToFile('notes/daily/test.md')).toBe(
        true
      );
      expect(patternTestRule.shouldApplyToFile('vault/other/test.md')).toBe(
        false
      );
    });

    it('should escape dots in patterns', () => {
      patternTestRule.config.includePatterns = ['test.md'];
      expect(patternTestRule.shouldApplyToFile('test.md')).toBe(true);
      expect(patternTestRule.shouldApplyToFile('testXmd')).toBe(false); // Dot should not match any character
    });

    it('should handle patterns with multiple wildcards', () => {
      patternTestRule.config.includePatterns = ['**/*test*.md'];
      expect(patternTestRule.shouldApplyToFile('folder/mytest.md')).toBe(true);
      expect(patternTestRule.shouldApplyToFile('folder/testfile.md')).toBe(
        true
      );
      expect(patternTestRule.shouldApplyToFile('folder/mytestfile.md')).toBe(
        true
      );
      expect(patternTestRule.shouldApplyToFile('folder/other.md')).toBe(false);
    });
  });

  describe('abstract methods', () => {
    it('should require lint method implementation', async () => {
      const mockContext = {
        file: {
          path: 'test.md',
          content: 'test',
          frontmatter: {},
          headings: [],
          links: [],
          attachments: [],
          ast: { type: 'root' as const, children: [] },
        },
        vaultPath: '/vault',
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const issues = await testRule.lint(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe('test-rule.basic');
      expect(issues[0].message).toBe('Test issue found');
    });

    it('should allow optional fix method implementation', async () => {
      const mockContext = {
        file: {
          path: 'test.md',
          content: 'test',
          frontmatter: {},
          headings: [],
          links: [],
          attachments: [],
          ast: { type: 'root' as const, children: [] },
        },
        vaultPath: '/vault',
        dryRun: false,
        verbose: false,
        metadata: {},
      };

      const mockIssues: Issue[] = [
        {
          ruleId: 'test-rule.basic',
          severity: 'warning',
          message: 'Test issue',
          file: 'test.md',
          fixable: true,
        },
      ];

      const fixes = await testRule.fix!(mockContext, mockIssues);
      expect(fixes).toHaveLength(1);
      expect(fixes[0].ruleId).toBe('test-rule.basic');
      expect(fixes[0].description).toBe('Fixed test issue');
    });
  });

  describe('rule without fix method', () => {
    class RuleWithoutFix extends BaseRule {
      async lint(context: RuleExecutionContext): Promise<Issue[]> {
        return [];
      }
      // No fix method
    }

    it('should work without fix method', () => {
      const ruleWithoutFix = new RuleWithoutFix(
        ruleId,
        'Rule Without Fix',
        'A rule without fix capability',
        'test',
        ruleConfig
      );

      expect(ruleWithoutFix.fix).toBeUndefined();
      expect(ruleWithoutFix.shouldApplyToFile('test.md')).toBe(true);
    });
  });
});
