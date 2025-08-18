/**
 * Profiles command implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LintEngine } from '../../core/engine.js';

export function createProfilesCommand(): Command {
  const command = new Command('profiles');

  command
    .description('Manage configuration profiles')
    .option('--list', 'List available profiles', false)
    .option('--active', 'Show active profile', false)
    .option('--switch <profile>', 'Switch to a different profile')
    .action(async (options: any, command: Command) => {
      try {
        const globalOptions = command.parent?.opts() || {};

        if (globalOptions.verbose) {
          console.log(chalk.blue('Managing profiles...'));
        }

        const engine = new LintEngine();

        // Load configuration
        const config = await engine.loadConfiguration(globalOptions.config);

        // Handle different profile operations
        if (options.active) {
          // Show active profile
          if (globalOptions.json) {
            console.log(
              JSON.stringify(
                {
                  activeProfile: globalOptions.profile,
                  configPath: globalOptions.config || 'default',
                },
                null,
                2
              )
            );
          } else {
            console.log(
              chalk.blue('Active profile:'),
              chalk.bold(globalOptions.profile)
            );
            if (globalOptions.verbose) {
              console.log(
                chalk.gray(`Config path: ${globalOptions.config || 'default'}`)
              );
            }
          }
          return;
        }

        if (options.switch) {
          // Switch profile (this would require updating config file)
          console.log(
            chalk.yellow(
              `Profile switching requires updating the configuration file manually.`
            )
          );
          console.log(
            chalk.gray(
              `To switch to profile "${options.switch}", update the active_profile setting in your obsidian-lint.toml file.`
            )
          );
          return;
        }

        // Default: list profiles
        const availableProfiles = await engine.getAvailableProfiles();

        if (globalOptions.json) {
          const output = {
            activeProfile: globalOptions.profile,
            availableProfiles: availableProfiles.map(profile => ({
              name: profile.name,
              description: profile.description,
              rulesPath: profile.rulesPath,
              active: profile.name === globalOptions.profile,
            })),
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(chalk.blue('Available profiles:'));

          if (availableProfiles.length === 0) {
            console.log(chalk.yellow('No profiles found.'));
            return;
          }

          for (const profile of availableProfiles) {
            const isActive = profile.name === globalOptions.profile;
            const marker = isActive ? chalk.green('● ') : chalk.gray('○ ');
            const nameColor = isActive ? chalk.bold.green : chalk.white;

            console.log(`${marker}${nameColor(profile.name)}`);
            console.log(`  ${chalk.gray(profile.description)}`);

            if (globalOptions.verbose) {
              console.log(
                `  ${chalk.gray(`Rules path: ${profile.rulesPath}`)}`
              );

              // Show rule count for each profile
              try {
                const rules = await engine.loadRules(profile.name);
                console.log(
                  `  ${chalk.gray(`Rules: ${rules.length} enabled`)}`
                );
              } catch (error) {
                console.log(
                  `  ${chalk.red('Error loading rules for this profile')}`
                );
              }
            }
            console.log();
          }

          console.log(
            chalk.gray(
              `Currently using profile: ${chalk.bold(globalOptions.profile)}`
            )
          );
          console.log(
            chalk.gray(
              'To switch profiles, use the --profile flag or update your configuration file.'
            )
          );
        }
      } catch (error) {
        console.error(
          chalk.red('Profiles command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  return command;
}
