/**
 * Tests for progress bar utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  ProgressBar,
  createProgressBar,
  formatTime,
} from '../../../../src/cli/utils/progress.js';

describe('ProgressBar', () => {
  let progressBar: ProgressBar;

  beforeEach(() => {
    progressBar = new ProgressBar();
  });

  afterEach(() => {
    progressBar.stop();
  });

  describe('constructor', () => {
    it('should create progress bar with default options', () => {
      const bar = new ProgressBar();
      expect(bar).toBeInstanceOf(ProgressBar);
    });

    it('should create progress bar with custom options', () => {
      const options = {
        showETA: false,
        showPercentage: false,
        showOperation: false,
      };

      const bar = new ProgressBar(options);
      expect(bar).toBeInstanceOf(ProgressBar);
    });
  });

  describe('getPercentage', () => {
    it('should return 0 for empty progress bar', () => {
      expect(progressBar.getPercentage()).toBe(0);
    });

    it('should calculate percentage correctly', () => {
      progressBar.start(100);
      progressBar.update(25);

      expect(progressBar.getPercentage()).toBe(25);
    });

    it('should handle zero total', () => {
      progressBar.start(0);

      expect(progressBar.getPercentage()).toBe(0);
    });
  });

  describe('getCurrentOperation', () => {
    it('should return current operation', () => {
      progressBar.start(100);
      progressBar.update(50, 'Testing operation');

      expect(progressBar.getCurrentOperation()).toBe('Testing operation');
    });

    it('should return default operation initially', () => {
      progressBar.start(100);

      expect(progressBar.getCurrentOperation()).toBe('Starting...');
    });
  });

  describe('getElapsedTime', () => {
    it('should return elapsed time since start', async () => {
      progressBar.start(100);

      // Wait a small amount of time
      await new Promise(resolve => setTimeout(resolve, 10));

      const elapsed = progressBar.getElapsedTime();
      expect(elapsed).toBeGreaterThan(0);
    });

    it('should return 0 before start', () => {
      const elapsed = progressBar.getElapsedTime();
      expect(elapsed).toBe(0);
    });
  });

  describe('update operations', () => {
    beforeEach(() => {
      progressBar.start(100);
    });

    it('should handle numeric updates', () => {
      progressBar.update(50);
      expect(progressBar.getPercentage()).toBe(50);
    });

    it('should handle object updates', () => {
      progressBar.update({
        current: 75,
        operation: 'Analyzing rules...',
        details: 'Rule validation',
      });

      expect(progressBar.getPercentage()).toBe(75);
      expect(progressBar.getCurrentOperation()).toBe('Analyzing rules...');
    });

    it('should increment correctly', () => {
      progressBar.increment();
      expect(progressBar.getPercentage()).toBe(1);

      progressBar.increment('Processing file.md');
      expect(progressBar.getPercentage()).toBe(2);
      expect(progressBar.getCurrentOperation()).toBe('Processing file.md');
    });

    it('should set operation without changing progress', () => {
      const initialPercentage = progressBar.getPercentage();
      progressBar.setOperation('Loading configuration...');

      expect(progressBar.getPercentage()).toBe(initialPercentage);
      expect(progressBar.getCurrentOperation()).toBe(
        'Loading configuration...'
      );
    });

    it('should truncate long operation names', () => {
      const longOperation = 'A'.repeat(60);
      progressBar.update(50, longOperation);

      expect(progressBar.getCurrentOperation()).toBe('A'.repeat(47) + '...');
    });
  });
});

describe('createProgressBar', () => {
  it('should create a new ProgressBar instance', () => {
    const bar = createProgressBar();
    expect(bar).toBeInstanceOf(ProgressBar);
    bar.stop();
  });

  it('should create progress bar with options', () => {
    const options = { showETA: false };
    const bar = createProgressBar(options);
    expect(bar).toBeInstanceOf(ProgressBar);
    bar.stop();
  });
});

describe('formatTime', () => {
  it('should format milliseconds', () => {
    expect(formatTime(500)).toBe('500ms');
    expect(formatTime(999)).toBe('999ms');
  });

  it('should format seconds', () => {
    expect(formatTime(1000)).toBe('1s');
    expect(formatTime(30000)).toBe('30s');
    expect(formatTime(59000)).toBe('59s');
  });

  it('should format minutes and seconds', () => {
    expect(formatTime(60000)).toBe('1m 0s');
    expect(formatTime(90000)).toBe('1m 30s');
    expect(formatTime(150000)).toBe('2m 30s');
  });
});
