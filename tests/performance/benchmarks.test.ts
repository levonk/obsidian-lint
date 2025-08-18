/**
 * Performance Benchmarks
 * Comprehensive benchmarks for performance optimization components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceCache } from '../../src/core/performance-cache.js';
import { MemoryManager } from '../../src/core/memory-manager.js';
import { WorkerPool } from '../../src/core/worker-pool.js';
import { LintEngine } from '../../src/core/engine.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  memoryUsed: number;
}

class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  async run(
    name: string,
    operations: number,
    fn: () => Promise<void>
  ): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = Date.now();

    await fn();

    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;

    const duration = endTime - startTime;
    const opsPerSecond = operations / (duration / 1000);
    const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // MB

    const result: BenchmarkResult = {
      name,
      duration,
      operations,
      opsPerSecond,
      memoryUsed,
    };

    this.results.push(result);
    return result;
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  printResults(): void {
    console.log('\n=== Performance Benchmark Results ===');
    for (const result of this.results) {
      console.log(`${result.name}:`);
      console.log(`  Duration: ${result.duration}ms`);
      console.log(`  Operations: ${result.operations}`);
      console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(2)}`);
      console.log(`  Memory: ${result.memoryUsed.toFixed(2)}MB`);
      console.log('');
    }
  }
}

describe('Performance Benchmarks', () => {
  let tempDir: string;
  let benchmark: BenchmarkRunner;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `obsidian-lint-benchmark-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    benchmark = new BenchmarkRunner();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Cache Performance', () => {
    it('should benchmark cache operations', async () => {
      const cache = new PerformanceCache({
        maxMemoryMB: 50,
        maxEntries: 1000,
        cacheDirectory: tempDir,
      });

      await cache.initialize();

      // Benchmark cache writes
      const writeResult = await benchmark.run(
        'Cache Writes',
        1000,
        async () => {
          for (let i = 0; i < 1000; i++) {
            const filePath = `test-${i}.md`;
            const mockRule = { id: { full: `rule-${i % 10}` } } as any;

            await cache.cacheRuleResult(
              filePath,
              mockRule,
              [{ ruleId: `rule-${i % 10}`, message: `Issue ${i}` }] as any,
              [],
              Math.random() * 100
            );
          }
        }
      );

      expect(writeResult.opsPerSecond).toBeGreaterThan(100); // At least 100 ops/sec

      // Benchmark cache reads
      const readResult = await benchmark.run('Cache Reads', 1000, async () => {
        for (let i = 0; i < 1000; i++) {
          const filePath = `test-${i}.md`;
          const ruleId = `rule-${i % 10}`;
          cache.getCachedRuleResult(filePath, ruleId);
        }
      });

      expect(readResult.opsPerSecond).toBeGreaterThan(1000); // Reads should be much faster

      await cache.shutdown();
    });

    it('should benchmark file modification checking', async () => {
      const cache = new PerformanceCache({
        maxMemoryMB: 10,
        cacheDirectory: tempDir,
      });

      await cache.initialize();

      // Create test files
      const fileCount = 100;
      const files: string[] = [];

      for (let i = 0; i < fileCount; i++) {
        const filePath = join(tempDir, `test-${i}.md`);
        await fs.writeFile(filePath, `# Test ${i}`);
        files.push(filePath);
      }

      const result = await benchmark.run(
        'File Modification Checks',
        fileCount,
        async () => {
          for (const filePath of files) {
            await cache.needsProcessing(filePath);
          }
        }
      );

      expect(result.opsPerSecond).toBeGreaterThan(50); // Should check at least 50 files/sec

      await cache.shutdown();
    });
  });

  describe('Memory Manager Performance', () => {
    it('should benchmark memory monitoring', async () => {
      const memoryManager = new MemoryManager({
        checkIntervalMs: 10, // Very frequent for testing
      });

      const result = await benchmark.run(
        'Memory Stats Collection',
        1000,
        async () => {
          for (let i = 0; i < 1000; i++) {
            memoryManager.getMemoryStats();
          }
        }
      );

      expect(result.opsPerSecond).toBeGreaterThan(1000); // Should be very fast

      memoryManager.shutdown();
    });

    it('should benchmark batching strategy calculation', async () => {
      const memoryManager = new MemoryManager();

      const result = await benchmark.run(
        'Batching Strategy Calculation',
        1000,
        async () => {
          for (let i = 0; i < 1000; i++) {
            memoryManager.getBatchingStrategy();
          }
        }
      );

      expect(result.opsPerSecond).toBeGreaterThan(5000); // Should be very fast

      memoryManager.shutdown();
    });

    it('should benchmark processing queue', async () => {
      const memoryManager = new MemoryManager();
      const items = Array.from({ length: 100 }, (_, i) => i);

      const result = await benchmark.run(
        'Processing Queue (100 items)',
        100,
        async () => {
          const queue = memoryManager.createProcessingQueue(
            items,
            async item => {
              // Simulate some work
              await new Promise(resolve => setTimeout(resolve, 1));
            },
            { maxConcurrency: 4 }
          );

          await queue.start();
        }
      );

      expect(result.opsPerSecond).toBeGreaterThan(10); // Should process at least 10 items/sec

      memoryManager.shutdown();
    });
  });

  describe('Worker Pool Performance', () => {
    it('should benchmark parallel task execution', async () => {
      const workerPool = new WorkerPool({
        maxWorkers: 2,
      });

      const taskCount = 50;
      const tasks = Array.from(
        { length: taskCount },
        (_, i) => () => Promise.resolve(i * 2)
      );

      const result = await benchmark.run(
        'Parallel Task Execution',
        taskCount,
        async () => {
          await workerPool.executeParallel(tasks, 4);
        }
      );

      expect(result.opsPerSecond).toBeGreaterThan(20); // Should handle at least 20 tasks/sec

      await workerPool.shutdown();
    });
  });

  describe('Engine Performance', () => {
    it('should benchmark engine initialization', async () => {
      const result = await benchmark.run(
        'Engine Initialization',
        10,
        async () => {
          for (let i = 0; i < 10; i++) {
            const engine = new LintEngine(2, {
              enableCaching: true,
              enableMemoryManagement: true,
              cacheDirectory: join(tempDir, `engine-${i}`),
            });
            await engine.shutdown();
          }
        }
      );

      expect(result.opsPerSecond).toBeGreaterThan(1); // Should initialize at least 1 engine/sec
    });

    it('should benchmark performance metrics collection', async () => {
      const engine = new LintEngine(2, {
        enableCaching: true,
        enableMemoryManagement: true,
        cacheDirectory: tempDir,
      });

      const result = await benchmark.run(
        'Performance Metrics Collection',
        1000,
        async () => {
          for (let i = 0; i < 1000; i++) {
            engine.getPerformanceMetrics();
          }
        }
      );

      expect(result.opsPerSecond).toBeGreaterThan(1000); // Should be very fast

      await engine.shutdown();
    });
  });

  describe('File System Performance', () => {
    it('should benchmark file creation and reading', async () => {
      const fileCount = 100;

      const writeResult = await benchmark.run(
        'File Writes',
        fileCount,
        async () => {
          for (let i = 0; i < fileCount; i++) {
            const content = `# Test File ${i}\n\n${'Content '.repeat(100)}`;
            await fs.writeFile(join(tempDir, `bench-${i}.md`), content);
          }
        }
      );

      expect(writeResult.opsPerSecond).toBeGreaterThan(10); // At least 10 files/sec

      const readResult = await benchmark.run(
        'File Reads',
        fileCount,
        async () => {
          for (let i = 0; i < fileCount; i++) {
            await fs.readFile(join(tempDir, `bench-${i}.md`), 'utf-8');
          }
        }
      );

      expect(readResult.opsPerSecond).toBeGreaterThan(50); // Reads should be faster
    });

    it('should benchmark file stat operations', async () => {
      // Create test files
      const fileCount = 100;
      const files: string[] = [];

      for (let i = 0; i < fileCount; i++) {
        const filePath = join(tempDir, `stat-test-${i}.md`);
        await fs.writeFile(filePath, `# Test ${i}`);
        files.push(filePath);
      }

      const result = await benchmark.run(
        'File Stat Operations',
        fileCount,
        async () => {
          for (const filePath of files) {
            await fs.stat(filePath);
          }
        }
      );

      expect(result.opsPerSecond).toBeGreaterThan(100); // Should stat at least 100 files/sec
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should benchmark memory usage during large operations', async () => {
      const cache = new PerformanceCache({
        maxMemoryMB: 100,
        cacheDirectory: tempDir,
      });

      await cache.initialize();

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      const result = await benchmark.run(
        'Large Cache Operations',
        5000,
        async () => {
          for (let i = 0; i < 5000; i++) {
            const filePath = `large-test-${i}.md`;
            const mockRule = { id: { full: `rule-${i % 50}` } } as any;
            const largeContent = 'x'.repeat(1000); // 1KB content

            await cache.cacheRuleResult(
              filePath,
              mockRule,
              [{ ruleId: `rule-${i % 50}`, message: largeContent }] as any,
              [],
              Math.random() * 100,
              largeContent
            );
          }
        }
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryGrowth).toBeLessThan(200); // Should not use more than 200MB
      expect(result.opsPerSecond).toBeGreaterThan(50); // Should maintain reasonable performance

      await cache.shutdown();
    });
  });

  afterEach(() => {
    // Print benchmark results for manual inspection
    if (process.env.SHOW_BENCHMARKS) {
      benchmark.printResults();
    }
  });
});
