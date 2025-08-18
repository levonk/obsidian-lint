/**
 * File Naming Rules Implementation
 * Validates and fixes file naming conventions
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';
import path from 'path';

/**
 * Interface for file naming settings
 */
interface FileNamingSettings {
  allow_numbers: boolean;
  allow_underscores: boolean;
  max_length: number;
  update_links: boolean;
  preserve_extension: boolean;
  case_sensitive: boolean;
}

/**
 * Base class for file naming rules
 */
export abstract class FileNamingRule extends BaseRule {
  protected settings: FileNamingSettings;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'file-naming', config);
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(settings: Record<string, any>): FileNamingSettings {
    const defaultSettings: FileNamingSettings = {
      allow_numbers: true,
      allow_underscores: false,
      max_length: 100,
      update_links: true,
      preserve_extension: true,
      case_sensitive: false,
    };

    return {
      ...defaultSettings,
      ...settings,
      allow_numbers:
        typeof settings['allow_numbers'] === 'boolean'
          ? settings['allow_numbers']
          : defaultSettings.allow_numbers,
      allow_underscores:
        typeof settings['allow_underscores'] === 'boolean'
          ? settings['allow_underscores']
          : defaultSettings.allow_underscores,
      max_length:
        typeof settings['max_length'] === 'number' && settings['max_length'] > 0
          ? settings['max_length']
          : defaultSettings.max_length,
      update_links:
        typeof settings['update_links'] === 'boolean'
          ? settings['update_links']
          : defaultSettings.update_links,
      preserve_extension:
        typeof settings['preserve_extension'] === 'boolean'
          ? settings['preserve_extension']
          : defaultSettings.preserve_extension,
      case_sensitive:
        typeof settings['case_sensitive'] === 'boolean'
          ? settings['case_sensitive']
          : defaultSettings.case_sensitive,
    };
  }

  /**
   * Lint implementation - check file naming convention
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    const fileName = path.basename(file.path, path.extname(file.path));
    const validationResult = this.validateFileName(fileName);

    if (!validationResult.isValid) {
      issues.push({
        ruleId: this.id.full,
        severity: 'error',
        message: validationResult.message,
        file: file.path,
        fixable: true,
      });
    }

    // Check file name length
    if (fileName.length > this.settings.max_length) {
      issues.push({
        ruleId: this.id.full,
        severity: 'warning',
        message: `File name exceeds maximum length of ${this.settings.max_length} characters`,
        file: file.path,
        fixable: true,
      });
    }

    return issues;
  }

  /**
   * Fix implementation - rename file according to convention
   */
  override async fix(
    context: RuleExecutionContext,
    issues: Issue[]
  ): Promise<Fix[]> {
    const fixes: Fix[] = [];
    const { file } = context;

    if (issues.length === 0) {
      return fixes;
    }

    const currentFileName = path.basename(file.path, path.extname(file.path));
    const extension = path.extname(file.path);
    const directory = path.dirname(file.path);

    const newFileName = this.fixFileName(currentFileName);

    if (newFileName !== currentFileName) {
      const newPath = path.join(directory, newFileName + extension);

      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: file.path,
          newPath: newPath,
        },
      ];

      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: `Rename file from "${currentFileName}" to "${newFileName}"`,
        changes,
      });
    }

    return fixes;
  }

  /**
   * Abstract method to validate file name according to specific convention
   */
  protected abstract validateFileName(fileName: string): {
    isValid: boolean;
    message: string;
  };

  /**
   * Abstract method to fix file name according to specific convention
   */
  protected abstract fixFileName(fileName: string): string;

  /**
   * Common validation helpers
   */
  protected hasValidCharacters(
    fileName: string,
    allowedPattern: RegExp
  ): boolean {
    return allowedPattern.test(fileName);
  }

  protected removeInvalidCharacters(
    fileName: string,
    allowedPattern: RegExp
  ): string {
    return fileName.replace(
      new RegExp(`[^${allowedPattern.source.slice(1, -1)}]`, 'g'),
      ''
    );
  }

  protected truncateFileName(fileName: string): string {
    if (fileName.length <= this.settings.max_length) {
      return fileName;
    }
    return fileName.substring(0, this.settings.max_length).replace(/-+$/, '');
  }
}

/**
 * Kebab Case File Naming Rule
 */
export class FileNamingKebabCaseRule extends FileNamingRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'file-naming',
        minor: 'kebab-case',
        full: 'file-naming.kebab-case',
      },
      'Kebab Case File Naming',
      'Enforce kebab-case naming convention for all markdown files',
      config
    );
  }

  protected validateFileName(fileName: string): {
    isValid: boolean;
    message: string;
  } {
    const pattern = this.getKebabCasePattern();

    if (!pattern.test(fileName)) {
      return {
        isValid: false,
        message: `File name "${fileName}" does not follow kebab-case convention (lowercase letters, numbers, and hyphens only)`,
      };
    }

    return { isValid: true, message: '' };
  }

  protected fixFileName(fileName: string): string {
    let fixed = fileName
      .toLowerCase()
      .replace(/[^a-z0-9\-_\s]/g, '') // Remove invalid characters
      .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    if (!this.settings.allow_numbers) {
      fixed = fixed.replace(/[0-9]/g, '');
    }

    if (!this.settings.allow_underscores) {
      fixed = fixed.replace(/_/g, '-');
    }

    return this.truncateFileName(fixed);
  }

  private getKebabCasePattern(): RegExp {
    let pattern = 'a-z';

    if (this.settings.allow_numbers) {
      pattern += '0-9';
    }

    pattern += '\\-';

    if (this.settings.allow_underscores) {
      pattern += '_';
    }

    return new RegExp(`^[${pattern}]+$`);
  }
}

/**
 * Camel Case File Naming Rule
 */
export class FileNamingCamelCaseRule extends FileNamingRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'file-naming',
        minor: 'camel-case',
        full: 'file-naming.camel-case',
      },
      'Camel Case File Naming',
      'Enforce camelCase naming convention for all markdown files',
      config
    );
  }

  protected validateFileName(fileName: string): {
    isValid: boolean;
    message: string;
  } {
    const pattern = this.getCamelCasePattern();

    if (!pattern.test(fileName)) {
      return {
        isValid: false,
        message: `File name "${fileName}" does not follow camelCase convention`,
      };
    }

    return { isValid: true, message: '' };
  }

  protected fixFileName(fileName: string): string {
    let fixed = fileName
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove invalid characters
      .replace(/[\s\-_]+(.)/g, (_, char) => char.toUpperCase()) // Convert to camelCase
      .replace(/^[A-Z]/, char => char.toLowerCase()); // Ensure first letter is lowercase

    if (!this.settings.allow_numbers) {
      fixed = fixed.replace(/[0-9]/g, '');
    }

    return this.truncateFileName(fixed);
  }

  private getCamelCasePattern(): RegExp {
    let pattern = 'a-zA-Z';

    if (this.settings.allow_numbers) {
      pattern += '0-9';
    }

    return new RegExp(`^[${pattern}]+$`);
  }
}

/**
 * Space Separated File Naming Rule
 */
export class FileNamingSpaceSeparatedRule extends FileNamingRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'file-naming',
        minor: 'space-separated',
        full: 'file-naming.space-separated',
      },
      'Space Separated File Naming',
      'Enforce space-separated naming convention for all markdown files',
      config
    );
  }

  protected validateFileName(fileName: string): {
    isValid: boolean;
    message: string;
  } {
    const pattern = this.getSpaceSeparatedPattern();

    if (!pattern.test(fileName)) {
      return {
        isValid: false,
        message: `File name "${fileName}" does not follow space-separated convention`,
      };
    }

    return { isValid: true, message: '' };
  }

  protected fixFileName(fileName: string): string {
    let fixed = fileName
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove invalid characters
      .replace(/[\-_]+/g, ' ') // Replace hyphens and underscores with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim(); // Remove leading/trailing spaces

    if (!this.settings.allow_numbers) {
      fixed = fixed.replace(/[0-9]/g, '');
    }

    return this.truncateFileName(fixed);
  }

  private getSpaceSeparatedPattern(): RegExp {
    let pattern = 'a-zA-Z';

    if (this.settings.allow_numbers) {
      pattern += '0-9';
    }

    pattern += '\\s';

    return new RegExp(`^[${pattern}]+$`);
  }
}

/**
 * Mixed Case File Naming Rule
 */
export class FileNamingMixedCaseRule extends FileNamingRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'file-naming',
        minor: 'mixed-case',
        full: 'file-naming.mixed-case',
      },
      'Mixed Case File Naming',
      'Allow mixed case naming with flexible conventions',
      config
    );
  }

  protected validateFileName(fileName: string): {
    isValid: boolean;
    message: string;
  } {
    const pattern = this.getMixedCasePattern();

    if (!pattern.test(fileName)) {
      return {
        isValid: false,
        message: `File name "${fileName}" contains invalid characters`,
      };
    }

    return { isValid: true, message: '' };
  }

  protected fixFileName(fileName: string): string {
    let fixed = fileName
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/_+/g, '_') // Collapse multiple underscores
      .trim(); // Remove leading/trailing spaces

    if (!this.settings.allow_numbers) {
      fixed = fixed.replace(/[0-9]/g, '');
    }

    if (!this.settings.allow_underscores) {
      fixed = fixed.replace(/_/g, ' ');
    }

    return this.truncateFileName(fixed);
  }

  private getMixedCasePattern(): RegExp {
    let pattern = 'a-zA-Z';

    if (this.settings.allow_numbers) {
      pattern += '0-9';
    }

    // Always allow spaces and hyphens for mixed case
    pattern += '\\s\\-';

    if (this.settings.allow_underscores) {
      pattern += '_';
    }

    return new RegExp(`^[${pattern}]+$`);
  }
}

/**
 * Factory function to create file naming rule instances
 */
export function createFileNamingRule(
  ruleId: string,
  config: RuleConfig
): FileNamingRule {
  switch (ruleId) {
    case 'file-naming.kebab-case':
      return new FileNamingKebabCaseRule(config);
    case 'file-naming.camel-case':
      return new FileNamingCamelCaseRule(config);
    case 'file-naming.space-separated':
      return new FileNamingSpaceSeparatedRule(config);
    case 'file-naming.mixed-case':
      return new FileNamingMixedCaseRule(config);
    default:
      throw new Error(`Unknown file naming rule variant: ${ruleId}`);
  }
}
