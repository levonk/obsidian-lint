/**
 * Unit tests for Rule System
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { RuleLoader, RuleEngine } from '../../../src/core/rules.js';
import { RuleExecutor } from '../../../src/core/rule-executor.js';
import type { Rule, RuleDefinition } from '../../../src/types/rules.js';

describe('RuleLoader', () => {
  let ruleLoader: RuleLoader;
  let testDir: string;

  beforeEach(() => {
    ruleLoader = new RuleLoader();
    testDir = join(process.cwd(), 'test-rules-temp');

    // Clean up any existing test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadRules', () => {
    it('should load rules from enabled directory', async () => {
      // Create test directory structure
      const enabledDir = join(testDir, 'enabled');
      mkdirSync(enabledDir, { recursive: true });

      // Create a test rule file
      const ruleContent = `
[rule]
id = "test-rule.basic"
name = "Test Rule"
description = "A test rule"
category = "test"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
test_setting = "value"
`;

      writeFileSync(join(enabledDir, 'test-rule.toml'), ruleContent);

      const rules = await ruleLoader.loadRules(testDir);

      expect(rules).toHaveLength(1);
      expect(rules[0].id.full).toBe('test-rule.basic');
      expect(rules[0].name).toBe('Test Rule');
      expect(rules[0].description).toBe('A test rule');
      expect(rules[0].category).toBe('test');
      expect(rules[0].config.pathAllowlist).toEqual(['**/*.md']);
      expect(rules[0].config.settings.test_setting).toBe('value');
    });

    it('should load rules from subdirectories', async () => {
      // Create test directory structure with subdirectories
      const enabledDir = join(testDir, 'enabled');
      const subDir = join(enabledDir, 'attachment-organization');
      mkdirSync(subDir, { recursive: true });

      // Create rule files in subdirectory
      const rule1Content = `
[rule]
id = "attachment-organization.centralized"
name = "Centralized Attachments"
description = "Move attachments to central location"
category = "attachment"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
attachment_directory = "Meta/Attachments"
`;

      writeFileSync(join(subDir, 'centralized.toml'), rule1Content);

      const rules = await ruleLoader.loadRules(testDir);

      expect(rules).toHaveLength(1);
      expect(rules[0].id.full).toBe('attachment-organization.centralized');
      expect(rules[0].config.settings.attachment_directory).toBe(
        'Meta/Attachments'
      );
    });

    it('should throw error if enabled directory does not exist', async () => {
      expect(async () => {
        await ruleLoader.loadRules(testDir);
      }).toThrow('Rules enabled directory not found');
    });

    it('should throw error for invalid TOML syntax', async () => {
      const enabledDir = join(testDir, 'enabled');
      mkdirSync(enabledDir, { recursive: true });

      // Create invalid TOML file
      writeFileSync(
        join(enabledDir, 'invalid.toml'),
        'invalid toml content [[['
      );

      expect(async () => {
        await ruleLoader.loadRules(testDir);
      }).toThrow('Failed to load rule from');
    });

    it('should detect and report rule conflicts', async () => {
      const enabledDir = join(testDir, 'enabled');
      mkdirSync(enabledDir, { recursive: true });

      // Create two rules with same major ID
      const rule1Content = `
[rule]
id = "test-rule.variant1"
name = "Test Rule Variant 1"
description = "First variant"
category = "test"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
`;

      const rule2Content = `
[rule]
id = "test-rule.variant2"
name = "Test Rule Variant 2"
description = "Second variant"
category = "test"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
`;

      writeFileSync(join(enabledDir, 'variant1.toml'), rule1Content);
      writeFileSync(join(enabledDir, 'variant2.toml'), rule2Content);

      expect(async () => {
        await ruleLoader.loadRules(testDir);
      }).toThrow('Rule conflicts detected');
    });
  });

  describe('loadRuleFromFile', () => {
    it('should load a valid rule file', async () => {
      const enabledDir = join(testDir, 'enabled');
      mkdirSync(enabledDir, { recursive: true });

      const ruleContent = `
[rule]
id = "frontmatter-required.strict"
name = "Strict Frontmatter"
description = "Enforce all required frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = ["Meta/Templates/**"]
include_patterns = ["**/*"]
exclude_patterns = [".*", "README.md"]

[settings]
required_fields = ["title", "date_created", "tags"]
auto_fix = true
`;

      const filePath = join(enabledDir, 'frontmatter.toml');
      writeFileSync(filePath, ruleContent);

      const rule = await ruleLoader.loadRuleFromFile(filePath);

      expect(rule.id.major).toBe('frontmatter-required');
      expect(rule.id.minor).toBe('strict');
      expect(rule.id.full).toBe('frontmatter-required.strict');
      expect(rule.name).toBe('Strict Frontmatter');
      expect(rule.config.pathDenylist).toEqual(['Meta/Templates/**']);
      expect(rule.config.settings.required_fields).toEqual([
        'title',
        'date_created',
        'tags',
      ]);
      expect(rule.config.settings.auto_fix).toBe(true);
    });

    it('should handle missing optional config fields', async () => {
      const enabledDir = join(testDir, 'enabled');
      mkdirSync(enabledDir, { recursive: true });

      const ruleContent = `
[rule]
id = "minimal-rule.test"
name = "Minimal Rule"
description = "A minimal rule definition"
category = "test"

[config]
# Only required section, no optional arrays

[settings]
`;

      const filePath = join(enabledDir, 'minimal.toml');
      writeFileSync(filePath, ruleContent);

      const rule = await ruleLoader.loadRuleFromFile(filePath);

      expect(rule.config.pathAllowlist).toEqual([]);
      expect(rule.config.pathDenylist).toEqual([]);
      expect(rule.config.includePatterns).toEqual(['**/*']);
      expect(rule.config.excludePatterns).toEqual(['.*']);
    });

    it('should throw error for missing required fields', async () => {
      const enabledDir = join(testDir, 'enabled');
      mkdirSync(enabledDir, { recursive: true });

      const ruleContent = `
[rule]
# Missing required fields
name = "Incomplete Rule"

[config]

[settings]
`;

      const filePath = join(enabledDir, 'incomplete.toml');
      writeFileSync(filePath, ruleContent);

      expect(async () => {
        await ruleLoader.loadRuleFromFile(filePath);
      }).toThrow('Rule validation failed');
    });

    it('should throw error for invalid rule ID format', async () => {
      const enabledDir = join(testDir, 'enabled');
      mkdirSync(enabledDir, { recursive: true });

      const ruleContent = `
[rule]
id = "invalid_id_format"
name = "Invalid Rule"
description = "Rule with invalid ID"
category = "test"

[config]

[settings]
`;

      const filePath = join(enabledDir, 'invalid-id.toml');
      writeFileSync(filePath, ruleContent);

      expect(async () => {
        await ruleLoader.loadRuleFromFile(filePath);
      }).toThrow('Invalid rule ID format');
    });
  });

  describe('validateRule', () => {
    it('should validate a correct rule', () => {
      const rule: Rule = {
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
      };

      expect(ruleLoader.validateRule(rule)).toBe(true);
    });

    it('should reject rule with missing required fields', () => {
      const rule = {
        id: {
          major: 'test-rule',
          minor: 'basic',
          full: 'test-rule.basic',
        },
        // Missing name, description, category
        config: {
          pathAllowlist: ['**/*.md'],
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: ['.*'],
          settings: {},
        },
        lint: async () => [],
      } as Rule;

      expect(ruleLoader.validateRule(rule)).toBe(false);
    });

    it('should reject rule with inconsistent ID', () => {
      const rule: Rule = {
        id: {
          major: 'test-rule',
          minor: 'basic',
          full: 'wrong.full', // Inconsistent with major.minor
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
      };

      expect(ruleLoader.validateRule(rule)).toBe(false);
    });

    it('should reject rule with non-array config fields', () => {
      const rule = {
        id: {
          major: 'test-rule',
          minor: 'basic',
          full: 'test-rule.basic',
        },
        name: 'Test Rule',
        description: 'A test rule',
        category: 'test',
        config: {
          pathAllowlist: 'not-an-array', // Should be array
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: ['.*'],
          settings: {},
        },
        lint: async () => [],
      } as Rule;

      expect(ruleLoader.validateRule(rule)).toBe(false);
    });
  });

  describe('detectRuleConflicts', () => {
    it('should detect no conflicts with different major IDs', () => {
      const rules: Rule[] = [
        {
          id: { major: 'rule1', minor: 'variant1', full: 'rule1.variant1' },
          name: 'Rule 1',
          description: 'First rule',
          category: 'test',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: ['**/*'],
            excludePatterns: ['.*'],
            settings: {},
          },
          lint: async () => [],
        },
        {
          id: { major: 'rule2', minor: 'variant1', full: 'rule2.variant1' },
          name: 'Rule 2',
          description: 'Second rule',
          category: 'test',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: ['**/*'],
            excludePatterns: ['.*'],
            settings: {},
          },
          lint: async () => [],
        },
      ];

      const result = ruleLoader.detectRuleConflicts(rules);

      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect conflicts with same major ID', () => {
      const rules: Rule[] = [
        {
          id: {
            major: 'same-rule',
            minor: 'variant1',
            full: 'same-rule.variant1',
          },
          name: 'Rule Variant 1',
          description: 'First variant',
          category: 'test',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: ['**/*'],
            excludePatterns: ['.*'],
            settings: {},
          },
          lint: async () => [],
        },
        {
          id: {
            major: 'same-rule',
            minor: 'variant2',
            full: 'same-rule.variant2',
          },
          name: 'Rule Variant 2',
          description: 'Second variant',
          category: 'test',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: ['**/*'],
            excludePatterns: ['.*'],
            settings: {},
          },
          lint: async () => [],
        },
      ];

      const result = ruleLoader.detectRuleConflicts(rules);

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].majorId).toBe('same-rule');
      expect(result.conflicts[0].conflictingRules).toHaveLength(2);
      expect(result.conflicts[0].resolution).toContain('variant1, variant2');
    });

    it('should generate warnings for rules with no path restrictions', () => {
      const rules: Rule[] = [
        {
          id: {
            major: 'unrestricted-rule',
            minor: 'basic',
            full: 'unrestricted-rule.basic',
          },
          name: 'Unrestricted Rule',
          description: 'Rule with no path restrictions',
          category: 'test',
          config: {
            pathAllowlist: [], // Empty
            pathDenylist: [], // Empty
            includePatterns: ['**/*'],
            excludePatterns: ['.*'],
            settings: {},
          },
          lint: async () => [],
        },
      ];

      const result = ruleLoader.detectRuleConflicts(rules);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('unrestricted-rule.basic');
      expect(result.warnings[0]).toContain('no path restrictions');
    });
  });
});

describe('RuleEngine', () => {
  let ruleEngine: RuleEngine;
  let testDir: string;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    testDir = join(process.cwd(), 'test-engine-temp');

    // Clean up any existing test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadRulesForProfile', () => {
    it('should load rules using the rule loader', async () => {
      // Create test directory structure
      const enabledDir = join(testDir, 'enabled');
      mkdirSync(enabledDir, { recursive: true });

      // Create a test rule file
      const ruleContent = `
[rule]
id = "engine-test.basic"
name = "Engine Test Rule"
description = "A test rule for engine"
category = "test"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
`;

      writeFileSync(join(enabledDir, 'engine-test.toml'), ruleContent);

      const rules = await ruleEngine.loadRulesForProfile(testDir);

      expect(rules).toHaveLength(1);
      expect(rules[0].id.full).toBe('engine-test.basic');
      expect(rules[0].name).toBe('Engine Test Rule');
    });
  });

  describe('getRuleLoader', () => {
    it('should return the rule loader instance', () => {
      const loader = ruleEngine.getRuleLoader();
      expect(loader).toBeInstanceOf(RuleLoader);
    });
  });

  describe('getRuleExecutor', () => {
    it('should return the rule executor instance', () => {
      const executor = ruleEngine.getRuleExecutor();
      expect(executor).toBeDefined();
      expect(typeof executor.executeRule).toBe('function');
      expect(typeof executor.executeRuleFix).toBe('function');
      expect(typeof executor.filterRulesByPath).toBe('function');
    });
  });

  describe('validateRuleConflicts', () => {
    it('should validate rule conflicts using the rule loader', () => {
      const rules: Rule[] = [
        {
          id: {
            major: 'conflict-test',
            minor: 'variant1',
            full: 'conflict-test.variant1',
          },
          name: 'Conflict Test 1',
          description: 'First variant',
          category: 'test',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: ['**/*'],
            excludePatterns: ['.*'],
            settings: {},
          },
          lint: async () => [],
        },
        {
          id: {
            major: 'conflict-test',
            minor: 'variant2',
            full: 'conflict-test.variant2',
          },
          name: 'Conflict Test 2',
          description: 'Second variant',
          category: 'test',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: ['**/*'],
            excludePatterns: ['.*'],
            settings: {},
          },
          lint: async () => [],
        },
      ];

      const result = ruleEngine.validateRuleConflicts(rules);

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].majorId).toBe('conflict-test');
    });
  });
});
