/**
 * Rule Execution Engine
 * Handles execution of rules against files with proper error handling and context
 */

import type {
  Rule,
  RuleExecutor as IRuleExecutor,
  RuleExecutionContext,
} from '../types/rules.js';
import type { MarkdownFile, Issue, Fix } from '../types/common.js';

export class RuleExecutionError extends Error {
  constructor(
    message: string,
    public ruleId: string,
    public filePath: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'RuleExecutionError';
  }
}

export class RuleExecutor implements IRuleExecutor {
  /**
   * Execute a rule against a file within the provided context
   */
  async executeRule(
    rule: Rule,
    context: RuleExecutionContext
  ): Promise<Issue[]> {
    try {
      // Check if rule should apply to this file
      if (!this.shouldRuleApplyToFile(rule, context.file.path)) {
        return [];
      }

      // Execute the rule's lint method
      const issues = await rule.lint(context);

      // Validate and enrich issues
      return this.validateAndEnrichIssues(issues, rule, context);
    } catch (error) {
      throw new RuleExecutionError(
        `Failed to execute rule ${rule.id.full} on file ${context.file.path}`,
        rule.id.full,
        context.file.path,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Execute a rule's fix method for the given issues
   */
  async executeRuleFix(
    rule: Rule,
    context: RuleExecutionContext,
    issues: Issue[]
  ): Promise<Fix[]> {
    try {
      // Check if rule has fix capability
      if (!rule.fix) {
        return [];
      }

      // Filter issues that are fixable and belong to this rule
      const fixableIssues = issues.filter(
        issue => issue.fixable && issue.ruleId === rule.id.full
      );

      if (fixableIssues.length === 0) {
        return [];
      }

      // Execute the rule's fix method
      const fixes = await rule.fix(context, fixableIssues);

      // Validate and enrich fixes
      return this.validateAndEnrichFixes(fixes, rule, context);
    } catch (error) {
      throw new RuleExecutionError(
        `Failed to execute fix for rule ${rule.id.full} on file ${context.file.path}`,
        rule.id.full,
        context.file.path,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Filter rules that should apply to the given file path
   */
  filterRulesByPath(
    rules: Rule[],
    filePath: string,
    vaultPath?: string
  ): Rule[] {
    // Normalize the file path for pattern matching
    const normalizedPath = this.normalizePathForMatching(filePath, vaultPath);
    return rules.filter(rule =>
      this.shouldRuleApplyToFile(rule, normalizedPath)
    );
  }

  /**
   * Create a rule execution context
   */
  createExecutionContext(
    file: MarkdownFile,
    vaultPath: string,
    options: { dryRun: boolean; verbose: boolean },
    metadata: Record<string, any> = {}
  ): RuleExecutionContext {
    return {
      file,
      vaultPath,
      dryRun: options.dryRun,
      verbose: options.verbose,
      metadata: {
        ...metadata,
        executionTime: new Date().toISOString(),
        fileSize: file.content.length,
        hasfrontmatter: Object.keys(file.frontmatter).length > 0,
        headingCount: file.headings.length,
        linkCount: file.links.length,
        attachmentCount: file.attachments.length,
      },
    };
  }

  /**
   * Check if a rule should apply to a specific file path
   */
  private shouldRuleApplyToFile(rule: Rule, filePath: string): boolean {
    // Use the rule's built-in path filtering if it's a BaseRule
    if (
      'shouldApplyToFile' in rule &&
      typeof rule.shouldApplyToFile === 'function'
    ) {
      const result = rule.shouldApplyToFile(filePath);

      return result;
    }

    // Fallback to manual pattern matching
    const result = this.matchesRulePatterns(rule, filePath);

    return result;
  }

  /**
   * Manual pattern matching for rules that don't extend BaseRule
   */
  private matchesRulePatterns(rule: Rule, filePath: string): boolean {
    // Check denylist first
    if (rule.config.pathDenylist.length > 0) {
      for (const pattern of rule.config.pathDenylist) {
        if (this.matchesGlobPattern(filePath, pattern)) {
          return false;
        }
      }
    }

    // Check allowlist
    if (rule.config.pathAllowlist.length > 0) {
      for (const pattern of rule.config.pathAllowlist) {
        if (this.matchesGlobPattern(filePath, pattern)) {
          return true;
        }
      }
      return false; // Not in allowlist
    }

    // Check include patterns
    let included = false;
    for (const pattern of rule.config.includePatterns) {
      if (this.matchesGlobPattern(filePath, pattern)) {
        included = true;
        break;
      }
    }

    if (!included) {
      return false;
    }

    // Check exclude patterns
    for (const pattern of rule.config.excludePatterns) {
      if (this.matchesGlobPattern(filePath, pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Simple glob pattern matching
   */
  private matchesGlobPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    // First escape dots, then handle glob patterns
    let regexPattern = pattern.replace(/\./g, '\\.');

    // Handle ** first (matches any path including /) - use placeholder to avoid conflicts
    regexPattern = regexPattern.replace(/\*\*/g, '__DOUBLE_STAR__');

    // Handle * (matches any filename chars except /)
    regexPattern = regexPattern.replace(/\*/g, '[^/]*');

    // Replace placeholder with correct regex
    // ** should match zero or more path segments (including zero)
    regexPattern = regexPattern.replace(/__DOUBLE_STAR__/g, '.*');

    // Handle ? (matches single char)
    regexPattern = regexPattern.replace(/\?/g, '.');

    // Special handling for patterns that start with .* - make them optional at the beginning
    if (regexPattern.startsWith('.*')) {
      // For patterns like .*/something, make the leading path optional
      if (regexPattern.charAt(2) === '/') {
        regexPattern = '(?:.*[/])?' + regexPattern.substring(3);
      }
    }

    const regex = new RegExp(`^${regexPattern}$`);
    const result = regex.test(filePath);

    return result;
  }

  /**
   * Validate and enrich issues returned by rules
   */
  private validateAndEnrichIssues(
    issues: Issue[],
    rule: Rule,
    context: RuleExecutionContext
  ): Issue[] {
    return issues.map(issue => {
      // Ensure issue has required fields
      if (!issue.ruleId) {
        issue.ruleId = rule.id.full;
      }

      if (!issue.file) {
        issue.file = context.file.path;
      }

      // Validate severity
      if (!['error', 'warning', 'info'].includes(issue.severity)) {
        issue.severity = 'warning';
      }

      // Ensure message is present
      if (!issue.message) {
        issue.message = `Issue detected by rule ${rule.id.full}`;
      }

      // Ensure fixable is boolean
      if (typeof issue.fixable !== 'boolean') {
        issue.fixable = false;
      }

      return issue;
    });
  }

  /**
   * Validate and enrich fixes returned by rules
   */
  private validateAndEnrichFixes(
    fixes: Fix[],
    rule: Rule,
    context: RuleExecutionContext
  ): Fix[] {
    return fixes.map(fix => {
      // Ensure fix has required fields
      if (!fix.ruleId) {
        fix.ruleId = rule.id.full;
      }

      if (!fix.file) {
        fix.file = context.file.path;
      }

      // Ensure description is present
      if (!fix.description) {
        fix.description = `Fix applied by rule ${rule.id.full}`;
      }

      // Ensure changes array exists
      if (!Array.isArray(fix.changes)) {
        fix.changes = [];
      }

      return fix;
    });
  }

  /**
   * Normalize file path for pattern matching
   */
  private normalizePathForMatching(
    filePath: string,
    vaultPath?: string
  ): string {
    let normalizedPath = filePath;

    // Convert to forward slashes
    normalizedPath = normalizedPath.replace(/\\/g, '/');

    // If vault path is provided, make the path relative to the vault
    if (vaultPath) {
      const normalizedVaultPath = vaultPath.replace(/\\/g, '/');

      if (normalizedPath.startsWith(normalizedVaultPath)) {
        // Remove vault path and leading slash
        normalizedPath = normalizedPath.substring(normalizedVaultPath.length);
        if (normalizedPath.startsWith('/')) {
          normalizedPath = normalizedPath.substring(1);
        }
      }
    }

    return normalizedPath;
  }
}
