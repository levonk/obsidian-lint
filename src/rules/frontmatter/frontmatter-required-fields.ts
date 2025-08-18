/**
 * Frontmatter Required Fields Rule Implementation
 * Validates and fixes frontmatter fields according to different strictness levels
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';

/**
 * Valid status values for frontmatter
 */
const VALID_STATUS_VALUES = [
  'draft',
  'in-progress',
  'active',
  'on-hold',
  'archived',
] as const;
type ValidStatus = (typeof VALID_STATUS_VALUES)[number];

/**
 * Interface for frontmatter validation settings
 */
interface FrontmatterSettings {
  required_fields: string[];
  auto_fix: boolean;
  default_status: ValidStatus;
  date_format: string;
  strict_arrays?: boolean;
  custom_fields?: Record<string, any>;
}

/**
 * Base class for frontmatter required fields rules
 */
export abstract class FrontmatterRequiredFieldsRule extends BaseRule {
  protected settings: FrontmatterSettings;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'frontmatter', config);
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(settings: Record<string, any>): FrontmatterSettings {
    const defaultSettings: FrontmatterSettings = {
      required_fields: ['title'],
      auto_fix: true,
      default_status: 'draft',
      date_format: 'YYYY-MM-DD',
      strict_arrays: true,
    };

    return {
      ...defaultSettings,
      ...settings,
      required_fields: Array.isArray(settings.required_fields)
        ? settings.required_fields
        : defaultSettings.required_fields,
      auto_fix:
        typeof settings.auto_fix === 'boolean'
          ? settings.auto_fix
          : defaultSettings.auto_fix,
      default_status: VALID_STATUS_VALUES.includes(settings.default_status)
        ? settings.default_status
        : defaultSettings.default_status,
      date_format:
        typeof settings.date_format === 'string'
          ? settings.date_format
          : defaultSettings.date_format,
    };
  }

  /**
   * Lint implementation - check for frontmatter issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    // Check if frontmatter exists
    if (!file.frontmatter || Object.keys(file.frontmatter).length === 0) {
      issues.push({
        ruleId: this.id.full,
        severity: 'error',
        message: 'Missing frontmatter section',
        file: file.path,
        line: 1,
        fixable: this.settings.auto_fix,
      });
      return issues;
    }

    // Check required fields
    for (const field of this.settings.required_fields) {
      if (
        !(field in file.frontmatter) ||
        file.frontmatter[field] === null ||
        file.frontmatter[field] === undefined
      ) {
        issues.push({
          ruleId: this.id.full,
          severity: 'error',
          message: `Missing required frontmatter field: ${field}`,
          file: file.path,
          fixable: this.settings.auto_fix,
        });
      } else {
        // Validate field format
        const fieldIssues = this.validateField(
          field,
          file.frontmatter[field],
          file.path
        );
        issues.push(...fieldIssues);
      }
    }

    return issues;
  }

  /**
   * Fix implementation - add missing fields and fix format issues
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_fix) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file } = context;
    const changes: FileChange[] = [];

    // Parse current frontmatter or create new one
    let frontmatter = file.frontmatter || {};
    let needsUpdate = false;

    // Add missing required fields
    for (const field of this.settings.required_fields) {
      if (
        !(field in frontmatter) ||
        frontmatter[field] === null ||
        frontmatter[field] === undefined
      ) {
        frontmatter[field] = this.getDefaultValue(field);
        needsUpdate = true;
      } else {
        // Fix field format issues
        const fixedValue = this.fixFieldValue(field, frontmatter[field]);
        if (fixedValue !== frontmatter[field]) {
          frontmatter[field] = fixedValue;
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      // Generate new frontmatter content
      const newFrontmatterContent =
        this.generateFrontmatterContent(frontmatter);

      // Find frontmatter boundaries in original content
      const frontmatterBounds = this.findFrontmatterBounds(file.content);

      if (frontmatterBounds) {
        // Replace existing frontmatter
        changes.push({
          type: 'replace',
          line: frontmatterBounds.startLine,
          oldText: file.content.substring(
            frontmatterBounds.startIndex,
            frontmatterBounds.endIndex
          ),
          newText: newFrontmatterContent,
        });
      } else {
        // Add frontmatter at the beginning
        changes.push({
          type: 'insert',
          line: 1,
          column: 1,
          newText: newFrontmatterContent + '\n',
        });
      }

      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Fixed frontmatter required fields',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Validate a specific frontmatter field
   */
  protected validateField(
    field: string,
    value: any,
    filePath: string
  ): Issue[] {
    const issues: Issue[] = [];

    switch (field) {
      case 'title':
        if (typeof value !== 'string' || value.trim() === '') {
          issues.push({
            ruleId: this.id.full,
            severity: 'error',
            message: 'Title must be a non-empty string',
            file: filePath,
            fixable: this.settings.auto_fix,
          });
        }
        break;

      case 'aliases':
      case 'tags':
        if (!Array.isArray(value)) {
          issues.push({
            ruleId: this.id.full,
            severity: 'error',
            message: `${field} must be an array`,
            file: filePath,
            fixable: this.settings.auto_fix,
          });
        } else if (this.settings.strict_arrays) {
          // Check array elements are strings
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] !== 'string') {
              issues.push({
                ruleId: this.id.full,
                severity: 'warning',
                message: `${field}[${i}] should be a string`,
                file: filePath,
                fixable: this.settings.auto_fix,
              });
            }
          }
        }
        break;

      case 'status':
        if (!VALID_STATUS_VALUES.includes(value)) {
          issues.push({
            ruleId: this.id.full,
            severity: 'error',
            message: `Status must be one of: ${VALID_STATUS_VALUES.join(', ')}`,
            file: filePath,
            fixable: this.settings.auto_fix,
          });
        }
        break;

      case 'date_created':
      case 'date_updated':
        if (!this.isValidDate(value)) {
          issues.push({
            ruleId: this.id.full,
            severity: 'error',
            message: `${field} must be in ${this.settings.date_format} format`,
            file: filePath,
            fixable: this.settings.auto_fix,
          });
        }
        break;

      default:
        // Custom field validation can be implemented by subclasses
        break;
    }

    return issues;
  }

  /**
   * Get default value for a field
   */
  protected getDefaultValue(field: string): any {
    switch (field) {
      case 'title':
        return 'Untitled';
      case 'aliases':
      case 'tags':
        return [];
      case 'status':
        return this.settings.default_status;
      case 'date_created':
      case 'date_updated':
        return this.formatDate(new Date());
      default:
        return this.settings.custom_fields?.[field] || '';
    }
  }

  /**
   * Fix field value format
   */
  protected fixFieldValue(field: string, value: any): any {
    switch (field) {
      case 'title':
        return typeof value === 'string' ? value.trim() : String(value).trim();

      case 'aliases':
      case 'tags':
        if (!Array.isArray(value)) {
          return typeof value === 'string' ? [value] : [];
        }
        return value
          .map(item => String(item).trim())
          .filter(item => item.length > 0);

      case 'status':
        return VALID_STATUS_VALUES.includes(value)
          ? value
          : this.settings.default_status;

      case 'date_created':
      case 'date_updated':
        if (this.isValidDate(value)) {
          return value;
        }
        // Try to parse and reformat
        const date = new Date(value);
        return isNaN(date.getTime())
          ? this.formatDate(new Date())
          : this.formatDate(date);

      default:
        return value;
    }
  }

  /**
   * Check if a date string is valid according to the configured format
   */
  protected isValidDate(dateString: any): boolean {
    if (typeof dateString !== 'string') {
      return false;
    }

    // For YYYY-MM-DD format
    if (this.settings.date_format === 'YYYY-MM-DD') {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(dateString)) {
        return false;
      }

      const date = new Date(dateString);
      return !isNaN(date.getTime()) && dateString === this.formatDate(date);
    }

    return false;
  }

  /**
   * Format a date according to the configured format
   */
  protected formatDate(date: Date): string {
    if (this.settings.date_format === 'YYYY-MM-DD') {
      return date.toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0]; // Default to ISO date
  }

  /**
   * Generate frontmatter content from object
   */
  protected generateFrontmatterContent(
    frontmatter: Record<string, any>
  ): string {
    const lines = ['---'];

    // Order fields consistently
    const orderedFields = [
      'title',
      'aliases',
      'tags',
      'status',
      'date_created',
      'date_updated',
    ];
    const processedFields = new Set<string>();

    // Add ordered fields first
    for (const field of orderedFields) {
      if (field in frontmatter) {
        lines.push(this.formatFrontmatterField(field, frontmatter[field]));
        processedFields.add(field);
      }
    }

    // Add remaining fields
    for (const [field, value] of Object.entries(frontmatter)) {
      if (!processedFields.has(field)) {
        lines.push(this.formatFrontmatterField(field, value));
      }
    }

    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Format a single frontmatter field
   */
  protected formatFrontmatterField(field: string, value: any): string {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${field}: []`;
      }
      const items = value
        .map(item => `  - ${this.escapeYamlValue(item)}`)
        .join('\n');
      return `${field}:\n${items}`;
    } else {
      return `${field}: ${this.escapeYamlValue(value)}`;
    }
  }

  /**
   * Escape YAML value if needed
   */
  protected escapeYamlValue(value: any): string {
    const str = String(value);
    // Simple escaping - wrap in quotes if contains special characters
    if (
      str.includes(':') ||
      str.includes('#') ||
      str.includes('[') ||
      str.includes(']')
    ) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }

  /**
   * Find frontmatter boundaries in content
   */
  protected findFrontmatterBounds(
    content: string
  ): {
    startIndex: number;
    endIndex: number;
    startLine: number;
    endLine: number;
  } | null {
    const lines = content.split('\n');

    if (lines[0] !== '---') {
      return null;
    }

    let endLine = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        endLine = i;
        break;
      }
    }

    if (endLine === -1) {
      return null;
    }

    const startIndex = 0;
    const endIndex = lines.slice(0, endLine + 1).join('\n').length;

    return {
      startIndex,
      endIndex,
      startLine: 1,
      endLine: endLine + 1,
    };
  }
}

/**
 * Strict variant - requires all standard fields with strict validation
 */
export class FrontmatterRequiredFieldsStrictRule extends FrontmatterRequiredFieldsRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'frontmatter-required-fields',
        minor: 'strict',
        full: 'frontmatter-required-fields.strict',
      },
      'Strict Frontmatter Fields',
      'Enforce all required frontmatter fields with strict validation',
      config
    );
  }
}

/**
 * Minimal variant - requires only essential fields
 */
export class FrontmatterRequiredFieldsMinimalRule extends FrontmatterRequiredFieldsRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'frontmatter-required-fields',
        minor: 'minimal',
        full: 'frontmatter-required-fields.minimal',
      },
      'Minimal Frontmatter Fields',
      'Enforce minimal required frontmatter fields',
      config
    );
  }
}

/**
 * Custom variant - allows user-defined required fields
 */
export class FrontmatterRequiredFieldsCustomRule extends FrontmatterRequiredFieldsRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'frontmatter-required-fields',
        minor: 'custom',
        full: 'frontmatter-required-fields.custom',
      },
      'Custom Frontmatter Fields',
      'Enforce custom set of required frontmatter fields',
      config
    );
  }

  /**
   * Override field validation for custom fields
   */
  protected validateField(
    field: string,
    value: any,
    filePath: string
  ): Issue[] {
    // First try standard validation
    const standardIssues = super.validateField(field, value, filePath);
    if (standardIssues.length > 0) {
      return standardIssues;
    }

    // Custom field validation
    if (this.settings.custom_fields && field in this.settings.custom_fields) {
      const expectedType = typeof this.settings.custom_fields[field];
      const actualType = typeof value;

      if (expectedType !== actualType) {
        return [
          {
            ruleId: this.id.full,
            severity: 'warning',
            message: `Custom field ${field} should be of type ${expectedType}, got ${actualType}`,
            file: filePath,
            fixable: this.settings.auto_fix,
          },
        ];
      }
    }

    return [];
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createFrontmatterRequiredFieldsRule(
  ruleId: string,
  config: RuleConfig
): FrontmatterRequiredFieldsRule {
  switch (ruleId) {
    case 'frontmatter-required-fields.strict':
      return new FrontmatterRequiredFieldsStrictRule(config);
    case 'frontmatter-required-fields.minimal':
      return new FrontmatterRequiredFieldsMinimalRule(config);
    case 'frontmatter-required-fields.custom':
      return new FrontmatterRequiredFieldsCustomRule(config);
    default:
      throw new Error(
        `Unknown frontmatter required fields rule variant: ${ruleId}`
      );
  }
}
