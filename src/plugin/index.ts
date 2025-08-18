/**
 * Obsidian Plugin Entry Point
 * Exports the main plugin class and related types for Obsidian integration
 */

export { default as ObsidianLintPlugin } from './main.js';
export type { PluginSettings } from './settings.js';
export { DEFAULT_PLUGIN_SETTINGS, validatePluginSettings } from './settings.js';
export { ObsidianLintSettingTab } from './settings-tab.js';

// Re-export main plugin as default for Obsidian
export { default } from './main.js';
