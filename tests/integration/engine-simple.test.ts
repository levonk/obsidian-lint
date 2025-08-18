/**
 * Simple integration tests for the LintEngine core functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LintEngine } from '../../src/core/engine.js';
import type { ProcessOptions } from '../../src/types/index.js';

describe('LintEngine Simple Integration Tests', () => {
  let testDir: string;
  let vaultDir: string;
  let configDir: string;
  let engine: LintEngine;

  beforeEach(() => {
    // Create temporary test directory
    testDir = join(tmpdir(), `obsidian-lint-simple-test-${Date.now()}`);
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

    // Initialize engine
    engine = new LintEngine(2);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic Engine Functionality', () => {
    it('should create engine instance', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(LintEngine);
    });

    it('should load configuration', async () => {
      const config = await engine.loadConfiguration(
        join(configDir, 'obsidian-lint.toml')
      );

      expect(config).toBeDefined();
      expect(config.activeProfile).toBe('default');
      expect(config.profiles.default).toBeDefined();
    });

    it('should handle missing configuration gracefully', async () => {
      await expect(
        engine.loadConfiguration('/nonexistent/config.toml')
      ).rejects.toThrow();
    });

    it('should process vault with dry run', async () => {
      // Set config path for the engine
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBeGreaterThanOrEqual(0);
      expect(result.issuesFound).toBeDefined();
      expect(result.fixesApplied).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle parallel processing flag', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: true, // Enable parallel processing
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should handle progress callback', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      let progressCalled = false;
      const progressCallback = (
        current: number,
        total: number,
        message?: string
      ) => {
        progressCalled = true;
        expect(current).toBeGreaterThanOrEqual(0);
        expect(total).toBeGreaterThan(0);
        expect(current).toBeLessThanOrEqual(total);
      };

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      await engine.processVault(vaultDir, options, progressCallback);

      expect(progressCalled).toBe(true);
    });

    it('should handle ignore patterns', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      // Create a file that should be ignored
      writeFileSync(
        join(vaultDir, 'ignored-file.md'),
        `# Ignored File\n\nThis should be ignored.`
      );

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
        ignore: ['**/ignored-*.md'], // Ignore files matching this pattern
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      // Should process fewer files due to ignore pattern
    });

    it('should handle empty vault', async () => {
      // Create empty vault
      const emptyVaultDir = join(testDir, 'empty-vault');
      mkdirSync(emptyVaultDir, { recursive: true });

      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(emptyVaultDir, options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBe(0);
      expect(result.issuesFound).toHaveLength(0);
      expect(result.fixesApplied).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid vault path', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault('/nonexistent/vault', options);

      expect(result).toBeDefined();
      expect(result.filesProcessed).toBe(0);
      // Should handle gracefully without throwing
    });

    it('should collect errors during processing', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      const options: ProcessOptions = {
        dryRun: true,
        fix: false,
        verbose: false,
        generateMoc: false,
        parallel: false,
      };

      const result = await engine.processVault(vaultDir, options);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should get available profiles', async () => {
      const profiles = await engine.getAvailableProfiles();

      expect(profiles).toBeDefined();
      expect(Array.isArray(profiles)).toBe(true);
    });

    it('should handle missing profile', async () => {
      process.env.OBSIDIAN_LINT_CONFIG = join(configDir, 'obsidian-lint.toml');

      await expect(engine.loadRules('nonexistent')).rejects.toThrow(
        "Profile 'nonexistent' not found"
      );
    });
  });
});
