#!/usr/bin/env bun

/**
 * Demo script showing progress bar and user feedback system
 */

import {
  ProgressBar,
  createProgressBar,
  formatTime,
} from '../src/cli/utils/progress.js';
import {
  Logger,
  printHeader,
  printSuccess,
  printWarning,
  printError,
  printInfo,
} from '../src/cli/utils/output.js';

async function demoProgressBar() {
  printHeader('Progress Bar Demo');

  const progressBar = createProgressBar({
    showETA: true,
    showPercentage: true,
    showOperation: true,
  });

  const totalFiles = 50;
  progressBar.start(totalFiles);

  // Simulate file processing
  for (let i = 0; i < totalFiles; i++) {
    const fileName = `file-${i + 1}.md`;
    progressBar.update(i + 1, `Processing ${fileName}`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  progressBar.finish('All files processed successfully!');

  console.log(`\nElapsed time: ${formatTime(progressBar.getElapsedTime())}`);
  console.log(`Final percentage: ${progressBar.getPercentage()}%`);
}

async function demoLogger() {
  printHeader('Logger Demo');

  // Regular logger
  console.log('\n--- Regular Mode ---');
  const logger = new Logger(false, false);

  logger.info('Starting lint operation');
  logger.warn('Found deprecated configuration option');
  logger.error('Failed to parse file: invalid.md');
  logger.success('Linting completed successfully');
  logger.debug('This debug message will not appear');

  // Verbose logger
  console.log('\n--- Verbose Mode ---');
  const verboseLogger = new Logger(true, false);

  verboseLogger.info('Loading configuration', {
    configFile: 'obsidian-lint.toml',
  });
  verboseLogger.debug('Rule discovery started', {
    rulesPath: './config/rules',
  });
  verboseLogger.warn('Rule conflict detected', {
    conflictingRules: ['rule-a.strict', 'rule-a.minimal'],
  });

  // JSON logger
  console.log('\n--- JSON Mode ---');
  const jsonLogger = new Logger(false, true);

  jsonLogger.info('Processing complete', {
    filesProcessed: 42,
    issuesFound: 3,
    fixesApplied: 1,
  });
}

function demoUtilityFunctions() {
  printHeader('Utility Functions Demo');

  printInfo('This is an informational message');
  printSuccess('Operation completed successfully');
  printWarning('This is a warning message');
  printError('This is an error message');
}

async function main() {
  console.log('🚀 Obsidian Lint - Progress Bar and User Feedback Demo\n');

  await demoProgressBar();
  console.log('\n' + '='.repeat(60) + '\n');

  await demoLogger();
  console.log('\n' + '='.repeat(60) + '\n');

  demoUtilityFunctions();

  console.log('\n✨ Demo completed!');
}

if (import.meta.main) {
  main().catch(console.error);
}
