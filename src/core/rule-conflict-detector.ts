/**
 * Rule Conflict Detection and Resolution
 * Comprehensive conflict detection with detailed resolution suggestions
 */

import type { Rule, RuleId } from '../types/rules.js';
import {
  RuleError,
  ErrorCodes,
  ValidationResult,
  ErrorAggregator,
  ErrorContextBuilder,
} from '../types/errors.js';

export interface ConflictGroup {
  majorId: string;
  conflictingRules: Rule[];
  conflictType: ConflictType;
  severity: ConflictSeverity;
  resolution: string;
  suggestions: string[];
}

export interface ConflictResult {
  valid: boolean;
  conflicts: ConflictGroup[];
  warnings: string[];
  summary: ConflictSummary;
}

export interface ConflictSummary {
  totalRules: number;
  conflictingRules: number;
  majorIdGroups: number;
  criticalConflicts: number;
  warningConflicts: number;
}

export enum ConflictType {
  MAJOR_ID_DUPLICATE = 'MAJOR_ID_DUPLICATE',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INCOMPATIBLE_SETTINGS = 'INCOMPATIBLE_SETTINGS',
  PATH_OVERLAP = 'PATH_OVERLAP',
  RESOURCE_CONTENTION = 'RESOURCE_CONTENTION',
}

export enum ConflictSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

export class RuleConflictDetector {
  private aggregator: ErrorAggregator;

  constructor() {
    this.aggregator = new ErrorAggregator();
  }

  /**
   * Detect all types of conflicts between rules
   */
  detectConflicts(rules: Rule[]): ConflictResult {
    this.aggregator.clear();
    const conflicts: ConflictGroup[] = [];

    try {
      // Detect major ID conflicts (most critical)
      const majorIdConflicts = this.detectMajorIdConflicts(rules);
      conflicts.push(...majorIdConflicts);

      // Detect path overlap conflicts
      const pathConflicts = this.detectPathOverlapConflicts(rules);
      conflicts.push(...pathConflicts);

      // Detect incompatible settings
      const settingsConflicts = this.detectIncompatibleSettings(rules);
      conflicts.push(...settingsConflicts);

      // Detect resource contention
      const resourceConflicts = this.detectResourceContention(rules);
      conflicts.push(...resourceConflicts);

      // Generate warnings for potential issues
      const warnings = this.generateWarnings(rules);

      // Create summary
      const summary = this.createConflictSummary(rules, conflicts);

      return {
        valid:
          conflicts.filter(c => c.severity === ConflictSeverity.CRITICAL)
            .length === 0,
        conflicts,
        warnings,
        summary,
      };
    } catch (error) {
      const contextBuilder = new ErrorContextBuilder()
        .addOperation('conflict_detection')
        .addCustom('ruleCount', rules.length)
        .addOriginalError(
          error instanceof Error ? error : new Error(String(error))
        );

      this.aggregator.addError(
        new RuleError(
          'Unexpected error during conflict detection',
          ErrorCodes.RULE_VALIDATION_ERROR,
          undefined,
          contextBuilder.build()
        )
      );

      return {
        valid: false,
        conflicts: [],
        warnings: [],
        summary: this.createConflictSummary(rules, []),
      };
    }
  }

  /**
   * Detect major ID conflicts (multiple rules with same major ID)
   */
  private detectMajorIdConflicts(rules: Rule[]): ConflictGroup[] {
    const conflicts: ConflictGroup[] = [];
    const majorIdGroups = new Map<string, Rule[]>();

    // Group rules by major ID
    for (const rule of rules) {
      const majorId = rule.id.major;
      if (!majorIdGroups.has(majorId)) {
        majorIdGroups.set(majorId, []);
      }
      majorIdGroups.get(majorId)!.push(rule);
    }

    // Check for conflicts
    for (const [majorId, rulesInGroup] of majorIdGroups) {
      if (rulesInGroup.length > 1) {
        const minorIds = rulesInGroup.map(r => r.id.minor);
        const suggestions = this.generateMajorIdConflictSuggestions(
          majorId,
          rulesInGroup
        );

        conflicts.push({
          majorId,
          conflictingRules: rulesInGroup,
          conflictType: ConflictType.MAJOR_ID_DUPLICATE,
          severity: ConflictSeverity.CRITICAL,
          resolution: `Only one rule variant per major ID is allowed. Found variants: ${minorIds.join(', ')}`,
          suggestions,
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect path overlap conflicts between rules
   */
  private detectPathOverlapConflicts(rules: Rule[]): ConflictGroup[] {
    const conflicts: ConflictGroup[] = [];
    const pathGroups = new Map<string, Rule[]>();

    // Group rules by their path patterns
    for (const rule of rules) {
      const pathKey = this.createPathKey(rule);
      if (!pathGroups.has(pathKey)) {
        pathGroups.set(pathKey, []);
      }
      pathGroups.get(pathKey)!.push(rule);
    }

    // Check for potential conflicts
    for (const [pathKey, rulesInGroup] of pathGroups) {
      if (rulesInGroup.length > 1) {
        // Check if rules might interfere with each other
        const interferingRules = this.findInterferingRules(rulesInGroup);

        if (interferingRules.length > 0) {
          const suggestions =
            this.generatePathConflictSuggestions(interferingRules);

          conflicts.push({
            majorId: `path-overlap-${pathKey}`,
            conflictingRules: interferingRules,
            conflictType: ConflictType.PATH_OVERLAP,
            severity: ConflictSeverity.WARNING,
            resolution: `Rules may interfere with each other on overlapping paths: ${pathKey}`,
            suggestions,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect incompatible settings between rules
   */
  private detectIncompatibleSettings(rules: Rule[]): ConflictGroup[] {
    const conflicts: ConflictGroup[] = [];

    // Check for specific incompatible combinations
    const fileOrganizationRules = rules.filter(
      r => r.category === 'file-organization'
    );
    const attachmentRules = rules.filter(r => r.category === 'attachment');

    // Check file organization conflicts
    if (fileOrganizationRules.length > 1) {
      const incompatiblePairs = this.findIncompatibleFileOrganizationRules(
        fileOrganizationRules
      );
      conflicts.push(...incompatiblePairs);
    }

    // Check attachment organization conflicts
    if (attachmentRules.length > 1) {
      const incompatiblePairs =
        this.findIncompatibleAttachmentRules(attachmentRules);
      conflicts.push(...incompatiblePairs);
    }

    return conflicts;
  }

  /**
   * Detect resource contention between rules
   */
  private detectResourceContention(rules: Rule[]): ConflictGroup[] {
    const conflicts: ConflictGroup[] = [];

    // Check for rules that might compete for the same resources
    const fileMovingRules = rules.filter(
      r =>
        r.id.major.includes('file-organization') ||
        r.id.major.includes('attachment-organization')
    );

    if (fileMovingRules.length > 1) {
      const suggestions = [
        'Consider using only one file organization rule at a time',
        'If multiple rules are needed, ensure they target different file types',
        'Use path allowlist/denylist to prevent conflicts',
      ];

      conflicts.push({
        majorId: 'resource-contention-file-moving',
        conflictingRules: fileMovingRules,
        conflictType: ConflictType.RESOURCE_CONTENTION,
        severity: ConflictSeverity.WARNING,
        resolution: 'Multiple rules may attempt to move the same files',
        suggestions,
      });
    }

    return conflicts;
  }

  /**
   * Generate warnings for potential issues
   */
  private generateWarnings(rules: Rule[]): string[] {
    const warnings: string[] = [];

    // Check for rules with no path restrictions
    const unrestricted = rules.filter(
      r =>
        r.config.pathAllowlist.length === 0 &&
        r.config.pathDenylist.length === 0
    );

    if (unrestricted.length > 0) {
      warnings.push(
        `${unrestricted.length} rule(s) have no path restrictions and will apply to all files: ${unrestricted.map(r => r.id.full).join(', ')}`
      );
    }

    // Check for rules with overly broad patterns
    const broadRules = rules.filter(
      r =>
        r.config.includePatterns.includes('**/*') &&
        r.config.excludePatterns.length === 0
    );

    if (broadRules.length > 0) {
      warnings.push(
        `${broadRules.length} rule(s) use very broad include patterns: ${broadRules.map(r => r.id.full).join(', ')}`
      );
    }

    // Check for duplicate rule names
    const nameGroups = new Map<string, Rule[]>();
    for (const rule of rules) {
      if (!nameGroups.has(rule.name)) {
        nameGroups.set(rule.name, []);
      }
      nameGroups.get(rule.name)!.push(rule);
    }

    for (const [name, rulesWithName] of nameGroups) {
      if (rulesWithName.length > 1) {
        warnings.push(
          `Multiple rules share the same name '${name}': ${rulesWithName.map(r => r.id.full).join(', ')}`
        );
      }
    }

    return warnings;
  }

  /**
   * Generate suggestions for major ID conflicts
   */
  private generateMajorIdConflictSuggestions(
    majorId: string,
    conflictingRules: Rule[]
  ): string[] {
    const suggestions: string[] = [];
    const minorIds = conflictingRules.map(r => r.id.minor);

    suggestions.push(
      `Choose one variant to keep enabled: ${minorIds.join(', ')}`
    );

    suggestions.push(
      `Move unused variants to the 'disabled' directory in your rules configuration`
    );

    // Provide specific recommendations based on rule type
    if (majorId.includes('attachment-organization')) {
      suggestions.push(
        'For attachment organization, consider: centralized (move to Meta/Attachments) vs keep-with-note (attachments stay near notes)'
      );
    } else if (majorId.includes('file-naming')) {
      suggestions.push(
        'For file naming, choose the convention that matches your vault: kebab-case, camel-case, or space-separated'
      );
    } else if (majorId.includes('frontmatter-required-fields')) {
      suggestions.push(
        'For frontmatter rules, choose: strict (all fields required), minimal (basic fields), or custom (configurable fields)'
      );
    }

    suggestions.push(
      `Example: Move .config/obsidian-lint/rules/default/enabled/${majorId}.${minorIds[1]}.toml to .config/obsidian-lint/rules/default/disabled/`
    );

    return suggestions;
  }

  /**
   * Generate suggestions for path conflicts
   */
  private generatePathConflictSuggestions(conflictingRules: Rule[]): string[] {
    return [
      'Use more specific path patterns to avoid overlap',
      'Add path denylist entries to exclude conflicting paths',
      'Consider combining rule functionality if appropriate',
      'Use different profiles for conflicting rule sets',
    ];
  }

  /**
   * Create a path key for grouping rules by their path patterns
   */
  private createPathKey(rule: Rule): string {
    const allowlist = rule.config.pathAllowlist.sort().join('|');
    const denylist = rule.config.pathDenylist.sort().join('|');
    const include = rule.config.includePatterns.sort().join('|');
    const exclude = rule.config.excludePatterns.sort().join('|');

    return `${allowlist}::${denylist}::${include}::${exclude}`;
  }

  /**
   * Find rules that might interfere with each other
   */
  private findInterferingRules(rules: Rule[]): Rule[] {
    // For now, return rules that have the same category and might conflict
    const categoryGroups = new Map<string, Rule[]>();

    for (const rule of rules) {
      if (!categoryGroups.has(rule.category)) {
        categoryGroups.set(rule.category, []);
      }
      categoryGroups.get(rule.category)!.push(rule);
    }

    const interfering: Rule[] = [];
    for (const [category, categoryRules] of categoryGroups) {
      if (
        categoryRules.length > 1 &&
        this.isCategoryPotentiallyConflicting(category)
      ) {
        interfering.push(...categoryRules);
      }
    }

    return interfering;
  }

  /**
   * Check if a category might have conflicting rules
   */
  private isCategoryPotentiallyConflicting(category: string): boolean {
    const conflictingCategories = [
      'file-organization',
      'attachment',
      'frontmatter',
      'linking',
    ];

    return conflictingCategories.includes(category);
  }

  /**
   * Find incompatible file organization rules
   */
  private findIncompatibleFileOrganizationRules(
    rules: Rule[]
  ): ConflictGroup[] {
    const conflicts: ConflictGroup[] = [];

    // Check for conflicting file naming rules
    const namingRules = rules.filter(r => r.id.major.includes('file-naming'));
    if (namingRules.length > 1) {
      conflicts.push({
        majorId: 'file-naming-conflict',
        conflictingRules: namingRules,
        conflictType: ConflictType.INCOMPATIBLE_SETTINGS,
        severity: ConflictSeverity.WARNING,
        resolution:
          'Multiple file naming conventions cannot be applied simultaneously',
        suggestions: [
          'Choose one file naming convention',
          'Use different profiles for different naming conventions',
          'Apply different naming rules to different directories using path patterns',
        ],
      });
    }

    return conflicts;
  }

  /**
   * Find incompatible attachment rules
   */
  private findIncompatibleAttachmentRules(rules: Rule[]): ConflictGroup[] {
    const conflicts: ConflictGroup[] = [];

    // Check for conflicting attachment organization rules
    const orgRules = rules.filter(r =>
      r.id.major.includes('attachment-organization')
    );
    if (orgRules.length > 1) {
      conflicts.push({
        majorId: 'attachment-organization-conflict',
        conflictingRules: orgRules,
        conflictType: ConflictType.INCOMPATIBLE_SETTINGS,
        severity: ConflictSeverity.WARNING,
        resolution:
          'Multiple attachment organization strategies cannot be used together',
        suggestions: [
          'Choose either centralized or keep-with-note organization',
          'Use path patterns to apply different strategies to different directories',
        ],
      });
    }

    return conflicts;
  }

  /**
   * Create conflict summary
   */
  private createConflictSummary(
    rules: Rule[],
    conflicts: ConflictGroup[]
  ): ConflictSummary {
    const conflictingRuleIds = new Set<string>();
    const majorIdGroups = new Set<string>();

    let criticalConflicts = 0;
    let warningConflicts = 0;

    for (const conflict of conflicts) {
      majorIdGroups.add(conflict.majorId);

      for (const rule of conflict.conflictingRules) {
        conflictingRuleIds.add(rule.id.full);
      }

      if (conflict.severity === ConflictSeverity.CRITICAL) {
        criticalConflicts++;
      } else if (conflict.severity === ConflictSeverity.WARNING) {
        warningConflicts++;
      }
    }

    return {
      totalRules: rules.length,
      conflictingRules: conflictingRuleIds.size,
      majorIdGroups: majorIdGroups.size,
      criticalConflicts,
      warningConflicts,
    };
  }

  /**
   * Generate comprehensive conflict report
   */
  generateConflictReport(result: ConflictResult): string {
    let report = '=== Rule Conflict Detection Report ===\n\n';

    // Summary
    report += `Summary:\n`;
    report += `  Total Rules: ${result.summary.totalRules}\n`;
    report += `  Conflicting Rules: ${result.summary.conflictingRules}\n`;
    report += `  Critical Conflicts: ${result.summary.criticalConflicts}\n`;
    report += `  Warning Conflicts: ${result.summary.warningConflicts}\n`;
    report += `  Status: ${result.valid ? '✅ Valid' : '❌ Invalid'}\n\n`;

    // Critical conflicts
    const criticalConflicts = result.conflicts.filter(
      c => c.severity === ConflictSeverity.CRITICAL
    );
    if (criticalConflicts.length > 0) {
      report += `🚨 Critical Conflicts (${criticalConflicts.length}):\n`;
      for (let i = 0; i < criticalConflicts.length; i++) {
        const conflict = criticalConflicts[i];
        report += `${i + 1}. ${conflict.majorId} (${conflict.conflictType})\n`;
        report += `   Resolution: ${conflict.resolution}\n`;
        report += `   Affected Rules: ${conflict.conflictingRules.map(r => r.id.full).join(', ')}\n`;

        if (conflict.suggestions.length > 0) {
          report += `   Suggestions:\n`;
          conflict.suggestions.forEach(suggestion => {
            report += `     • ${suggestion}\n`;
          });
        }
        report += '\n';
      }
    }

    // Warning conflicts
    const warningConflicts = result.conflicts.filter(
      c => c.severity === ConflictSeverity.WARNING
    );
    if (warningConflicts.length > 0) {
      report += `⚠️  Warning Conflicts (${warningConflicts.length}):\n`;
      for (let i = 0; i < warningConflicts.length; i++) {
        const conflict = warningConflicts[i];
        report += `${i + 1}. ${conflict.majorId} (${conflict.conflictType})\n`;
        report += `   Resolution: ${conflict.resolution}\n`;
        report += `   Affected Rules: ${conflict.conflictingRules.map(r => r.id.full).join(', ')}\n`;

        if (conflict.suggestions.length > 0) {
          report += `   Suggestions:\n`;
          conflict.suggestions.forEach(suggestion => {
            report += `     • ${suggestion}\n`;
          });
        }
        report += '\n';
      }
    }

    // General warnings
    if (result.warnings.length > 0) {
      report += `💡 General Warnings (${result.warnings.length}):\n`;
      result.warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning}\n`;
      });
      report += '\n';
    }

    // Resolution guide
    if (!result.valid) {
      report += `🔧 Resolution Guide:\n`;
      report += `1. Address all critical conflicts first - these prevent the system from running\n`;
      report += `2. Review warning conflicts - these may cause unexpected behavior\n`;
      report += `3. Move conflicting rule files to the 'disabled' directory\n`;
      report += `4. Re-run conflict detection to verify resolution\n`;
      report += `5. Test your configuration with a small subset of files first\n\n`;
    }

    report += '=== End Report ===\n';
    return report;
  }
}
