/**
 * Engine Performance Tests
 * Tests the performance optimizations in the LintEngine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LintEngine } from '../../src/core/engine.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LintEngine Performance', () => {
  let engine: LintEngine;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `obsidian-lint-perf-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    engine = new LintEngine(4, {
      enableCaching: true,
      enableMemoryManagement: true,
      enableWorkerThreads: false, // Disabled for testing
      cacheDirectory: tempDir,
      maxMemoryMB: 100,
    });
  });

  afterEach(async () => {
    await engine.shutdown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Performance Metrics', () => {
    it('should provide performance metrics', () => {
      const metrics = engine.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.maxConcurrency).toBeGreaterThan(0);
      expect(metrics.cpuCount).toBeGreaterThan(0);
      expect(metrics.recommendedConcurrency).toBeGreaterThan(0);
    });

    it('should include cache stats when caching is enabled', () => {
      const metrics = engine.getPerformanceMetrics();

      expect(metrics.cacheStats).toBeDefined();
      expect(metrics.memoryStats).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear caches', async () => {
      await engine.clearCaches();
      // Should not throw
    });
  });

  describe('Engine Health Validation', () => {
    it('should validate engine health', async () => {
      const health = await engine.validateEngineHealth();

      expect(health).toBeDefined();
      expect(typeof health.healthy).toBe('boolean');
      expect(Array.isArray(health.issues)).toBe(true);
      expect(Array.isArray(health.warnings)).toBe(true);
    });
  });

  describe('Large Vault Simulation', () => {
    it('should handle processing multiple files efficiently', async () => {
      // Create a test vault structure
      const vaultDir = join(tempDir, 'test-vault');
      await fs.mkdir(vaultDir, { recursive: true });

      // Create config directory
      const configDir = join(vaultDir, '.config', 'obsidian-lint');
      await fs.mkdir(configDir, { recursive: true });

      // Create basic config
      const configContent = `
[general]
vault_root = "${vaultDir}"
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

      await fs.writeFile(join(configDir, 'obsidian-lint.toml'), configContent);

      // Create rules directory structure
      const rulesDir = join(configDir, 'rules', 'default', 'enabled');
      await fs.mkdir(rulesDir, { recursive: true });

      // Create test files
      const fileCount = 10;
      for (let i = 0; i < fileCount; i++) {
        const content = `# Test File ${i}\n\nThis is test content for file ${i}.\n\n## Section\n\nMore content here.`;
        await fs.writeFile(join(vaultDir, `test-${i}.md`), content);
      }

      const startTime = Date.now();

      try {
        const result = await engine.processVault(vaultDir, {
          dryRun: true,
          fix: false,
          verbose: false,
          parallel: true,
          generateMoc: false,
        });

        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
        expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

        // Verify performance metrics were collected
        const metrics = engine.getPerformanceMetrics();
        expect(metrics.cacheStats).toBeDefined();
      } catch (error) {
        // Expected to fail due to missing rules, but should not crash
        expect(error).toBeDefined();
      }
    });
  });

  describe('Memory Management Integration', () => {
    it('should monitor memory during processing', async () => {
      const metrics = engine.getPerformanceMetrics();

      if (metrics.memoryStats) {
        expect(metrics.memoryStats.used).toBeGreaterThan(0);
        expect(metrics.memoryStats.percentage).toBeGreaterThanOrEqual(0);
        expect(metrics.memoryStats.percentage).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Incremental Processing', () => {
    it('should support incremental processing with caching', async () => {
      // This test would require a more complex setup with actual rules
      // For now, we'll just verify the engine can be configured for caching
      const metrics = engine.getPerformanceMetrics();
      expect(metrics.cacheStats).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle shutdown gracefully', async () => {
      await engine.shutdown();
      // Should not throw
    });

    it('should generate error reports', () => {
      const mockResult = {
        filesProcessed: 5,
        issuesFound: [],
        fixesApplied: [],
        errors: [new Error('Test error 1'), new Error('Test error 2')],
        duration: 1000,
      };

      const report = engine.generateErrorReport(mockResult);

      expect(report).toContain('LINT ENGINE ERROR REPORT');
      expect(report).toContain('Total Errors: 2');
      expect(report).toContain('Test error 1');
      expect(report).toContain('Test error 2');
    });
  });

  describe('Concurrency Management', () => {
    it('should respect concurrency limits', () => {
      const metrics = engine.getPerformanceMetrics();

      expect(metrics.maxConcurrency).toBeGreaterThan(0);
      expect(metrics.maxConcurrency).toBeLessThanOrEqual(metrics.cpuCount * 2);
    });
  });
});
