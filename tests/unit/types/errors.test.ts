/**
 * Tests for Error Types and Classes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LintError,
  ConfigurationError,
  RuleError,
  FileSystemError,
  ProcessingError,
  ErrorCodes,
  ErrorContextBuilder,
  ErrorAggregator,
} from '../../../src/types/errors.js';

describe('LintError', () => {
  it('should create a basic lint error', () => {
    const error = new LintError('Test message', ErrorCodes.CONFIG_NOT_FOUND);

    expect(error.name).toBe('LintError');
    expect(error.message).toBe('Test message');
    expect(error.code).toBe(ErrorCodes.CONFIG_NOT_FOUND);
    expect(error.context).toBeUndefined();
  });

  it('should create a lint error with context', () => {
    const context = { filePath: '/test/path', ruleId: 'test-rule' };
    const error = new LintError(
      'Test message',
      ErrorCodes.RULE_EXECUTION_ERROR,
      context
    );

    expect(error.context).toEqual(context);
  });

  it('should generate detailed report', () => {
    const context = {
      filePath: '/test/path',
      originalError: new Error('Original error message'),
    };
    const error = new LintError(
      'Test message',
      ErrorCodes.FILE_READ_ERROR,
      context
    );

    const report = error.toDetailedReport();

    expect(report).toContain('LintError: Test message');
    expect(report).toContain('Code: FILE_READ_ERROR');
    expect(report).toContain('filePath: "/test/path"');
    expect(report).toContain('originalError: Original error message');
  });

  it('should convert to JSON', () => {
    const context = { filePath: '/test/path' };
    const error = new LintError(
      'Test message',
      ErrorCodes.CONFIG_VALIDATION_FAILED,
      context
    );

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'LintError',
      message: 'Test message',
      code: ErrorCodes.CONFIG_VALIDATION_FAILED,
      context,
      stack: expect.any(String),
    });
  });
});

describe('ConfigurationError', () => {
  it('should create configuration error with path', () => {
    const error = new ConfigurationError(
      'Invalid config',
      ErrorCodes.CONFIG_INVALID_TOML,
      '/config/path'
    );

    expect(error.name).toBe('ConfigurationError');
    expect(error.path).toBe('/config/path');
    expect(error.context?.path).toBe('/config/path');
  });

  it('should create configuration error with additional context', () => {
    const additionalContext = { lineNumber: 42 };
    const error = new ConfigurationError(
      'Invalid config',
      ErrorCodes.CONFIG_INVALID_TOML,
      '/config/path',
      additionalContext
    );

    expect(error.context).toEqual({
      ...additionalContext,
      path: '/config/path',
    });
  });
});

describe('RuleError', () => {
  it('should create rule error with rule ID', () => {
    const error = new RuleError(
      'Rule failed',
      ErrorCodes.RULE_EXECUTION_ERROR,
      'test-rule.variant'
    );

    expect(error.name).toBe('RuleError');
    expect(error.ruleId).toBe('test-rule.variant');
    expect(error.context?.ruleId).toBe('test-rule.variant');
  });
});

describe('FileSystemError', () => {
  it('should create file system error with file path', () => {
    const error = new FileSystemError(
      'File not found',
      ErrorCodes.FILE_NOT_FOUND,
      '/test/file.md'
    );

    expect(error.name).toBe('FileSystemError');
    expect(error.filePath).toBe('/test/file.md');
    expect(error.context?.filePath).toBe('/test/file.md');
  });
});

describe('ProcessingError', () => {
  it('should create processing error with operation', () => {
    const error = new ProcessingError(
      'Processing failed',
      ErrorCodes.BATCH_PROCESSING_ERROR,
      'batch_process'
    );

    expect(error.name).toBe('ProcessingError');
    expect(error.operation).toBe('batch_process');
    expect(error.context?.operation).toBe('batch_process');
  });
});

describe('ErrorContextBuilder', () => {
  let builder: ErrorContextBuilder;

  beforeEach(() => {
    builder = new ErrorContextBuilder();
  });

  it('should build context with file path', () => {
    const context = builder.addFile('/test/file.md').build();

    expect(context).toEqual({ filePath: '/test/file.md' });
  });

  it('should build context with rule ID', () => {
    const context = builder.addRule('test-rule.variant').build();

    expect(context).toEqual({ ruleId: 'test-rule.variant' });
  });

  it('should build context with operation', () => {
    const context = builder.addOperation('lint_file').build();

    expect(context).toEqual({ operation: 'lint_file' });
  });

  it('should build context with original error', () => {
    const originalError = new Error('Original error');
    const context = builder.addOriginalError(originalError).build();

    expect(context).toEqual({ originalError });
  });

  it('should build context with custom fields', () => {
    const context = builder
      .addCustom('customField', 'customValue')
      .addCustom('anotherField', 42)
      .build();

    expect(context).toEqual({
      customField: 'customValue',
      anotherField: 42,
    });
  });

  it('should build complex context', () => {
    const originalError = new Error('Original error');
    const context = builder
      .addFile('/test/file.md')
      .addRule('test-rule.variant')
      .addOperation('lint_file')
      .addOriginalError(originalError)
      .addCustom('lineNumber', 10)
      .build();

    expect(context).toEqual({
      filePath: '/test/file.md',
      ruleId: 'test-rule.variant',
      operation: 'lint_file',
      originalError,
      lineNumber: 10,
    });
  });
});

describe('ErrorAggregator', () => {
  let aggregator: ErrorAggregator;

  beforeEach(() => {
    aggregator = new ErrorAggregator();
  });

  it('should start empty', () => {
    expect(aggregator.hasErrors()).toBe(false);
    expect(aggregator.hasWarnings()).toBe(false);
    expect(aggregator.getErrors()).toEqual([]);
    expect(aggregator.getWarnings()).toEqual([]);
  });

  it('should add and retrieve errors', () => {
    const error1 = new LintError('Error 1', ErrorCodes.CONFIG_NOT_FOUND);
    const error2 = new LintError('Error 2', ErrorCodes.RULE_CONFLICT);

    aggregator.addError(error1);
    aggregator.addError(error2);

    expect(aggregator.hasErrors()).toBe(true);
    expect(aggregator.getErrors()).toEqual([error1, error2]);
  });

  it('should add and retrieve warnings', () => {
    aggregator.addWarning('Warning 1');
    aggregator.addWarning('Warning 2');

    expect(aggregator.hasWarnings()).toBe(true);
    expect(aggregator.getWarnings()).toEqual(['Warning 1', 'Warning 2']);
  });

  it('should clear errors and warnings', () => {
    const error = new LintError('Error', ErrorCodes.CONFIG_NOT_FOUND);
    aggregator.addError(error);
    aggregator.addWarning('Warning');

    aggregator.clear();

    expect(aggregator.hasErrors()).toBe(false);
    expect(aggregator.hasWarnings()).toBe(false);
    expect(aggregator.getErrors()).toEqual([]);
    expect(aggregator.getWarnings()).toEqual([]);
  });

  it('should create validation result', () => {
    const error = new LintError('Error', ErrorCodes.CONFIG_NOT_FOUND);
    aggregator.addError(error);
    aggregator.addWarning('Warning');

    const result = aggregator.toValidationResult();

    expect(result).toEqual({
      valid: false,
      errors: [error],
      warnings: ['Warning'],
    });
  });

  it('should create validation result for valid state', () => {
    aggregator.addWarning('Warning only');

    const result = aggregator.toValidationResult();

    expect(result).toEqual({
      valid: true,
      errors: [],
      warnings: ['Warning only'],
    });
  });

  it('should generate report', () => {
    const error1 = new ConfigurationError(
      'Config error',
      ErrorCodes.CONFIG_INVALID_TOML,
      '/config/path'
    );
    const error2 = new RuleError(
      'Rule error',
      ErrorCodes.RULE_EXECUTION_ERROR,
      'test-rule'
    );

    aggregator.addError(error1);
    aggregator.addError(error2);
    aggregator.addWarning('Warning 1');
    aggregator.addWarning('Warning 2');

    const report = aggregator.generateReport();

    expect(report).toContain('Errors (2):');
    expect(report).toContain('1. [CONFIG_INVALID_TOML] Config error');
    expect(report).toContain('File: /config/path');
    expect(report).toContain('2. [RULE_EXECUTION_ERROR] Rule error');
    expect(report).toContain('Rule: test-rule');
    expect(report).toContain('Warnings (2):');
    expect(report).toContain('1. Warning 1');
    expect(report).toContain('2. Warning 2');
  });

  it('should generate empty report', () => {
    const report = aggregator.generateReport();

    expect(report).toBe('');
  });
});

describe('ErrorCodes', () => {
  it('should have all required error codes', () => {
    // Configuration errors
    expect(ErrorCodes.CONFIG_NOT_FOUND).toBe('CONFIG_NOT_FOUND');
    expect(ErrorCodes.CONFIG_INVALID_TOML).toBe('CONFIG_INVALID_TOML');
    expect(ErrorCodes.CONFIG_VALIDATION_FAILED).toBe(
      'CONFIG_VALIDATION_FAILED'
    );

    // Rule errors
    expect(ErrorCodes.RULE_CONFLICT).toBe('RULE_CONFLICT');
    expect(ErrorCodes.RULE_EXECUTION_ERROR).toBe('RULE_EXECUTION_ERROR');

    // File system errors
    expect(ErrorCodes.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    expect(ErrorCodes.FILE_ACCESS_DENIED).toBe('FILE_ACCESS_DENIED');
    expect(ErrorCodes.FILE_READ_ERROR).toBe('FILE_READ_ERROR');
    expect(ErrorCodes.FILE_WRITE_ERROR).toBe('FILE_WRITE_ERROR');

    // Processing errors
    expect(ErrorCodes.FILE_PROCESSING_ERROR).toBe('FILE_PROCESSING_ERROR');
    expect(ErrorCodes.BATCH_PROCESSING_ERROR).toBe('BATCH_PROCESSING_ERROR');
  });
});
