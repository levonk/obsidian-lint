import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { LintEngine } from '../../src/core/engine.js';
import { PerformanceMonitor } from '../../src/core/performance/index.js';

describe('Large Vault Performance Tests', () => {
  let tempDir: string;
  let engine: LintEngine;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'obsidian-lint-perf-'));
    engine = new LintEngine();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Scalability Tests', () => {
    it('should handle 1000+ notes efficiently', async () => {
      const vaultPath = path.join(tempDir, 'large-vault');
      await createLargeVault(vaultPath, 1000);

      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      const result = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
        parallel: true,
      });

      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      // Performance assertions
      expect(result.filesProcessed).toBe(1000);
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
      expect(memoryUsed).toBeLessThan(500 * 1024 * 1024); // Should use less than 500MB additional memory

      console.log(
        `Processed ${result.filesProcessed} files in ${duration}ms using ${Math.round(memoryUsed / 1024 / 1024)}MB`
      );
    });

    it('should handle 5000+ notes with parallel processing', async () => {
      const vaultPath = path.join(tempDir, 'huge-vault');
      await createLargeVault(vaultPath, 5000);

      const startTime = Date.now();

      const result = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
        parallel: true,
        maxConcurrency: 8,
      });

      const duration = Date.now() - startTime;

      expect(result.filesProcessed).toBe(5000);
      expect(duration).toBeLessThan(300000); // Should complete within 5 minutes
      expect(result.errors).toHaveLength(0);

      console.log(
        `Processed ${result.filesProcessed} files in ${duration}ms with parallel processing`
      );
    });

    it('should maintain performance with complex interconnected notes', async () => {
      const vaultPath = path.join(tempDir, 'interconnected-vault');
      await createInterconnectedVault(vaultPath, 500);

      const startTime = Date.now();

      const result = await engine.processVault(vaultPath, {
        dryRun: false,
        fix: true,
        verbose: false,
        parallel: true,
      });

      const duration = Date.now() - startTime;

      expect(result.filesProcessed).toBe(500);
      expect(duration).toBeLessThan(120000); // Should complete within 2 minutes
      expect(result.fixesApplied.length).toBeGreaterThan(0);

      console.log(
        `Processed interconnected vault in ${duration}ms with ${result.fixesApplied.length} fixes`
      );
    });
  });

  describe('Memory Management Tests', () => {
    it('should not leak memory during large vault processing', async () => {
      const vaultPath = path.join(tempDir, 'memory-test-vault');
      await createLargeVault(vaultPath, 2000);

      const initialMemory = process.memoryUsage();

      // Process vault multiple times to detect memory leaks
      for (let i = 0; i < 3; i++) {
        await engine.processVault(vaultPath, {
          dryRun: true,
          fix: false,
          verbose: false,
          parallel: true,
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(
        `Memory increase after 3 runs: ${Math.round(memoryIncrease / 1024 / 1024)}MB`
      );
    });

    it('should handle memory pressure gracefully', async () => {
      const vaultPath = path.join(tempDir, 'pressure-test-vault');
      await createLargeVault(vaultPath, 1000);

      // Simulate memory pressure by creating large objects
      const memoryPressure: any[] = [];
      for (let i = 0; i < 100; i++) {
        memoryPressure.push(new Array(100000).fill('memory-pressure'));
      }

      const result = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
        parallel: true,
        maxConcurrency: 2, // Reduce concurrency under memory pressure
      });

      expect(result.filesProcessed).toBe(1000);
      expect(result.errors).toHaveLength(0);

      // Clean up memory pressure
      memoryPressure.length = 0;
    });
  });

  describe('Performance Optimization Tests', () => {
    it('should benefit from caching on repeated operations', async () => {
      const vaultPath = path.join(tempDir, 'cache-test-vault');
      await createLargeVault(vaultPath, 500);

      // First run (cold cache)
      const firstRunStart = Date.now();
      const firstResult = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
        parallel: true,
      });
      const firstRunDuration = Date.now() - firstRunStart;

      // Second run (warm cache)
      const secondRunStart = Date.now();
      const secondResult = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
        parallel: true,
      });
      const secondRunDuration = Date.now() - secondRunStart;

      expect(firstResult.filesProcessed).toBe(secondResult.filesProcessed);
      expect(secondRunDuration).toBeLessThan(firstRunDuration * 0.8); // Should be at least 20% faster

      console.log(
        `First run: ${firstRunDuration}ms, Second run: ${secondRunDuration}ms (${Math.round((1 - secondRunDuration / firstRunDuration) * 100)}% improvement)`
      );
    });

    it('should scale linearly with parallel processing', async () => {
      const vaultPath = path.join(tempDir, 'scaling-test-vault');
      await createLargeVault(vaultPath, 1000);

      // Test with different concurrency levels
      const concurrencyLevels = [1, 2, 4, 8];
      const results: Array<{ concurrency: number; duration: number }> = [];

      for (const concurrency of concurrencyLevels) {
        const startTime = Date.now();

        await engine.processVault(vaultPath, {
          dryRun: true,
          fix: false,
          verbose: false,
          parallel: true,
          maxConcurrency: concurrency,
        });

        const duration = Date.now() - startTime;
        results.push({ concurrency, duration });

        console.log(`Concurrency ${concurrency}: ${duration}ms`);
      }

      // Higher concurrency should generally be faster (allowing for some variance)
      const singleThreaded = results.find(r => r.concurrency === 1)!;
      const multiThreaded = results.find(r => r.concurrency === 8)!;

      expect(multiThreaded.duration).toBeLessThan(
        singleThreaded.duration * 0.7
      ); // Should be at least 30% faster
    });
  });

  describe('Resource Usage Tests', () => {
    it('should respect memory limits', async () => {
      const vaultPath = path.join(tempDir, 'memory-limit-vault');
      await createLargeVault(vaultPath, 2000);

      const initialMemory = process.memoryUsage();

      const result = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
        parallel: true,
        memoryLimit: 200 * 1024 * 1024, // 200MB limit
      });

      const peakMemory = process.memoryUsage();
      const memoryUsed = peakMemory.heapUsed - initialMemory.heapUsed;

      expect(result.filesProcessed).toBe(2000);
      expect(memoryUsed).toBeLessThan(250 * 1024 * 1024); // Should stay close to limit

      console.log(`Memory used: ${Math.round(memoryUsed / 1024 / 1024)}MB`);
    });

    it('should handle CPU-intensive operations efficiently', async () => {
      const vaultPath = path.join(tempDir, 'cpu-intensive-vault');
      await createComplexVault(vaultPath, 1000);

      const startTime = Date.now();
      const startCpuUsage = process.cpuUsage();

      const result = await engine.processVault(vaultPath, {
        dryRun: false,
        fix: true,
        verbose: false,
        parallel: true,
        generateMoc: true,
      });

      const duration = Date.now() - startTime;
      const cpuUsage = process.cpuUsage(startCpuUsage);

      expect(result.filesProcessed).toBe(1000);
      expect(result.fixesApplied.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(180000); // Should complete within 3 minutes

      const cpuTime = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      console.log(
        `CPU time: ${cpuTime.toFixed(2)}s, Wall time: ${(duration / 1000).toFixed(2)}s`
      );
    });

    it('should handle extremely large vaults (10,000+ notes)', async () => {
      const vaultPath = path.join(tempDir, 'extreme-vault');
      await createLargeVault(vaultPath, 10000);

      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      const result = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
        parallel: true,
        maxConcurrency: 16,
      });

      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      expect(result.filesProcessed).toBe(10000);
      expect(duration).toBeLessThan(600000); // Should complete within 10 minutes
      expect(memoryUsed).toBeLessThan(1024 * 1024 * 1024); // Should use less than 1GB

      console.log(
        `Extreme vault: ${result.filesProcessed} files in ${duration}ms using ${Math.round(memoryUsed / 1024 / 1024)}MB`
      );
    });

    it('should handle concurrent vault processing', async () => {
      // Create multiple vaults
      const vaultPaths = [];
      for (let i = 0; i < 3; i++) {
        const vaultPath = path.join(tempDir, `concurrent-vault-${i}`);
        await createLargeVault(vaultPath, 500);
        vaultPaths.push(vaultPath);
      }

      const startTime = Date.now();

      // Process all vaults concurrently
      const promises = vaultPaths.map(vaultPath =>
        engine.processVault(vaultPath, {
          dryRun: true,
          fix: false,
          verbose: false,
          parallel: true,
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Verify all vaults were processed
      results.forEach((result, index) => {
        expect(result.filesProcessed).toBe(500);
        expect(result.errors).toHaveLength(0);
      });

      console.log(
        `Concurrent processing: ${results.length} vaults (${results.reduce((sum, r) => sum + r.filesProcessed, 0)} total files) in ${duration}ms`
      );
    });
  });

  describe('Stress Tests', () => {
    it('should handle files with extremely long content', async () => {
      const vaultPath = path.join(tempDir, 'long-content-vault');
      await fs.mkdir(vaultPath, { recursive: true });

      // Create file with very long content
      const longContent = '# Long Note\n\n' + 'Lorem ipsum '.repeat(100000);
      await fs.writeFile(path.join(vaultPath, 'long-note.md'), longContent);

      const result = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
      });

      expect(result.filesProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle deeply nested directory structures', async () => {
      const vaultPath = path.join(tempDir, 'deep-vault');
      await fs.mkdir(vaultPath, { recursive: true });

      // Create deeply nested structure (20 levels deep)
      let currentPath = vaultPath;
      for (let i = 0; i < 20; i++) {
        currentPath = path.join(currentPath, `level-${i}`);
        await fs.mkdir(currentPath, { recursive: true });
        await fs.writeFile(
          path.join(currentPath, `note-${i}.md`),
          `# Note at Level ${i}\n\nContent at depth ${i}`
        );
      }

      const result = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
      });

      expect(result.filesProcessed).toBe(20);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle files with many links', async () => {
      const vaultPath = path.join(tempDir, 'many-links-vault');
      await fs.mkdir(vaultPath, { recursive: true });

      // Create target notes
      for (let i = 0; i < 100; i++) {
        await fs.writeFile(
          path.join(vaultPath, `target-${i}.md`),
          `# Target ${i}\n\nTarget note ${i}`
        );
      }

      // Create note with many links
      const links = Array.from({ length: 100 }, (_, i) => `[[target-${i}]]`);
      const manyLinksContent = `# Many Links\n\n${links.join('\n')}`;
      await fs.writeFile(
        path.join(vaultPath, 'many-links.md'),
        manyLinksContent
      );

      const result = await engine.processVault(vaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
      });

      expect(result.filesProcessed).toBe(101);
      expect(result.errors).toHaveLength(0);
    });
  });

  // Helper functions
  async function createLargeVault(vaultPath: string, noteCount: number) {
    await fs.mkdir(vaultPath, { recursive: true });

    const batchSize = 100;
    const batches = Math.ceil(noteCount / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const promises: Promise<void>[] = [];
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, noteCount);

      for (let i = startIdx; i < endIdx; i++) {
        const folderNum = Math.floor(i / 100);
        const folderPath = path.join(vaultPath, `folder-${folderNum}`);
        const notePath = path.join(folderPath, `note-${i}.md`);

        const content = `# Note ${i}

This is note number ${i} in the large vault test.

## Content

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Tags

#test #note-${i} #folder-${folderNum}

## Links

${i > 0 ? `[[note-${i - 1}]]` : ''}
${i < noteCount - 1 ? `[[note-${i + 1}]]` : ''}

## Metadata

Created: ${new Date().toISOString()}
Index: ${i}
`;

        promises.push(
          fs
            .mkdir(folderPath, { recursive: true })
            .then(() => fs.writeFile(notePath, content))
        );
      }

      await Promise.all(promises);
    }
  }

  async function createInterconnectedVault(
    vaultPath: string,
    noteCount: number
  ) {
    await fs.mkdir(vaultPath, { recursive: true });

    for (let i = 0; i < noteCount; i++) {
      const notePath = path.join(vaultPath, `note-${i}.md`);

      // Create random links to other notes
      const linkCount = Math.floor(Math.random() * 5) + 1;
      const links: string[] = [];

      for (let j = 0; j < linkCount; j++) {
        const targetNote = Math.floor(Math.random() * noteCount);
        if (targetNote !== i) {
          links.push(`[[note-${targetNote}]]`);
        }
      }

      const content = `---
title: Note ${i}
tags: [interconnected, test]
date_created: ${new Date().toISOString().split('T')[0]}
---

# Note ${i}

This note is part of an interconnected network.

## Links

${links.join('\n')}

## Content

This note connects to ${links.length} other notes in the vault.

## Backlinks

This section will be populated by backlinks from other notes.
`;

      await fs.writeFile(notePath, content);
    }
  }

  async function createComplexVault(vaultPath: string, noteCount: number) {
    await fs.mkdir(vaultPath, { recursive: true });

    // Create directory structure
    const directories = ['Daily', 'Projects', 'Areas', 'Resources', 'Archive'];
    for (const dir of directories) {
      await fs.mkdir(path.join(vaultPath, dir), { recursive: true });
    }

    // Create attachments directory
    const attachmentsDir = path.join(vaultPath, 'Attachments');
    await fs.mkdir(attachmentsDir, { recursive: true });

    for (let i = 0; i < noteCount; i++) {
      const dir = directories[i % directories.length];
      const notePath = path.join(vaultPath, dir, `note-${i}.md`);

      // Create some attachments
      if (i % 10 === 0) {
        const attachmentPath = path.join(vaultPath, `attachment-${i}.png`);
        await fs.writeFile(attachmentPath, `fake-image-data-${i}`);
      }

      const content = `# Note ${i} in ${dir}

Complex note with various elements that require processing.

## Frontmatter Issues
- Missing required fields
- Incorrect date formats
- Invalid tag structures

## Content Issues
- Broken links: [[non-existent-note]]
- Malformed links: [broken link](
- Missing alt text: ![](attachment-${i}.png)

## Tags
#${dir.toLowerCase()} #complex #test-${i}

## Links
${i > 0 ? `[[note-${i - 1}]]` : ''}
${i < noteCount - 1 ? `[[note-${i + 1}]]` : ''}

## Attachments
${i % 10 === 0 ? `![Image ${i}](attachment-${i}.png)` : ''}
`;

      await fs.writeFile(notePath, content);
    }
  }
});
