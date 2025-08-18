/**
 * Performance Cache Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceCache } from '../../src/core/performance-cache.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PerformanceCache', () => {
  let cache: PerformanceCache;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `obsidian-lint-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    cache = new PerformanceCache({
      maxMemoryMB: 10,
      maxEntries: 100,
      ttlMinutes: 5,
      persistToDisk: true,
      cacheDirectory: tempDir,
    });

    await cache.initialize();
  });

  afterEach(async () => {
    await cache.shutdown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('File Modification Tracking', () => {
    it('should detect when file needs processing (new file)', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      const needsProcessing = await cache.needsProcessing(testFile);
      expect(needsProcessing).toBe(true);
    });

    it('should detect when file needs processing (modified file)', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      // Cache the file
      await cache.cacheRuleResult(
        testFile,
        { id: { full: 'test-rule' } } as any,
        [],
        [],
        100,
        '# Test'
      );

      // Modify the file
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different mtime
      await fs.writeFile(testFile, '# Modified Test');

      const needsProcessing = await cache.needsProcessing(testFile);
      expect(needsProcessing).toBe(true);
    });

    it('should skip processing for unchanged files', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      // Cache the file
      await cache.cacheRuleResult(
        testFile,
        { id: { full: 'test-rule' } } as any,
        [],
        [],
        100,
        '# Test'
      );

      const needsProcessing = await cache.needsProcessing(testFile);
      expect(needsProcessing).toBe(false);
    });
  });

  describe('Rule Execution Caching', () => {
    it('should cache and retrieve rule results', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      const mockRule = { id: { full: 'test-rule' } } as any;
      const mockIssues = [
        { ruleId: 'test-rule', message: 'Test issue' },
      ] as any;
      const mockFixes = [
        { ruleId: 'test-rule', description: 'Test fix' },
      ] as any;

      // Cache the result
      await cache.cacheRuleResult(
        testFile,
        mockRule,
        mockIssues,
        mockFixes,
        150
      );

      // Retrieve the result
      const cachedResult = cache.getCachedRuleResult(testFile, 'test-rule');

      expect(cachedResult).toBeDefined();
      expect(cachedResult!.issues).toEqual(mockIssues);
      expect(cachedResult!.fixes).toEqual(mockFixes);
      expect(cachedResult!.executionTime).toBe(150);
    });

    it('should return null for non-cached results', () => {
      const cachedResult = cache.getCachedRuleResult(
        'nonexistent.md',
        'test-rule'
      );
      expect(cachedResult).toBeNull();
    });

    it('should invalidate cache entries', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      const mockRule = { id: { full: 'test-rule' } } as any;

      // Cache the result
      await cache.cacheRuleResult(testFile, mockRule, [], [], 100);

      // Verify it's cached
      expect(cache.getCachedRuleResult(testFile, 'test-rule')).toBeDefined();

      // Invalidate
      cache.invalidateFile(testFile);

      // Verify it's gone
      expect(cache.getCachedRuleResult(testFile, 'test-rule')).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should track hit/miss rates', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      const mockRule = { id: { full: 'test-rule' } } as any;

      // Cache miss
      let result = cache.getCachedRuleResult(testFile, 'test-rule');
      expect(result).toBeNull();

      // Cache the result
      await cache.cacheRuleResult(testFile, mockRule, [], [], 100);

      // Cache hit
      result = cache.getCachedRuleResult(testFile, 'test-rule');
      expect(result).toBeDefined();

      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.totalEntries).toBe(1);
    });

    it('should estimate memory usage', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      const mockRule = { id: { full: 'test-rule' } } as any;

      // Cache some results
      await cache.cacheRuleResult(testFile, mockRule, [], [], 100);

      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Batch File Analysis', () => {
    it('should analyze multiple files for processing needs', async () => {
      const files = [];

      // Create test files
      for (let i = 0; i < 5; i++) {
        const testFile = join(tempDir, `test${i}.md`);
        await fs.writeFile(testFile, `# Test ${i}`);
        files.push(testFile);
      }

      // Cache some files
      const mockRule = { id: { full: 'test-rule' } } as any;
      await cache.cacheRuleResult(files[0], mockRule, [], [], 100);
      await cache.cacheRuleResult(files[1], mockRule, [], [], 100);

      const analysis = await cache.getFilesNeedingProcessing(files);

      expect(analysis.canSkip).toHaveLength(2);
      expect(analysis.needsProcessing).toHaveLength(3);
      expect(analysis.canSkip).toContain(files[0]);
      expect(analysis.canSkip).toContain(files[1]);
    });
  });

  describe('Persistence', () => {
    it('should persist cache to disk', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      const mockRule = { id: { full: 'test-rule' } } as any;

      // Cache some data
      await cache.cacheRuleResult(testFile, mockRule, [], [], 100);

      // Persist to disk
      await cache.persistToDisk();

      // Check that cache file exists
      const cacheFile = join(tempDir, 'performance-cache.json');
      const exists = await fs
        .access(cacheFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should load cache from disk', async () => {
      const testFile = join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      const mockRule = { id: { full: 'test-rule' } } as any;

      // Cache some data and persist
      await cache.cacheRuleResult(testFile, mockRule, [], [], 100);
      await cache.persistToDisk();

      // Create new cache instance
      const newCache = new PerformanceCache({
        maxMemoryMB: 10,
        maxEntries: 100,
        ttlMinutes: 5,
        persistToDisk: true,
        cacheDirectory: tempDir,
      });

      await newCache.initialize();

      // Check that data was loaded
      const cachedResult = newCache.getCachedRuleResult(testFile, 'test-rule');
      expect(cachedResult).toBeDefined();

      await newCache.shutdown();
    });
  });
});
