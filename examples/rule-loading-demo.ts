#!/usr/bin/env bun

/**
 * Demonstration of the rule loading system
 */

import { join } from 'path';
import { RuleEngine } from '../src/core/rules.js';

async function demonstrateRuleLoading() {
  console.log('🔧 Obsidian Lint Rule Loading Demo\n');

  const ruleEngine = new RuleEngine();
  const rulesPath = join(process.cwd(), 'config', 'rules', 'default');

  try {
    console.log(`📂 Loading rules from: ${rulesPath}`);
    const rules = await ruleEngine.loadRulesForProfile(rulesPath);

    console.log(`✅ Successfully loaded ${rules.length} rules:\n`);

    // Group rules by category
    const rulesByCategory = new Map<string, typeof rules>();
    for (const rule of rules) {
      if (!rulesByCategory.has(rule.category)) {
        rulesByCategory.set(rule.category, []);
      }
      rulesByCategory.get(rule.category)!.push(rule);
    }

    // Display rules by category
    for (const [category, categoryRules] of rulesByCategory) {
      console.log(`📋 ${category.toUpperCase()} Rules:`);
      for (const rule of categoryRules) {
        console.log(`  • ${rule.id.full}`);
        console.log(`    Name: ${rule.name}`);
        console.log(`    Description: ${rule.description}`);

        // Show some config details
        if (rule.config.pathAllowlist.length > 0) {
          console.log(
            `    Path allowlist: ${rule.config.pathAllowlist.join(', ')}`
          );
        }
        if (rule.config.pathDenylist.length > 0) {
          console.log(
            `    Path denylist: ${rule.config.pathDenylist.join(', ')}`
          );
        }

        // Show some settings
        const settingsKeys = Object.keys(rule.config.settings);
        if (settingsKeys.length > 0) {
          console.log(`    Settings: ${settingsKeys.join(', ')}`);
        }
        console.log('');
      }
    }

    // Validate for conflicts
    console.log('🔍 Checking for rule conflicts...');
    const conflictResult = ruleEngine.validateRuleConflicts(rules);

    if (conflictResult.valid) {
      console.log('✅ No rule conflicts detected!');
    } else {
      console.log('❌ Rule conflicts detected:');
      for (const conflict of conflictResult.conflicts) {
        console.log(
          `  • Major ID '${conflict.majorId}': ${conflict.resolution}`
        );
      }
    }

    if (conflictResult.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      for (const warning of conflictResult.warnings) {
        console.log(`  • ${warning}`);
      }
    }
  } catch (error) {
    console.error(
      '❌ Error loading rules:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Run the demo
demonstrateRuleLoading().catch(console.error);
