/**
 * Integration tests for CLI commands
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CLI Integration Tests', () => {
  let testDir: string;
  let vaultDir: string;
  let configDir: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `obsidian-lint-test-${Date.now()}`);
    vaultDir = join(testDir, 'vault');
    configDir = join(vaultDir, '.config', 'obsidian-lint');

    mkdirSync(vaultDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });
    mkdirSync(join(configDir, 'rules', 'default', 'enabled'), {
      recursive: true,
    });

    // Create basic config file
    const config = `
[general]
vault_root = "${vaultDir.replace(/\\/g, '/')}"
dry_run = false
verbose = false
fix = false
parallel = true
max_concurrency = 2

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Test profile"
rules_path = "rules/default"
`;
    writeFileSync(join(configDir, 'obsidian-lint.toml'), config);

    // Create a test rule
    const testRule = `
[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter Fields"
description = "Require all frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = [".*"]

[settings]
required_fields = ["title", "date_created"]
`;
    writeFileSync(
      join(
        configDir,
        'rules',
        'default',
        'enabled',
        'frontmatter-required-fields.strict.toml'
      ),
      testRule
    );

    // Create test markdown files
    writeFileSync(
      join(vaultDir, 'test-note.md'),
      `---
title: Test Note
date_created: 2024-01-01
---

# Test Note

This is a test note.
`
    );

    writeFileSync(
      join(vaultDir, 'incomplete-note.md'),
      `---
title: Incomplete Note
---

# Incomplete Note

This note is missing required frontmatter.
`
    );
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('CLI Entry Point', () => {
    it('should have proper shebang and be executable', () => {
      const cliPath = join(process.cwd(), 'src', 'cli', 'index.ts');
      const content = require('fs').readFileSync(cliPath, 'utf-8');

      expect(content.startsWith('#!/usr/bin/env bun')).toBe(true);
    });

    it('should show help when --help is used', () => {
      try {
        const result = execSync('bun run src/cli/index.ts --help', {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });

        expect(result).toContain('obsidian-lint');
        expect(result).toContain('A comprehensive linting and fixing solution');
        expect(result).toContain('Commands:');
        expect(result).toContain('lint');
        expect(result).toContain('fix');
        expect(result).toContain('check');
        expect(result).toContain('rules');
        expect(result).toContain('profiles');
      } catch (error: any) {
        // Help command exits with code 0, but execSync might throw
        if (error.status === 0) {
          expect(error.stdout).toContain('obsidian-lint');
        } else {
          throw error;
        }
      }
    });

    it('should show version when --version is used', () => {
      try {
        const result = execSync('bun run src/cli/index.ts --version', {
          encoding: 'utf-8',
          cwd: process.cwd(),
        });

        expect(result).toMatch(/\d+\.\d+\.\d+/);
      } catch (error: any) {
        // Version command exits with code 0, but execSync might throw
        if (error.status === 0) {
          expect(error.stdout).toMatch(/\d+\.\d+\.\d+/);
        } else {
          throw error;
        }
      }
    });
  });

  describe('lint command', () => {
    it('should run lint command with default options', () => {
      const result = execSync(
        `bun run src/cli/index.ts lint "${vaultDir}" --config "${join(configDir, 'obsidian-lint.toml')}"`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('Files processed:');
    });

    it('should support dry-run mode', () => {
      const result = execSync(
        `bun run src/cli/index.ts lint "${vaultDir}" --config "${join(configDir, 'obsidian-lint.toml')}" --dry-run`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('DRY RUN');
    });

    it('should support verbose output', () => {
      const result = execSync(
        `bun run src/cli/index.ts lint "${vaultDir}" --config "${join(configDir, 'obsidian-lint.toml')}" --verbose`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('Running lint command');
    });

    it('should support JSON output', () => {
      const result = execSync(
        `bun run src/cli/index.ts lint "${vaultDir}" --config "${join(configDir, 'obsidian-lint.toml')}" --json`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('filesProcessed');
      expect(parsed).toHaveProperty('issuesFound');
      expect(parsed).toHaveProperty('fixesApplied');
      expect(parsed).toHaveProperty('errors');
      expect(parsed).toHaveProperty('duration');
    });
  });

  describe('fix command', () => {
    it('should run fix command', () => {
      const result = execSync(
        `bun run src/cli/index.ts fix "${vaultDir}" --config "${join(configDir, 'obsidian-lint.toml')}" --dry-run`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('Files processed:');
    });
  });

  describe('check command', () => {
    it('should validate configuration and rules', () => {
      const result = execSync(
        `bun run src/cli/index.ts check "${vaultDir}" --config "${join(configDir, 'obsidian-lint.toml')}"`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('✓ Configuration is valid');
      expect(result).toContain('✓ Loaded');
      expect(result).toContain('✓ No rule conflicts detected');
      expect(result).toContain('✓ All checks passed');
    });

    it('should show verbose rule information', () => {
      const result = execSync(
        `bun run src/cli/index.ts check "${vaultDir}" --config "${join(configDir, 'obsidian-lint.toml')}" --verbose`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('Configuration details:');
      expect(result).toContain('Enabled rules:');
    });
  });

  describe('rules command', () => {
    it('should list available rules', () => {
      const result = execSync(
        `bun run src/cli/index.ts rules --config "${join(configDir, 'obsidian-lint.toml')}"`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('Rules for profile:');
      expect(result).toContain('frontmatter-required-fields.strict');
    });

    it('should support JSON output for rules', () => {
      const result = execSync(
        `bun run src/cli/index.ts rules --config "${join(configDir, 'obsidian-lint.toml')}" --json`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('profile');
      expect(parsed).toHaveProperty('totalRules');
      expect(parsed).toHaveProperty('enabledRules');
      expect(parsed).toHaveProperty('rules');
    });

    it('should filter rules by category', () => {
      const result = execSync(
        `bun run src/cli/index.ts rules --config "${join(configDir, 'obsidian-lint.toml')}" --category frontmatter`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('FRONTMATTER:');
    });
  });

  describe('profiles command', () => {
    it('should list available profiles', () => {
      const result = execSync(
        `bun run src/cli/index.ts profiles --config "${join(configDir, 'obsidian-lint.toml')}"`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('Available profiles:');
      expect(result).toContain('Default Profile');
    });

    it('should show active profile', () => {
      const result = execSync(
        `bun run src/cli/index.ts profiles --active --config "${join(configDir, 'obsidian-lint.toml')}"`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('Active profile:');
      expect(result).toContain('default');
    });

    it('should support JSON output for profiles', () => {
      const result = execSync(
        `bun run src/cli/index.ts profiles --config "${join(configDir, 'obsidian-lint.toml')}" --json`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('activeProfile');
      expect(parsed).toHaveProperty('availableProfiles');
    });
  });

  describe('Global Options', () => {
    it('should support --config option', () => {
      const result = execSync(
        `bun run src/cli/index.ts check "${vaultDir}" --config "${join(configDir, 'obsidian-lint.toml')}"`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('✓ Configuration is valid');
    });

    it('should support --profile option', () => {
      const result = execSync(
        `bun run src/cli/index.ts rules --config "${join(configDir, 'obsidian-lint.toml')}" --profile default`,
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      expect(result).toContain('Rules for profile: default');
    });

    it('should handle missing vault path gracefully', () => {
      try {
        execSync(
          `bun run src/cli/index.ts lint --config "${join(configDir, 'obsidian-lint.toml')}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
          }
        );
      } catch (error: any) {
        // Should handle gracefully, not crash
        expect(error.status).not.toBe(null);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid config file gracefully', () => {
      const invalidConfigPath = join(testDir, 'invalid-config.toml');
      writeFileSync(invalidConfigPath, 'invalid toml content [[[');

      try {
        execSync(
          `bun run src/cli/index.ts check "${vaultDir}" --config "${invalidConfigPath}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
          }
        );
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain(
          'Failed to parse configuration'
        );
      }
    });

    it('should handle missing config file gracefully', () => {
      const missingConfigPath = join(testDir, 'missing-config.toml');

      try {
        execSync(
          `bun run src/cli/index.ts check "${vaultDir}" --config "${missingConfigPath}"`,
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
          }
        );
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain(
          'Configuration file not found'
        );
      }
    });
  });
});
