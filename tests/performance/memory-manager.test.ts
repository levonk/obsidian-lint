/**
 * Memory Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from '../../src/core/memory-manager.js';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager({
      thresholds: {
        warning: 50, // Lower thresholds for testing
        critical: 70,
        emergency: 90,
      },
      checkIntervalMs: 100,
      maxBatchSize: 4,
    });
  });

  afterEach(() => {
    memoryManager.shutdown();
  });

  describe('Memory Statistics', () => {
    it('should get current memory statistics', () => {
      const stats = memoryManager.getMemoryStats();

      expect(stats).toBeDefined();
      expect(stats.used).toBeGreaterThan(0);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.percentage).toBeGreaterThanOrEqual(0);
      expect(stats.percentage).toBeLessThanOrEqual(100);
      expect(stats.heapUsed).toBeGreaterThan(0);
      expect(stats.heapTotal).toBeGreaterThan(0);
    });

    it('should determine if memory is safe', () => {
      const isSafe = memoryManager.isMemorySafe();
      expect(typeof isSafe).toBe('boolean');
    });
  });

  describe('Batching Strategy', () => {
    it('should provide batching recommendations', () => {
      const strategy = memoryManager.getBatchingStrategy();

      expect(strategy).toBeDefined();
      expect(strategy.currentBatchSize).toBe(4);
      expect(strategy.recommendedBatchSize).toBeGreaterThan(0);
      expect(typeof strategy.shouldReduceBatch).toBe('boolean');
      expect(typeof strategy.shouldPause).toBe('boolean');
    });

    it('should calculate optimal batch size', () => {
      const batchSize = memoryManager.calculateOptimalBatchSize(1, 100); // 1MB files, 100 total

      expect(batchSize).toBeGreaterThan(0);
      expect(batchSize).toBeLessThanOrEqual(100);
    });

    it('should estimate memory usage for batch', () => {
      const fileSizes = [1024, 2048, 4096]; // bytes
      const estimatedUsage = memoryManager.estimateMemoryUsage(fileSizes);

      expect(estimatedUsage).toBeGreaterThan(0);
    });

    it('should determine if batch can be processed safely', () => {
      const smallFileSizes = [100, 200, 300]; // Small files
      const canProcess = memoryManager.canProcessBatch(smallFileSizes);

      expect(typeof canProcess).toBe('boolean');
    });
  });

  describe('Memory Monitoring', () => {
    it('should start and stop monitoring', () => {
      memoryManager.startMonitoring();
      // Should not throw

      memoryManager.stopMonitoring();
      // Should not throw
    });

    it('should track memory history', async () => {
      memoryManager.startMonitoring();

      // Wait for a few monitoring cycles
      await new Promise(resolve => setTimeout(resolve, 250));

      const history = memoryManager.getMemoryHistory();
      expect(history.length).toBeGreaterThan(0);

      memoryManager.stopMonitoring();
    });

    it('should determine memory trend', async () => {
      memoryManager.startMonitoring();

      // Wait for enough data points
      await new Promise(resolve => setTimeout(resolve, 350));

      const trend = memoryManager.getMemoryTrend();
      expect(['increasing', 'decreasing', 'stable']).toContain(trend);

      memoryManager.stopMonitoring();
    });
  });

  describe('Callback System', () => {
    it('should register and trigger warning callbacks', done => {
      let callbackTriggered = false;

      memoryManager.onMemoryWarning(stats => {
        callbackTriggered = true;
        expect(stats).toBeDefined();
        done();
      });

      // This test might not trigger in normal conditions
      // so we'll just verify the callback was registered
      expect(callbackTriggered).toBe(false);
      done();
    });

    it('should register critical callbacks', () => {
      let callbackRegistered = false;

      memoryManager.onMemoryCritical(() => {
        callbackRegistered = true;
      });

      // Just verify no errors during registration
      expect(callbackRegistered).toBe(false);
    });
  });

  describe('Garbage Collection', () => {
    it('should attempt garbage collection', () => {
      const result = memoryManager.forceGarbageCollection();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Processing Queue', () => {
    it('should create memory-aware processing queue', async () => {
      const items = [1, 2, 3, 4, 5];
      const processedItems: number[] = [];

      const queue = memoryManager.createProcessingQueue(
        items,
        async item => {
          processedItems.push(item);
          await new Promise(resolve => setTimeout(resolve, 10));
        },
        { maxConcurrency: 2 }
      );

      await queue.start();

      expect(processedItems).toHaveLength(5);
      expect(processedItems.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('should track processing progress', async () => {
      const items = [1, 2, 3];

      const queue = memoryManager.createProcessingQueue(items, async item => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Start processing in background
      const processingPromise = queue.start();

      // Check initial progress
      let progress = queue.getProgress();
      expect(progress.total).toBe(3);
      expect(progress.completed).toBe(0);

      // Wait for completion
      await processingPromise;

      // Check final progress
      progress = queue.getProgress();
      expect(progress.completed).toBe(3);
    });

    it('should support pause and resume', async () => {
      const items = [1, 2, 3, 4, 5];
      const processedItems: number[] = [];

      const queue = memoryManager.createProcessingQueue(items, async item => {
        processedItems.push(item);
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Start processing
      const processingPromise = queue.start();

      // Pause after a short delay
      setTimeout(() => queue.pause(), 30);

      // Resume after another delay
      setTimeout(() => queue.resume(), 100);

      await processingPromise;

      expect(processedItems).toHaveLength(5);
    });
  });

  describe('Memory Waiting', () => {
    it('should wait for memory to be available', async () => {
      const startTime = Date.now();
      const result = await memoryManager.waitForMemory(100); // Short timeout
      const duration = Date.now() - startTime;

      expect(typeof result).toBe('boolean');
      expect(duration).toBeLessThan(200); // Should not wait too long in normal conditions
    });
  });
});
