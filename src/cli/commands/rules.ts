/**
 * Rules command implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LintEngine } from '../../core/engine.js';

export function createRulesCommand(): Command {
  const command = new Command('rules');

  command
    .description('List available rules and their status')
    .option('--enabled', 'Show only enabled rules', false)
    .option('--disabled', 'Show only disabled rules', false)
    .option('--category <category>', 'Filter by rule category')
    .action(async (options: any, command: Command) => {
      try {
        const globalOptions = command.parent?.opts() || {};

        if (globalOptions.verbose) {
          console.log(chalk.blue('Listing rules...'));
        }

        const engine = new LintEngine();

        // Load configuration to get profile information
        const config = await engine.loadConfiguration(globalOptions.config);

        // Load enabled rules
        const enabledRules = await engine.loadRules(globalOptions.profile);

        // Load all available rules (both enabled and disabled)
        const allRules = await engine.loadAllRules(globalOptions.profile);

        // Filter rules based on options
        let rulesToShow = allRules;

        if (options.enabled) {
          rulesToShow = enabledRules;
        } else if (options.disabled) {
          rulesToShow = allRules.filter(
            rule =>
              !enabledRules.some(enabled => enabled.id.full === rule.id.full)
          );
        }

        if (options.category) {
          rulesToShow = rulesToShow.filter(
            rule =>
              rule.category.toLowerCase() === options.category.toLowerCase()
          );
        }

        // Group rules by category
        const rulesByCategory = new Map<string, typeof rulesToShow>();
        for (const rule of rulesToShow) {
          if (!rulesByCategory.has(rule.category)) {
            rulesByCategory.set(rule.category, []);
          }
          rulesByCategory.get(rule.category)!.push(rule);
        }

        // Display results
        if (globalOptions.json) {
          const output = {
            profile: globalOptions.profile,
            totalRules: allRules.length,
            enabledRules: enabledRules.length,
            disabledRules: allRules.length - enabledRules.length,
            rules: Array.from(rulesByCategory.entries()).map(
              ([category, rules]) => ({
                category,
                rules: rules.map(rule => ({
                  id: rule.id.full,
                  name: rule.name,
                  description: rule.description,
                  enabled: enabledRules.some(
                    enabled => enabled.id.full === rule.id.full
                  ),
                })),
              })
            ),
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          // Human-readable output
          console.log(
            chalk.blue(`Rules for profile: ${globalOptions.profile}`)
          );
          console.log(
            chalk.gray(
              `Total: ${allRules.length} | Enabled: ${enabledRules.length} | Disabled: ${
                allRules.length - enabledRules.length
              }`
            )
          );

          if (rulesToShow.length === 0) {
            console.log(chalk.yellow('No rules match the specified criteria.'));
            return;
          }

          for (const [category, rules] of rulesByCategory) {
            console.log(chalk.bold(`\n${category.toUpperCase()}:`));

            for (const rule of rules) {
              const isEnabled = enabledRules.some(
                enabled => enabled.id.full === rule.id.full
              );
              const status = isEnabled ? chalk.green('✓') : chalk.red('✗');
              const statusText = isEnabled ? 'enabled' : 'disabled';

              console.log(
                `  ${status} ${chalk.bold(rule.id.full)} ${chalk.gray(
                  `(${statusText})`
                )}`
              );
              console.log(`    ${rule.description}`);

              if (globalOptions.verbose && rule.config) {
                if (rule.config.pathAllowlist?.length > 0) {
                  console.log(
                    chalk.gray(
                      `    Allowlist: ${rule.config.pathAllowlist.join(', ')}`
                    )
                  );
                }
                if (rule.config.pathDenylist?.length > 0) {
                  console.log(
                    chalk.gray(
                      `    Denylist: ${rule.config.pathDenylist.join(', ')}`
                    )
                  );
                }
              }
            }
          }

          console.log(
            chalk.gray(
              `\nShowing ${rulesToShow.length} of ${allRules.length} total rules`
            )
          );
        }
      } catch (error) {
        console.error(
          chalk.red('Rules command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    });

  return command;
}
