/**
 * Performance Cache System for Obsidian Lint
 * Provides file modification tracking, rule execution caching, and memory management
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { Issue, Fix, MarkdownFile } from '../types/index.js';
import type { Rule } from '../types/rules.js';

export interface FileMetadata {
  path: string;
  size: number;
  mtime: number; // Unix timestamp
  contentHash?: string;
  lastProcessed?: number;
}

export interface CacheEntry {
  fileMetadata: FileMetadata;
  ruleResults: Map<string, RuleExecutionResult>;
  timestamp: number;
}

export interface RuleExecutionResult {
  ruleId: string;
  issues: Issue[];
  fixes: Fix[];
  executionTime: number;
  fileHash: string;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface PerformanceCacheOptions {
  maxMemoryMB: number;
  maxEntries: number;
  ttlMinutes: number;
  persistToDisk: boolean;
  cacheDirectory?: string;
}

/**
 * High-performance cache system for file processing and rule execution
 */
export class PerformanceCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private hitCount = 0;
  private missCount = 0;
  private options: PerformanceCacheOptions;
  private cacheFilePath?: string;

  constructor(options: Partial<PerformanceCacheOptions> = {}) {
    this.options = {
      maxMemoryMB: 100,
      maxEntries: 1000,
      ttlMinutes: 60,
      persistToDisk: true,
      ...options,
    };

    if (this.options.persistToDisk && this.options.cacheDirectory) {
      this.cacheFilePath = join(
        this.options.cacheDirectory,
        'performance-cache.json'
      );
    }
  }

  /**
   * Initialize cache by loading from disk if enabled
   */
  async initialize(): Promise<void> {
    if (this.options.persistToDisk && this.cacheFilePath) {
      await this.loadFromDisk();
    }
  }

  /**
   * Check if file needs processing based on modification time
   */
  async needsProcessing(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      const currentMtime = stats.mtime.getTime();

      const cacheEntry = this.cache.get(filePath);
      if (!cacheEntry) {
        return true; // Not in cache, needs processing
      }

      // Check if file has been modified
      if (cacheEntry.fileMetadata.mtime < currentMtime) {
        return true; // File modified, needs reprocessing
      }

      // Check TTL
      const now = Date.now();
      const ageMinutes = (now - cacheEntry.timestamp) / (1000 * 60);
      if (ageMinutes > this.options.ttlMinutes) {
        return true; // Cache entry expired
      }

      return false; // File hasn't changed and cache is valid
    } catch (error) {
      // If we can't stat the file, assume it needs processing
      return true;
    }
  }

  /**
   * Get cached rule execution result
   */
  getCachedRuleResult(
    filePath: string,
    ruleId: string
  ): RuleExecutionResult | null {
    const cacheEntry = this.cache.get(filePath);
    if (!cacheEntry) {
      this.missCount++;
      return null;
    }

    const ruleResult = cacheEntry.ruleResults.get(ruleId);
    if (!ruleResult) {
      this.missCount++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(filePath);
    this.hitCount++;
    return ruleResult;
  }

  /**
   * Cache rule execution result
   */
  async cacheRuleResult(
    filePath: string,
    rule: Rule,
    issues: Issue[],
    fixes: Fix[],
    executionTime: number,
    fileContent?: string
  ): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const fileHash = fileContent ? this.calculateHash(fileContent) : '';

      const fileMetadata: FileMetadata = {
        path: filePath,
        size: stats.size,
        mtime: stats.mtime.getTime(),
        contentHash: fileHash,
        lastProcessed: Date.now(),
      };

      const ruleResult: RuleExecutionResult = {
        ruleId: rule.id.full,
        issues,
        fixes,
        executionTime,
        fileHash,
      };

      let cacheEntry = this.cache.get(filePath);
      if (!cacheEntry) {
        cacheEntry = {
          fileMetadata,
          ruleResults: new Map(),
          timestamp: Date.now(),
        };
        this.cache.set(filePath, cacheEntry);
      } else {
        // Update file metadata
        cacheEntry.fileMetadata = fileMetadata;
        cacheEntry.timestamp = Date.now();
      }

      cacheEntry.ruleResults.set(rule.id.full, ruleResult);
      this.updateAccessOrder(filePath);

      // Enforce cache limits
      await this.enforceCacheLimits();
    } catch (error) {
      // Handle file stat errors gracefully
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        // File doesn't exist, create minimal metadata
        const fileHash = fileContent ? this.calculateHash(fileContent) : '';
        const fileMetadata: FileMetadata = {
          path: filePath,
          size: fileContent ? fileContent.length : 0,
          mtime: Date.now(),
          contentHash: fileHash,
          lastProcessed: Date.now(),
        };

        const ruleResult: RuleExecutionResult = {
          ruleId: rule.id.full,
          issues,
          fixes,
          executionTime,
          fileHash,
        };

        let cacheEntry = this.cache.get(filePath);
        if (!cacheEntry) {
          cacheEntry = {
            fileMetadata,
            ruleResults: new Map(),
            timestamp: Date.now(),
          };
          this.cache.set(filePath, cacheEntry);
        } else {
          cacheEntry.fileMetadata = fileMetadata;
          cacheEntry.timestamp = Date.now();
        }

        cacheEntry.ruleResults.set(rule.id.full, ruleResult);
        this.updateAccessOrder(filePath);
        await this.enforceCacheLimits();
      } else {
        // Silently ignore cache errors in tests
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Failed to cache rule result for ${filePath}:`, error);
        }
      }
    }
  }

  /**
   * Get file metadata from cache
   */
  getFileMetadata(filePath: string): FileMetadata | null {
    const cacheEntry = this.cache.get(filePath);
    return cacheEntry?.fileMetadata || null;
  }

  /**
   * Invalidate cache entry for a file
   */
  invalidateFile(filePath: string): void {
    this.cache.delete(filePath);
    const index = this.accessOrder.indexOf(filePath);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    let memoryUsage = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const entry of this.cache.values()) {
      // Rough memory estimation
      memoryUsage += JSON.stringify(entry).length * 2; // UTF-16 chars
      oldestEntry = Math.min(oldestEntry, entry.timestamp);
      newestEntry = Math.max(newestEntry, entry.timestamp);
    }

    return {
      totalEntries: this.cache.size,
      hitRate,
      memoryUsage: memoryUsage / (1024 * 1024), // MB
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Persist cache to disk
   */
  async persistToDisk(): Promise<void> {
    if (!this.options.persistToDisk || !this.cacheFilePath) {
      return;
    }

    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.cacheFilePath), { recursive: true });

      // Convert cache to serializable format
      const serializable = {
        cache: Array.from(this.cache.entries()).map(([key, value]) => [
          key,
          {
            ...value,
            ruleResults: Array.from(value.ruleResults.entries()),
          },
        ]),
        accessOrder: this.accessOrder,
        hitCount: this.hitCount,
        missCount: this.missCount,
        timestamp: Date.now(),
      };

      await fs.writeFile(
        this.cacheFilePath,
        JSON.stringify(serializable, null, 2)
      );
    } catch (error) {
      console.warn('Failed to persist cache to disk:', error);
    }
  }

  /**
   * Load cache from disk
   */
  private async loadFromDisk(): Promise<void> {
    if (!this.cacheFilePath) {
      return;
    }

    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Restore cache
      this.cache.clear();
      for (const [key, value] of parsed.cache) {
        this.cache.set(key, {
          ...value,
          ruleResults: new Map(value.ruleResults),
        });
      }

      this.accessOrder = parsed.accessOrder || [];
      this.hitCount = parsed.hitCount || 0;
      this.missCount = parsed.missCount || 0;

      // Clean up expired entries
      await this.cleanupExpiredEntries();
    } catch (error) {
      // If loading fails, start with empty cache
      console.warn('Failed to load cache from disk, starting fresh:', error);
      this.clear();
    }
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(filePath: string): void {
    const index = this.accessOrder.indexOf(filePath);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(filePath);
  }

  /**
   * Enforce cache size and memory limits
   */
  private async enforceCacheLimits(): Promise<void> {
    // Remove expired entries first
    await this.cleanupExpiredEntries();

    // Enforce entry count limit
    while (
      this.cache.size > this.options.maxEntries &&
      this.accessOrder.length > 0
    ) {
      const oldestFile = this.accessOrder.shift();
      if (oldestFile) {
        this.cache.delete(oldestFile);
      }
    }

    // Enforce memory limit (rough estimation)
    const stats = this.getStats();
    while (
      stats.memoryUsage > this.options.maxMemoryMB &&
      this.accessOrder.length > 0
    ) {
      const oldestFile = this.accessOrder.shift();
      if (oldestFile) {
        this.cache.delete(oldestFile);
      }
    }
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const ttlMs = this.options.ttlMinutes * 60 * 1000;

    const expiredFiles: string[] = [];
    for (const [filePath, entry] of this.cache.entries()) {
      if (now - entry.timestamp > ttlMs) {
        expiredFiles.push(filePath);
      }
    }

    for (const filePath of expiredFiles) {
      this.invalidateFile(filePath);
    }
  }

  /**
   * Calculate simple hash for content
   */
  private calculateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get files that need processing based on cache state
   */
  async getFilesNeedingProcessing(filePaths: string[]): Promise<{
    needsProcessing: string[];
    canSkip: string[];
  }> {
    const needsProcessing: string[] = [];
    const canSkip: string[] = [];

    for (const filePath of filePaths) {
      if (await this.needsProcessing(filePath)) {
        needsProcessing.push(filePath);
      } else {
        canSkip.push(filePath);
      }
    }

    return { needsProcessing, canSkip };
  }

  /**
   * Cleanup and shutdown cache
   */
  async shutdown(): Promise<void> {
    if (this.options.persistToDisk) {
      await this.persistToDisk();
    }
    this.clear();
  }
}
