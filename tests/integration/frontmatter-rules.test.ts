/**
 * Integration tests for frontmatter rules
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { RuleLoader } from '../../src/core/rules.js';
import type { MarkdownFile } from '../../src/types/common.js';

describe('Frontmatter Rules Integration', () => {
  const testDir = join(process.cwd(), 'test-temp-frontmatter');
  const rulesDir = join(testDir, 'rules', 'test-profile');
  const enabledDir = join(rulesDir, 'enabled', 'frontmatter-required-fields');

  let ruleLoader: RuleLoader;

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(enabledDir, { recursive: true });
    ruleLoader = new RuleLoader();
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should load and execute strict frontmatter rule', async () => {
    // Create strict rule configuration
    const strictRuleConfig = `[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter Fields"
description = "Enforce all required frontmatter fields with strict validation"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title", "aliases", "tags", "status", "date_created", "date_updated"]
auto_fix = true
default_status = "draft"
date_format = "YYYY-MM-DD"`;

    writeFileSync(join(enabledDir, 'strict.toml'), strictRuleConfig);

    // Load rules
    const rules = await ruleLoader.loadRules(rulesDir);
    expect(rules).toHaveLength(1);

    const rule = rules[0];
    expect(rule.id.full).toBe('frontmatter-required-fields.strict');

    // Test with file missing frontmatter
    const mockFile: MarkdownFile = {
      path: 'test.md',
      content: 'Just some content',
      frontmatter: {},
      headings: [],
      links: [],
      attachments: [],
      ast: { type: 'root', children: [] },
    };

    const context = {
      file: mockFile,
      vaultPath: '/test',
      dryRun: false,
      verbose: false,
      metadata: {},
    };

    const issues = await rule.lint(context);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('Missing frontmatter section');
    expect(issues[0].fixable).toBe(true);

    // Test fix functionality
    if (rule.fix) {
      const fixes = await rule.fix(context, issues);
      expect(fixes).toHaveLength(1);
      expect(fixes[0].description).toBe('Fixed frontmatter required fields');
    }
  });

  it('should load and execute minimal frontmatter rule', async () => {
    // Create minimal rule configuration
    const minimalRuleConfig = `[rule]
id = "frontmatter-required-fields.minimal"
name = "Minimal Frontmatter Fields"
description = "Enforce minimal required frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title", "status"]
auto_fix = true
default_status = "draft"
date_format = "YYYY-MM-DD"`;

    writeFileSync(join(enabledDir, 'minimal.toml'), minimalRuleConfig);

    // Load rules
    const rules = await ruleLoader.loadRules(rulesDir);
    expect(rules).toHaveLength(1);

    const rule = rules[0];
    expect(rule.id.full).toBe('frontmatter-required-fields.minimal');

    // Test with file having only title
    const mockFile: MarkdownFile = {
      path: 'test.md',
      content: `---
title: Test Note
---
Content`,
      frontmatter: {
        title: 'Test Note',
      },
      headings: [],
      links: [],
      attachments: [],
      ast: { type: 'root', children: [] },
    };

    const context = {
      file: mockFile,
      vaultPath: '/test',
      dryRun: false,
      verbose: false,
      metadata: {},
    };

    const issues = await rule.lint(context);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe(
      'Missing required frontmatter field: status'
    );
  });

  it('should load and execute custom frontmatter rule', async () => {
    // Create custom rule configuration
    const customRuleConfig = `[rule]
id = "frontmatter-required-fields.custom"
name = "Custom Frontmatter Fields"
description = "Enforce custom set of required frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title", "priority", "project"]
auto_fix = true
default_status = "draft"
date_format = "YYYY-MM-DD"

[settings.custom_fields]
priority = "medium"
project = "default"`;

    writeFileSync(join(enabledDir, 'custom.toml'), customRuleConfig);

    // Load rules
    const rules = await ruleLoader.loadRules(rulesDir);
    expect(rules).toHaveLength(1);

    const rule = rules[0];
    expect(rule.id.full).toBe('frontmatter-required-fields.custom');

    // Test with file having custom fields
    const mockFile: MarkdownFile = {
      path: 'test.md',
      content: `---
title: Test Note
priority: high
project: test-project
---
Content`,
      frontmatter: {
        title: 'Test Note',
        priority: 'high',
        project: 'test-project',
      },
      headings: [],
      links: [],
      attachments: [],
      ast: { type: 'root', children: [] },
    };

    const context = {
      file: mockFile,
      vaultPath: '/test',
      dryRun: false,
      verbose: false,
      metadata: {},
    };

    const issues = await rule.lint(context);
    expect(issues).toHaveLength(0);
  });

  it('should detect rule conflicts between variants', async () => {
    // Create both strict and minimal rules (should conflict)
    const strictRuleConfig = `[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter Fields"
description = "Enforce all required frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title", "status"]
auto_fix = true
default_status = "draft"
date_format = "YYYY-MM-DD"`;

    const minimalRuleConfig = `[rule]
id = "frontmatter-required-fields.minimal"
name = "Minimal Frontmatter Fields"
description = "Enforce minimal required frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title"]
auto_fix = true
default_status = "draft"
date_format = "YYYY-MM-DD"`;

    writeFileSync(join(enabledDir, 'strict.toml'), strictRuleConfig);
    writeFileSync(join(enabledDir, 'minimal.toml'), minimalRuleConfig);

    // Loading should fail due to conflict
    await expect(ruleLoader.loadRules(rulesDir)).rejects.toThrow(
      /Rule conflicts detected/
    );
  });

  it('should validate rule configuration format', async () => {
    // Create invalid rule configuration (missing required fields)
    const invalidRuleConfig = `[rule]
name = "Invalid Rule"
# Missing id, description, category

[config]
path_allowlist = ["**/*.md"]

[settings]
required_fields = ["title"]`;

    writeFileSync(join(enabledDir, 'invalid.toml'), invalidRuleConfig);

    // Loading should fail due to validation error
    await expect(ruleLoader.loadRules(rulesDir)).rejects.toThrow(
      /Missing required field: rule.id/
    );
  });

  it('should handle rule with invalid ID format', async () => {
    // Create rule with invalid ID format
    const invalidIdRuleConfig = `[rule]
id = "invalid_id_format"  # Should be kebab-case with major.minor
name = "Invalid ID Rule"
description = "Rule with invalid ID format"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]

[settings]
required_fields = ["title"]`;

    writeFileSync(join(enabledDir, 'invalid-id.toml'), invalidIdRuleConfig);

    // Loading should fail due to invalid ID format
    await expect(ruleLoader.loadRules(rulesDir)).rejects.toThrow(
      /Rule ID must be in format 'major.minor'/
    );
  });

  it('should apply path filtering correctly', async () => {
    // Create rule with path restrictions
    const restrictedRuleConfig = `[rule]
id = "frontmatter-required-fields.strict"
name = "Restricted Frontmatter Fields"
description = "Frontmatter rule with path restrictions"
category = "frontmatter"

[config]
path_allowlist = ["notes/**"]
path_denylist = ["templates/**"]
include_patterns = ["**/*"]
exclude_patterns = [".*", "README.md"]

[settings]
required_fields = ["title"]
auto_fix = true
default_status = "draft"
date_format = "YYYY-MM-DD"`;

    writeFileSync(join(enabledDir, 'restricted.toml'), restrictedRuleConfig);

    const rules = await ruleLoader.loadRules(rulesDir);
    const rule = rules[0];

    // Test path filtering
    expect(rule.shouldApplyToFile('notes/test.md')).toBe(true);
    expect(rule.shouldApplyToFile('templates/test.md')).toBe(false);
    expect(rule.shouldApplyToFile('README.md')).toBe(false);
    expect(rule.shouldApplyToFile('.hidden.md')).toBe(false);
    expect(rule.shouldApplyToFile('other/test.md')).toBe(false); // Not in allowlist
  });
});
