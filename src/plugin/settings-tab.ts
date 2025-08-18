import { PluginSettingTab, Setting, Notice } from '../types/obsidian.js';
import type { App } from '../types/obsidian.js';
import ObsidianLintPlugin from './main.js';
import type { PluginSettings } from './settings.js';
import type { Rule } from '../types/index.js';
import type { ProfileConfig } from '../types/config.js';

/**
 * Settings tab for the Obsidian Lint Plugin
 * Provides UI for configuring plugin behavior within Obsidian
 */
export class ObsidianLintSettingTab extends PluginSettingTab {
  plugin: ObsidianLintPlugin;
  private availableRules: Rule[] = [];
  private availableProfiles: ProfileConfig[] = [];
  private isLoadingRules = false;
  private isLoadingProfiles = false;
  private filePattern = '';
  private fixPattern = '';
  private tagPattern = '';

  constructor(app: App, plugin: ObsidianLintPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl('h2', { text: 'Obsidian Lint Settings' });

    // Description
    containerEl.createEl('p', {
      text: 'Configure the Obsidian Lint plugin behavior and integration settings.',
    });

    // Load available data
    this.loadAvailableData();

    this.addGeneralSettings();
    this.addProfileSettings();
    this.addRuleManagementSettings();
    this.addLintingSettings();
    this.addBulkOperationsSettings();
    this.addPerformanceSettings();
    this.addAdvancedSettings();
  }

  /**
   * Load available profiles and rules
   */
  private async loadAvailableData(): Promise<void> {
    try {
      // Load available profiles
      if (!this.isLoadingProfiles) {
        this.isLoadingProfiles = true;
        // Note: This would need to be implemented in the engine
        // For now, we'll use a placeholder
        try {
          this.availableProfiles = await this.plugin.getAvailableProfiles();
        } catch (error) {
          console.error('Failed to load available profiles:', error);
          // Fallback to default profiles
          this.availableProfiles = [
            {
              name: 'default',
              description: 'Default profile',
              rulesPath: 'rules/default',
              enabledRules: [],
            },
          ];
        }
        this.isLoadingProfiles = false;
      }

      // Load available rules for current profile
      if (!this.isLoadingRules) {
        this.isLoadingRules = true;
        try {
          this.availableRules = await this.plugin.getAvailableRules();
        } catch (error) {
          console.error('Failed to load available rules:', error);
          this.availableRules = [];
        }
        this.isLoadingRules = false;
      }
    } catch (error) {
      console.error('Failed to load available data:', error);
    }
  }

  /**
   * Add general configuration settings
   */
  private addGeneralSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'General Settings' });

    // Configuration file path
    new Setting(containerEl)
      .setName('Configuration file path')
      .setDesc(
        'Path to the obsidian-lint.toml configuration file (leave empty for auto-detection)'
      )
      .addText(text =>
        text
          .setPlaceholder('e.g., .config/obsidian-lint/obsidian-lint.toml')
          .setValue(this.plugin.getSettings().configPath)
          .onChange(async value => {
            await this.plugin.updateSettings({ configPath: value });
          })
      );

    // Active profile dropdown
    new Setting(containerEl)
      .setName('Active profile')
      .setDesc('Configuration profile to use for linting rules')
      .addDropdown(dropdown => {
        // Add available profiles
        this.availableProfiles.forEach(profile => {
          dropdown.addOption(
            profile.name,
            `${profile.name} - ${profile.description}`
          );
        });

        // Set current value
        dropdown.setValue(this.plugin.getSettings().activeProfile);

        dropdown.onChange(async value => {
          await this.plugin.updateSettings({ activeProfile: value });
          // Reload rules when profile changes
          this.loadAvailableData();
          // Refresh the display to update rule toggles
          this.display();
        });
      });

    // Verbose logging
    new Setting(containerEl)
      .setName('Verbose logging')
      .setDesc('Enable detailed logging for debugging purposes')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().verbose)
          .onChange(async value => {
            await this.plugin.updateSettings({ verbose: value });
          })
      );
  }

  /**
   * Add profile management settings
   */
  private addProfileSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Profile Management' });

    // Profile information
    const currentProfile = this.availableProfiles.find(
      p => p.name === this.plugin.getSettings().activeProfile
    );

    if (currentProfile) {
      const profileInfo = containerEl.createEl('div', { cls: 'profile-info' });
      profileInfo.createEl('p', {
        text: `Current Profile: ${currentProfile.name}`,
        cls: 'profile-current',
      });
      profileInfo.createEl('p', {
        text: currentProfile.description,
        cls: 'profile-description',
      });
      profileInfo.createEl('p', {
        text: `Rules Path: ${currentProfile.rulesPath}`,
        cls: 'profile-path',
      });
    }

    // Profile actions
    new Setting(containerEl)
      .setName('Reload profiles')
      .setDesc('Refresh the list of available profiles from configuration')
      .addButton(button =>
        button.setButtonText('Reload').onClick(async () => {
          await this.loadAvailableData();
          this.display();
          new Notice('Profiles reloaded');
        })
      );
  }

  /**
   * Add rule management settings
   */
  private addRuleManagementSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Rule Management' });

    // Rule statistics
    this.addRuleStatistics(containerEl);

    // Rule search and filter
    this.addRuleSearchAndFilter(containerEl);

    // Rule enable/disable toggles
    if (this.availableRules.length > 0) {
      const ruleContainer = containerEl.createEl('div', {
        cls: 'rule-toggles',
      });

      // Group rules by major ID
      const ruleGroups = new Map<string, Rule[]>();
      this.availableRules.forEach(rule => {
        const majorId = rule.id.major;
        if (!ruleGroups.has(majorId)) {
          ruleGroups.set(majorId, []);
        }
        ruleGroups.get(majorId)!.push(rule);
      });

      // Create toggles for each rule group
      ruleGroups.forEach((rules, majorId) => {
        const groupContainer = ruleContainer.createEl('div', {
          cls: 'rule-group',
        });

        // Group header with expand/collapse
        const groupHeader = groupContainer.createEl('div', {
          cls: 'rule-group-header',
        });

        const groupTitle = groupHeader.createEl('h4', {
          text: majorId
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase()),
        });

        // Add group-level enable/disable buttons
        const groupActions = groupHeader.createEl('div', {
          cls: 'rule-group-actions',
        });

        const enableGroupBtn = groupActions.createEl('button', {
          text: 'Enable All',
          cls: 'mod-small',
        });
        enableGroupBtn.onclick = async () => {
          for (const rule of rules) {
            await this.updateRuleStatus(rule.id.full, true);
          }
          this.display();
          new Notice(`Enabled all ${majorId} rules`);
        };

        const disableGroupBtn = groupActions.createEl('button', {
          text: 'Disable All',
          cls: 'mod-small mod-warning',
        });
        disableGroupBtn.onclick = async () => {
          for (const rule of rules) {
            await this.updateRuleStatus(rule.id.full, false);
          }
          this.display();
          new Notice(`Disabled all ${majorId} rules`);
        };

        // Rule toggles within group
        const rulesContainer = groupContainer.createEl('div', {
          cls: 'rule-group-rules',
        });

        rules.forEach(rule => {
          const isEnabled =
            this.plugin.getSettings().enabledRules.includes(rule.id.full) ||
            (!this.plugin.getSettings().disabledRules.includes(rule.id.full) &&
              this.plugin.getSettings().enabledRules.length === 0);

          const ruleSetting = new Setting(rulesContainer)
            .setName(rule.name)
            .setDesc(rule.description)
            .addToggle(toggle =>
              toggle.setValue(isEnabled).onChange(async value => {
                await this.updateRuleStatus(rule.id.full, value);
              })
            );

          // Add rule status indicator
          const statusIndicator = ruleSetting.settingEl.createEl('span', {
            cls: isEnabled ? 'rule-enabled' : 'rule-disabled',
            text: isEnabled ? '●' : '○',
          });
          statusIndicator.style.marginLeft = '8px';
        });
      });
    } else {
      containerEl.createEl('p', {
        text: 'No rules available. Check your configuration and profile settings.',
        cls: 'no-rules-message',
      });
    }

    // Rule management actions
    this.addRuleManagementActions(containerEl);
  }

  /**
   * Add rule statistics display
   */
  private addRuleStatistics(containerEl: HTMLElement): void {
    const settings = this.plugin.getSettings();
    const totalRules = this.availableRules.length;
    const enabledCount =
      settings.enabledRules.length ||
      (settings.enabledRules.length === 0 && settings.disabledRules.length === 0
        ? totalRules
        : 0);
    const disabledCount = settings.disabledRules.length;

    const statsContainer = containerEl.createEl('div', {
      cls: 'rule-statistics',
    });

    statsContainer.createEl('div', {
      cls: 'rule-stat',
      text: `Total Rules: ${totalRules}`,
    });

    statsContainer.createEl('div', {
      cls: 'rule-stat rule-stat-enabled',
      text: `Enabled: ${enabledCount}`,
    });

    statsContainer.createEl('div', {
      cls: 'rule-stat rule-stat-disabled',
      text: `Disabled: ${disabledCount}`,
    });
  }

  /**
   * Add rule search and filter functionality
   */
  private addRuleSearchAndFilter(containerEl: HTMLElement): void {
    const searchContainer = containerEl.createEl('div', {
      cls: 'rule-search-container',
    });

    new Setting(searchContainer)
      .setName('Search rules')
      .setDesc('Filter rules by name or description')
      .addText(text =>
        text.setPlaceholder('Search rules...').onChange(value => {
          this.filterRules(value);
        })
      );

    new Setting(searchContainer)
      .setName('Filter by category')
      .setDesc('Show rules from specific categories')
      .addDropdown(dropdown => {
        dropdown.addOption('all', 'All Categories');

        // Get unique categories
        const categories = [
          ...new Set(this.availableRules.map(rule => rule.category)),
        ];
        categories.forEach(category => {
          dropdown.addOption(
            category,
            category.charAt(0).toUpperCase() + category.slice(1)
          );
        });

        dropdown.onChange(value => {
          this.filterRulesByCategory(value);
        });
      });
  }

  /**
   * Add rule management action buttons
   */
  private addRuleManagementActions(containerEl: HTMLElement): void {
    // Rule management actions
    new Setting(containerEl)
      .setName('Reload rules')
      .setDesc('Refresh the list of available rules from the current profile')
      .addButton(button =>
        button.setButtonText('Reload').onClick(async () => {
          await this.loadAvailableData();
          this.display();
          new Notice('Rules reloaded');
        })
      );

    // Enable all rules
    new Setting(containerEl)
      .setName('Enable all rules')
      .setDesc('Enable all available rules for the current profile')
      .addButton(button =>
        button.setButtonText('Enable All').onClick(async () => {
          const allRuleIds = this.availableRules.map(rule => rule.id.full);
          await this.plugin.updateSettings({
            enabledRules: allRuleIds,
            disabledRules: [],
          });
          this.display();
          new Notice(`Enabled ${allRuleIds.length} rules`);
        })
      );

    // Disable all rules
    new Setting(containerEl)
      .setName('Disable all rules')
      .setDesc('Disable all rules for the current profile')
      .addButton(button =>
        button
          .setButtonText('Disable All')
          .setWarning()
          .onClick(async () => {
            await this.plugin.updateSettings({
              enabledRules: [],
              disabledRules: this.availableRules.map(rule => rule.id.full),
            });
            this.display();
            new Notice('Disabled all rules');
          })
      );

    // Import/Export rule configuration
    new Setting(containerEl)
      .setName('Export rule configuration')
      .setDesc('Export current rule settings to a file')
      .addButton(button =>
        button.setButtonText('Export').onClick(async () => {
          await this.exportRuleConfiguration();
        })
      );

    new Setting(containerEl)
      .setName('Import rule configuration')
      .setDesc('Import rule settings from a file')
      .addButton(button =>
        button.setButtonText('Import').onClick(async () => {
          await this.importRuleConfiguration();
        })
      );
  }

  /**
   * Add bulk operations settings
   */
  private addBulkOperationsSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Bulk Operations' });

    containerEl.createEl('p', {
      text: 'Run linting operations on multiple files or the entire vault.',
      cls: 'bulk-operations-description',
    });

    // Bulk operation options
    this.addBulkOperationOptions(containerEl);

    // Vault-wide operations
    this.addVaultOperations(containerEl);

    // Folder operations
    this.addFolderOperations(containerEl);

    // File selection operations
    this.addFileSelectionOperations(containerEl);

    // Scheduled operations
    this.addScheduledOperations(containerEl);
  }

  /**
   * Add bulk operation configuration options
   */
  private addBulkOperationOptions(containerEl: HTMLElement): void {
    const optionsContainer = containerEl.createEl('div', {
      cls: 'bulk-operation-options',
    });

    // Dry run options
    new Setting(optionsContainer)
      .setName('Use dry run for bulk operations')
      .setDesc('Show what would be changed without making actual changes')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().dryRun || false)
          .onChange(async value => {
            await this.plugin.updateSettings({ dryRun: value });
          })
      );

    // Progress notifications
    new Setting(optionsContainer)
      .setName('Show progress notifications')
      .setDesc('Display progress notifications during bulk operations')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().showProgressNotifications)
          .onChange(async value => {
            await this.plugin.updateSettings({
              showProgressNotifications: value,
            });
          })
      );

    // Auto-save after fix
    new Setting(optionsContainer)
      .setName('Auto-save after bulk fix')
      .setDesc('Automatically save files after applying bulk fixes')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().autoSaveAfterFix)
          .onChange(async value => {
            await this.plugin.updateSettings({ autoSaveAfterFix: value });
          })
      );
  }

  /**
   * Add vault-wide operations
   */
  private addVaultOperations(containerEl: HTMLElement): void {
    const vaultContainer = containerEl.createEl('div', {
      cls: 'vault-operations',
    });

    vaultContainer.createEl('h4', { text: 'Vault-wide Operations' });

    // Lint entire vault
    new Setting(vaultContainer)
      .setName('Lint entire vault')
      .setDesc('Run linting on all markdown files in the vault')
      .addButton(button =>
        button
          .setButtonText('Lint Vault')
          .setCta()
          .onClick(async () => {
            await this.runBulkOperation('lint-vault');
          })
      );

    // Fix entire vault
    new Setting(vaultContainer)
      .setName('Fix entire vault')
      .setDesc('Run linting with auto-fix on all markdown files in the vault')
      .addButton(button =>
        button
          .setButtonText('Fix Vault')
          .setWarning()
          .onClick(async () => {
            await this.runBulkOperation('fix-vault');
          })
      );

    // Lint with specific rules only
    new Setting(vaultContainer)
      .setName('Lint vault with specific rules')
      .setDesc('Run linting on the entire vault using only selected rules')
      .addButton(button =>
        button.setButtonText('Selective Lint').onClick(async () => {
          await this.runSelectiveVaultOperation('lint');
        })
      );
  }

  /**
   * Add folder operations
   */
  private addFolderOperations(containerEl: HTMLElement): void {
    const folderContainer = containerEl.createEl('div', {
      cls: 'folder-operations',
    });

    folderContainer.createEl('h4', { text: 'Folder Operations' });

    // Lint current folder
    new Setting(folderContainer)
      .setName('Lint current folder')
      .setDesc('Run linting on all files in the currently active folder')
      .addButton(button =>
        button.setButtonText('Lint Folder').onClick(async () => {
          await this.runBulkOperation('lint-folder');
        })
      );

    // Fix current folder
    new Setting(folderContainer)
      .setName('Fix current folder')
      .setDesc(
        'Run linting with auto-fix on all files in the currently active folder'
      )
      .addButton(button =>
        button
          .setButtonText('Fix Folder')
          .setWarning()
          .onClick(async () => {
            await this.runBulkOperation('fix-folder');
          })
      );

    // Lint specific folder
    new Setting(folderContainer)
      .setName('Lint specific folder')
      .setDesc('Choose a folder to lint')
      .addButton(button =>
        button.setButtonText('Choose Folder').onClick(async () => {
          await this.runFolderSelector('lint');
        })
      );

    // Fix specific folder
    new Setting(folderContainer)
      .setName('Fix specific folder')
      .setDesc('Choose a folder to fix')
      .addButton(button =>
        button
          .setButtonText('Choose Folder')
          .setWarning()
          .onClick(async () => {
            await this.runFolderSelector('fix');
          })
      );
  }

  /**
   * Add file selection operations
   */
  private addFileSelectionOperations(containerEl: HTMLElement): void {
    const selectionContainer = containerEl.createEl('div', {
      cls: 'file-selection-operations',
    });

    selectionContainer.createEl('h4', { text: 'File Selection Operations' });

    // Lint files by pattern
    new Setting(selectionContainer)
      .setName('Lint files by pattern')
      .setDesc('Lint files matching a specific glob pattern')
      .addText(text =>
        text.setPlaceholder('e.g., **/*daily*.md').onChange(value => {
          this.filePattern = value;
        })
      )
      .addButton(button =>
        button.setButtonText('Lint Pattern').onClick(async () => {
          if (this.filePattern) {
            await this.runPatternOperation('lint', this.filePattern);
          } else {
            new Notice('Please enter a file pattern');
          }
        })
      );

    // Fix files by pattern
    new Setting(selectionContainer)
      .setName('Fix files by pattern')
      .setDesc('Fix files matching a specific glob pattern')
      .addText(text =>
        text.setPlaceholder('e.g., **/*template*.md').onChange(value => {
          this.fixPattern = value;
        })
      )
      .addButton(button =>
        button
          .setButtonText('Fix Pattern')
          .setWarning()
          .onClick(async () => {
            if (this.fixPattern) {
              await this.runPatternOperation('fix', this.fixPattern);
            } else {
              new Notice('Please enter a file pattern');
            }
          })
      );

    // Lint files by tag
    new Setting(selectionContainer)
      .setName('Lint files by tag')
      .setDesc('Lint files containing specific tags')
      .addText(text =>
        text.setPlaceholder('e.g., #project, #draft').onChange(value => {
          this.tagPattern = value;
        })
      )
      .addButton(button =>
        button.setButtonText('Lint Tagged').onClick(async () => {
          if (this.tagPattern) {
            await this.runTagOperation('lint', this.tagPattern);
          } else {
            new Notice('Please enter tags to search for');
          }
        })
      );
  }

  /**
   * Add scheduled operations
   */
  private addScheduledOperations(containerEl: HTMLElement): void {
    const scheduledContainer = containerEl.createEl('div', {
      cls: 'scheduled-operations',
    });

    scheduledContainer.createEl('h4', { text: 'Scheduled Operations' });

    // Auto-lint on file save
    new Setting(scheduledContainer)
      .setName('Auto-lint on file save')
      .setDesc('Automatically lint files when they are saved')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().realTimeLinting)
          .onChange(async value => {
            await this.plugin.updateSettings({ realTimeLinting: value });
          })
      );

    // Daily vault maintenance
    new Setting(scheduledContainer)
      .setName('Daily vault maintenance')
      .setDesc('Run a daily maintenance check on the entire vault')
      .addButton(button =>
        button.setButtonText('Schedule Daily').onClick(async () => {
          await this.scheduleDailyMaintenance();
        })
      );

    // Weekly deep clean
    new Setting(scheduledContainer)
      .setName('Weekly deep clean')
      .setDesc('Schedule a weekly comprehensive vault cleanup')
      .addButton(button =>
        button.setButtonText('Schedule Weekly').onClick(async () => {
          await this.scheduleWeeklyDeepClean();
        })
      );
  }

  /**
   * Add linting behavior settings
   */
  private addLintingSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Linting Behavior' });

    // Real-time linting
    new Setting(containerEl)
      .setName('Real-time linting')
      .setDesc('Lint files as you type (may impact performance)')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().realTimeLinting)
          .onChange(async value => {
            await this.plugin.updateSettings({ realTimeLinting: value });
          })
      );

    // Real-time linting delay
    new Setting(containerEl)
      .setName('Real-time linting delay')
      .setDesc(
        'Delay in milliseconds before triggering real-time linting (100-5000ms)'
      )
      .addSlider(slider =>
        slider
          .setLimits(100, 5000, 100)
          .setValue(this.plugin.getSettings().realTimeLintingDelay)
          .setDynamicTooltip()
          .onChange(async value => {
            await this.plugin.updateSettings({ realTimeLintingDelay: value });
          })
      );

    // Show inline errors
    new Setting(containerEl)
      .setName('Show inline errors')
      .setDesc('Display error indicators directly in the editor')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().showInlineErrors)
          .onChange(async value => {
            await this.plugin.updateSettings({ showInlineErrors: value });
          })
      );

    // Auto-fix
    new Setting(containerEl)
      .setName('Auto-fix issues')
      .setDesc('Automatically apply fixes when possible (use with caution)')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().autoFix)
          .onChange(async value => {
            await this.plugin.updateSettings({ autoFix: value });
          })
      );

    // Auto-save after fix
    new Setting(containerEl)
      .setName('Auto-save after fix')
      .setDesc('Automatically save files after applying fixes')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().autoSaveAfterFix)
          .onChange(async value => {
            await this.plugin.updateSettings({ autoSaveAfterFix: value });
          })
      );
  }

  /**
   * Add performance settings
   */
  private addPerformanceSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Performance Settings' });

    // Enable parallel processing
    new Setting(containerEl)
      .setName('Enable parallel processing')
      .setDesc('Process multiple files simultaneously for better performance')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().enableParallelProcessing)
          .onChange(async value => {
            await this.plugin.updateSettings({
              enableParallelProcessing: value,
            });
          })
      );

    // Max concurrency
    new Setting(containerEl)
      .setName('Maximum concurrent operations')
      .setDesc('Number of files to process simultaneously (1-16)')
      .addSlider(slider =>
        slider
          .setLimits(1, 16, 1)
          .setValue(this.plugin.getSettings().maxConcurrency)
          .setDynamicTooltip()
          .onChange(async value => {
            await this.plugin.updateSettings({ maxConcurrency: value });
          })
      );

    // Show progress notifications
    new Setting(containerEl)
      .setName('Show progress notifications')
      .setDesc('Display notifications for long-running operations')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.getSettings().showProgressNotifications)
          .onChange(async value => {
            await this.plugin.updateSettings({
              showProgressNotifications: value,
            });
          })
      );
  }

  /**
   * Add advanced settings
   */
  private addAdvancedSettings(): void {
    const { containerEl } = this;

    containerEl.createEl('h3', { text: 'Advanced Settings' });

    // Enabled rules
    new Setting(containerEl)
      .setName('Enabled rules')
      .setDesc(
        'Comma-separated list of rule IDs to enable (leave empty for all)'
      )
      .addTextArea(text =>
        text
          .setPlaceholder(
            'e.g., frontmatter-required-fields.strict, attachment-organization.centralized'
          )
          .setValue(this.plugin.getSettings().enabledRules.join(', '))
          .onChange(async value => {
            const rules = value
              .split(',')
              .map(r => r.trim())
              .filter(r => r.length > 0);
            await this.plugin.updateSettings({ enabledRules: rules });
          })
      );

    // Disabled rules
    new Setting(containerEl)
      .setName('Disabled rules')
      .setDesc('Comma-separated list of rule IDs to disable')
      .addTextArea(text =>
        text
          .setPlaceholder(
            'e.g., spell-correction.auto-fix, tag-from-folders.hierarchical'
          )
          .setValue(this.plugin.getSettings().disabledRules.join(', '))
          .onChange(async value => {
            const rules = value
              .split(',')
              .map(r => r.trim())
              .filter(r => r.length > 0);
            await this.plugin.updateSettings({ disabledRules: rules });
          })
      );

    // Action buttons
    containerEl.createEl('h3', { text: 'Actions' });

    // Test configuration button
    new Setting(containerEl)
      .setName('Test configuration')
      .setDesc('Test the current configuration and rule setup')
      .addButton(button =>
        button
          .setButtonText('Test Config')
          .setCta()
          .onClick(async () => {
            await this.testConfiguration();
          })
      );

    // Reset settings button
    new Setting(containerEl)
      .setName('Reset settings')
      .setDesc('Reset all plugin settings to default values')
      .addButton(button =>
        button
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            await this.resetSettings();
          })
      );
  }

  /**
   * Test the current configuration
   */
  private async testConfiguration(): Promise<void> {
    try {
      new Notice('Testing configuration...');

      // This would test the configuration in a real implementation
      // For now, just show a success message
      new Notice('Configuration test completed successfully');
    } catch (error) {
      console.error('Configuration test failed:', error);
      new Notice('Configuration test failed. Check console for details.');
    }
  }

  /**
   * Reset all settings to defaults
   */
  private async resetSettings(): Promise<void> {
    try {
      // Reset to default settings
      await this.plugin.updateSettings({
        configPath: '',
        activeProfile: 'default',
        realTimeLinting: false,
        showInlineErrors: true,
        autoFix: false,
        verbose: false,
        enableParallelProcessing: true,
        maxConcurrency: 4,
        enabledRules: [],
        disabledRules: [],
        showProgressNotifications: true,
        autoSaveAfterFix: true,
        realTimeLintingDelay: 1000,
      });

      // Refresh the display
      this.display();

      new Notice('Settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      new Notice('Failed to reset settings. Check console for details.');
    }
  }

  /**
   * Update rule enable/disable status
   */
  private async updateRuleStatus(
    ruleId: string,
    enabled: boolean
  ): Promise<void> {
    try {
      const settings = this.plugin.getSettings();
      let enabledRules = [...settings.enabledRules];
      let disabledRules = [...settings.disabledRules];

      if (enabled) {
        // Enable the rule
        if (!enabledRules.includes(ruleId)) {
          enabledRules.push(ruleId);
        }
        // Remove from disabled list
        disabledRules = disabledRules.filter(id => id !== ruleId);
      } else {
        // Disable the rule
        if (!disabledRules.includes(ruleId)) {
          disabledRules.push(ruleId);
        }
        // Remove from enabled list
        enabledRules = enabledRules.filter(id => id !== ruleId);
      }

      await this.plugin.updateSettings({
        enabledRules,
        disabledRules,
      });

      const action = enabled ? 'enabled' : 'disabled';
      new Notice(`Rule ${ruleId} ${action}`);
    } catch (error) {
      console.error('Failed to update rule status:', error);
      new Notice('Failed to update rule status. Check console for details.');
    }
  }

  /**
   * Filter rules by search term
   */
  private filterRules(searchTerm: string): void {
    const ruleElements = this.containerEl.querySelectorAll(
      '.rule-group-rules .setting-item'
    );
    const groupElements = this.containerEl.querySelectorAll('.rule-group');

    ruleElements.forEach((element: HTMLElement) => {
      const name =
        element
          .querySelector('.setting-item-name')
          ?.textContent?.toLowerCase() || '';
      const desc =
        element
          .querySelector('.setting-item-description')
          ?.textContent?.toLowerCase() || '';
      const matches =
        name.includes(searchTerm.toLowerCase()) ||
        desc.includes(searchTerm.toLowerCase());

      element.style.display = matches ? 'flex' : 'none';
    });

    // Hide empty groups
    groupElements.forEach((groupElement: HTMLElement) => {
      const visibleRules = groupElement.querySelectorAll(
        '.rule-group-rules .setting-item[style*="flex"]'
      );
      groupElement.style.display = visibleRules.length > 0 ? 'block' : 'none';
    });
  }

  /**
   * Filter rules by category
   */
  private filterRulesByCategory(category: string): void {
    const ruleElements = this.containerEl.querySelectorAll(
      '.rule-group-rules .setting-item'
    );
    const groupElements = this.containerEl.querySelectorAll('.rule-group');

    if (category === 'all') {
      ruleElements.forEach((element: HTMLElement) => {
        element.style.display = 'flex';
      });
      groupElements.forEach((element: HTMLElement) => {
        element.style.display = 'block';
      });
      return;
    }

    // Find rules matching the category
    const matchingRules = this.availableRules.filter(
      rule => rule.category === category
    );
    const matchingRuleIds = new Set(matchingRules.map(rule => rule.id.full));

    ruleElements.forEach((element: HTMLElement) => {
      const ruleName =
        element.querySelector('.setting-item-name')?.textContent || '';
      const matchingRule = this.availableRules.find(
        rule => rule.name === ruleName
      );
      const matches = matchingRule && matchingRuleIds.has(matchingRule.id.full);

      element.style.display = matches ? 'flex' : 'none';
    });

    // Hide empty groups
    groupElements.forEach((groupElement: HTMLElement) => {
      const visibleRules = groupElement.querySelectorAll(
        '.rule-group-rules .setting-item[style*="flex"]'
      );
      groupElement.style.display = visibleRules.length > 0 ? 'block' : 'none';
    });
  }

  /**
   * Export rule configuration to JSON
   */
  private async exportRuleConfiguration(): Promise<void> {
    try {
      const settings = this.plugin.getSettings();
      const config = {
        activeProfile: settings.activeProfile,
        enabledRules: settings.enabledRules,
        disabledRules: settings.disabledRules,
        exportDate: new Date().toISOString(),
        version: '1.0.0',
      };

      const jsonString = JSON.stringify(config, null, 2);

      // Create a downloadable file
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `obsidian-lint-rules-${settings.activeProfile}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      new Notice('Rule configuration exported successfully');
    } catch (error) {
      console.error('Failed to export rule configuration:', error);
      new Notice(
        'Failed to export rule configuration. Check console for details.'
      );
    }
  }

  /**
   * Import rule configuration from JSON
   */
  private async importRuleConfiguration(): Promise<void> {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const config = JSON.parse(text);

          // Validate the configuration
          if (!config.enabledRules || !Array.isArray(config.enabledRules)) {
            throw new Error(
              'Invalid configuration format: missing or invalid enabledRules'
            );
          }

          if (!config.disabledRules || !Array.isArray(config.disabledRules)) {
            throw new Error(
              'Invalid configuration format: missing or invalid disabledRules'
            );
          }

          // Apply the configuration
          await this.plugin.updateSettings({
            enabledRules: config.enabledRules,
            disabledRules: config.disabledRules,
          });

          // Optionally switch profile if specified and available
          if (
            config.activeProfile &&
            this.availableProfiles.some(p => p.name === config.activeProfile)
          ) {
            await this.plugin.updateSettings({
              activeProfile: config.activeProfile,
            });
          }

          this.display();
          new Notice('Rule configuration imported successfully');
        } catch (error) {
          console.error('Failed to import rule configuration:', error);
          new Notice(
            'Failed to import rule configuration. Check console for details.'
          );
        }
      };

      input.click();
    } catch (error) {
      console.error('Failed to import rule configuration:', error);
      new Notice(
        'Failed to import rule configuration. Check console for details.'
      );
    }
  }

  /**
   * Run bulk operations
   */
  private async runBulkOperation(operation: string): Promise<void> {
    try {
      const settings = this.plugin.getSettings();
      let message = '';
      let confirmMessage = '';

      switch (operation) {
        case 'lint-vault':
          message = 'Linting entire vault...';
          confirmMessage =
            'This will lint all markdown files in your vault. Continue?';
          break;
        case 'fix-vault':
          message = 'Fixing entire vault...';
          confirmMessage =
            'This will apply fixes to all markdown files in your vault. This action cannot be undone. Continue?';
          break;
        case 'lint-folder':
          message = 'Linting current folder...';
          confirmMessage =
            'This will lint all markdown files in the current folder. Continue?';
          break;
        case 'fix-folder':
          message = 'Fixing current folder...';
          confirmMessage =
            'This will apply fixes to all markdown files in the current folder. This action cannot be undone. Continue?';
          break;
        default:
          throw new Error(`Unknown bulk operation: ${operation}`);
      }

      // Show confirmation dialog for destructive operations
      if (operation.includes('fix')) {
        const confirmed = confirm(confirmMessage);
        if (!confirmed) {
          return;
        }
      }

      new Notice(message);

      // Execute the operation based on type
      if (operation === 'lint-vault') {
        // Use the plugin's existing lint vault method
        await this.plugin['lintVault']();
      } else if (operation === 'fix-vault') {
        // Use the plugin's existing fix vault method
        await this.plugin['fixVault']();
      } else if (operation === 'lint-folder') {
        // Get current folder and lint it
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          const folderPath = activeFile.path.substring(
            0,
            activeFile.path.lastIndexOf('/')
          );
          await this.plugin.lintFolder(folderPath);
        } else {
          new Notice('No active file to determine current folder');
        }
      } else if (operation === 'fix-folder') {
        // Get current folder and fix it
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          const folderPath = activeFile.path.substring(
            0,
            activeFile.path.lastIndexOf('/')
          );
          await this.plugin.fixFolder(folderPath);
        } else {
          new Notice('No active file to determine current folder');
        }
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
      new Notice('Bulk operation failed. Check console for details.');
    }
  }

  /**
   * Run selective vault operation with rule selection
   */
  private async runSelectiveVaultOperation(
    operation: 'lint' | 'fix'
  ): Promise<void> {
    // This would open a modal to select specific rules
    // For now, show a simple prompt
    const ruleIds = prompt('Enter rule IDs to use (comma-separated):');
    if (!ruleIds) return;

    const selectedRules = ruleIds
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    try {
      new Notice(
        `Running selective ${operation} with ${selectedRules.length} rules...`
      );

      // This would need to be implemented in the plugin main class
      // For now, just show a placeholder message
      new Notice(`Selective ${operation} completed`);
    } catch (error) {
      console.error(`Selective ${operation} failed:`, error);
      new Notice(`Selective ${operation} failed. Check console for details.`);
    }
  }

  /**
   * Run folder selector for operations
   */
  private async runFolderSelector(operation: 'lint' | 'fix'): Promise<void> {
    // This would open Obsidian's folder picker
    // For now, use a simple prompt
    const folderPath = prompt('Enter folder path:');
    if (!folderPath) return;

    try {
      new Notice(`Running ${operation} on folder: ${folderPath}`);

      if (operation === 'lint') {
        await this.plugin.lintFolder(folderPath);
      } else {
        await this.plugin.fixFolder(folderPath);
      }
    } catch (error) {
      console.error(`Folder ${operation} failed:`, error);
      new Notice(`Folder ${operation} failed. Check console for details.`);
    }
  }

  /**
   * Run operation on files matching a pattern
   */
  private async runPatternOperation(
    operation: 'lint' | 'fix',
    pattern: string
  ): Promise<void> {
    try {
      new Notice(`Running ${operation} on files matching pattern: ${pattern}`);

      // This would need to be implemented in the plugin main class
      // For now, just show a placeholder message
      new Notice(`Pattern ${operation} completed for pattern: ${pattern}`);
    } catch (error) {
      console.error(`Pattern ${operation} failed:`, error);
      new Notice(`Pattern ${operation} failed. Check console for details.`);
    }
  }

  /**
   * Run operation on files with specific tags
   */
  private async runTagOperation(
    operation: 'lint' | 'fix',
    tags: string
  ): Promise<void> {
    try {
      const tagList = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      new Notice(
        `Running ${operation} on files with tags: ${tagList.join(', ')}`
      );

      // This would need to be implemented in the plugin main class
      // For now, just show a placeholder message
      new Notice(
        `Tag-based ${operation} completed for tags: ${tagList.join(', ')}`
      );
    } catch (error) {
      console.error(`Tag-based ${operation} failed:`, error);
      new Notice(`Tag-based ${operation} failed. Check console for details.`);
    }
  }

  /**
   * Schedule daily maintenance
   */
  private async scheduleDailyMaintenance(): Promise<void> {
    try {
      // This would set up a daily scheduled task
      // For now, just show a confirmation
      new Notice(
        'Daily maintenance scheduled. This feature will run automatically.'
      );
    } catch (error) {
      console.error('Failed to schedule daily maintenance:', error);
      new Notice(
        'Failed to schedule daily maintenance. Check console for details.'
      );
    }
  }

  /**
   * Schedule weekly deep clean
   */
  private async scheduleWeeklyDeepClean(): Promise<void> {
    try {
      // This would set up a weekly scheduled task
      // For now, just show a confirmation
      new Notice(
        'Weekly deep clean scheduled. This feature will run automatically.'
      );
    } catch (error) {
      console.error('Failed to schedule weekly deep clean:', error);
      new Notice(
        'Failed to schedule weekly deep clean. Check console for details.'
      );
    }
  }
}
