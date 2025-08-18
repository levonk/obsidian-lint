/**
 * Progress bar utilities for CLI
 */

import cliProgress from 'cli-progress';
import chalk from 'chalk';

export interface ProgressBarOptions {
  total?: number;
  format?: string;
  hideCursor?: boolean;
  clearOnComplete?: boolean;
  stopOnComplete?: boolean;
  showETA?: boolean;
  showPercentage?: boolean;
  showOperation?: boolean;
}

export interface ProgressUpdate {
  current: number;
  operation?: string;
  details?: string;
}

export class ProgressBar {
  private bar: cliProgress.SingleBar;
  private startTime: number = 0;
  private current: number = 0;
  private total: number = 0;
  private currentOperation: string = '';
  private options: ProgressBarOptions;

  constructor(options: ProgressBarOptions = {}) {
    this.options = {
      showETA: true,
      showPercentage: true,
      showOperation: true,
      ...options,
    };

    const formatParts: string[] = [];

    // Progress bar
    formatParts.push(chalk.blue('{bar}'));

    // Percentage
    if (this.options.showPercentage) {
      formatParts.push('{percentage}%');
    }

    // Current/Total
    formatParts.push('{value}/{total} files');

    // ETA
    if (this.options.showETA) {
      formatParts.push(chalk.gray('ETA: {eta_formatted}'));
    }

    // Current operation
    if (this.options.showOperation) {
      formatParts.push(chalk.cyan('{operation}'));
    }

    const defaultFormat = formatParts.join(' | ');

    this.bar = new cliProgress.SingleBar(
      {
        format: options.format || defaultFormat,
        hideCursor: options.hideCursor ?? true,
        clearOnComplete: options.clearOnComplete ?? false,
        stopOnComplete: options.stopOnComplete ?? true,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        barsize: 30,
        etaBuffer: 10, // Use last 10 updates for ETA calculation
      },
      cliProgress.Presets.shades_classic
    );
  }

  start(total: number, initialValue: number = 0): void {
    this.total = total;
    this.current = initialValue;
    this.startTime = Date.now();
    this.currentOperation = 'Starting...';

    this.bar.start(total, initialValue, {
      operation: this.currentOperation,
      eta_formatted: this.formatETA(0),
    });
  }

  update(update: ProgressUpdate | number, operation?: string): void {
    if (typeof update === 'number') {
      // Legacy support for simple number updates
      this.current = update;
      if (operation) {
        this.currentOperation = this.truncateOperation(operation);
      }
    } else {
      this.current = update.current;
      if (update.operation) {
        this.currentOperation = this.truncateOperation(update.operation);
      }
    }

    const eta = this.calculateETA();
    const payload: any = {
      operation: this.currentOperation,
      eta_formatted: this.formatETA(eta),
    };

    this.bar.update(this.current, payload);
  }

  increment(operation?: string): void {
    this.update(this.current + 1, operation);
  }

  setOperation(operation: string): void {
    this.currentOperation = this.truncateOperation(operation);
    const eta = this.calculateETA();

    this.bar.update(this.current, {
      operation: this.currentOperation,
      eta_formatted: this.formatETA(eta),
    });
  }

  stop(): void {
    this.bar.stop();
  }

  finish(message?: string): void {
    this.bar.update(this.total, {
      operation: 'Complete',
      eta_formatted: this.formatETA(0),
    });
    this.bar.stop();

    if (message) {
      console.log(chalk.green(`✓ ${message}`));
    }
  }

  getElapsedTime(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime;
  }

  getPercentage(): number {
    if (this.total === 0) return 0;
    return Math.round((this.current / this.total) * 100);
  }

  getCurrentOperation(): string {
    return this.currentOperation;
  }

  private calculateETA(): number {
    if (this.current === 0 || this.current >= this.total) return 0;

    const elapsed = this.getElapsedTime();
    const rate = this.current / elapsed;
    const remaining = this.total - this.current;

    return Math.round(remaining / rate);
  }

  private formatETA(etaMs: number): string {
    if (etaMs === 0) return '0s';

    const seconds = Math.floor(etaMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  private truncateOperation(operation: string): string {
    const maxLength = 50;
    return operation.length > maxLength
      ? operation.substring(0, maxLength - 3) + '...'
      : operation;
  }
}

export function createProgressBar(options?: ProgressBarOptions): ProgressBar {
  return new ProgressBar(options);
}

export function formatTime(ms: number): string {
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
