/**
 * Lint command implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LintEngine } from '../../core/engine.js';
import { ProcessOptions } from '../../types/index.js';
import { createProgressBar } from '../utils/progress.js';
import { formatOutput } from '../utils/output.js';

export function createLintCommand(): Command {
  const command = new Command('lint');

  command
    .description('Run linting on vault (default command)')
    .argument('[vault-path]', 'Path to Obsidian vault', process.cwd())
    .option('-d, --dry-run', 'Show changes without applying them', false)
    .option('--parallel', 'Enable parallel processing', true)
    .option('--progress', 'Show progress bar', true)
    .option('--rules <rules...>', 'Specific rules to run')
    .option('--ignore <patterns...>', 'Patterns to ignore')
    .option('--generate-moc', 'Generate Maps of Content', false)
    .action(async (vaultPath: string, options: any, command: Command) => {
      try {
        const globalOptions = command.parent?.opts() || {};

        if (globalOptions.verbose) {
          console.log(chalk.blue('Running lint command with options:'));
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

        // Load configuration
        const config = await engine.loadConfiguration(globalOptions.config);

        // Load rules for the specified profile
        const rules = await engine.loadRules(globalOptions.profile);

        if (globalOptions.verbose) {
          console.log(
            chalk.blue(
              `Loaded ${rules.length} rules for profile: ${globalOptions.profile}`
            )
          );
        }

        // Create process options
        const processOptions: ProcessOptions = {
          dryRun: options.dryRun,
          fix: false, // lint command doesn't fix
          verbose: globalOptions.verbose,
          rules: options.rules,
          ignore: options.ignore,
          generateMoc: options.generateMoc,
          parallel: options.parallel,
        };

        // Show progress bar if enabled
        let progressBar: any = null;
        if (options.progress && !globalOptions.json) {
          progressBar = createProgressBar();
        }

        // Process vault
        const result = await engine.processVault(vaultPath, processOptions);

        // Hide progress bar
        if (progressBar) {
          progressBar.stop();
        }

        // Format and display output
        const output = formatOutput(result, {
          json: globalOptions.json,
          verbose: globalOptions.verbose,
          dryRun: options.dryRun,
        });

        console.log(output);

        // Exit with appropriate code
        if (result.issuesFound.length > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red('Lint failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  return command;
}
