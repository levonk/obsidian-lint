/**
 * Integration tests for bulk operations in the plugin settings
 */

import { describe, it, expect } from 'bun:test';
import ObsidianLintPlugin from '../../../src/plugin/main.js';
import { ObsidianLintSettingTab } from '../../../src/plugin/settings-tab.js';
import type { App } from '../../../src/types/obsidian.js';

describe('Bulk Operations Integration', () => {
  it('should create plugin and settings tab instances', () => {
    // Mock app
    const mockApp = {
      workspace: {
        getActiveFile: () => null,
        getActiveViewOfType: () => null,
        on: () => {},
      },
      vault: {
        adapter: {
          basePath: '/test/vault',
        },
      },
    } as any;

    // Create plugin
    const plugin = new ObsidianLintPlugin();
    plugin.app = mockApp;

    // Create settings tab
    const settingsTab = new ObsidianLintSettingTab(mockApp, plugin);

    expect(plugin).toBeDefined();
    expect(settingsTab).toBeDefined();
    expect(settingsTab.plugin).toBe(plugin);
  });

  it('should have bulk operation methods available', () => {
    const mockApp = {} as any;
    const plugin = new ObsidianLintPlugin();

    expect(typeof plugin.lintFolder).toBe('function');
    expect(typeof plugin.fixFolder).toBe('function');
    expect(typeof plugin.getAvailableProfiles).toBe('function');
    expect(typeof plugin.getAvailableRules).toBe('function');
  });
});
