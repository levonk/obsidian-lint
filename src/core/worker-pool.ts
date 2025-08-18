/**
 * Worker Thread Pool for CPU-intensive Operations
 * Provides parallel processing capabilities for rule execution and file processing
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import { join } from 'path';
import type { Rule, RuleExecutionContext } from '../types/rules.js';
import type { Issue, Fix, MarkdownFile } from '../types/index.js';

export interface WorkerTask {
  id: string;
  type: 'rule-execution' | 'file-parsing' | 'content-analysis';
  data: any;
  priority: number;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

export interface WorkerPoolOptions {
  maxWorkers: number;
  taskTimeout: number;
  enableProfiling: boolean;
  workerScript?: string;
}

export interface WorkerStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  activeWorkers: number;
  queuedTasks: number;
}

/**
 * Worker pool for parallel processing of CPU-intensive tasks
 */
export class WorkerPool {
  private workers: Map<number, Worker> = new Map();
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<
    string,
    { resolve: Function; reject: Function; startTime: number }
  > = new Map();
  private workerStats: WorkerStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    activeWorkers: 0,
    queuedTasks: 0,
  };
  private options: WorkerPoolOptions;
  private nextTaskId = 0;
  private executionTimes: number[] = [];

  constructor(options: Partial<WorkerPoolOptions> = {}) {
    this.options = {
      maxWorkers: Math.min(cpus().length, 4),
      taskTimeout: 30000, // 30 seconds
      enableProfiling: false,
      workerScript: join(__dirname, 'worker-thread.js'),
      ...options,
    };
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (!isMainThread) {
      throw new Error('WorkerPool can only be initialized in the main thread');
    }

    // Create worker script if it doesn't exist
    await this.ensureWorkerScript();

    // Start initial workers
    for (let i = 0; i < this.options.maxWorkers; i++) {
      await this.createWorker();
    }
  }

  /**
   * Execute a rule in a worker thread
   */
  async executeRule(
    rule: Rule,
    context: RuleExecutionContext,
    priority: number = 0
  ): Promise<{ issues: Issue[]; fixes: Fix[]; executionTime: number }> {
    const task: WorkerTask = {
      id: this.generateTaskId(),
      type: 'rule-execution',
      data: {
        rule: this.serializeRule(rule),
        context: this.serializeContext(context),
      },
      priority,
    };

    const result = await this.executeTask(task);
    return result;
  }

  /**
   * Parse markdown file in a worker thread
   */
  async parseMarkdownFile(
    filePath: string,
    content: string,
    priority: number = 0
  ): Promise<MarkdownFile> {
    const task: WorkerTask = {
      id: this.generateTaskId(),
      type: 'file-parsing',
      data: {
        filePath,
        content,
      },
      priority,
    };

    const result = await this.executeTask(task);
    return result;
  }

  /**
   * Analyze content for patterns in a worker thread
   */
  async analyzeContent(
    content: string,
    analysisType: string,
    options: any = {},
    priority: number = 0
  ): Promise<any> {
    const task: WorkerTask = {
      id: this.generateTaskId(),
      type: 'content-analysis',
      data: {
        content,
        analysisType,
        options,
      },
      priority,
    };

    const result = await this.executeTask(task);
    return result;
  }

  /**
   * Execute multiple tasks in parallel
   */
  async executeParallel<T>(
    tasks: Array<() => Promise<T>>,
    maxConcurrency?: number
  ): Promise<T[]> {
    const concurrency = maxConcurrency || this.options.maxWorkers;
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      const promise = task().then(result => {
        results[i] = result;
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        // Remove completed promises
        for (let j = executing.length - 1; j >= 0; j--) {
          if (
            (await Promise.race([executing[j], Promise.resolve('pending')])) !==
            'pending'
          ) {
            executing.splice(j, 1);
          }
        }
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Get worker pool statistics
   */
  getStats(): WorkerStats {
    return {
      ...this.workerStats,
      activeWorkers: this.workers.size,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    // Wait for active tasks to complete or timeout
    const activeTaskPromises = Array.from(this.activeTasks.values()).map(
      ({ resolve, reject }) =>
        new Promise<void>(res => {
          const timeout = setTimeout(() => {
            reject(new Error('Task cancelled due to shutdown'));
            res();
          }, 5000);

          resolve = (originalResolve => (value: any) => {
            clearTimeout(timeout);
            originalResolve(value);
            res();
          })(resolve);
        })
    );

    await Promise.allSettled(activeTaskPromises);

    // Terminate all workers
    const terminationPromises = Array.from(this.workers.values()).map(worker =>
      worker.terminate()
    );

    await Promise.allSettled(terminationPromises);

    this.workers.clear();
    this.taskQueue = [];
    this.activeTasks.clear();
  }

  /**
   * Execute a task in the worker pool
   */
  private async executeTask(task: WorkerTask): Promise<any> {
    return new Promise((resolve, reject) => {
      this.activeTasks.set(task.id, { resolve, reject, startTime: Date.now() });
      this.taskQueue.push(task);
      this.taskQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
      this.workerStats.totalTasks++;
      this.workerStats.queuedTasks = this.taskQueue.length;

      this.processQueue();

      // Set timeout
      setTimeout(() => {
        const taskInfo = this.activeTasks.get(task.id);
        if (taskInfo) {
          this.activeTasks.delete(task.id);
          this.workerStats.failedTasks++;
          reject(
            new Error(
              `Task ${task.id} timed out after ${this.options.taskTimeout}ms`
            )
          );
        }
      }, this.options.taskTimeout);
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available worker
    for (const [workerId, worker] of this.workers) {
      if (this.taskQueue.length === 0) break;

      // Check if worker is available (simplified check)
      const task = this.taskQueue.shift()!;
      this.workerStats.queuedTasks = this.taskQueue.length;

      worker.postMessage(task);
    }
  }

  /**
   * Create a new worker
   */
  private async createWorker(): Promise<void> {
    const worker = new Worker(this.options.workerScript!, {
      workerData: {
        enableProfiling: this.options.enableProfiling,
      },
    });

    const workerId = worker.threadId;
    this.workers.set(workerId, worker);

    worker.on('message', (result: WorkerResult) => {
      this.handleWorkerResult(result);
    });

    worker.on('error', error => {
      console.error(`Worker ${workerId} error:`, error);
      this.handleWorkerError(workerId, error);
    });

    worker.on('exit', code => {
      if (code !== 0) {
        console.error(`Worker ${workerId} exited with code ${code}`);
      }
      this.workers.delete(workerId);

      // Recreate worker if pool is still active
      if (this.workers.size < this.options.maxWorkers) {
        this.createWorker().catch(console.error);
      }
    });
  }

  /**
   * Handle worker result
   */
  private handleWorkerResult(result: WorkerResult): void {
    const taskInfo = this.activeTasks.get(result.taskId);
    if (!taskInfo) {
      return; // Task might have timed out
    }

    this.activeTasks.delete(result.taskId);

    // Update statistics
    this.executionTimes.push(result.executionTime);
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift(); // Keep only recent times
    }

    this.workerStats.averageExecutionTime =
      this.executionTimes.reduce((sum, time) => sum + time, 0) /
      this.executionTimes.length;

    if (result.success) {
      this.workerStats.completedTasks++;
      taskInfo.resolve(result.result);
    } else {
      this.workerStats.failedTasks++;
      taskInfo.reject(new Error(result.error || 'Unknown worker error'));
    }

    // Process more tasks if available
    this.processQueue();
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: number, error: Error): void {
    // Find and reject all tasks assigned to this worker
    for (const [taskId, taskInfo] of this.activeTasks) {
      // This is a simplified approach - in a real implementation,
      // you'd track which worker is handling which task
      taskInfo.reject(error);
      this.activeTasks.delete(taskId);
      this.workerStats.failedTasks++;
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${++this.nextTaskId}`;
  }

  /**
   * Serialize rule for worker thread
   */
  private serializeRule(rule: Rule): any {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      category: rule.category,
      config: rule.config,
      // Note: Functions cannot be serialized, so we'll need to reconstruct the rule in the worker
    };
  }

  /**
   * Serialize execution context for worker thread
   */
  private serializeContext(context: RuleExecutionContext): any {
    return {
      file: context.file,
      vaultPath: context.vaultPath,
      dryRun: context.dryRun,
      verbose: context.verbose,
      metadata: context.metadata,
    };
  }

  /**
   * Ensure worker script exists
   */
  private async ensureWorkerScript(): Promise<void> {
    // This would create the worker script file if it doesn't exist
    // For now, we'll assume it exists or will be created separately
  }
}

/**
 * Worker thread entry point (this code runs in worker threads)
 */
if (!isMainThread && parentPort) {
  const { enableProfiling } = workerData;

  parentPort.on('message', async (task: WorkerTask) => {
    const startTime = Date.now();
    let result: WorkerResult;

    try {
      let taskResult: any;

      switch (task.type) {
        case 'rule-execution':
          taskResult = await executeRuleInWorker(task.data);
          break;
        case 'file-parsing':
          taskResult = await parseFileInWorker(task.data);
          break;
        case 'content-analysis':
          taskResult = await analyzeContentInWorker(task.data);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      result = {
        taskId: task.id,
        success: true,
        result: taskResult,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      result = {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }

    parentPort!.postMessage(result);
  });

  /**
   * Execute rule in worker thread
   */
  async function executeRuleInWorker(data: any): Promise<any> {
    // This would reconstruct the rule and execute it
    // For now, return mock data
    return {
      issues: [],
      fixes: [],
      executionTime: 0,
    };
  }

  /**
   * Parse file in worker thread
   */
  async function parseFileInWorker(data: any): Promise<any> {
    // This would parse the markdown file
    // For now, return mock data
    return {
      path: data.filePath,
      content: data.content,
      frontmatter: {},
      headings: [],
      links: [],
      attachments: [],
      ast: { type: 'root', children: [] },
    };
  }

  /**
   * Analyze content in worker thread
   */
  async function analyzeContentInWorker(data: any): Promise<any> {
    // This would perform content analysis
    // For now, return mock data
    return {
      analysisType: data.analysisType,
      results: {},
    };
  }
}
