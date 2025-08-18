/**
 * Memory Management System for Large Vault Processing
 * Monitors memory usage and implements strategies to prevent OOM errors
 */

import { cpus } from 'os';

export interface MemoryStats {
  used: number; // MB
  total: number; // MB
  percentage: number;
  heapUsed: number; // MB
  heapTotal: number; // MB
  external: number; // MB
}

export interface MemoryThresholds {
  warning: number; // Percentage (0-100)
  critical: number; // Percentage (0-100)
  emergency: number; // Percentage (0-100)
}

export interface MemoryManagerOptions {
  thresholds: MemoryThresholds;
  checkIntervalMs: number;
  enableGarbageCollection: boolean;
  maxBatchSize: number;
  adaptiveBatching: boolean;
}

export interface BatchingStrategy {
  currentBatchSize: number;
  recommendedBatchSize: number;
  shouldReduceBatch: boolean;
  shouldPause: boolean;
}

/**
 * Memory manager for large vault processing operations
 */
export class MemoryManager {
  private options: MemoryManagerOptions;
  private monitoringInterval?: NodeJS.Timeout;
  private memoryHistory: MemoryStats[] = [];
  private maxHistorySize = 100;
  private warningCallbacks: Array<(stats: MemoryStats) => void> = [];
  private criticalCallbacks: Array<(stats: MemoryStats) => void> = [];

  constructor(options: Partial<MemoryManagerOptions> = {}) {
    this.options = {
      thresholds: {
        warning: 70,
        critical: 85,
        emergency: 95,
      },
      checkIntervalMs: 5000,
      enableGarbageCollection: true,
      maxBatchSize: Math.max(1, Math.floor(cpus().length * 2)),
      adaptiveBatching: true,
      ...options,
    };
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.checkIntervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    const totalMemory = this.getTotalSystemMemory();

    return {
      used: memUsage.rss / 1024 / 1024,
      total: totalMemory,
      percentage: (memUsage.rss / (totalMemory * 1024 * 1024)) * 100,
      heapUsed: memUsage.heapUsed / 1024 / 1024,
      heapTotal: memUsage.heapTotal / 1024 / 1024,
      external: memUsage.external / 1024 / 1024,
    };
  }

  /**
   * Check if memory usage is within safe limits
   */
  isMemorySafe(): boolean {
    const stats = this.getMemoryStats();
    return stats.percentage < this.options.thresholds.critical;
  }

  /**
   * Get recommended batching strategy based on current memory usage
   */
  getBatchingStrategy(): BatchingStrategy {
    const stats = this.getMemoryStats();
    const { thresholds, maxBatchSize, adaptiveBatching } = this.options;

    let recommendedBatchSize = maxBatchSize;
    let shouldReduceBatch = false;
    let shouldPause = false;

    if (adaptiveBatching) {
      if (stats.percentage >= thresholds.emergency) {
        recommendedBatchSize = 1;
        shouldReduceBatch = true;
        shouldPause = true;
      } else if (stats.percentage >= thresholds.critical) {
        recommendedBatchSize = Math.max(1, Math.floor(maxBatchSize * 0.25));
        shouldReduceBatch = true;
      } else if (stats.percentage >= thresholds.warning) {
        recommendedBatchSize = Math.max(1, Math.floor(maxBatchSize * 0.5));
        shouldReduceBatch = true;
      }
    }

    return {
      currentBatchSize: maxBatchSize,
      recommendedBatchSize,
      shouldReduceBatch,
      shouldPause,
    };
  }

  /**
   * Force garbage collection if enabled and available
   */
  forceGarbageCollection(): boolean {
    if (!this.options.enableGarbageCollection) {
      return false;
    }

    try {
      if (global.gc) {
        global.gc();
        return true;
      }
    } catch (error) {
      console.warn('Failed to force garbage collection:', error);
    }

    return false;
  }

  /**
   * Wait for memory to be available
   */
  async waitForMemory(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.isMemorySafe()) {
        return true;
      }

      // Try garbage collection
      this.forceGarbageCollection();

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }

  /**
   * Register callback for memory warnings
   */
  onMemoryWarning(callback: (stats: MemoryStats) => void): void {
    this.warningCallbacks.push(callback);
  }

  /**
   * Register callback for critical memory situations
   */
  onMemoryCritical(callback: (stats: MemoryStats) => void): void {
    this.criticalCallbacks.push(callback);
  }

  /**
   * Get memory usage trend (increasing, decreasing, stable)
   */
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.memoryHistory.length < 3) {
      return 'stable';
    }

    const recent = this.memoryHistory.slice(-3);
    const trend = recent[2].percentage - recent[0].percentage;

    if (trend > 5) return 'increasing';
    if (trend < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  /**
   * Clear memory history
   */
  clearHistory(): void {
    this.memoryHistory = [];
  }

  /**
   * Calculate optimal batch size based on available memory and file sizes
   */
  calculateOptimalBatchSize(
    averageFileSizeMB: number,
    totalFiles: number
  ): number {
    const stats = this.getMemoryStats();
    const availableMemoryMB = (stats.total * (100 - stats.percentage)) / 100;

    // Reserve 30% of available memory for processing overhead
    const usableMemoryMB = availableMemoryMB * 0.7;

    // Calculate how many files we can process based on memory
    const memoryBasedBatchSize = Math.floor(
      usableMemoryMB / (averageFileSizeMB * 2)
    ); // 2x for processing overhead

    // Don't exceed our configured maximum
    const maxAllowed = this.options.maxBatchSize;

    // Don't go below 1
    return Math.max(1, Math.min(memoryBasedBatchSize, maxAllowed, totalFiles));
  }

  /**
   * Estimate memory usage for processing a batch of files
   */
  estimateMemoryUsage(fileSizes: number[]): number {
    // Rough estimation: file size + processing overhead (2x) + rule execution overhead (1.5x)
    const totalFileSize = fileSizes.reduce((sum, size) => sum + size, 0);
    return (totalFileSize * 3.5) / (1024 * 1024); // Convert to MB
  }

  /**
   * Check if a batch can be processed safely
   */
  canProcessBatch(fileSizes: number[]): boolean {
    const estimatedUsage = this.estimateMemoryUsage(fileSizes);
    const stats = this.getMemoryStats();
    const availableMemory = (stats.total * (100 - stats.percentage)) / 100;

    return estimatedUsage < availableMemory * 0.8; // Leave 20% buffer
  }

  /**
   * Get system memory information
   */
  private getTotalSystemMemory(): number {
    try {
      // Try to get actual system memory (Node.js 16+)
      const os = require('os');
      return os.totalmem() / 1024 / 1024; // Convert to MB
    } catch {
      // Fallback estimation based on heap limit
      const v8 = require('v8');
      try {
        const heapStats = v8.getHeapStatistics();
        return heapStats.heap_size_limit / 1024 / 1024;
      } catch {
        // Final fallback
        return 2048; // Assume 2GB
      }
    }
  }

  /**
   * Check memory usage and trigger callbacks if needed
   */
  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();

    // Add to history
    this.memoryHistory.push(stats);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    // Check thresholds and trigger callbacks
    if (stats.percentage >= this.options.thresholds.critical) {
      this.criticalCallbacks.forEach(callback => {
        try {
          callback(stats);
        } catch (error) {
          console.error('Error in memory critical callback:', error);
        }
      });
    } else if (stats.percentage >= this.options.thresholds.warning) {
      this.warningCallbacks.forEach(callback => {
        try {
          callback(stats);
        } catch (error) {
          console.error('Error in memory warning callback:', error);
        }
      });
    }

    // Auto garbage collection if memory is high
    if (stats.percentage >= this.options.thresholds.critical) {
      this.forceGarbageCollection();
    }
  }

  /**
   * Create a memory-aware processing queue
   */
  createProcessingQueue<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    options: {
      maxConcurrency?: number;
      memoryCheckInterval?: number;
    } = {}
  ): {
    start: () => Promise<void>;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    getProgress: () => { completed: number; total: number; paused: boolean };
  } {
    let completed = 0;
    let paused = false;
    let stopped = false;
    const maxConcurrency = options.maxConcurrency || this.options.maxBatchSize;

    const start = async (): Promise<void> => {
      const queue = [...items];
      const inProgress = new Set<Promise<void>>();

      while (queue.length > 0 && !stopped) {
        // Wait if paused
        while (paused && !stopped) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (stopped) break;

        // Check memory before processing more items
        if (!this.isMemorySafe()) {
          paused = true;
          console.warn('Processing paused due to high memory usage');
          await this.waitForMemory();
          paused = false;
          console.log('Processing resumed');
        }

        // Process items up to concurrency limit
        while (
          inProgress.size < maxConcurrency &&
          queue.length > 0 &&
          !stopped &&
          !paused
        ) {
          const item = queue.shift()!;
          const promise = processor(item)
            .then(() => {
              completed++;
              inProgress.delete(promise);
            })
            .catch(error => {
              console.error('Error processing item:', error);
              inProgress.delete(promise);
            });

          inProgress.add(promise);
        }

        // Wait for at least one to complete
        if (inProgress.size > 0) {
          await Promise.race(inProgress);
        }
      }

      // Wait for all remaining to complete
      await Promise.all(inProgress);
    };

    return {
      start,
      pause: () => {
        paused = true;
      },
      resume: () => {
        paused = false;
      },
      stop: () => {
        stopped = true;
      },
      getProgress: () => ({ completed, total: items.length, paused }),
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    this.stopMonitoring();
    this.clearHistory();
    this.warningCallbacks = [];
    this.criticalCallbacks = [];
  }
}
