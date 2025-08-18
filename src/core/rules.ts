/**
 * Rule System
 * Handles rule discovery, loading, validation, and conflict detection
 */

import * as TOML from '@iarna/toml';
import { glob } from 'glob';
import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import type {
  Rule,
  RuleId,
  RuleConfig,
  RuleDefinition,
  RuleLoader as IRuleLoader,
  RuleExecutor as IRuleExecutor,
} from '../types/rules.js';
import { RuleExecutor } from './rule-executor.js';
import { createFrontmatterRequiredFieldsRule } from '../rules/frontmatter/frontmatter-required-fields.js';
import { createFileOrganizationRule } from '../rules/file-organization/index.js';

export interface ConflictResult {
  valid: boolean;
  conflicts: ConflictGroup[];
  warnings: string[];
}

export interface ConflictGroup {
  majorId: string;
  conflictingRules: Rule[];
  resolution: string;
}

export class RuleLoader implements IRuleLoader {
  /**
   * Load all rules from the specified rules path
   */
  async loadRules(rulesPath: string): Promise<Rule[]> {
    const enabledPath = join(rulesPath, 'enabled');

    if (!existsSync(enabledPath)) {
      throw new Error(`Rules enabled directory not found: ${enabledPath}`);
    }

    // Use glob to find all .toml files recursively
    const pattern = join(enabledPath, '**/*.toml').replace(/\\/g, '/');
    const ruleFiles = await glob(pattern);

    const rules: Rule[] = [];
    const loadPromises = ruleFiles.map(async filePath => {
      try {
        const rule = await this.loadRuleFromFile(filePath);
        return rule;
      } catch (error) {
        throw new Error(
          `Failed to load rule from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const loadedRules = await Promise.all(loadPromises);
    rules.push(...loadedRules);

    // Validate rules and check for conflicts
    const conflictResult = this.detectRuleConflicts(rules);
    if (!conflictResult.valid) {
      const conflictMessages = conflictResult.conflicts.map(
        conflict =>
          `Major ID '${conflict.majorId}' has conflicts: ${conflict.resolution}`
      );
      throw new Error(
        `Rule conflicts detected:\n${conflictMessages.join('\n')}`
      );
    }

    return rules;
  }

  /**
   * Load a single rule from a TOML file
   */
  async loadRuleFromFile(filePath: string): Promise<Rule> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const ruleDefinition = TOML.parse(content) as RuleDefinition;

      // Validate the rule definition structure
      this.validateRuleDefinition(ruleDefinition, filePath);

      // Parse rule ID
      const ruleId = this.parseRuleId(ruleDefinition.rule.id);

      // Transform config from snake_case to camelCase and clean TOML arrays
      const config: RuleConfig = {
        pathAllowlist:
          this.cleanTomlArray(ruleDefinition.config.path_allowlist) || [],
        pathDenylist:
          this.cleanTomlArray(ruleDefinition.config.path_denylist) || [],
        includePatterns: this.cleanTomlArray(
          ruleDefinition.config.include_patterns
        ) || ['**/*'],
        excludePatterns: this.cleanTomlArray(
          ruleDefinition.config.exclude_patterns
        ) || ['.*'],
        settings: this.cleanTomlObject(ruleDefinition.settings) || {},
      };

      // Create the rule object with actual implementation
      const rule = this.createRuleInstance(ruleId.full, ruleDefinition, config);

      return rule;
    } catch (error) {
      throw new Error(
        `Failed to parse rule file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a rule instance based on rule ID
   */
  private createRuleInstance(
    ruleId: string,
    ruleDefinition: RuleDefinition,
    config: RuleConfig
  ): Rule {
    // Handle frontmatter rules
    if (ruleId.startsWith('frontmatter-required-fields.')) {
      return createFrontmatterRequiredFieldsRule(ruleId, config);
    }

    // Handle file organization rules
    if (
      ruleId.startsWith('file-naming.') ||
      ruleId.startsWith('file-path-organization.') ||
      ruleId.startsWith('duplicate-file-detection.')
    ) {
      return createFileOrganizationRule(ruleId, config);
    }

    // Fallback to placeholder implementation for unknown rules
    return {
      id: this.parseRuleId(ruleId),
      name: ruleDefinition.rule.name,
      description: ruleDefinition.rule.description,
      category: ruleDefinition.rule.category,
      config,
      lint: async () => {
        console.warn(
          `Rule ${ruleId} has no implementation - returning empty results`
        );
        return [];
      },
      fix: async () => {
        console.warn(
          `Rule ${ruleId} has no fix implementation - returning empty results`
        );
        return [];
      },
    };
  }

  /**
   * Validate a rule definition from TOML
   */
  private validateRuleDefinition(ruleDefinition: any, filePath: string): void {
    const errors: string[] = [];

    // Check required top-level sections
    if (!ruleDefinition.rule) {
      errors.push('Missing required [rule] section');
    } else {
      // Validate rule section fields
      if (!ruleDefinition.rule.id) {
        errors.push('Missing required field: rule.id');
      } else if (typeof ruleDefinition.rule.id !== 'string') {
        errors.push('Field rule.id must be a string');
      }

      if (!ruleDefinition.rule.name) {
        errors.push('Missing required field: rule.name');
      } else if (typeof ruleDefinition.rule.name !== 'string') {
        errors.push('Field rule.name must be a string');
      }

      if (!ruleDefinition.rule.description) {
        errors.push('Missing required field: rule.description');
      } else if (typeof ruleDefinition.rule.description !== 'string') {
        errors.push('Field rule.description must be a string');
      }

      if (!ruleDefinition.rule.category) {
        errors.push('Missing required field: rule.category');
      } else if (typeof ruleDefinition.rule.category !== 'string') {
        errors.push('Field rule.category must be a string');
      }
    }

    if (!ruleDefinition.config) {
      errors.push('Missing required [config] section');
    } else {
      // Validate config section arrays
      const arrayFields = [
        'path_allowlist',
        'path_denylist',
        'include_patterns',
        'exclude_patterns',
      ];

      for (const field of arrayFields) {
        if (
          ruleDefinition.config[field] &&
          !Array.isArray(ruleDefinition.config[field])
        ) {
          errors.push(`Field config.${field} must be an array`);
        }
      }
    }

    // Validate rule ID format
    if (ruleDefinition.rule?.id) {
      try {
        this.parseRuleId(ruleDefinition.rule.id);
      } catch (error) {
        errors.push(
          `Invalid rule ID format: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Rule validation failed for ${filePath}:\n${errors.join('\n')}`
      );
    }
  }

  /**
   * Parse a rule ID string into RuleId object
   */
  private parseRuleId(idString: string): RuleId {
    if (!idString || typeof idString !== 'string') {
      throw new Error('Rule ID must be a non-empty string');
    }

    const parts = idString.split('.');
    if (parts.length !== 2) {
      throw new Error(
        `Rule ID must be in format 'major.minor', got: ${idString}`
      );
    }

    const [major, minor] = parts;

    if (!major || !minor) {
      throw new Error(`Rule ID parts cannot be empty, got: ${idString}`);
    }

    // Validate format - should be kebab-case
    const kebabCaseRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    if (!kebabCaseRegex.test(major)) {
      throw new Error(`Rule ID major part must be kebab-case, got: ${major}`);
    }

    if (!kebabCaseRegex.test(minor)) {
      throw new Error(`Rule ID minor part must be kebab-case, got: ${minor}`);
    }

    return {
      major,
      minor,
      full: idString,
    };
  }

  /**
   * Validate a rule object
   */
  validateRule(rule: Rule): boolean {
    try {
      // Check required fields
      if (!rule.id || !rule.name || !rule.description || !rule.category) {
        return false;
      }

      // Validate rule ID
      if (!rule.id.major || !rule.id.minor || !rule.id.full) {
        return false;
      }

      if (rule.id.full !== `${rule.id.major}.${rule.id.minor}`) {
        return false;
      }

      // Validate config
      if (!rule.config) {
        return false;
      }

      // Check that arrays are actually arrays
      const arrayFields: (keyof RuleConfig)[] = [
        'pathAllowlist',
        'pathDenylist',
        'includePatterns',
        'excludePatterns',
      ];

      for (const field of arrayFields) {
        if (!Array.isArray(rule.config[field])) {
          return false;
        }
      }

      // Check that lint function exists
      if (typeof rule.lint !== 'function') {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean TOML array by removing metadata symbols and converting to plain array
   */
  private cleanTomlArray(tomlArray: any): string[] {
    if (!Array.isArray(tomlArray)) {
      return [];
    }

    // Convert to plain array and ensure all elements are strings
    return tomlArray.map(item => String(item));
  }

  /**
   * Clean TOML object by removing metadata symbols recursively
   */
  private cleanTomlObject(tomlObject: any): Record<string, any> {
    if (!tomlObject || typeof tomlObject !== 'object') {
      return {};
    }

    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(tomlObject)) {
      // Skip symbol properties
      if (typeof key === 'symbol') {
        continue;
      }

      if (Array.isArray(value)) {
        cleaned[key] = this.cleanTomlArray(value);
      } else if (value && typeof value === 'object') {
        cleaned[key] = this.cleanTomlObject(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Detect conflicts between rules with comprehensive analysis
   */
  detectRuleConflicts(rules: Rule[]): ConflictResult {
    const conflicts: ConflictGroup[] = [];
    const warnings: string[] = [];
    const majorIdGroups = new Map<string, Rule[]>();

    // Group rules by major ID
    for (const rule of rules) {
      const majorId = rule.id.major;
      if (!majorIdGroups.has(majorId)) {
        majorIdGroups.set(majorId, []);
      }
      majorIdGroups.get(majorId)!.push(rule);
    }

    // Check for conflicts (multiple rules with same major ID)
    for (const [majorId, rulesInGroup] of majorIdGroups) {
      if (rulesInGroup.length > 1) {
        const conflictingVariants = rulesInGroup.map(r => r.id.minor);
        const resolution = this.generateConflictResolution(
          majorId,
          conflictingVariants
        );

        conflicts.push({
          majorId,
          conflictingRules: rulesInGroup,
          resolution,
        });
      }
    }

    // Add warnings for potential issues
    this.detectPotentialIssues(rules, warnings);

    return {
      valid: conflicts.length === 0,
      conflicts,
      warnings,
    };
  }

  /**
   * Generate detailed conflict resolution suggestions
   */
  private generateConflictResolution(
    majorId: string,
    variants: string[]
  ): string {
    const variantList = variants.join(', ');
    let resolution = `Multiple variants of '${majorId}' are enabled: ${variantList}. `;

    // Provide specific guidance based on rule type
    switch (majorId) {
      case 'frontmatter-required-fields':
        resolution += `Choose one variant:
        - 'strict': Enforces all required fields with validation
        - 'minimal': Only requires basic fields (title, date_created)
        - 'custom': Uses custom field requirements from settings

        Recommendation: Use 'strict' for comprehensive organization, 'minimal' for simple setups.`;
        break;

      case 'attachment-organization':
        resolution += `Choose one variant:
        - 'centralized': Moves all attachments to Meta/Attachments
        - 'keep-with-note': Keeps attachments near their referencing notes
        - 'by-type': Organizes attachments by file type

        Recommendation: Use 'centralized' for clean organization, 'keep-with-note' for contextual access.`;
        break;

      case 'file-naming':
        resolution += `Choose one variant:
        - 'kebab-case': Uses kebab-case-naming
        - 'camel-case': Uses camelCaseNaming
        - 'space-separated': Uses space separated naming
        - 'mixed-case': Allows Mixed Case Naming

        Recommendation: Use 'kebab-case' for consistency with web standards.`;
        break;

      case 'tag-from-folders':
        resolution += `Choose one variant:
        - 'hierarchical': Creates nested tags from folder structure
        - 'flat': Creates flat tags from folder names
        - 'custom': Uses custom tag generation rules

        Recommendation: Use 'hierarchical' for complex structures, 'flat' for simple organization.`;
        break;

      default:
        resolution += `Only one variant per major rule ID is allowed. `;
        resolution += `To resolve: Move unwanted variants from 'enabled/' to 'disabled/' directory, `;
        resolution += `or remove them entirely. Keep only the variant that matches your workflow.`;
    }

    resolution += `\n\nTo fix: Move unwanted .toml files from rules/[profile]/enabled/${majorId}/ to rules/[profile]/disabled/${majorId}/`;

    return resolution;
  }

  /**
   * Detect potential issues and generate warnings
   */
  private detectPotentialIssues(rules: Rule[], warnings: string[]): void {
    const rulesByCategory = new Map<string, Rule[]>();
    const pathPatterns = new Set<string>();

    // Group rules by category and collect path patterns
    for (const rule of rules) {
      // Group by category
      if (!rulesByCategory.has(rule.category)) {
        rulesByCategory.set(rule.category, []);
      }
      rulesByCategory.get(rule.category)!.push(rule);

      // Check path restrictions
      if (
        rule.config.pathAllowlist.length === 0 &&
        rule.config.pathDenylist.length === 0 &&
        rule.config.includePatterns.length === 1 &&
        rule.config.includePatterns[0] === '**/*'
      ) {
        warnings.push(
          `Rule ${rule.id.full} has no path restrictions and will apply to all files. Consider adding path filters for better performance.`
        );
      }

      // Check for overly broad include patterns
      if (
        rule.config.includePatterns.includes('**/*') &&
        rule.config.excludePatterns.length === 0
      ) {
        warnings.push(
          `Rule ${rule.id.full} uses very broad include pattern '**/*' with no exclusions. This may impact performance on large vaults.`
        );
      }

      // Collect unique path patterns
      rule.config.pathAllowlist.forEach(pattern => pathPatterns.add(pattern));
      rule.config.includePatterns.forEach(pattern => pathPatterns.add(pattern));
    }

    // Check for missing essential rule categories
    const essentialCategories = ['frontmatter', 'file-organization', 'linking'];
    for (const category of essentialCategories) {
      if (!rulesByCategory.has(category)) {
        warnings.push(
          `No rules found for essential category '${category}'. Consider adding rules for comprehensive vault organization.`
        );
      }
    }

    // Check for potentially conflicting path patterns
    const conflictingPatterns = this.findConflictingPathPatterns(
      Array.from(pathPatterns)
    );
    for (const conflict of conflictingPatterns) {
      warnings.push(
        `Potentially conflicting path patterns detected: '${conflict.pattern1}' and '${conflict.pattern2}'. This may cause unexpected rule application.`
      );
    }

    // Check for rules with identical configurations
    this.detectDuplicateConfigurations(rules, warnings);
  }

  /**
   * Find potentially conflicting path patterns
   */
  private findConflictingPathPatterns(
    patterns: string[]
  ): Array<{ pattern1: string; pattern2: string }> {
    const conflicts: Array<{ pattern1: string; pattern2: string }> = [];

    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const pattern1 = patterns[i];
        const pattern2 = patterns[j];

        // Check for overlapping patterns (simplified check)
        if (this.patternsOverlap(pattern1, pattern2)) {
          conflicts.push({ pattern1, pattern2 });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two glob patterns overlap (simplified implementation)
   */
  private patternsOverlap(pattern1: string, pattern2: string): boolean {
    // Very basic overlap detection - can be enhanced
    if (pattern1 === pattern2) return false; // Same pattern is not a conflict

    // Check if one pattern is a subset of another
    if (pattern1.includes('**') && pattern2.includes('**')) {
      const base1 = pattern1.replace('**/*', '');
      const base2 = pattern2.replace('**/*', '');
      return base1.includes(base2) || base2.includes(base1);
    }

    return false;
  }

  /**
   * Detect rules with identical configurations that might be redundant
   */
  private detectDuplicateConfigurations(
    rules: Rule[],
    warnings: string[]
  ): void {
    const configHashes = new Map<string, Rule[]>();

    for (const rule of rules) {
      // Create a hash of the configuration (excluding rule-specific settings)
      const configKey = JSON.stringify({
        pathAllowlist: rule.config.pathAllowlist.sort(),
        pathDenylist: rule.config.pathDenylist.sort(),
        includePatterns: rule.config.includePatterns.sort(),
        excludePatterns: rule.config.excludePatterns.sort(),
      });

      if (!configHashes.has(configKey)) {
        configHashes.set(configKey, []);
      }
      configHashes.get(configKey)!.push(rule);
    }

    // Report rules with identical path configurations
    for (const [configKey, rulesWithSameConfig] of configHashes) {
      if (rulesWithSameConfig.length > 1) {
        const ruleIds = rulesWithSameConfig.map(r => r.id.full).join(', ');
        warnings.push(
          `Rules with identical path configurations detected: ${ruleIds}. Consider consolidating or differentiating their path filters.`
        );
      }
    }
  }
}

export class RuleEngine {
  private ruleLoader: RuleLoader;
  private ruleExecutor: RuleExecutor;

  constructor() {
    this.ruleLoader = new RuleLoader();
    this.ruleExecutor = new RuleExecutor();
  }

  /**
   * Load rules for a specific profile
   */
  async loadRulesForProfile(rulesPath: string): Promise<Rule[]> {
    return this.ruleLoader.loadRules(rulesPath);
  }

  /**
   * Get the rule loader instance
   */
  getRuleLoader(): RuleLoader {
    return this.ruleLoader;
  }

  /**
   * Get the rule executor instance
   */
  getRuleExecutor(): RuleExecutor {
    return this.ruleExecutor;
  }

  /**
   * Validate rule conflicts
   */
  validateRuleConflicts(rules: Rule[]): ConflictResult {
    return this.ruleLoader.detectRuleConflicts(rules);
  }
}
