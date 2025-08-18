/**
 * Check command implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LintEngine } from '../../core/engine.js';

export function createCheckCommand(): Command {
  const command = new Command('check');

  command
    .description('Validate configuration and rules')
    .argument('[vault-path]', 'Path to Obsidian vault', process.cwd())
    .action(async (vaultPath: string, options: any, command: Command) => {
      try {
        const globalOptions = command.parent?.opts() || {};

        if (globalOptions.verbose) {
          console.log(chalk.blue('Running check command'));
        }

        const engine = new LintEngine();

        // Validate configuration
        console.log(chalk.blue('Checking configuration...'));
        const config = await engine.loadConfiguration(globalOptions.config);
        console.log(chalk.green('✓ Configuration is valid'));

        if (globalOptions.verbose) {
          console.log(chalk.gray('Configuration details:'));
          console.log(chalk.gray(`  Active profile: ${globalOptions.profile}`));
          console.log(
            chalk.gray(`  Vault root: ${config.general.vaultRoot || vaultPath}`)
          );
        }

        // Validate rules
        console.log(chalk.blue('Checking rules...'));
        const rules = await engine.loadRules(globalOptions.profile);
        console.log(chalk.green(`✓ Loaded ${rules.length} rules`));

        // Validate rule conflicts
        console.log(chalk.blue('Checking for rule conflicts...'));
        const conflictResult = await engine.validateRuleConflicts(rules);

        if (conflictResult.valid) {
          console.log(chalk.green('✓ No rule conflicts detected'));
        } else {
          console.log(
            chalk.red(
              `✗ Found ${conflictResult.conflicts.length} rule conflicts:`
            )
          );
          for (const conflict of conflictResult.conflicts) {
            console.log(
              chalk.red(
                `  - Major ID "${conflict.majorId}" has multiple enabled rules:`
              )
            );
            for (const rule of conflict.conflictingRules) {
              console.log(chalk.red(`    - ${rule.id.full}`));
            }
            console.log(chalk.yellow(`    Resolution: ${conflict.resolution}`));
          }
          process.exit(1);
        }

        // Show warnings if any
        if (conflictResult.warnings.length > 0) {
          console.log(chalk.yellow('Warnings:'));
          for (const warning of conflictResult.warnings) {
            console.log(chalk.yellow(`  - ${warning}`));
          }
        }

        // Verbose rule listing
        if (globalOptions.verbose) {
          console.log(chalk.blue('\nEnabled rules:'));
          for (const rule of rules) {
            console.log(chalk.gray(`  - ${rule.id.full}: ${rule.name}`));
          }
        }

        console.log(chalk.green('\n✓ All checks passed'));
      } catch (error) {
        console.error(
          chalk.red('Check failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  return command;
}
