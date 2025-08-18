/**
 * EditorLinter Class
 * Provides real-time linting functionality for Obsidian editors
 */

import type { Rule } from '../types/rules.js';
import type { Issue, Fix, MarkdownFile } from '../types/common.js';
import type {
  IEditorLinter,
  EditorContext,
  EditorLintOptions,
  EditorLintResult,
  EditorIndicator,
  QuickFix,
  QuickFixAction,
  EditorPosition,
  EditorRange,
} from '../types/editor.js';
import { RuleExecutor } from '../core/rule-executor.js';
import { FileProcessor } from '../utils/file-processor.js';
import { LintError, ErrorCodes } from '../types/errors.js';

/**
 * Default editor linting options
 */
export const DEFAULT_EDITOR_LINT_OPTIONS: EditorLintOptions = {
  debounceDelay: 1000,
  enableQuickFixes: true,
  showInlineErrors: true,
  maxIssuesPerFile: 50,
  enabledSeverities: ['error', 'warning', 'info'],
};

/**
 * EditorLinter provides real-time linting functionality with debouncing
 */
export class EditorLinter implements IEditorLinter {
  private rules: Rule[] = [];
  private ruleExecutor: RuleExecutor;
  private fileProcessor: FileProcessor;
  private options: EditorLintOptions;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isLinting = false;
  private lastLintResult: EditorLintResult | null = null;
  private currentContext: EditorContext | null = null;

  constructor(rules: Rule[], options: Partial<EditorLintOptions> = {}) {
    this.rules = rules;
    this.ruleExecutor = new RuleExecutor();
    this.fileProcessor = new FileProcessor();
    this.options = { ...DEFAULT_EDITOR_LINT_OPTIONS, ...options };
  }

  /**
   * Start real-time linting for the given editor context
   */
  async startLinting(context: EditorContext): Promise<void> {
    try {
      this.currentContext = context;

      // Clear any existing timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Start debounced linting
      this.debounceTimer = setTimeout(async () => {
        try {
          await this.performLinting(context);
        } catch (error) {
          console.error('Error during debounced linting:', error);
        }
      }, this.options.debounceDelay);
    } catch (error) {
      throw new LintError(
        'Failed to start editor linting',
        ErrorCodes.PLUGIN_API_ERROR,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Stop real-time linting
   */
  stopLinting(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isLinting = false;
    this.currentContext = null;
  }

  /**
   * Manually trigger linting for current content
   */
  async lintContent(context: EditorContext): Promise<EditorLintResult> {
    try {
      return await this.performLinting(context);
    } catch (error) {
      throw new LintError(
        'Failed to lint editor content',
        ErrorCodes.RULE_EXECUTION_ERROR,
        {
          filePath: context.filePath,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Apply a quick fix to the editor
   */
  async applyQuickFix(
    quickFix: QuickFix,
    context: EditorContext
  ): Promise<void> {
    try {
      // This would be implemented by the Obsidian integration
      // For now, we'll just log the action
      console.log(`Applying quick fix: ${quickFix.title}`, quickFix.action);

      // The actual implementation would depend on the Obsidian editor API
      // and would be handled by the ObsidianEditorIntegration class
    } catch (error) {
      throw new LintError(
        `Failed to apply quick fix: ${quickFix.title}`,
        ErrorCodes.RULE_FIX_ERROR,
        {
          quickFixId: quickFix.id,
          filePath: context.filePath,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Clear all visual indicators
   */
  clearIndicators(): void {
    // This would be implemented by the Obsidian integration
    // to clear visual indicators from the editor
    console.log('Clearing editor indicators');
  }

  /**
   * Update linting options
   */
  updateOptions(options: Partial<EditorLintOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Update the rules used for linting
   */
  updateRules(rules: Rule[]): void {
    this.rules = rules;
  }

  /**
   * Get the last linting result
   */
  getLastResult(): EditorLintResult | null {
    return this.lastLintResult;
  }

  /**
   * Check if linting is currently in progress
   */
  isCurrentlyLinting(): boolean {
    return this.isLinting;
  }

  /**
   * Perform the actual linting operation
   */
  private async performLinting(
    context: EditorContext
  ): Promise<EditorLintResult> {
    if (this.isLinting) {
      // Return cached result if linting is already in progress
      return this.lastLintResult || this.createEmptyResult();
    }

    this.isLinting = true;
    const startTime = Date.now();

    try {
      // Parse the markdown content
      const markdownFile = await this.parseMarkdownContent(context);

      // Filter rules that apply to this file
      const applicableRules = this.filterApplicableRules(context.filePath);

      // Execute rules and collect issues
      const allIssues: Issue[] = [];

      for (const rule of applicableRules) {
        try {
          const ruleContext = this.ruleExecutor.createExecutionContext(
            markdownFile,
            '', // vaultPath - would be provided by plugin
            { dryRun: true, verbose: false }
          );

          const issues = await this.ruleExecutor.executeRule(rule, ruleContext);
          allIssues.push(...issues);

          // Respect max issues limit
          if (allIssues.length >= this.options.maxIssuesPerFile) {
            break;
          }
        } catch (error) {
          console.warn(`Rule ${rule.id.full} failed to execute:`, error);
        }
      }

      // Filter issues by enabled severities
      const filteredIssues = allIssues.filter(issue =>
        this.options.enabledSeverities.includes(issue.severity)
      );

      // Create visual indicators
      const indicators = this.createEditorIndicators(filteredIssues);

      // Create quick fixes
      const quickFixes = await this.createQuickFixes(filteredIssues, context);

      const result: EditorLintResult = {
        issues: filteredIssues,
        indicators,
        quickFixes,
        processingTime: Date.now() - startTime,
      };

      this.lastLintResult = result;
      return result;
    } finally {
      this.isLinting = false;
    }
  }

  /**
   * Parse markdown content into MarkdownFile object
   */
  private async parseMarkdownContent(
    context: EditorContext
  ): Promise<MarkdownFile> {
    try {
      // Create a temporary file-like object for processing
      const tempFile: MarkdownFile = {
        path: context.filePath,
        content: context.content,
        frontmatter: {},
        headings: [],
        links: [],
        attachments: [],
        ast: { type: 'root', children: [] },
      };

      // Use the file processor to parse the content
      return await this.fileProcessor.parseMarkdownContent(tempFile);
    } catch (error) {
      throw new LintError(
        'Failed to parse markdown content for editor linting',
        ErrorCodes.FILE_PARSING_ERROR,
        {
          filePath: context.filePath,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Filter rules that apply to the current file
   */
  private filterApplicableRules(filePath: string): Rule[] {
    return this.ruleExecutor.filterRulesByPath(this.rules, filePath);
  }

  /**
   * Create visual indicators for editor display
   */
  private createEditorIndicators(issues: Issue[]): EditorIndicator[] {
    return issues
      .filter(issue => this.options.showInlineErrors)
      .map(issue => this.createIndicatorFromIssue(issue))
      .filter((indicator): indicator is EditorIndicator => indicator !== null);
  }

  /**
   * Create a visual indicator from an issue
   */
  private createIndicatorFromIssue(issue: Issue): EditorIndicator | null {
    if (!issue.line) {
      return null;
    }

    const range: EditorRange = {
      from: { line: issue.line - 1, ch: issue.column || 0 },
      to: { line: issue.line - 1, ch: (issue.column || 0) + 10 }, // Approximate range
    };

    return {
      id: `indicator-${issue.ruleId}-${issue.line}-${issue.column || 0}`,
      ruleId: issue.ruleId,
      severity: issue.severity,
      range,
      message: issue.message,
      quickFix: issue.fixable ? this.createQuickFixFromIssue(issue) : undefined,
    };
  }

  /**
   * Create quick fixes for fixable issues
   */
  private async createQuickFixes(
    issues: Issue[],
    context: EditorContext
  ): Promise<QuickFix[]> {
    if (!this.options.enableQuickFixes) {
      return [];
    }

    const quickFixes: QuickFix[] = [];

    for (const issue of issues.filter(i => i.fixable)) {
      const quickFix = this.createQuickFixFromIssue(issue);
      if (quickFix) {
        quickFixes.push(quickFix);
      }
    }

    return quickFixes;
  }

  /**
   * Create a quick fix from an issue
   */
  private createQuickFixFromIssue(issue: Issue): QuickFix | null {
    if (!issue.fixable || !issue.line) {
      return null;
    }

    // Create a basic quick fix - specific implementations would be rule-dependent
    const quickFixAction: QuickFixAction = {
      type: 'custom',
      handler: async () => {
        console.log(
          `Applying fix for rule ${issue.ruleId} at line ${issue.line}`
        );
        // Actual fix implementation would be rule-specific
      },
    };

    return {
      id: `quickfix-${issue.ruleId}-${issue.line}-${issue.column || 0}`,
      title: `Fix ${issue.ruleId}`,
      description: `Apply automatic fix for: ${issue.message}`,
      action: quickFixAction,
    };
  }

  /**
   * Create an empty result object
   */
  private createEmptyResult(): EditorLintResult {
    return {
      issues: [],
      indicators: [],
      quickFixes: [],
      processingTime: 0,
    };
  }

  /**
   * Debounce utility function
   */
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }
}
