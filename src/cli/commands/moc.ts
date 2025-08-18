/**
 * MOC (Map of Content) generation command implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LintEngine } from '../../core/engine.js';
import type { MocGeneratorSettings } from '../../core/moc-generator.js';
import { createProgressBar } from '../utils/progress.js';

export function createMocCommand(): Command {
  const command = new Command('moc');

  command
    .description('Generate Maps of Content (MOCs) for vault structure')
    .argument('[vault-path]', 'Path to Obsidian vault', process.cwd())
    .option(
      '-d, --dry-run',
      'Show what would be created without making changes',
      false
    )
    .option('--moc-dir <directory>', 'Directory for MOC files', 'MOCs')
    .option('--moc-suffix <suffix>', 'Suffix for MOC file names', ' MOC')
    .option('--template <path>', 'Path to MOC template file')
    .option(
      '--parallel-structure',
      'Create parallel MOC directory structure',
      false
    )
    .option('--parallel-path <path>', 'Path for parallel structure', 'MOCs')
    .option(
      '--min-files <number>',
      'Minimum files required for MOC creation',
      '2'
    )
    .option(
      '--link-format <format>',
      'Link format: wikilink or markdown',
      'wikilink'
    )
    .option('--no-bidirectional', 'Disable bidirectional linking')
    .option('--no-sort', 'Disable link sorting')
    .option('--group-by-type', 'Group links by file type', false)
    .option(
      '--no-preserve-manual',
      "Don't preserve manual content when updating"
    )
    .option(
      '--exclude <directories...>',
      'Directories to exclude from MOC generation'
    )
    .option(
      '--analyze-only',
      'Only analyze structure without generating MOCs',
      false
    )
    .action(async (vaultPath: string, options: any, command: Command) => {
      try {
        const globalOptions = command.parent?.opts() || {};

        if (globalOptions.verbose) {
          console.log(chalk.blue('Running MOC generation with options:'));
          console.log(
            chalk.gray(
              JSON.stringify(
                { vaultPath, ...options, ...globalOptions },
                null,
                2
              )
            )
          );
        }

        const engine = new LintEngine();

        // Parse MOC generator settings
        const mocSettings: Partial<MocGeneratorSettings> = {
          mocDirectory: options.mocDir,
          mocSuffix: options.mocSuffix,
          templatePath: options.template,
          parallelStructure: options.parallelStructure,
          parallelStructurePath: options.parallelPath,
          minFilesForMoc: parseInt(options.minFiles, 10),
          linkFormat: options.linkFormat as 'wikilink' | 'markdown',
          bidirectionalLinking: options.bidirectional !== false,
          sortLinks: options.sort !== false,
          groupByType: options.groupByType,
          preserveManualContent: options.preserveManual !== false,
          autoCreateMocs: !options.dryRun && !options.analyzeOnly,
        };

        if (options.exclude) {
          mocSettings.excludeDirectories = [
            ...(mocSettings.excludeDirectories || []),
            ...options.exclude,
          ];
        }

        if (options.analyzeOnly) {
          // Only analyze directory structure
          console.log(
            chalk.blue('Analyzing vault structure for MOC opportunities...')
          );

          const analysis = await engine.analyzeMocStructure(
            vaultPath,
            mocSettings
          );

          if (globalOptions.json) {
            console.log(JSON.stringify(analysis, null, 2));
            return;
          }

          // Display analysis results
          displayAnalysisResults(analysis, globalOptions.verbose);
          return;
        }

        // Show progress bar if not in JSON mode
        let progressBar: any = null;
        if (!globalOptions.json) {
          progressBar = createProgressBar();
          console.log(chalk.blue('Generating MOCs for vault structure...'));
        }

        // Generate MOCs
        const result = await engine.generateMocs(
          vaultPath,
          mocSettings,
          progressBar
            ? (current, total, message) => {
                progressBar.update(current / total, { message });
              }
            : undefined
        );

        // Hide progress bar
        if (progressBar) {
          progressBar.stop();
        }

        // Display results
        if (globalOptions.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          displayMocResults(result, options.dryRun, globalOptions.verbose);
        }

        // Exit with appropriate code
        if (result.issues.length > 0) {
          const errorIssues = result.issues.filter(
            issue => issue.severity === 'error'
          );
          if (errorIssues.length > 0) {
            process.exit(1);
          }
        }
      } catch (error) {
        console.error(
          chalk.red('MOC generation failed:'),
          error instanceof Error ? error.message : String(error)
        );

        if (globalOptions.verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray(error.stack));
        }

        process.exit(1);
      }
    });

  return command;
}

function displayAnalysisResults(analysis: any, verbose: boolean): void {
  console.log(chalk.blue('\n=== VAULT STRUCTURE ANALYSIS ==='));

  const stats = analyzeStructureStats(analysis);

  console.log(`Total directories: ${chalk.bold(stats.totalDirectories)}`);
  console.log(
    `Directories needing MOCs: ${chalk.bold(stats.directoriesNeedingMocs)}`
  );
  console.log(`Existing MOCs found: ${chalk.bold(stats.existingMocs)}`);
  console.log(`MOCs to create: ${chalk.bold(stats.mocsToCreate)}`);
  console.log(`MOCs to update: ${chalk.bold(stats.mocsToUpdate)}`);

  if (verbose) {
    console.log(chalk.blue('\n=== DIRECTORY DETAILS ==='));
    displayDirectoryDetails(analysis, 0);
  }

  console.log(chalk.green('\n✓ Analysis complete'));
}

function displayMocResults(
  result: any,
  dryRun: boolean,
  verbose: boolean
): void {
  const mode = dryRun ? 'DRY RUN' : 'RESULTS';
  console.log(chalk.blue(`\n=== MOC GENERATION ${mode} ===`));

  console.log(`MOCs created: ${chalk.bold.green(result.created.length)}`);
  console.log(`MOCs updated: ${chalk.bold.yellow(result.updated.length)}`);
  console.log(`Issues found: ${chalk.bold(result.issues.length)}`);
  console.log(`Fixes applied: ${chalk.bold(result.fixes.length)}`);

  if (result.created.length > 0) {
    console.log(chalk.green('\nCreated MOCs:'));
    for (const mocPath of result.created) {
      console.log(`  ${chalk.green('+')} ${mocPath}`);
    }
  }

  if (result.updated.length > 0) {
    console.log(chalk.yellow('\nUpdated MOCs:'));
    for (const mocPath of result.updated) {
      console.log(`  ${chalk.yellow('~')} ${mocPath}`);
    }
  }

  if (result.issues.length > 0) {
    console.log(chalk.red('\nIssues:'));
    for (const issue of result.issues) {
      const severityColor =
        issue.severity === 'error'
          ? chalk.red
          : issue.severity === 'warning'
            ? chalk.yellow
            : chalk.blue;
      console.log(
        `  ${severityColor(issue.severity.toUpperCase())}: ${issue.message}`
      );
      if (verbose && issue.file) {
        console.log(`    File: ${chalk.gray(issue.file)}`);
      }
    }
  }

  if (verbose && result.fixes.length > 0) {
    console.log(chalk.blue('\nFixes applied:'));
    for (const fix of result.fixes) {
      console.log(`  ${chalk.blue('→')} ${fix.description}`);
      console.log(`    File: ${chalk.gray(fix.file)}`);
    }
  }

  const statusMessage =
    result.issues.filter((i: any) => i.severity === 'error').length > 0
      ? chalk.red('✗ MOC generation completed with errors')
      : result.issues.length > 0
        ? chalk.yellow('⚠ MOC generation completed with warnings')
        : chalk.green('✓ MOC generation completed successfully');

  console.log(`\n${statusMessage}`);
}

function analyzeStructureStats(analysis: any): {
  totalDirectories: number;
  directoriesNeedingMocs: number;
  existingMocs: number;
  mocsToCreate: number;
  mocsToUpdate: number;
} {
  let totalDirectories = 0;
  let directoriesNeedingMocs = 0;
  let existingMocs = 0;
  let mocsToCreate = 0;
  let mocsToUpdate = 0;

  function traverse(dir: any): void {
    totalDirectories++;

    if (dir.shouldHaveMoc) {
      directoriesNeedingMocs++;

      if (dir.existingMocPath) {
        existingMocs++;
        mocsToUpdate++;
      } else {
        mocsToCreate++;
      }
    }

    for (const subdir of dir.subdirectories || []) {
      traverse(subdir);
    }
  }

  traverse(analysis);

  return {
    totalDirectories,
    directoriesNeedingMocs,
    existingMocs,
    mocsToCreate,
    mocsToUpdate,
  };
}

function displayDirectoryDetails(dir: any, depth: number): void {
  const indent = '  '.repeat(depth);
  const dirName = dir.relativePath || 'Root';

  if (dir.shouldHaveMoc) {
    const status = dir.existingMocPath
      ? chalk.yellow('UPDATE')
      : chalk.green('CREATE');

    console.log(
      `${indent}${chalk.bold(dirName)} (${dir.files.length} files) - ${status} MOC`
    );

    if (dir.existingMocPath) {
      console.log(`${indent}  Existing: ${chalk.gray(dir.existingMocPath)}`);
    }
    console.log(`${indent}  Target: ${chalk.gray(dir.mocPath)}`);
  } else if (dir.files.length > 0) {
    console.log(
      `${indent}${chalk.gray(dirName)} (${dir.files.length} files) - No MOC needed`
    );
  }

  for (const subdir of dir.subdirectories || []) {
    displayDirectoryDetails(subdir, depth + 1);
  }
}
