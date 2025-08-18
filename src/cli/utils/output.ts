/**
 * Output formatting utilities for CLI
 */

import chalk from 'chalk';
import { LintResult, Issue, Fix } from '../../types/index.js';

export interface OutputOptions {
  json?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface LogLevel {
  level: 'debug' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
  timestamp?: Date;
}

export class Logger {
  private verbose: boolean;
  private json: boolean;

  constructor(verbose: boolean = false, json: boolean = false) {
    this.verbose = verbose;
    this.json = json;
  }

  debug(message: string, details?: any): void {
    if (!this.verbose) return;
    this.log({ level: 'debug', message, details, timestamp: new Date() });
  }

  info(message: string, details?: any): void {
    this.log({ level: 'info', message, details, timestamp: new Date() });
  }

  warn(message: string, details?: any): void {
    this.log({ level: 'warn', message, details, timestamp: new Date() });
  }

  error(message: string, details?: any): void {
    this.log({ level: 'error', message, details, timestamp: new Date() });
  }

  success(message: string, details?: any): void {
    this.log({ level: 'success', message, details, timestamp: new Date() });
  }

  private log(logEntry: LogLevel): void {
    if (this.json) {
      console.log(JSON.stringify(logEntry));
      return;
    }

    const timestamp =
      this.verbose && logEntry.timestamp
        ? chalk.gray(`[${logEntry.timestamp.toISOString()}] `)
        : '';

    const prefix = this.getColoredPrefix(logEntry.level);
    const message = `${timestamp}${prefix} ${logEntry.message}`;

    console.log(message);

    if (this.verbose && logEntry.details) {
      console.log(chalk.gray('  Details:'), logEntry.details);
    }
  }

  private getColoredPrefix(level: LogLevel['level']): string {
    switch (level) {
      case 'debug':
        return chalk.gray('DEBUG');
      case 'info':
        return chalk.blue('INFO');
      case 'warn':
        return chalk.yellow('WARN');
      case 'error':
        return chalk.red('ERROR');
      case 'success':
        return chalk.green('SUCCESS');
      default:
        return chalk.white('LOG');
    }
  }
}

export function formatOutput(
  result: LintResult,
  options: OutputOptions = {}
): string {
  if (options.json) {
    return formatJsonOutput(result);
  }

  return formatHumanOutput(result, options);
}

function formatJsonOutput(result: LintResult): string {
  // Enhanced JSON output with additional metadata
  const jsonOutput = {
    summary: {
      filesProcessed: result.filesProcessed,
      issuesFound: result.issuesFound.length,
      fixesApplied: result.fixesApplied.length,
      errors: result.errors.length,
      duration: result.duration,
      durationFormatted: formatDuration(result.duration),
      timestamp: new Date().toISOString(),
    },
    issues: result.issuesFound.map(issue => ({
      ...issue,
      severity: issue.severity,
      location:
        issue.line !== undefined
          ? `${issue.file}:${issue.line}${issue.column !== undefined ? `:${issue.column}` : ''}`
          : issue.file,
    })),
    fixes: result.fixesApplied.map(fix => ({
      ...fix,
      changesCount: fix.changes.length,
    })),
    errors: result.errors.map(error => ({
      message: error.message,
      name: error.name,
      stack: error.stack,
    })),
    statistics: {
      issuesBySeverity: getIssuesBySeverity(result.issuesFound),
      issuesByRule: getIssuesByRule(result.issuesFound),
      fixesByRule: getFixesByRule(result.fixesApplied),
    },
  };

  return JSON.stringify(jsonOutput, null, 2);
}

function getIssuesBySeverity(issues: Issue[]): Record<string, number> {
  const counts: Record<string, number> = { error: 0, warning: 0, info: 0 };

  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1;
  }

  return counts;
}

function getIssuesByRule(issues: Issue[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const issue of issues) {
    counts[issue.ruleId] = (counts[issue.ruleId] || 0) + 1;
  }

  return counts;
}

function getFixesByRule(fixes: Fix[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const fix of fixes) {
    counts[fix.ruleId] = (counts[fix.ruleId] || 0) + 1;
  }

  return counts;
}

function formatHumanOutput(result: LintResult, options: OutputOptions): string {
  const lines: string[] = [];

  // Summary header
  const mode = options.dryRun ? 'DRY RUN' : 'RESULTS';
  lines.push(chalk.bold.blue(`\n=== LINT ${mode} ===`));

  // Basic stats
  lines.push(
    `Files processed: ${chalk.bold(result.filesProcessed.toString())}`
  );
  lines.push(
    `Issues found: ${chalk.bold(result.issuesFound.length.toString())}`
  );

  if (result.fixesApplied.length > 0) {
    lines.push(
      `Fixes applied: ${chalk.bold.green(result.fixesApplied.length.toString())}`
    );
  }

  if (result.errors.length > 0) {
    lines.push(`Errors: ${chalk.bold.red(result.errors.length.toString())}`);
  }

  lines.push(`Duration: ${chalk.gray(formatDuration(result.duration))}`);

  // Issues section
  if (result.issuesFound.length > 0) {
    lines.push(chalk.bold('\n=== ISSUES ==='));

    // Group issues by file
    const issuesByFile = groupIssuesByFile(result.issuesFound);

    for (const [file, issues] of issuesByFile) {
      lines.push(chalk.bold.underline(`\n${file}:`));

      for (const issue of issues) {
        lines.push(formatIssue(issue, options.verbose));
      }
    }
  }

  // Fixes section (if any were applied)
  if (result.fixesApplied.length > 0 && options.verbose) {
    lines.push(chalk.bold('\n=== FIXES APPLIED ==='));

    const fixesByFile = groupFixesByFile(result.fixesApplied);

    for (const [file, fixes] of fixesByFile) {
      lines.push(chalk.bold.underline(`\n${file}:`));

      for (const fix of fixes) {
        lines.push(formatFix(fix));
      }
    }
  }

  // Errors section
  if (result.errors.length > 0) {
    lines.push(chalk.bold.red('\n=== ERRORS ==='));

    for (const error of result.errors) {
      lines.push(chalk.red(`  ✗ ${error.message}`));
      if (options.verbose && error.stack) {
        lines.push(chalk.gray(`    ${error.stack}`));
      }
    }
  }

  // Final summary
  lines.push('');
  if (result.issuesFound.length === 0 && result.errors.length === 0) {
    lines.push(chalk.green('✓ No issues found!'));
  } else if (result.errors.length > 0) {
    lines.push(chalk.red('✗ Completed with errors'));
  } else {
    const message = options.dryRun
      ? `Found ${result.issuesFound.length} issues (dry run mode)`
      : `Found ${result.issuesFound.length} issues`;
    lines.push(chalk.yellow(`⚠ ${message}`));
  }

  return lines.join('\n');
}

function formatIssue(issue: Issue, verbose?: boolean): string {
  const severity = formatSeverity(issue.severity);
  const location =
    issue.line !== undefined
      ? chalk.gray(
          `:${issue.line}${issue.column !== undefined ? `:${issue.column}` : ''}`
        )
      : '';

  const fixable = issue.fixable ? chalk.green(' [fixable]') : '';
  const rule = verbose ? chalk.gray(` (${issue.ruleId})`) : '';

  return `  ${severity} ${issue.message}${location}${fixable}${rule}`;
}

function formatFix(fix: Fix): string {
  const changes =
    fix.changes.length > 1
      ? chalk.gray(` (${fix.changes.length} changes)`)
      : '';

  return `  ${chalk.green('✓')} ${fix.description}${changes} ${chalk.gray(`(${fix.ruleId})`)}`;
}

function formatSeverity(severity: Issue['severity']): string {
  switch (severity) {
    case 'error':
      return chalk.red('✗');
    case 'warning':
      return chalk.yellow('⚠');
    case 'info':
      return chalk.blue('ℹ');
    default:
      return chalk.gray('•');
  }
}

function groupIssuesByFile(issues: Issue[]): Map<string, Issue[]> {
  const grouped = new Map<string, Issue[]>();

  for (const issue of issues) {
    if (!grouped.has(issue.file)) {
      grouped.set(issue.file, []);
    }
    grouped.get(issue.file)!.push(issue);
  }

  // Sort files alphabetically
  return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function groupFixesByFile(fixes: Fix[]): Map<string, Fix[]> {
  const grouped = new Map<string, Fix[]>();

  for (const fix of fixes) {
    if (!grouped.has(fix.file)) {
      grouped.set(fix.file, []);
    }
    grouped.get(fix.file)!.push(fix);
  }

  // Sort files alphabetically
  return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Additional utility functions for colorized output
export function printHeader(text: string): void {
  console.log(chalk.bold.blue(`\n=== ${text.toUpperCase()} ===`));
}

export function printSuccess(text: string): void {
  console.log(chalk.green(`✓ ${text}`));
}

export function printWarning(text: string): void {
  console.log(chalk.yellow(`⚠ ${text}`));
}

export function printError(text: string): void {
  console.log(chalk.red(`✗ ${text}`));
}

export function printInfo(text: string): void {
  console.log(chalk.blue(`ℹ ${text}`));
}

export function printVerbose(text: string, details?: any): void {
  console.log(chalk.gray(`  ${text}`));
  if (details) {
    console.log(chalk.gray(`    ${JSON.stringify(details, null, 2)}`));
  }
}

export function createTable(headers: string[], rows: string[][]): string {
  const columnWidths = headers.map((header, index) => {
    const maxRowWidth = Math.max(...rows.map(row => (row[index] || '').length));
    return Math.max(header.length, maxRowWidth);
  });

  const separator = '─'.repeat(
    columnWidths.reduce((sum, width) => sum + width + 3, -1)
  );

  const headerRow = headers
    .map((header, index) => header.padEnd(columnWidths[index]))
    .join(' │ ');

  const dataRows = rows.map(row =>
    row
      .map((cell, index) => (cell || '').padEnd(columnWidths[index]))
      .join(' │ ')
  );

  return [headerRow, separator, ...dataRows].join('\n');
}
