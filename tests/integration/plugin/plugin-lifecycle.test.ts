import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// Mock the obsidian module before importing the plugin
mock.module('obsidian', () => ({
  Plugin: class Plugin {
    app: any;
    async loadData(): Promise<any> {
      return {};
    }
    async saveData(data: any): Promise<void> {}
    addStatusBarItem(): any {
      return { setText: mock(), addClass: mock(), remove: mock() };
    }
    addCommand(command: any): void {}
    addSettingTab(settingTab: any): void {}
  },
  Notice: class Notice {
    constructor(message: string) {}
  },
}));

import ObsidianLintPlugin from '../../../src/plugin/main.js';
import { DEFAULT_PLUGIN_SETTINGS } from '../../../src/plugin/settings.js';

// Mock Obsidian API
const mockApp = {
  workspace: {
    getActiveFile: mock(() => null),
  },
  vault: {
    adapter: {
      basePath: '/test/vault',
    },
  },
};

const mockPlugin = {
  app: mockApp,
  loadData: mock(() => Promise.resolve({})),
  saveData: mock(() => Promise.resolve()),
  addStatusBarItem: mock(() => ({
    setText: mock(),
    addClass: mock(),
    remove: mock(),
  })),
  addCommand: mock(),
  addSettingTab: mock(),
};

describe('Plugin Lifecycle', () => {
  let plugin: ObsidianLintPlugin;

  beforeEach(() => {
    // Create plugin instance with mocked dependencies
    plugin = Object.assign(new ObsidianLintPlugin(), mockPlugin);

    // Reset all mocks
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Plugin Loading', () => {
    it('should load successfully with default settings', async () => {
      // Mock successful data loading
      mockPlugin.loadData.mockResolvedValue({});

      await expect(plugin.onload()).resolves.toBeUndefined();

      // Verify settings were loaded
      expect(plugin.getSettings()).toEqual(DEFAULT_PLUGIN_SETTINGS);
    });

    it('should load with existing settings', async () => {
      const existingSettings = {
        activeProfile: 'work',
        verbose: true,
        realTimeLinting: true,
      };

      mockPlugin.loadData.mockResolvedValue(existingSettings);

      await plugin.onload();

      const settings = plugin.getSettings();
      expect(settings.activeProfile).toBe('work');
      expect(settings.verbose).toBe(true);
      expect(settings.realTimeLinting).toBe(true);
    });

    it('should handle loading errors gracefully', async () => {
      mockPlugin.loadData.mockRejectedValue(new Error('Failed to load data'));

      await expect(plugin.onload()).rejects.toThrow(
        'Plugin initialization failed'
      );
    });

    it('should set up status bar', async () => {
      mockPlugin.loadData.mockResolvedValue({});

      await plugin.onload();

      expect(mockPlugin.addStatusBarItem).toHaveBeenCalled();
    });

    it('should register commands', async () => {
      mockPlugin.loadData.mockResolvedValue({});

      await plugin.onload();

      // Should register multiple commands
      expect(mockPlugin.addCommand).toHaveBeenCalledTimes(5);

      // Check specific commands were registered
      const commandCalls = mockPlugin.addCommand.mock.calls;
      const commandIds = commandCalls.map(call => call[0].id);

      expect(commandIds).toContain('lint-current-file');
      expect(commandIds).toContain('lint-vault');
      expect(commandIds).toContain('fix-current-file');
      expect(commandIds).toContain('fix-vault');
      expect(commandIds).toContain('show-lint-results');
    });

    it('should register settings tab', async () => {
      mockPlugin.loadData.mockResolvedValue({});

      await plugin.onload();

      expect(mockPlugin.addSettingTab).toHaveBeenCalled();
    });
  });

  describe('Plugin Unloading', () => {
    it('should unload successfully', async () => {
      // Load plugin first
      mockPlugin.loadData.mockResolvedValue({});
      await plugin.onload();

      // Then unload
      await expect(plugin.onunload()).resolves.toBeUndefined();
    });

    it('should clean up status bar on unload', async () => {
      const mockStatusBar = {
        setText: mock(),
        addClass: mock(),
        remove: mock(),
      };

      mockPlugin.addStatusBarItem.mockReturnValue(mockStatusBar);
      mockPlugin.loadData.mockResolvedValue({});

      await plugin.onload();
      await plugin.onunload();

      expect(mockStatusBar.remove).toHaveBeenCalled();
    });

    it('should handle unload errors gracefully', async () => {
      // Load plugin first
      mockPlugin.loadData.mockResolvedValue({});
      await plugin.onload();

      // Mock status bar removal error
      const mockStatusBar = {
        setText: mock(),
        addClass: mock(),
        remove: mock(() => {
          throw new Error('Removal failed');
        }),
      };

      // Manually set the status bar to trigger error
      (plugin as any).statusBarItem = mockStatusBar;

      // Should not throw, just log error
      await expect(plugin.onunload()).resolves.toBeUndefined();
    });
  });

  describe('Settings Management', () => {
    beforeEach(async () => {
      mockPlugin.loadData.mockResolvedValue({});
      await plugin.onload();
    });

    it('should save settings', async () => {
      mockPlugin.saveData.mockResolvedValue(undefined);

      await plugin.updateSettings({ verbose: true });

      expect(mockPlugin.saveData).toHaveBeenCalled();
      expect(plugin.getSettings().verbose).toBe(true);
    });

    it('should handle save errors', async () => {
      mockPlugin.saveData.mockRejectedValue(new Error('Save failed'));

      await expect(plugin.updateSettings({ verbose: true })).rejects.toThrow(
        'Failed to save plugin settings'
      );
    });

    it('should merge settings correctly', async () => {
      mockPlugin.saveData.mockResolvedValue(undefined);

      await plugin.updateSettings({
        verbose: true,
        activeProfile: 'test',
      });

      const settings = plugin.getSettings();
      expect(settings.verbose).toBe(true);
      expect(settings.activeProfile).toBe('test');
      // Other settings should remain default
      expect(settings.realTimeLinting).toBe(false);
    });
  });
});
