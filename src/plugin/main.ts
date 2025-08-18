import { Plugin, Notice } from '../types/obsidian.js';
import type { TFile, Command } from '../types/obsidian.js';
import { LintEngine } from '../core/engine.js';
import { Configuration } from '../types/config.js';
import { LintResult } from '../types/common.js';
import { PluginSettings, DEFAULT_PLUGIN_SETTINGS } from './settings.js';
import { ObsidianLintSettingTab } from './settings-tab.js';
import { ErrorCodes, LintError } from '../types/errors.js';
import { EditorLinter } from './editor-linter.js';
import { ObsidianEditorIntegrationImpl } from './obsidian-editor-integration.js';

/**
 * Main Obsidian plugin class for the Obsidian Lint Tool
 * Provides integration between the core linting engine and Obsidian's API
 */
export default class ObsidianLintPlugin extends Plugin {
  private engine: LintEngine;
  private settings: PluginSettings;
  private statusBarItem: HTMLElement;
  private editorLinter: EditorLinter | null = null;
  private editorIntegration: ObsidianEditorIntegrationImpl | null = null;

  /**
   * Plugin initialization - called when plugin is loaded
   */
  async onload(): Promise<void> {
    try {
      // Load plugin settings
      await this.loadSettings();

      // Initialize the lint engine
      this.engine = new LintEngine();

      // Set up UI components
      this.setupStatusBar();
      this.setupCommands();
      this.setupSettingsTab();

      // Initialize editor linting if enabled
      await this.initializeEditorLinting();

      console.log('Obsidian Lint Plugin loaded successfully');
    } catch (error) {
      console.error('Failed to load Obsidian Lint Plugin:', error);
      new Notice(
        'Failed to load Obsidian Lint Plugin. Check console for details.'
      );
      throw new LintError(
        'Plugin initialization failed',
        ErrorCodes.PLUGIN_INITIALIZATION_ERROR,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Plugin cleanup - called when plugin is unloaded
   */
  async onunload(): Promise<void> {
    try {
      // Clean up editor integration
      if (this.editorIntegration) {
        this.editorIntegration.unregisterChangeHandlers();
        this.editorIntegration = null;
      }

      // Clean up editor linter
      if (this.editorLinter) {
        this.editorLinter.stopLinting();
        this.editorLinter = null;
      }

      // Clean up status bar
      if (this.statusBarItem) {
        this.statusBarItem.remove();
      }

      console.log('Obsidian Lint Plugin unloaded successfully');
    } catch (error) {
      console.error('Error during plugin unload:', error);
    }
  }

  /**
   * Load plugin settings from Obsidian's data storage
   */
  async loadSettings(): Promise<void> {
    try {
      const data = await this.loadData();
      this.settings = Object.assign({}, DEFAULT_PLUGIN_SETTINGS, data);
    } catch (error) {
      console.error('Failed to load plugin settings:', error);
      this.settings = DEFAULT_PLUGIN_SETTINGS;
      throw new LintError(
        'Failed to load plugin settings',
        ErrorCodes.PLUGIN_SETTINGS_ERROR,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Save plugin settings to Obsidian's data storage
   */
  async saveSettings(): Promise<void> {
    try {
      await this.saveData(this.settings);
    } catch (error) {
      console.error('Failed to save plugin settings:', error);
      throw new LintError(
        'Failed to save plugin settings',
        ErrorCodes.PLUGIN_SETTINGS_ERROR,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get current plugin settings
   */
  getSettings(): PluginSettings {
    return this.settings;
  }

  /**
   * Update plugin settings
   */
  async updateSettings(newSettings: Partial<PluginSettings>): Promise<void> {
    const oldSettings = { ...this.settings };
    this.settings = Object.assign(this.settings, newSettings);
    await this.saveSettings();

    // Reinitialize editor linting if real-time linting settings changed
    if (
      oldSettings.realTimeLinting !== this.settings.realTimeLinting ||
      oldSettings.realTimeLintingDelay !== this.settings.realTimeLintingDelay ||
      oldSettings.showInlineErrors !== this.settings.showInlineErrors
    ) {
      await this.initializeEditorLinting();
    }
  }

  /**
   * Set up status bar item
   */
  private setupStatusBar(): void {
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('Obsidian Lint: Ready');
    this.statusBarItem.addClass('obsidian-lint-status');
  }

  /**
   * Set up command palette commands
   */
  private setupCommands(): void {
    // Lint current file command
    this.addCommand({
      id: 'lint-current-file',
      name: 'Lint current file',
      callback: () => this.lintCurrentFile(),
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'l' }],
    });

    // Lint entire vault command
    this.addCommand({
      id: 'lint-vault',
      name: 'Lint entire vault',
      callback: () => this.lintVault(),
    });

    // Fix current file command
    this.addCommand({
      id: 'fix-current-file',
      name: 'Fix current file',
      callback: () => this.fixCurrentFile(),
    });

    // Fix entire vault command
    this.addCommand({
      id: 'fix-vault',
      name: 'Fix entire vault',
      callback: () => this.fixVault(),
    });

    // Show lint results command
    this.addCommand({
      id: 'show-lint-results',
      name: 'Show lint results',
      callback: () => this.showLintResults(),
    });

    // Toggle real-time linting command
    this.addCommand({
      id: 'toggle-realtime-linting',
      name: 'Toggle real-time linting',
      callback: () => this.toggleRealtimeLinting(),
    });

    // Clear editor indicators command
    this.addCommand({
      id: 'clear-editor-indicators',
      name: 'Clear editor indicators',
      callback: () => this.clearEditorIndicators(),
    });
  }

  /**
   * Set up settings tab
   */
  private setupSettingsTab(): void {
    this.addSettingTab(new ObsidianLintSettingTab(this.app, this));
  }

  /**
   * Lint the currently active file
   */
  private async lintCurrentFile(): Promise<void> {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice('No active file to lint');
        return;
      }

      if (!activeFile.path.endsWith('.md')) {
        new Notice('Active file is not a markdown file');
        return;
      }

      this.updateStatusBar('Linting current file...');

      const result = await this.engine.processFiles([activeFile.path], {
        dryRun: false,
        fix: false,
        verbose: this.settings.verbose,
        parallel: false,
      });

      this.handleLintResult(result, `Linted ${activeFile.name}`);
    } catch (error) {
      this.handleError('Failed to lint current file', error);
    }
  }

  /**
   * Lint the entire vault
   */
  private async lintVault(): Promise<void> {
    try {
      this.updateStatusBar('Linting vault...');

      const result = await this.engine.processVault(
        this.app.vault.adapter.basePath,
        {
          dryRun: false,
          fix: false,
          verbose: this.settings.verbose,
          parallel: this.settings.enableParallelProcessing,
          profile: this.settings.activeProfile,
        }
      );

      this.handleLintResult(result, 'Vault linting complete');
    } catch (error) {
      this.handleError('Failed to lint vault', error);
    }
  }

  /**
   * Fix the currently active file
   */
  private async fixCurrentFile(): Promise<void> {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice('No active file to fix');
        return;
      }

      if (!activeFile.path.endsWith('.md')) {
        new Notice('Active file is not a markdown file');
        return;
      }

      this.updateStatusBar('Fixing current file...');

      const result = await this.engine.processFiles([activeFile.path], {
        dryRun: false,
        fix: true,
        verbose: this.settings.verbose,
        parallel: false,
      });

      this.handleLintResult(result, `Fixed ${activeFile.name}`);
    } catch (error) {
      this.handleError('Failed to fix current file', error);
    }
  }

  /**
   * Fix the entire vault
   */
  private async fixVault(): Promise<void> {
    try {
      this.updateStatusBar('Fixing vault...');

      const result = await this.engine.processVault(
        this.app.vault.adapter.basePath,
        {
          dryRun: false,
          fix: true,
          verbose: this.settings.verbose,
          parallel: this.settings.enableParallelProcessing,
          profile: this.settings.activeProfile,
        }
      );

      this.handleLintResult(result, 'Vault fixing complete');
    } catch (error) {
      this.handleError('Failed to fix vault', error);
    }
  }

  /**
   * Show lint results in a modal or notice
   */
  private showLintResults(): void {
    if (this.editorLinter) {
      const result = this.editorLinter.getLastResult();
      if (result) {
        const message = `Found ${result.issues.length} issues in ${result.processingTime}ms`;
        new Notice(message);
      } else {
        new Notice('No recent lint results available');
      }
    } else {
      new Notice('Real-time linting is not enabled');
    }
  }

  /**
   * Toggle real-time linting on/off
   */
  private async toggleRealtimeLinting(): Promise<void> {
    try {
      const newValue = !this.settings.realTimeLinting;
      await this.updateSettings({ realTimeLinting: newValue });

      const status = newValue ? 'enabled' : 'disabled';
      new Notice(`Real-time linting ${status}`);
    } catch (error) {
      this.handleError('Failed to toggle real-time linting', error);
    }
  }

  /**
   * Clear all editor indicators
   */
  private clearEditorIndicators(): void {
    if (this.editorIntegration) {
      this.editorIntegration.clearIndicators();
      new Notice('Editor indicators cleared');
    } else {
      new Notice('Real-time linting is not enabled');
    }
  }

  /**
   * Handle lint operation results
   */
  private handleLintResult(result: LintResult, successMessage: string): void {
    const { filesProcessed, issuesFound, fixesApplied } = result;

    if (issuesFound.length === 0) {
      new Notice(`${successMessage}: No issues found`);
    } else {
      const fixedCount = fixesApplied.length;
      const remainingIssues = issuesFound.length - fixedCount;

      let message = `${successMessage}: ${issuesFound.length} issues found`;
      if (fixedCount > 0) {
        message += `, ${fixedCount} fixed`;
      }
      if (remainingIssues > 0) {
        message += `, ${remainingIssues} remaining`;
      }

      new Notice(message);
    }

    this.updateStatusBar('Ready');
  }

  /**
   * Handle errors during lint operations
   */
  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    new Notice(`${message}: ${errorMessage}`);
    this.updateStatusBar('Error');
  }

  /**
   * Update status bar text
   */
  private updateStatusBar(text: string): void {
    if (this.statusBarItem) {
      this.statusBarItem.setText(`Obsidian Lint: ${text}`);
    }
  }

  /**
   * Initialize editor linting functionality
   */
  private async initializeEditorLinting(): Promise<void> {
    try {
      // Clean up existing editor integration
      if (this.editorIntegration) {
        this.editorIntegration.unregisterChangeHandlers();
        this.editorIntegration = null;
      }

      if (this.editorLinter) {
        this.editorLinter.stopLinting();
        this.editorLinter = null;
      }

      // Only initialize if real-time linting is enabled
      if (!this.settings.realTimeLinting) {
        return;
      }

      // Load rules for editor linting
      const rules = await this.engine.loadRulesForProfile(
        this.settings.activeProfile
      );

      // Create editor linter with settings
      this.editorLinter = new EditorLinter(rules, {
        debounceDelay: this.settings.realTimeLintingDelay,
        enableQuickFixes: true,
        showInlineErrors: this.settings.showInlineErrors,
        maxIssuesPerFile: 50,
        enabledSeverities: ['error', 'warning', 'info'],
      });

      // Create editor integration
      this.editorIntegration = new ObsidianEditorIntegrationImpl(
        this,
        this.editorLinter
      );

      // Register change handlers
      this.editorIntegration.registerChangeHandlers();

      console.log('Editor linting initialized successfully');
    } catch (error) {
      console.error('Failed to initialize editor linting:', error);
      // Don't throw - allow plugin to continue working without real-time linting
    }
  }

  /**
   * Get the editor linter instance (for testing)
   */
  getEditorLinter(): EditorLinter | null {
    return this.editorLinter;
  }

  /**
   * Get the editor integration instance (for testing)
   */
  getEditorIntegration(): ObsidianEditorIntegrationImpl | null {
    return this.editorIntegration;
  }

  /**
   * Lint files in a specific folder
   */
  async lintFolder(folderPath: string): Promise<void> {
    try {
      this.updateStatusBar('Linting folder...');

      // Get all markdown files in the folder
      const files = await this.getMarkdownFilesInFolder(folderPath);

      if (files.length === 0) {
        new Notice('No markdown files found in folder');
        return;
      }

      const result = await this.engine.processFiles(files, {
        dryRun: false,
        fix: false,
        verbose: this.settings.verbose,
        parallel: this.settings.enableParallelProcessing,
      });

      this.handleLintResult(result, `Linted folder ${folderPath}`);
    } catch (error) {
      this.handleError('Failed to lint folder', error);
    }
  }

  /**
   * Fix files in a specific folder
   */
  async fixFolder(folderPath: string): Promise<void> {
    try {
      this.updateStatusBar('Fixing folder...');

      // Get all markdown files in the folder
      const files = await this.getMarkdownFilesInFolder(folderPath);

      if (files.length === 0) {
        new Notice('No markdown files found in folder');
        return;
      }

      const result = await this.engine.processFiles(files, {
        dryRun: false,
        fix: true,
        verbose: this.settings.verbose,
        parallel: this.settings.enableParallelProcessing,
      });

      this.handleLintResult(result, `Fixed folder ${folderPath}`);
    } catch (error) {
      this.handleError('Failed to fix folder', error);
    }
  }

  /**
   * Get all markdown files in a folder
   */
  private async getMarkdownFilesInFolder(
    folderPath: string
  ): Promise<string[]> {
    // This would need to be implemented using Obsidian's vault API
    // For now, return a placeholder
    return [];
  }

  /**
   * Get available profiles from the engine
   */
  async getAvailableProfiles(): Promise<ProfileConfig[]> {
    try {
      return await this.engine.getAvailableProfiles();
    } catch (error) {
      console.error('Failed to get available profiles:', error);
      return [];
    }
  }

  /**
   * Get available rules for the current profile
   */
  async getAvailableRules(): Promise<Rule[]> {
    try {
      return await this.engine.loadAllRules(this.settings.activeProfile);
    } catch (error) {
      console.error('Failed to get available rules:', error);
      return [];
    }
  }
}
