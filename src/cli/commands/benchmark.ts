/**
 * Benchmark Command
 * CLI command to run performance benchmarks
 */

import { LintEngine } from '../../core/engine.js';
import { PerformanceCache } from '../../core/performance-cache.js';
import { MemoryManager } from '../../core/memory-manager.js';
import { WorkerPool } from '../../core/worker-pool.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface BenchmarkOptions {
  iterations?: number;
  verbose?: boolean;
  outputFile?: string;
  includeCache?: boolean;
  includeMemory?: boolean;
  includeWorkers?: boolean;
  includeEngine?: boolean;
}

export interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  memoryUsed: number;
  success: boolean;
  error?: string;
}

export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];
  private options: Required<BenchmarkOptions>;

  constructor(options: BenchmarkOptions = {}) {
    this.options = {
      iterations: 1000,
      verbose: false,
      outputFile: '',
      includeCache: true,
      includeMemory: true,
      includeWorkers: true,
      includeEngine: true,
      ...options,
    };
  }

  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🚀 Starting Performance Benchmarks...\n');

    if (this.options.includeCache) {
      await this.runCacheBenchmarks();
    }

    if (this.options.includeMemory) {
      await this.runMemoryBenchmarks();
    }

    if (this.options.includeWorkers) {
      await this.runWorkerBenchmarks();
    }

    if (this.options.includeEngine) {
      await this.runEngineBenchmarks();
    }

    await this.generateReport();
    return this.results;
  }

  private async runCacheBenchmarks(): Promise<void> {
    console.log('📦 Running Cache Benchmarks...');

    const tempDir = join(tmpdir(), `benchmark-cache-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const cache = new PerformanceCache({
        maxMemoryMB: 50,
        cacheDirectory: tempDir,
      });
      await cache.initialize();

      // Cache write benchmark
      await this.runBenchmark(
        'Cache Writes',
        this.options.iterations,
        async () => {
          const filePath = `test-${Math.random()}.md`;
          const mockRule = { id: { full: `rule-${Math.random()}` } } as any;

          await cache.cacheRuleResult(
            filePath,
            mockRule,
            [{ ruleId: mockRule.id.full, message: 'Test issue' }] as any,
            [],
            Math.random() * 100
          );
        }
      );

      // Cache read benchmark
      await this.runBenchmark(
        'Cache Reads',
        this.options.iterations,
        async () => {
          const filePath = `test-${Math.random()}.md`;
          const ruleId = `rule-${Math.random()}`;
          cache.getCachedRuleResult(filePath, ruleId);
        }
      );

      // File modification check benchmark
      const testFiles: string[] = [];
      for (let i = 0; i < 100; i++) {
        const filePath = join(tempDir, `test-${i}.md`);
        await fs.writeFile(filePath, `# Test ${i}`);
        testFiles.push(filePath);
      }

      await this.runBenchmark('File Modification Checks', 100, async () => {
        for (const filePath of testFiles) {
          await cache.needsProcessing(filePath);
        }
      });

      await cache.shutdown();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async runMemoryBenchmarks(): Promise<void> {
    console.log('🧠 Running Memory Benchmarks...');

    const memoryManager = new MemoryManager();

    // Memory stats collection benchmark
    await this.runBenchmark(
      'Memory Stats Collection',
      this.options.iterations,
      async () => {
        memoryManager.getMemoryStats();
      }
    );

    // Batching strategy benchmark
    await this.runBenchmark(
      'Batching Strategy Calculation',
      this.options.iterations,
      async () => {
        memoryManager.getBatchingStrategy();
      }
    );

    // Processing queue benchmark
    const items = Array.from({ length: 50 }, (_, i) => i);
    await this.runBenchmark('Processing Queue (50 items)', 50, async () => {
      const queue = memoryManager.createProcessingQueue(
        items,
        async item => {
          await new Promise(resolve => setTimeout(resolve, 1));
        },
        { maxConcurrency: 4 }
      );
      await queue.start();
    });

    memoryManager.shutdown();
  }

  private async runWorkerBenchmarks(): Promise<void> {
    console.log('⚡ Running Worker Benchmarks...');

    const workerPool = new WorkerPool({
      maxWorkers: 2,
    });

    // Parallel task execution benchmark
    const taskCount = 100;
    const tasks = Array.from(
      { length: taskCount },
      (_, i) => () => Promise.resolve(i * 2)
    );

    await this.runBenchmark('Parallel Task Execution', taskCount, async () => {
      await workerPool.executeParallel(tasks, 4);
    });

    await workerPool.shutdown();
  }

  private async runEngineBenchmarks(): Promise<void> {
    console.log('🔧 Running Engine Benchmarks...');

    const tempDir = join(tmpdir(), `benchmark-engine-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Engine initialization benchmark
      await this.runBenchmark('Engine Initialization', 10, async () => {
        const engine = new LintEngine(2, {
          enableCaching: true,
          enableMemoryManagement: true,
          cacheDirectory: join(tempDir, `engine-${Math.random()}`),
        });
        await engine.shutdown();
      });

      // Performance metrics collection benchmark
      const engine = new LintEngine(2, {
        enableCaching: true,
        enableMemoryManagement: true,
        cacheDirectory: tempDir,
      });

      await this.runBenchmark(
        'Performance Metrics Collection',
        this.options.iterations,
        async () => {
          engine.getPerformanceMetrics();
        }
      );

      await engine.shutdown();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async runBenchmark(
    name: string,
    operations: number,
    fn: () => Promise<void>
  ): Promise<BenchmarkResult> {
    if (this.options.verbose) {
      console.log(`  Running ${name}...`);
    }

    const startMemory = process.memoryUsage().heapUsed;
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      await fn();
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

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
      success,
      error,
    };

    this.results.push(result);

    if (this.options.verbose) {
      console.log(`    ✓ ${name}: ${opsPerSecond.toFixed(2)} ops/sec`);
    }

    return result;
  }

  private async generateReport(): Promise<void> {
    console.log('\n📊 Benchmark Results:');
    console.log('='.repeat(80));

    for (const result of this.results) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Operations: ${result.operations}`);
      console.log(`   Ops/sec: ${result.opsPerSecond.toFixed(2)}`);
      console.log(`   Memory: ${result.memoryUsed.toFixed(2)}MB`);

      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }

      console.log('');
    }

    // Generate summary
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    console.log('📈 Summary:');
    console.log(`   Total benchmarks: ${this.results.length}`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${failed.length}`);

    if (successful.length > 0) {
      const avgOpsPerSec =
        successful.reduce((sum, r) => sum + r.opsPerSecond, 0) /
        successful.length;
      const totalMemory = successful.reduce((sum, r) => sum + r.memoryUsed, 0);
      console.log(`   Average ops/sec: ${avgOpsPerSec.toFixed(2)}`);
      console.log(`   Total memory used: ${totalMemory.toFixed(2)}MB`);
    }

    // Save to file if requested
    if (this.options.outputFile) {
      const reportData = {
        timestamp: new Date().toISOString(),
        options: this.options,
        results: this.results,
        summary: {
          total: this.results.length,
          successful: successful.length,
          failed: failed.length,
          averageOpsPerSec:
            successful.length > 0
              ? successful.reduce((sum, r) => sum + r.opsPerSecond, 0) /
                successful.length
              : 0,
          totalMemoryUsed: successful.reduce((sum, r) => sum + r.memoryUsed, 0),
        },
      };

      await fs.writeFile(
        this.options.outputFile,
        JSON.stringify(reportData, null, 2)
      );

      console.log(`\n💾 Report saved to: ${this.options.outputFile}`);
    }
  }
}

export async function runBenchmarkCommand(
  options: BenchmarkOptions = {}
): Promise<void> {
  const runner = new BenchmarkRunner(options);
  await runner.runAllBenchmarks();
}
