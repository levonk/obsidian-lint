/**
 * Performance Optimization Components
 * Export all performance-related classes and interfaces
 */

export { PerformanceCache } from '../performance-cache.js';
export type {
  FileMetadata,
  CacheEntry,
  RuleExecutionResult,
  CacheStats,
  PerformanceCacheOptions,
} from '../performance-cache.js';

export { MemoryManager } from '../memory-manager.js';
export type {
  MemoryStats,
  MemoryThresholds,
  MemoryManagerOptions,
  BatchingStrategy,
} from '../memory-manager.js';

export { WorkerPool } from '../worker-pool.js';
export type {
  WorkerTask,
  WorkerResult,
  WorkerPoolOptions,
  WorkerStats,
} from '../worker-pool.js';

export type { LintEnginePerformanceOptions } from '../engine.js';
