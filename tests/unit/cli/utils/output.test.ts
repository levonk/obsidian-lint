/**
 * Tests for output formatting utilities
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import {
  formatOutput,
  Logger,
  printHeader,
  printSuccess,
  printWarning,
  printError,
  printInfo,
  createTable,
} from '../../../../src/cli/utils/output.js';
import { LintResult, Issue, Fix } from '../../../../src/types/index.js';

describe('formatOutput', () => {
  let mockResult: LintResult;

  beforeEach(() => {
    mockResult = {
      filesProcessed: 10,
      issuesFound: [
        {
          ruleId: 'frontmatter-required-fields.strict',
          severity: 'error',
          message: 'Missing required field: title',
          file: 'test.md',
          line: 1,
          column: 1,
          fixable: true,
        },
        {
          ruleId: 'linking-internal.strict-brackets',
          severity: 'warning',
          message: 'Invalid link format',
          file: 'another.md',
          line: 5,
          fixable: false,
        },
      ],
      fixesApplied: [
        {
          ruleId: 'frontmatter-required-fields.strict',
          file: 'test.md',
          description: 'Added missing title field',
          changes: [
            {
              type: 'insert',
              line: 1,
              content: 'title: Test Document',
            },
          ],
        },
      ],
      errors: [],
      duration: 1500,
    };
  });

  describe('JSON output', () => {
    it('should format result as JSON', () => {
      const output = formatOutput(mockResult, { json: true });
      const parsed = JSON.parse(output);

      expect(parsed.summary).toBeDefined();
      expect(parsed.summary.filesProcessed).toBe(10);
      expect(parsed.summary.issuesFound).toBe(2);
      expect(parsed.summary.fixesApplied).toBe(1);
      expect(parsed.summary.errors).toBe(0);
      expect(parsed.summary.duration).toBe(1500);
      expect(parsed.summary.timestamp).toBeDefined();
    });

    it('should include enhanced issue information in JSON', () => {
      const output = formatOutput(mockResult, { json: true });
      const parsed = JSON.parse(output);

      expect(parsed.issues).toHaveLength(2);
      expect(parsed.issues[0].location).toBe('test.md:1:1');
      expect(parsed.issues[1].location).toBe('another.md:5');
    });

    it('should include statistics in JSON output', () => {
      const output = formatOutput(mockResult, { json: true });
      const parsed = JSON.parse(output);

      expect(parsed.statistics.issuesBySeverity).toEqual({
        error: 1,
        warning: 1,
        info: 0,
      });

      expect(parsed.statistics.issuesByRule).toEqual({
        'frontmatter-required-fields.strict': 1,
        'linking-internal.strict-brackets': 1,
      });

      expect(parsed.statistics.fixesByRule).toEqual({
        'frontmatter-required-fields.strict': 1,
      });
    });
  });

  describe('Human-readable output', () => {
    it('should format result for human reading', () => {
      const output = formatOutput(mockResult);

      expect(output).toContain('LINT RESULTS');
      expect(output).toContain('Files processed:');
      expect(output).toContain('10');
      expect(output).toContain('Issues found:');
      expect(output).toContain('2');
      expect(output).toContain('Fixes applied:');
      expect(output).toContain('1');
      expect(output).toContain('Duration:');
    });

    it('should show dry run mode in header', () => {
      const output = formatOutput(mockResult, { dryRun: true });

      expect(output).toContain('LINT DRY RUN');
    });

    it('should group issues by file', () => {
      const output = formatOutput(mockResult);

      expect(output).toContain('test.md:');
      expect(output).toContain('another.md:');
      expect(output).toContain('Missing required field: title');
      expect(output).toContain('Invalid link format');
    });

    it('should show fixes in verbose mode', () => {
      const output = formatOutput(mockResult, { verbose: true });

      expect(output).toContain('FIXES APPLIED');
      expect(output).toContain('Added missing title field');
    });

    it('should handle no issues found', () => {
      const cleanResult: LintResult = {
        ...mockResult,
        issuesFound: [],
        fixesApplied: [],
      };

      const output = formatOutput(cleanResult);

      expect(output).toContain('No issues found!');
    });

    it('should handle errors', () => {
      const errorResult: LintResult = {
        ...mockResult,
        errors: [new Error('Test error')],
      };

      const output = formatOutput(errorResult);

      expect(output).toContain('ERRORS');
      expect(output).toContain('Test error');
      expect(output).toContain('Completed with errors');
    });
  });
});

describe('Logger', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('basic logging', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger(false, false);
    });

    it('should log messages with correct prefixes', () => {
      logger.info('Test info');
      logger.warn('Test warn');
      logger.error('Test error');
      logger.success('Test success');

      expect(consoleSpy).toHaveBeenCalledTimes(4);

      const calls = consoleSpy.mock.calls.map((call: any) => call[0]);
      expect(calls[0]).toContain('INFO');
      expect(calls[0]).toContain('Test info');
      expect(calls[1]).toContain('WARN');
      expect(calls[1]).toContain('Test warn');
      expect(calls[2]).toContain('ERROR');
      expect(calls[2]).toContain('Test error');
      expect(calls[3]).toContain('SUCCESS');
      expect(calls[3]).toContain('Test success');
    });

    it('should not log debug messages in non-verbose mode', () => {
      logger.debug('Test debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('verbose mode', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger(true, false);
    });

    it('should log debug messages in verbose mode', () => {
      logger.debug('Test debug message');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain('DEBUG');
      expect(call).toContain('Test debug message');
    });

    it('should include timestamps in verbose mode', () => {
      logger.info('Test message');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(call).toContain('INFO');
      expect(call).toContain('Test message');
    });

    it('should log details in verbose mode', () => {
      const details = { key: 'value', number: 42 };
      logger.info('Test message', details);

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      const firstCall = consoleSpy.mock.calls[0][0];
      expect(firstCall).toContain('INFO');
      expect(firstCall).toContain('Test message');

      const secondCall = consoleSpy.mock.calls[1];
      expect(secondCall[0]).toContain('Details:');
      expect(secondCall[1]).toEqual(details);
    });
  });

  describe('JSON mode', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger(false, true);
    });

    it('should output JSON format', () => {
      logger.info('Test message', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
      expect(parsed.details).toEqual({ key: 'value' });
      expect(parsed.timestamp).toBeDefined();
    });
  });
});

describe('utility functions', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should print formatted messages', () => {
    printHeader('test header');
    printSuccess('Operation completed');
    printWarning('Warning message');
    printError('Error occurred');
    printInfo('Information');

    expect(consoleSpy).toHaveBeenCalledTimes(5);

    const calls = consoleSpy.mock.calls.map((call: any) => call[0]);
    expect(calls[0]).toContain('=== TEST HEADER ===');
    expect(calls[1]).toContain('✓ Operation completed');
    expect(calls[2]).toContain('⚠ Warning message');
    expect(calls[3]).toContain('✗ Error occurred');
    expect(calls[4]).toContain('ℹ Information');
  });
});

describe('createTable', () => {
  it('should create formatted table', () => {
    const headers = ['Name', 'Status', 'Count'];
    const rows = [
      ['Rule 1', 'Enabled', '5'],
      ['Rule 2', 'Disabled', '0'],
      ['Very Long Rule Name', 'Enabled', '123'],
    ];

    const table = createTable(headers, rows);

    expect(table).toContain('Name');
    expect(table).toContain('Status');
    expect(table).toContain('Count');
    expect(table).toContain('Rule 1');
    expect(table).toContain('Very Long Rule Name');
    expect(table).toContain('│');
    expect(table).toContain('─');
  });

  it('should handle empty rows', () => {
    const headers = ['Col1', 'Col2'];
    const rows = [
      ['Value1', ''],
      ['', 'Value2'],
    ];

    const table = createTable(headers, rows);

    expect(table).toContain('Col1');
    expect(table).toContain('Col2');
    expect(table).toContain('Value1');
    expect(table).toContain('Value2');
  });
});
