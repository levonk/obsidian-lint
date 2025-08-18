/**
 * Rule Type Definitions
 */

import type { MarkdownFile, Issue, Fix } from './common.js';
import { matchesGlob } from '../utils/glob-matcher.js';

export interface Rule {
  id: RuleId;
  name: string;
  description: string;
  category: string;
  config: RuleConfig;
  lint(context: RuleExecutionContext): Promise<Issue[]>;
  fix?(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]>;
}

export interface RuleId {
  major: string; // e.g., "attachment-organization"
  minor: string; // e.g., "centralized"
  full: string; // e.g., "attachment-organization.centralized"
}

export interface RuleConfig {
  pathAllowlist: string[];
  pathDenylist: string[];
  includePatterns: string[];
  excludePatterns: string[];
  settings: Record<string, any>;
}

export abstract class BaseRule {
  public readonly id: RuleId;
  public readonly name: string;
  public readonly description: string;
  public readonly category: string;
  public readonly config: RuleConfig;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    category: string,
    config: RuleConfig
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.category = category;
    this.config = config;
  }

  /**
   * Lint a markdown file and return issues found
   */
  abstract lint(context: RuleExecutionContext): Promise<Issue[]>;

  /**
   * Fix issues in a markdown file (optional implementation)
   */
  fix?(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]>;

  /**
   * Check if this rule should be applied to the given file path
   */
  shouldApplyToFile(filePath: string): boolean {
    // Check denylist first
    if (this.config.pathDenylist.length > 0) {
      for (const pattern of this.config.pathDenylist) {
        if (this.matchesPattern(filePath, pattern)) {
          return false;
        }
      }
    }

    // Check allowlist
    if (this.config.pathAllowlist.length > 0) {
      for (const pattern of this.config.pathAllowlist) {
        if (this.matchesPattern(filePath, pattern)) {
          return true;
        }
      }
      return false; // Not in allowlist
    }

    // Check include patterns
    let included = false;
    for (const pattern of this.config.includePatterns) {
      if (this.matchesPattern(filePath, pattern)) {
        included = true;
        break;
      }
    }

    if (!included) {
      return false;
    }

    // Check exclude patterns
    for (const pattern of this.config.excludePatterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Simple glob pattern matching
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    return matchesGlob(filePath, pattern);
  }
}

export interface RuleDefinition {
  rule: {
    id: string;
    name: string;
    description: string;
    category: string;
  };
  config: {
    path_allowlist: string[];
    path_denylist: string[];
    include_patterns: string[];
    exclude_patterns: string[];
  };
  settings: Record<string, any>;
}

export interface RuleLoader {
  loadRules(rulesPath: string): Promise<Rule[]>;
  loadRuleFromFile(filePath: string): Promise<Rule>;
  validateRule(rule: Rule): boolean;
}

export interface RuleExecutionContext {
  file: MarkdownFile;
  vaultPath: string;
  dryRun: boolean;
  verbose: boolean;
  metadata: Record<string, any>;
}

export interface RuleExecutor {
  executeRule(rule: Rule, context: RuleExecutionContext): Promise<Issue[]>;
  executeRuleFix(
    rule: Rule,
    context: RuleExecutionContext,
    issues: Issue[]
  ): Promise<Fix[]>;
  filterRulesByPath(rules: Rule[], filePath: string): Rule[];
  createExecutionContext(
    file: MarkdownFile,
    vaultPath: string,
    options: { dryRun: boolean; verbose: boolean },
    metadata?: Record<string, any>
  ): RuleExecutionContext;
}
