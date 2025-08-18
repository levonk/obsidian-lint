/**
 * Error Type Definitions and Classes
 * Comprehensive error handling system for the Obsidian Lint Tool
 */

/**
 * Base error class for all lint-related errors
 */
export class LintError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'LintError';

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LintError);
    }
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

    if (this.stack) {
      report += `Stack Trace:\n${this.stack}\n`;
    }

    return report;
  }

  /**
   * Convert error to JSON for serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error codes for different categories of errors
 */
export enum ErrorCodes {
  // Configuration Errors
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID_TOML = 'CONFIG_INVALID_TOML',
  CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED',
  CONFIG_MISSING_REQUIRED_FIELD = 'CONFIG_MISSING_REQUIRED_FIELD',
  CONFIG_INVALID_FIELD_TYPE = 'CONFIG_INVALID_FIELD_TYPE',
  CONFIG_INVALID_PROFILE = 'CONFIG_INVALID_PROFILE',
  CONFIG_PROFILE_NOT_FOUND = 'CONFIG_PROFILE_NOT_FOUND',
  CONFIG_RULES_PATH_NOT_FOUND = 'CONFIG_RULES_PATH_NOT_FOUND',

  // Rule System Errors
  RULE_LOAD_ERROR = 'RULE_LOAD_ERROR',
  RULE_INVALID_FORMAT = 'RULE_INVALID_FORMAT',
  RULE_INVALID_ID = 'RULE_INVALID_ID',
  RULE_MISSING_REQUIRED_FIELD = 'RULE_MISSING_REQUIRED_FIELD',
  RULE_CONFLICT = 'RULE_CONFLICT',
  RULE_EXECUTION_ERROR = 'RULE_EXECUTION_ERROR',
  RULE_FIX_ERROR = 'RULE_FIX_ERROR',
  RULE_VALIDATION_ERROR = 'RULE_VALIDATION_ERROR',

  // File System Errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_MOVE_ERROR = 'FILE_MOVE_ERROR',
  FILE_BACKUP_ERROR = 'FILE_BACKUP_ERROR',
  FILE_INVALID_MARKDOWN = 'FILE_INVALID_MARKDOWN',
  FILE_PARSING_ERROR = 'FILE_PARSING_ERROR',

  // Processing Errors
  VAULT_SCAN_ERROR = 'VAULT_SCAN_ERROR',
  FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
  BATCH_PROCESSING_ERROR = 'BATCH_PROCESSING_ERROR',
  PARALLEL_PROCESSING_ERROR = 'PARALLEL_PROCESSING_ERROR',
  FIX_APPLICATION_ERROR = 'FIX_APPLICATION_ERROR',

  // Engine Errors
  ENGINE_INITIALIZATION_ERROR = 'ENGINE_INITIALIZATION_ERROR',
  ENGINE_CONFIGURATION_ERROR = 'ENGINE_CONFIGURATION_ERROR',
  ENGINE_VALIDATION_ERROR = 'ENGINE_VALIDATION_ERROR',

  // MOC Generation Errors
  MOC_GENERATION_ERROR = 'MOC_GENERATION_ERROR',
  MOC_TEMPLATE_ERROR = 'MOC_TEMPLATE_ERROR',
  MOC_STRUCTURE_ERROR = 'MOC_STRUCTURE_ERROR',

  // Plugin Errors (for Obsidian integration)
  PLUGIN_API_ERROR = 'PLUGIN_API_ERROR',
  PLUGIN_INITIALIZATION_ERROR = 'PLUGIN_INITIALIZATION_ERROR',
  PLUGIN_SETTINGS_ERROR = 'PLUGIN_SETTINGS_ERROR',

  // Network/External Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  EXTERNAL_LINK_VALIDATION_ERROR = 'EXTERNAL_LINK_VALIDATION_ERROR',

  // Memory/Performance Errors
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  PERFORMANCE_THRESHOLD_EXCEEDED = 'PERFORMANCE_THRESHOLD_EXCEEDED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

/**
 * Configuration-specific error class
 */
export class ConfigurationError extends LintError {
  constructor(
    message: string,
    code: string,
    public path?: string,
    context?: Record<string, any>
  ) {
    super(message, code, { ...context, path });
    this.name = 'ConfigurationError';
  }
}

/**
 * Rule-specific error class
 */
export class RuleError extends LintError {
  constructor(
    message: string,
    code: string,
    public ruleId?: string,
    context?: Record<string, any>
  ) {
    super(message, code, { ...context, ruleId });
    this.name = 'RuleError';
  }
}

/**
 * File system error class
 */
export class FileSystemError extends LintError {
  constructor(
    message: string,
    code: string,
    public filePath?: string,
    context?: Record<string, any>
  ) {
    super(message, code, { ...context, filePath });
    this.name = 'FileSystemError';
  }
}

/**
 * Processing error class
 */
export class ProcessingError extends LintError {
  constructor(
    message: string,
    code: string,
    public operation?: string,
    context?: Record<string, any>
  ) {
    super(message, code, { ...context, operation });
    this.name = 'ProcessingError';
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: LintError[];
  warnings: string[];
}

/**
 * Error recovery options
 */
export interface ErrorRecoveryOptions {
  retryCount?: number;
  retryDelay?: number;
  fallbackAction?: () => Promise<void> | void;
  skipOnError?: boolean;
  continueOnError?: boolean;
}

/**
 * Error context builder for consistent error reporting
 */
export class ErrorContextBuilder {
  private context: Record<string, any> = {};

  addFile(filePath: string): this {
    this.context.filePath = filePath;
    return this;
  }

  addRule(ruleId: string): this {
    this.context.ruleId = ruleId;
    return this;
  }

  addOperation(operation: string): this {
    this.context.operation = operation;
    return this;
  }

  addOriginalError(error: Error): this {
    this.context.originalError = error;
    return this;
  }

  addCustom(key: string, value: any): this {
    this.context[key] = value;
    return this;
  }

  build(): Record<string, any> {
    return { ...this.context };
  }
}

/**
 * Error aggregator for collecting multiple errors
 */
export class ErrorAggregator {
  private errors: LintError[] = [];
  private warnings: string[] = [];

  addError(error: LintError): void {
    this.errors.push(error);
  }

  addWarning(warning: string): void {
    this.warnings.push(warning);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  getErrors(): LintError[] {
    return [...this.errors];
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  clear(): void {
    this.errors = [];
    this.warnings = [];
  }

  toValidationResult(): ValidationResult {
    return {
      valid: !this.hasErrors(),
      errors: this.getErrors(),
      warnings: this.getWarnings(),
    };
  }

  generateReport(): string {
    let report = '';

    if (this.hasErrors()) {
      report += `Errors (${this.errors.length}):\n`;
      this.errors.forEach((error, index) => {
        report += `${index + 1}. [${error.code}] ${error.message}\n`;
        if (error.context?.filePath) {
          report += `   File: ${error.context.filePath}\n`;
        }
        if (error.context?.ruleId) {
          report += `   Rule: ${error.context.ruleId}\n`;
        }
      });
      report += '\n';
    }

    if (this.hasWarnings()) {
      report += `Warnings (${this.warnings.length}):\n`;
      this.warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning}\n`;
      });
    }

    return report;
  }
}
