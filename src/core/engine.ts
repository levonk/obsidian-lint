/**
 * Core Engine - Main orchestration component with parallel processing
 */

import { ConfigurationManager } from './config.js';
import { RuleEngine } from './rules.js';
import { FileProcessor } from '../utils/file-processor.js';
import { RuleExecutor, RuleExecutionError } from './rule-executor.js';
import { MocGenerator } from './moc-generator.js';
import { PerformanceCache } from './performance-cache.js';
import { MemoryManager } from './memory-manager.js';
import { WorkerPool } from './worker-pool.js';
import type { Configuration, ProfileConfig } from '../types/config.js';
import type {
  Rule,
  ProcessOptions,
  LintResult,
  Issue,
  Fix,
  FileChange,
} from '../types/index.js';
import type { ConflictResult } from './rules.js';
import type {
  MocGenerationResult,
  MocGeneratorSettings,
} from './moc-generator.js';
import { MarkdownFile } from './markdown-file.js';
import { join } from 'path';
import { cpus } from 'os';

export interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

export class LintEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'LintEngineError';
  }

  /**
   * Create a detailed error report
   */
  toDetailedReport(): string {
    let report = `${this.name}: ${this.message}\n`;
    report += `Code: ${this.code}\n`;

    if (this.context) {
      report += `Context:\n`;
      for (const [key, value] of Object.entries(this.context)) {
        if (key === 'originalError' && value instanceof Error) {
          report += `  ${key}: ${value.message}\n`;
          if (value.stack) {
            report += `  Stack: ${value.stack}\n`;
          }
        } else {
          report += `  ${key}: ${JSON.stringify(value, null, 2)}\n`;
        }
      }
    }

    return report;
  }
}

export enum LintEngineErrorCodes {
  CONFIG_LOAD_ERROR = 'CONFIG_LOAD_ERROR',
  RULE_LOAD_ERROR = 'RULE_LOAD_ERROR',
  RULE_CONFLICTS = 'RULE_CONFLICTS',
  FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
  BATCH_PROCESSING_ERROR = 'BATCH_PROCESSING_ERROR',
  FIX_APPLICATION_ERROR = 'FIX_APPLICATION_ERROR',
  VAULT_SCAN_ERROR = 'VAULT_SCAN_ERROR',
  PARALLEL_PROCESSING_ERROR = 'PARALLEL_PROCESSING_ERROR',
  MOC_GENERATION_ERROR = 'MOC_GENERATION_ERROR',
}

export interface LintEnginePerformanceOptions {
  enableCaching: boolean;
  enableWorkerThreads: boolean;
  enableMemoryManagement: boolean;
  cacheDirectory?: string;
  maxMemoryMB?: number;
  workerPoolSize?: number;
}

export class LintEngine {
  private configManager: ConfigurationManager;
  private ruleEngine: RuleEngine;
  private fileProcessor: FileProcessor;
  private ruleExecutor: RuleExecutor;
  private mocGenerator: MocGenerator;
  private performanceCache?: PerformanceCache;
  private memoryManager?: MemoryManager;
  private workerPool?: WorkerPool;
  private maxConcurrency: number;
  private performanceOptions: LintEnginePerformanceOptions;

  constructor(
    maxConcurrency?: number,
    performanceOptions: Partial<LintEnginePerformanceOptions> = {}
  ) {
    this.configManager = new ConfigurationManager();
    this.ruleEngine = new RuleEngine();
    this.fileProcessor = new FileProcessor();
    this.ruleExecutor = new RuleExecutor();
    this.mocGenerator = new MocGenerator();
    this.maxConcurrency = maxConcurrency || Math.min(cpus().length, 4);

    this.performanceOptions = {
      enableCaching: true,
      enableWorkerThreads: false, // Disabled by default for compatibility
      enableMemoryManagement: true,
      maxMemoryMB: 512,
      workerPoolSize: Math.min(cpus().length, 4),
      ...performanceOptions,
    };

    this.initializePerformanceComponents();
  }

  /**
   * Initialize performance optimization components
   */
  private initializePerformanceComponents(): void {
    // Initialize synchronously to avoid async constructor issues
    if (this.performanceOptions.enableCaching) {
      this.performanceCache = new PerformanceCache({
        maxMemoryMB: this.performanceOptions.maxMemoryMB! / 4, // 25% of total for cache
        cacheDirectory: this.performanceOptions.cacheDirectory,
      });
      // Initialize cache asynchronously when first used
    }

    if (this.performanceOptions.enableMemoryManagement) {
      this.memoryManager = new MemoryManager({
        thresholds: {
          warning: 70,
          critical: 85,
          emergency: 95,
        },
        maxBatchSize: this.maxConcurrency,
      });
      this.memoryManager.startMonitoring();
    }

    if (this.performanceOptions.enableWorkerThreads) {
      this.workerPool = new WorkerPool({
        maxWorkers: this.performanceOptions.workerPoolSize,
      });
      // Initialize worker pool asynchronously when first used
    }
  }

  /**
   * Ensure performance components are initialized
   */
  private async ensurePerformanceComponentsInitialized(): Promise<void> {
    if (this.performanceCache && !this.performanceCache.getStats) {
      await this.performanceCache.initialize();
    }

    if (this.workerPool && this.performanceOptions.enableWorkerThreads) {
      try {
        await this.workerPool.initialize();
      } catch (error) {
        // Worker pool initialization can fail in test environments
        console.warn('Worker pool initialization failed:', error);
        this.workerPool = undefined;
      }
    }
  }

  /**
   * Load configuration from file or use defaults
   */
  async loadConfiguration(configPath?: string): Promise<Configuration> {
    const result = await this.configManager.loadConfiguration(
      undefined,
      configPath
    );
    return result.config;
  }

  /**
   * Load rules for a specific profile
   */
  async loadRules(profileName: string, vaultPath?: string): Promise<Rule[]> {
    // Check for explicit config path in environment
    const configPath = process.env.OBSIDIAN_LINT_CONFIG;
    const configResult = await this.configManager.loadConfiguration(
      vaultPath,
      configPath
    );
    const config = configResult.config;
    const profile = config.profiles[profileName];

    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    // Resolve rules path relative to config location
    const rulesPath = await this.resolveRulesPathWithConfig(
      profile.rulesPath,
      configResult.path
    );
    return this.ruleEngine.loadRulesForProfile(rulesPath);
  }

  /**
   * Load rules for a specific profile with explicit config path
   */
  async loadRulesWithConfigPath(
    profileName: string,
    configPath?: string
  ): Promise<Rule[]> {
    const configResult = await this.configManager.loadConfiguration();
    const config = configResult.config;
    const profile = config.profiles[profileName];

    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    // Resolve rules path relative to config location
    const rulesPath = await this.resolveRulesPathWithConfig(
      profile.rulesPath,
      configPath || configResult.path
    );
    return this.ruleEngine.loadRulesForProfile(rulesPath);
  }

  /**
   * Load all available rules (both enabled and disabled) for a profile
   */
  async loadAllRules(profileName: string): Promise<Rule[]> {
    const configResult = await this.configManager.loadConfiguration();
    const config = configResult.config;
    const profile = config.profiles[profileName];

    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    const rulesPath = await this.resolveRulesPathWithConfig(
      profile.rulesPath,
      configResult.path
    );

    // Load both enabled and disabled rules
    const enabledRules = await this.ruleEngine.loadRulesForProfile(rulesPath);

    // For now, we'll just return enabled rules since we don't have disabled rule loading yet
    // TODO: Implement loading from disabled directory as well
    return enabledRules;
  }

  /**
   * Get available profiles from configuration
   */
  async getAvailableProfiles(): Promise<ProfileConfig[]> {
    const config = await this.loadConfiguration();
    return Object.values(config.profiles);
  }

  /**
   * Validate rule conflicts
   */
  async validateRuleConflicts(rules: Rule[]): Promise<ConflictResult> {
    return this.ruleEngine.validateRuleConflicts(rules);
  }

  /**
   * Process an entire vault with performance optimizations
   */
  async processVault(
    vaultPath: string,
    options: ProcessOptions,
    progressCallback?: ProgressCallback
  ): Promise<LintResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];
    const fixes: Fix[] = [];
    const errors: Error[] = [];

    try {
      // Load configuration and rules
      const configResult =
        await this.configManager.loadConfiguration(vaultPath);
      const config = configResult.config;
      const rules = await this.loadRulesWithConfigPath(
        config.activeProfile,
        configResult.path
      );

      // Validate rule conflicts
      const conflictResult = await this.validateRuleConflicts(rules);
      if (!conflictResult.valid) {
        throw new LintEngineError(
          `Rule conflicts detected: ${conflictResult.conflicts.map(c => c.majorId).join(', ')}`,
          'RULE_CONFLICTS',
          { conflicts: conflictResult.conflicts }
        );
      }

      // Scan for markdown files
      const markdownFiles = await this.fileProcessor.scanVault(vaultPath, [
        '**/*.md',
      ]);

      // Filter files based on options
      let filesToProcess = this.filterFiles(markdownFiles, options, vaultPath);

      // Ensure performance components are initialized
      await this.ensurePerformanceComponentsInitialized();

      // Apply incremental processing if caching is enabled
      if (this.performanceCache) {
        const cacheResult =
          await this.performanceCache.getFilesNeedingProcessing(filesToProcess);
        if (options.verbose) {
          console.log(
            `Cache analysis: ${cacheResult.needsProcessing.length} files need processing, ${cacheResult.canSkip.length} can be skipped`
          );
        }
        filesToProcess = cacheResult.needsProcessing;

        // Add cached results for files that can be skipped
        for (const skippedFile of cacheResult.canSkip) {
          for (const rule of rules) {
            const cachedResult = this.performanceCache.getCachedRuleResult(
              skippedFile,
              rule.id.full
            );
            if (cachedResult) {
              issues.push(...cachedResult.issues);
              fixes.push(...cachedResult.fixes);
            }
          }
        }
      }

      if (progressCallback) {
        progressCallback(
          0,
          filesToProcess.length,
          'Starting file processing...'
        );
      }

      // Process files with performance optimizations
      let processedCount = 0;
      if (options.parallel && filesToProcess.length > 1) {
        const results = await this.processFilesInParallelOptimized(
          filesToProcess,
          vaultPath,
          rules,
          options,
          (current, total, message) => {
            processedCount = current;
            if (progressCallback) {
              progressCallback(current, total, message);
            }
          }
        );

        issues.push(...results.issues);
        fixes.push(...results.fixes);
        errors.push(...results.errors);
        processedCount = results.processedCount;
      } else {
        // Sequential processing with optimizations
        for (let i = 0; i < filesToProcess.length; i++) {
          const filePath = filesToProcess[i];

          if (progressCallback) {
            progressCallback(
              i,
              filesToProcess.length,
              `Processing ${filePath}`
            );
          }

          try {
            const result = await this.processFileOptimized(
              filePath,
              vaultPath,
              rules,
              options
            );
            issues.push(...result.issues);
            fixes.push(...result.fixes);
            processedCount++;
          } catch (error) {
            errors.push(
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
      }

      if (progressCallback) {
        progressCallback(
          processedCount,
          filesToProcess.length,
          'Processing complete'
        );
      }

      return {
        filesProcessed: processedCount,
        issuesFound: issues,
        fixesApplied: fixes,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));

      return {
        filesProcessed: 0,
        issuesFound: issues,
        fixesApplied: fixes,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Filter files based on processing options
   */
  private filterFiles(
    files: string[],
    options: ProcessOptions,
    vaultPath?: string
  ): string[] {
    let filtered = [...files];

    // Apply ignore patterns
    if (options.ignore && options.ignore.length > 0) {
      filtered = filtered.filter(filePath => {
        // Normalize path for pattern matching
        const normalizedPath = this.normalizePathForPatternMatching(
          filePath,
          vaultPath
        );

        return !options.ignore!.some(pattern =>
          this.matchesPattern(normalizedPath, pattern)
        );
      });
    }

    // Apply rule-specific filtering if specified
    if (options.rules && options.rules.length > 0) {
      // For now, we'll process all files and let rules filter themselves
      // This could be optimized in the future
    }

    return filtered;
  }

  /**
   * Normalize path for pattern matching by making it relative to vault
   */
  private normalizePathForPatternMatching(
    filePath: string,
    vaultPath?: string
  ): string {
    let normalizedPath = filePath.replace(/\\/g, '/');

    if (vaultPath) {
      const normalizedVaultPath = vaultPath.replace(/\\/g, '/');
      if (normalizedPath.startsWith(normalizedVaultPath)) {
        normalizedPath = normalizedPath.substring(normalizedVaultPath.length);
        if (normalizedPath.startsWith('/')) {
          normalizedPath = normalizedPath.substring(1);
        }
      }
    }

    return normalizedPath;
  }

  /**
   * Process files in parallel with performance optimizations
   */
  private async processFilesInParallelOptimized(
    files: string[],
    vaultPath: string,
    rules: Rule[],
    options: ProcessOptions,
    progressCallback?: ProgressCallback
  ): Promise<{
    issues: Issue[];
    fixes: Fix[];
    errors: Error[];
    processedCount: number;
  }> {
    const issues: Issue[] = [];
    const fixes: Fix[] = [];
    const errors: Error[] = [];
    let processedCount = 0;

    // Calculate optimal batch size based on memory constraints
    let batchSize = this.maxConcurrency;
    if (this.memoryManager) {
      const strategy = this.memoryManager.getBatchingStrategy();
      batchSize = strategy.recommendedBatchSize;

      if (strategy.shouldPause) {
        if (options.verbose) {
          console.log('Waiting for memory to be available...');
        }
        await this.memoryManager.waitForMemory();
      }
    }

    const batches = this.createBatches(files, batchSize);

    if (options.verbose) {
      console.log(
        `Processing ${files.length} files in ${batches.length} batches with concurrency ${batchSize}`
      );
      if (this.memoryManager) {
        const stats = this.memoryManager.getMemoryStats();
        console.log(
          `Memory usage: ${stats.percentage.toFixed(1)}% (${stats.used.toFixed(1)}MB/${stats.total.toFixed(1)}MB)`
        );
      }
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Check memory before processing each batch
      if (this.memoryManager && !this.memoryManager.isMemorySafe()) {
        if (options.verbose) {
          console.log(
            `Pausing before batch ${batchIndex + 1} due to high memory usage`
          );
        }
        await this.memoryManager.waitForMemory();
      }

      if (options.verbose) {
        console.log(
          `Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} files`
        );
      }

      // Process batch in parallel with error isolation and memory management
      const batchPromises = batch.map(async filePath => {
        try {
          const result = await this.processFileOptimized(
            filePath,
            vaultPath,
            rules,
            options
          );
          return { success: true, result, filePath };
        } catch (error) {
          const processedError =
            error instanceof Error ? error : new Error(String(error));

          if (options.verbose) {
            console.error(
              `Error processing file ${filePath}:`,
              processedError.message
            );
          }

          return {
            success: false,
            error: new LintEngineError(
              `Failed to process file ${filePath}`,
              'FILE_PROCESSING_ERROR',
              { filePath, originalError: processedError }
            ),
            filePath,
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results with enhanced error handling
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          const batchResult = promiseResult.value;

          if (batchResult.success) {
            issues.push(...batchResult.result.issues);
            fixes.push(...batchResult.result.fixes);
            processedCount++;

            if (options.verbose) {
              console.log(
                `✓ Processed ${batchResult.filePath} - ${batchResult.result.issues.length} issues, ${batchResult.result.fixes.length} fixes`
              );
            }
          } else {
            errors.push(batchResult.error);

            if (options.verbose) {
              console.error(`✗ Failed to process ${batchResult.filePath}`);
            }
          }

          if (progressCallback) {
            progressCallback(
              processedCount,
              files.length,
              `Processed ${batchResult.filePath}`
            );
          }
        } else {
          // Handle promise rejection
          const error = new LintEngineError(
            'Batch processing promise rejected',
            'BATCH_PROCESSING_ERROR',
            { reason: promiseResult.reason }
          );
          errors.push(error);

          if (options.verbose) {
            console.error(
              'Batch processing promise rejected:',
              promiseResult.reason
            );
          }
        }
      }

      // Force garbage collection after each batch if memory management is enabled
      if (this.memoryManager && batchIndex % 3 === 0) {
        this.memoryManager.forceGarbageCollection();
      }
    }

    if (options.verbose) {
      console.log(
        `Parallel processing complete: ${processedCount}/${files.length} files processed successfully`
      );
      if (this.memoryManager) {
        const finalStats = this.memoryManager.getMemoryStats();
        console.log(`Final memory usage: ${finalStats.percentage.toFixed(1)}%`);
      }
    }

    return { issues, fixes, errors, processedCount };
  }

  /**
   * Process files in parallel with configurable concurrency (legacy method)
   */
  private async processFilesInParallel(
    files: string[],
    vaultPath: string,
    rules: Rule[],
    options: ProcessOptions,
    progressCallback?: ProgressCallback
  ): Promise<{
    issues: Issue[];
    fixes: Fix[];
    errors: Error[];
    processedCount: number;
  }> {
    // Delegate to optimized version
    return this.processFilesInParallelOptimized(
      files,
      vaultPath,
      rules,
      options,
      progressCallback
    );
  }

  /**
   * Process a single file with performance optimizations
   */
  private async processFileOptimized(
    filePath: string,
    vaultPath: string,
    rules: Rule[],
    options: ProcessOptions
  ): Promise<{ issues: Issue[]; fixes: Fix[] }> {
    const issues: Issue[] = [];
    const fixes: Fix[] = [];

    try {
      // Parse the markdown file (potentially using worker threads)
      let markdownFile: MarkdownFile;
      if (this.workerPool && !options.dryRun) {
        const content = await this.fileProcessor.readFile(filePath);
        markdownFile = await this.workerPool.parseMarkdownFile(
          filePath,
          content
        );
      } else {
        markdownFile = await this.fileProcessor.parseMarkdownFile(filePath);
      }

      // Create execution context
      const context = this.ruleExecutor.createExecutionContext(
        markdownFile,
        vaultPath,
        { dryRun: options.dryRun, verbose: options.verbose }
      );

      // Filter rules that apply to this file
      const applicableRules = this.ruleExecutor.filterRulesByPath(
        rules,
        filePath,
        vaultPath
      );

      // Apply each rule with caching
      for (const rule of applicableRules) {
        try {
          let ruleIssues: Issue[] = [];
          let ruleFixes: Fix[] = [];
          let executionTime = 0;

          // Check cache first
          if (this.performanceCache) {
            const cachedResult = this.performanceCache.getCachedRuleResult(
              filePath,
              rule.id.full
            );
            if (cachedResult) {
              ruleIssues = cachedResult.issues;
              ruleFixes = cachedResult.fixes;
              executionTime = cachedResult.executionTime;

              if (options.verbose) {
                console.log(
                  `Cache hit for rule ${rule.id.full} on ${filePath}`
                );
              }
            }
          }

          // Execute rule if not cached
          if (
            ruleIssues.length === 0 &&
            (!this.performanceCache ||
              !this.performanceCache.getCachedRuleResult(
                filePath,
                rule.id.full
              ))
          ) {
            const ruleStartTime = Date.now();

            // Use worker threads for CPU-intensive rules if available
            if (this.workerPool && this.isCpuIntensiveRule(rule)) {
              const result = await this.workerPool.executeRule(rule, context);
              ruleIssues = result.issues;
              ruleFixes = result.fixes;
              executionTime = result.executionTime;
            } else {
              ruleIssues = await this.ruleExecutor.executeRule(rule, context);
              executionTime = Date.now() - ruleStartTime;

              // Apply fixes if enabled and available
              if (options.fix && rule.fix && ruleIssues.length > 0) {
                ruleFixes = await this.ruleExecutor.executeRuleFix(
                  rule,
                  context,
                  ruleIssues
                );
              }
            }

            // Cache the result
            if (this.performanceCache) {
              await this.performanceCache.cacheRuleResult(
                filePath,
                rule,
                ruleIssues,
                ruleFixes,
                executionTime,
                markdownFile.content
              );
            }
          }

          issues.push(...ruleIssues);
          fixes.push(...ruleFixes);

          // Apply fixes to file (respecting dry-run mode)
          if (options.fix && ruleFixes.length > 0) {
            await this.applyFixesToFile(
              markdownFile,
              ruleFixes,
              options.dryRun
            );
          }
        } catch (error) {
          if (error instanceof RuleExecutionError) {
            // Convert rule execution errors to issues
            issues.push({
              ruleId: error.ruleId,
              severity: 'error',
              message: `Rule execution failed: ${error.message}`,
              file: filePath,
              fixable: false,
            });
          } else {
            throw error;
          }
        }
      }

      return { issues, fixes };
    } catch (error) {
      throw new LintEngineError(
        `Failed to process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        'FILE_PROCESSING_ERROR',
        { filePath, originalError: error }
      );
    }
  }

  /**
   * Process a single file with all applicable rules (legacy method)
   */
  private async processFile(
    filePath: string,
    vaultPath: string,
    rules: Rule[],
    options: ProcessOptions
  ): Promise<{ issues: Issue[]; fixes: Fix[] }> {
    // Delegate to optimized version
    return this.processFileOptimized(filePath, vaultPath, rules, options);
  }

  /**
   * Create batches for parallel processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Simple pattern matching using glob patterns
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex (simplified)
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Apply fixes to a markdown file (enhanced implementation with dry-run support)
   */
  private async applyFixesToFile(
    markdownFile: MarkdownFile,
    fixes: Fix[],
    dryRun: boolean = false
  ): Promise<void> {
    if (fixes.length === 0) return;

    let modifiedContent = markdownFile.content;
    const originalContent = markdownFile.content;

    try {
      // Sort fixes by line number in reverse order to avoid offset issues
      const sortedFixes = [...fixes].sort((a, b) => {
        const aLine = a.changes[0]?.line || 0;
        const bLine = b.changes[0]?.line || 0;
        return bLine - aLine;
      });

      // Group fixes by type and apply them
      for (const fix of sortedFixes) {
        for (const change of fix.changes) {
          switch (change.type) {
            case 'replace':
              if (change.oldText && change.newText !== undefined) {
                // Use global replace for safety
                const regex = new RegExp(
                  this.escapeRegExp(change.oldText),
                  'g'
                );
                modifiedContent = modifiedContent.replace(
                  regex,
                  change.newText
                );
              }
              break;

            case 'insert':
              if (change.newText && change.line !== undefined) {
                const lines = modifiedContent.split('\n');
                lines.splice(change.line, 0, change.newText);
                modifiedContent = lines.join('\n');
              }
              break;

            case 'delete':
              if (change.oldText) {
                const regex = new RegExp(
                  this.escapeRegExp(change.oldText),
                  'g'
                );
                modifiedContent = modifiedContent.replace(regex, '');
              } else if (change.line !== undefined) {
                const lines = modifiedContent.split('\n');
                lines.splice(change.line, 1);
                modifiedContent = lines.join('\n');
              }
              break;

            case 'move':
              if (change.oldPath && change.newPath) {
                // File moves are handled separately and require special handling
                if (!dryRun) {
                  await this.fileProcessor.moveFile(
                    change.oldPath,
                    change.newPath
                  );
                  // Update internal references to the moved file
                  modifiedContent = this.updateReferencesToMovedFile(
                    modifiedContent,
                    change.oldPath,
                    change.newPath
                  );
                }
              }
              break;
          }
        }
      }

      // Write the modified content back to the file (unless dry run)
      if (modifiedContent !== originalContent && !dryRun) {
        // Create backup before modifying
        await this.fileProcessor.createBackup(markdownFile.path);
        await this.fileProcessor.writeFile(markdownFile.path, modifiedContent);
      }
    } catch (error) {
      throw new LintEngineError(
        `Failed to apply fixes to file ${markdownFile.path}`,
        'FIX_APPLICATION_ERROR',
        {
          filePath: markdownFile.path,
          fixCount: fixes.length,
          originalError: error,
        }
      );
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Update references to moved files
   */
  private updateReferencesToMovedFile(
    content: string,
    oldPath: string,
    newPath: string
  ): string {
    const oldName = oldPath.split('/').pop()?.replace(/\.md$/, '') || '';
    const newName = newPath.split('/').pop()?.replace(/\.md$/, '') || '';

    // Update wikilinks
    content = content.replace(
      new RegExp(`\\[\\[${this.escapeRegExp(oldName)}\\]\\]`, 'g'),
      `[[${newName}]]`
    );

    // Update markdown links
    content = content.replace(
      new RegExp(`\\[([^\\]]+)\\]\\(${this.escapeRegExp(oldPath)}\\)`, 'g'),
      `[$1](${newPath})`
    );

    return content;
  }

  /**
   * Resolve rules path relative to configuration location
   */
  private async resolveRulesPath(rulesPath: string): Promise<string> {
    // Get the configuration path to resolve relative to it
    const configResult = await this.configManager.loadConfiguration();

    if (configResult.path) {
      // Use the config manager's resolveRulesPath method
      return this.configManager.resolveRulesPath(configResult.path, rulesPath);
    }

    // Fallback to current working directory
    return join(process.cwd(), '.config/obsidian-lint', rulesPath);
  }

  /**
   * Resolve rules path with explicit config path
   */
  private async resolveRulesPathWithConfig(
    rulesPath: string,
    configPath?: string
  ): Promise<string> {
    if (configPath) {
      // Use the config manager's resolveRulesPath method
      return this.configManager.resolveRulesPath(configPath, rulesPath);
    }

    // Fallback to current working directory
    return join(process.cwd(), '.config/obsidian-lint', rulesPath);
  }

  /**
   * Generate comprehensive error report
   */
  generateErrorReport(result: LintResult): string {
    if (result.errors.length === 0) {
      return 'No errors occurred during processing.';
    }

    let report = `\n=== LINT ENGINE ERROR REPORT ===\n`;
    report += `Total Errors: ${result.errors.length}\n`;
    report += `Files Processed: ${result.filesProcessed}\n`;
    report += `Processing Duration: ${result.duration}ms\n\n`;

    // Group errors by type
    const errorGroups = new Map<string, Error[]>();

    for (const error of result.errors) {
      const errorType =
        error instanceof LintEngineError ? error.code : error.constructor.name;
      if (!errorGroups.has(errorType)) {
        errorGroups.set(errorType, []);
      }
      errorGroups.get(errorType)!.push(error);
    }

    // Report each error group
    for (const [errorType, errors] of errorGroups) {
      report += `--- ${errorType} (${errors.length} occurrences) ---\n`;

      for (let i = 0; i < errors.length; i++) {
        const error = errors[i];
        report += `${i + 1}. ${error.message}\n`;

        if (error instanceof LintEngineError && error.context) {
          if (error.context.filePath) {
            report += `   File: ${error.context.filePath}\n`;
          }
          if (error.context.originalError) {
            report += `   Cause: ${error.context.originalError}\n`;
          }
        }

        report += '\n';
      }
    }

    report += '=== END ERROR REPORT ===\n';
    return report;
  }

  /**
   * Validate engine configuration and dependencies
   */
  async validateEngineHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // Test configuration loading
      await this.loadConfiguration();
    } catch (error) {
      issues.push(
        `Configuration loading failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      // Test file processor
      const testFiles = await this.fileProcessor.scanVault(process.cwd(), [
        '*.md',
      ]);
      if (testFiles.length === 0) {
        warnings.push(
          'No markdown files found in current directory for testing'
        );
      }
    } catch (error) {
      issues.push(
        `File processor test failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Check concurrency settings
    if (this.maxConcurrency < 1) {
      issues.push(`Invalid concurrency setting: ${this.maxConcurrency}`);
    } else if (this.maxConcurrency > cpus().length * 2) {
      warnings.push(
        `High concurrency setting (${this.maxConcurrency}) may impact performance`
      );
    }

    return {
      healthy: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Generate MOCs for the entire vault
   */
  async generateMocs(
    vaultPath: string,
    settings?: Partial<MocGeneratorSettings>,
    progressCallback?: ProgressCallback
  ): Promise<MocGenerationResult> {
    if (settings) {
      this.mocGenerator.updateSettings(settings);
    }

    if (progressCallback) {
      progressCallback(0, 1, 'Analyzing directory structure...');
    }

    try {
      const result = await this.mocGenerator.generateMocsForVault(vaultPath);

      if (progressCallback) {
        progressCallback(1, 1, 'MOC generation complete');
      }

      return result;
    } catch (error) {
      throw new LintEngineError(
        `MOC generation failed: ${error instanceof Error ? error.message : String(error)}`,
        'MOC_GENERATION_ERROR',
        { vaultPath, originalError: error }
      );
    }
  }

  /**
   * Analyze directory structure for MOC opportunities
   */
  async analyzeMocStructure(
    vaultPath: string,
    settings?: Partial<MocGeneratorSettings>
  ) {
    if (settings) {
      this.mocGenerator.updateSettings(settings);
    }

    return this.mocGenerator.analyzeDirectoryStructure(vaultPath);
  }

  /**
   * Update MOC generator settings
   */
  updateMocSettings(settings: Partial<MocGeneratorSettings>): void {
    this.mocGenerator.updateSettings(settings);
  }

  /**
   * Get current MOC generator settings
   */
  getMocSettings(): MocGeneratorSettings {
    return this.mocGenerator.getSettings();
  }

  /**
   * Get engine performance metrics
   */
  getPerformanceMetrics(): {
    maxConcurrency: number;
    cpuCount: number;
    recommendedConcurrency: number;
    cacheStats?: any;
    memoryStats?: any;
    workerStats?: any;
  } {
    const cpuCount = cpus().length;
    const recommendedConcurrency = Math.min(cpuCount, 4);

    const metrics = {
      maxConcurrency: this.maxConcurrency,
      cpuCount,
      recommendedConcurrency,
    };

    if (this.performanceCache) {
      (metrics as any).cacheStats = this.performanceCache.getStats();
    }

    if (this.memoryManager) {
      (metrics as any).memoryStats = this.memoryManager.getMemoryStats();
    }

    if (this.workerPool) {
      (metrics as any).workerStats = this.workerPool.getStats();
    }

    return metrics;
  }

  /**
   * Determine if a rule is CPU-intensive and should use worker threads
   */
  private isCpuIntensiveRule(rule: Rule): boolean {
    // Rules that typically involve heavy computation
    const cpuIntensiveCategories = [
      'content-analysis',
      'spell-check',
      'duplicate-detection',
      'link-validation',
    ];

    const cpuIntensiveRules = [
      'spell-correction',
      'duplicate-file-detection',
      'external-link-validation',
      'content-similarity',
    ];

    return (
      cpuIntensiveCategories.includes(rule.category) ||
      cpuIntensiveRules.some(pattern => rule.id.full.includes(pattern))
    );
  }

  /**
   * Clear all caches and reset performance components
   */
  async clearCaches(): Promise<void> {
    if (this.performanceCache) {
      this.performanceCache.clear();
    }

    if (this.memoryManager) {
      this.memoryManager.clearHistory();
    }
  }

  /**
   * Shutdown the engine and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.performanceCache) {
      await this.performanceCache.shutdown();
    }

    if (this.memoryManager) {
      this.memoryManager.shutdown();
    }

    if (this.workerPool) {
      await this.workerPool.shutdown();
    }
  }
}
