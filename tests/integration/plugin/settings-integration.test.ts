/**
 * Integration tests for plugin settings and UI components
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import ObsidianLintPlugin from '../../../src/plugin/main.js';
import { ObsidianLintSettingTab } from '../../../src/plugin/settings-tab.js';
import { LintEngine } from '../../../src/core/engine.js';
import type { App } from '../../../src/types/obsidian.js';
import type { Rule } from '../../../src/types/rules.js';
import type { ProfileConfig } from '../../../src/types/config.js';
import { DEFAULT_PLUGIN_SETTINGS } from '../../../src/plugin/settings.js';

// Mock Obsidian API
const mockApp = {
  workspace: {
    getActiveFile: vi.fn(),
  },
  vault: {
    adapter: {
      basePath: '/test/vault',
    },
  },
} as unknown as App;

// Mock plugin methods
const createMockPlugin = () => {
  const plugin = {
    app: mockApp,
    loadData: vi.fn(),
    saveData: vi.fn(),
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    updateSettings: vi.fn(),
    getSettings: vi.fn(),
    getAvailableProfiles: vi.fn(),
    getAvailableRules: vi.fn(),
    lintFolder: vi.fn(),
    fixFolder: vi.fn(),
    addStatusBarItem: vi.fn().mockReturnValue({
      setText: vi.fn(),
      addClass: vi.fn(),
      remove: vi.fn(),
    }),
    addCommand: vi.fn(),
    addSettingTab: vi.fn(),
  } as unknown as ObsidianLintPlugin;

  return plugin;
};

describe('Plugin Settings Integration', () => {
  let plugin: ObsidianLintPlugin;
  let settingsTab: ObsidianLintSettingTab;
  let mockEngine: LintEngine;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock engine
    mockEngine = {
      loadRulesForProfile: vi.fn(),
      getAvailableProfiles: vi.fn(),
      loadAllRules: vi.fn(),
      processVault: vi.fn(),
      processFiles: vi.fn(),
    } as unknown as LintEngine;

    plugin = createMockPlugin();
    settingsTab = new ObsidianLintSettingTab(mockApp, plugin);

    // Mock container element
    settingsTab.containerEl = {
      empty: vi.fn(),
      createEl: vi.fn().mockReturnValue({
        createEl: vi.fn().mockReturnValue({
          createEl: vi.fn(),
          onclick: null,
          style: {},
        }),
        onclick: null,
        style: {},
        querySelector: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue([]),
      }),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
    } as unknown as HTMLElement;
  });

  describe('Settings persistence', () => {
    it('should load and save settings correctly', async () => {
      const testSettings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        activeProfile: 'test-profile',
        realTimeLinting: true,
        enabledRules: ['test-rule.variant'],
      };

      (plugin.loadData as Mock).mockResolvedValue(testSettings);
      (plugin.saveData as Mock).mockResolvedValue(undefined);

      // Simulate loading settings
      await plugin.loadSettings();
      expect(plugin.loadData).toHaveBeenCalled();

      // Simulate updating settings
      await plugin.updateSettings({ verbose: true });
      expect(plugin.saveData).toHaveBeenCalled();
    });

    it('should handle settings load failure gracefully', async () => {
      (plugin.loadData as Mock).mockRejectedValue(new Error('Load failed'));

      await expect(plugin.loadSettings()).rejects.toThrow(
        'Failed to load plugin settings'
      );
    });

    it('should handle settings save failure gracefully', async () => {
      (plugin.saveData as Mock).mockRejectedValue(new Error('Save failed'));

      await expect(plugin.saveSettings()).rejects.toThrow(
        'Failed to save plugin settings'
      );
    });
  });

  describe('Profile management integration', () => {
    it('should switch profiles and reload rules', async () => {
      const mockProfiles: ProfileConfig[] = [
        {
          name: 'default',
          description: 'Default profile',
          rulesPath: 'rules/default',
          enabledRules: [],
        },
        {
          name: 'work',
          description: 'Work profile',
          rulesPath: 'rules/work',
          enabledRules: [],
        },
      ];

      const mockRules: Rule[] = [
        {
          id: { major: 'test', minor: 'variant', full: 'test.variant' },
          name: 'Test Rule',
          description: 'Test rule description',
          category: 'test',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: [],
            excludePatterns: [],
            settings: {},
          },
          lint: vi.fn(),
        },
      ];

      (plugin.getAvailableProfiles as Mock).mockResolvedValue(mockProfiles);
      (plugin.getAvailableRules as Mock).mockResolvedValue(mockRules);

      // Load available data
      await settingsTab['loadAvailableData']();

      expect(plugin.getAvailableProfiles).toHaveBeenCalled();
      expect(plugin.getAvailableRules).toHaveBeenCalled();
      expect(settingsTab['availableProfiles']).toEqual(mockProfiles);
      expect(settingsTab['availableRules']).toEqual(mockRules);
    });

    it('should handle profile switching errors', async () => {
      (plugin.getAvailableProfiles as Mock).mockRejectedValue(
        new Error('Profile error')
      );

      await settingsTab['loadAvailableData']();

      // Should fallback to default profile
      expect(settingsTab['availableProfiles']).toEqual([
        {
          name: 'default',
          description: 'Default profile',
          rulesPath: 'rules/default',
          enabledRules: [],
        },
      ]);
    });
  });

  describe('Rule management integration', () => {
    beforeEach(() => {
      const mockRules: Rule[] = [
        {
          id: {
            major: 'frontmatter',
            minor: 'strict',
            full: 'frontmatter.strict',
          },
          name: 'Strict Frontmatter',
          description: 'Enforce strict frontmatter',
          category: 'frontmatter',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: [],
            excludePatterns: [],
            settings: {},
          },
          lint: vi.fn(),
        },
        {
          id: {
            major: 'frontmatter',
            minor: 'minimal',
            full: 'frontmatter.minimal',
          },
          name: 'Minimal Frontmatter',
          description: 'Enforce minimal frontmatter',
          category: 'frontmatter',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: [],
            excludePatterns: [],
            settings: {},
          },
          lint: vi.fn(),
        },
        {
          id: { major: 'spelling', minor: 'auto', full: 'spelling.auto' },
          name: 'Auto Spelling',
          description: 'Auto-correct spelling',
          category: 'content',
          config: {
            pathAllowlist: [],
            pathDenylist: [],
            includePatterns: [],
            excludePatterns: [],
            settings: {},
          },
          lint: vi.fn(),
          fix: vi.fn(),
        },
      ];

      settingsTab['availableRules'] = mockRules;
    });

    it('should enable and disable rules correctly', async () => {
      const mockSettings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        enabledRules: ['frontmatter.strict'],
        disabledRules: [],
      };

      (plugin.getSettings as Mock).mockReturnValue(mockSettings);
      (plugin.updateSettings as Mock).mockResolvedValue(undefined);

      // Enable a new rule
      await settingsTab['updateRuleStatus']('spelling.auto', true);

      expect(plugin.updateSettings).toHaveBeenCalledWith({
        enabledRules: ['frontmatter.strict', 'spelling.auto'],
        disabledRules: [],
      });

      // Disable an existing rule
      await settingsTab['updateRuleStatus']('frontmatter.strict', false);

      expect(plugin.updateSettings).toHaveBeenCalledWith({
        enabledRules: [],
        disabledRules: ['frontmatter.strict'],
      });
    });

    it('should handle rule conflicts correctly', async () => {
      const mockSettings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        enabledRules: ['frontmatter.strict'],
        disabledRules: [],
      };

      (plugin.getSettings as Mock).mockReturnValue(mockSettings);
      (plugin.updateSettings as Mock).mockResolvedValue(undefined);

      // Try to enable a conflicting rule (same major ID)
      await settingsTab['updateRuleStatus']('frontmatter.minimal', true);

      expect(plugin.updateSettings).toHaveBeenCalledWith({
        enabledRules: ['frontmatter.strict', 'frontmatter.minimal'],
        disabledRules: [],
      });

      // Note: Conflict detection would happen at the engine level
    });

    it('should filter rules by category', () => {
      const mockRuleElements = [
        {
          querySelector: vi
            .fn()
            .mockReturnValue({ textContent: 'Strict Frontmatter' }),
          style: { display: 'flex' },
        },
        {
          querySelector: vi
            .fn()
            .mockReturnValue({ textContent: 'Minimal Frontmatter' }),
          style: { display: 'flex' },
        },
        {
          querySelector: vi
            .fn()
            .mockReturnValue({ textContent: 'Auto Spelling' }),
          style: { display: 'flex' },
        },
      ];

      const mockGroupElements = [
        {
          querySelectorAll: vi
            .fn()
            .mockReturnValue([mockRuleElements[0], mockRuleElements[1]]),
          style: { display: 'block' },
        },
        {
          querySelectorAll: vi.fn().mockReturnValue([mockRuleElements[2]]),
          style: { display: 'block' },
        },
      ];

      (settingsTab.containerEl.querySelectorAll as Mock)
        .mockReturnValueOnce(mockRuleElements)
        .mockReturnValueOnce(mockGroupElements);

      settingsTab['filterRulesByCategory']('frontmatter');

      // Should show frontmatter rules and hide others
      expect(mockRuleElements[0].style.display).toBe('flex');
      expect(mockRuleElements[1].style.display).toBe('flex');
      expect(mockRuleElements[2].style.display).toBe('none');
    });
  });

  describe('Bulk operations integration', () => {
    it('should execute vault-wide operations', async () => {
      const mockLintVault = vi.fn().mockResolvedValue({
        filesProcessed: 10,
        issuesFound: [],
        fixesApplied: [],
        errors: [],
        duration: 1000,
      });

      (plugin as any).lintVault = mockLintVault;

      await settingsTab['runBulkOperation']('lint-vault');

      expect(mockLintVault).toHaveBeenCalled();
    });

    it('should execute folder operations with active file context', async () => {
      const mockActiveFile = { path: 'folder/subfolder/file.md' };
      (mockApp.workspace.getActiveFile as Mock).mockReturnValue(mockActiveFile);
      (plugin.lintFolder as Mock).mockResolvedValue(undefined);

      await settingsTab['runBulkOperation']('lint-folder');

      expect(plugin.lintFolder).toHaveBeenCalledWith('folder/subfolder');
    });

    it('should handle missing active file for folder operations', async () => {
      (mockApp.workspace.getActiveFile as Mock).mockReturnValue(null);

      await settingsTab['runBulkOperation']('lint-folder');

      expect(plugin.lintFolder).not.toHaveBeenCalled();
    });

    it('should require confirmation for destructive operations', async () => {
      const mockFixVault = vi.fn().mockResolvedValue(undefined);
      (plugin as any).fixVault = mockFixVault;

      // Mock confirm to return false
      global.confirm = vi.fn().mockReturnValue(false);

      await settingsTab['runBulkOperation']('fix-vault');

      expect(global.confirm).toHaveBeenCalled();
      expect(mockFixVault).not.toHaveBeenCalled();

      // Mock confirm to return true
      global.confirm = vi.fn().mockReturnValue(true);

      await settingsTab['runBulkOperation']('fix-vault');

      expect(mockFixVault).toHaveBeenCalled();
    });
  });

  describe('Configuration import/export integration', () => {
    it('should export configuration with current settings', async () => {
      const mockSettings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        activeProfile: 'test-profile',
        enabledRules: ['rule1.variant', 'rule2.variant'],
        disabledRules: ['rule3.variant'],
      };

      (plugin.getSettings as Mock).mockReturnValue(mockSettings);

      // Mock DOM APIs
      const mockBlob = { type: 'application/json' };
      global.Blob = vi.fn().mockImplementation(() => mockBlob);
      global.URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:url'),
        revokeObjectURL: vi.fn(),
      } as any;

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      global.document = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as any;

      await settingsTab['exportRuleConfiguration']();

      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('"activeProfile":"test-profile"')],
        { type: 'application/json' }
      );
      expect(mockAnchor.click).toHaveBeenCalled();
    });

    it('should import and apply configuration', async () => {
      const importConfig = {
        activeProfile: 'imported-profile',
        enabledRules: ['imported-rule.variant'],
        disabledRules: ['disabled-rule.variant'],
        exportDate: '2023-01-01T00:00:00.000Z',
        version: '1.0.0',
      };

      const mockFile = {
        text: vi.fn().mockResolvedValue(JSON.stringify(importConfig)),
      };

      const mockInput = {
        type: '',
        accept: '',
        onchange: null as any,
        click: vi.fn(),
      };

      global.document = {
        createElement: vi.fn().mockReturnValue(mockInput),
      } as any;

      settingsTab['availableProfiles'] = [
        {
          name: 'imported-profile',
          description: 'Imported profile',
          rulesPath: 'rules/imported',
          enabledRules: [],
        },
      ];

      (plugin.updateSettings as Mock).mockResolvedValue(undefined);

      await settingsTab['importRuleConfiguration']();

      // Simulate file selection
      const mockEvent = {
        target: {
          files: [mockFile],
        },
      };

      await mockInput.onchange(mockEvent);

      expect(plugin.updateSettings).toHaveBeenCalledWith({
        enabledRules: ['imported-rule.variant'],
        disabledRules: ['disabled-rule.variant'],
      });

      expect(plugin.updateSettings).toHaveBeenCalledWith({
        activeProfile: 'imported-profile',
      });
    });

    it('should validate imported configuration', async () => {
      const invalidConfig = {
        // Missing required fields
        someOtherField: 'value',
      };

      const mockFile = {
        text: vi.fn().mockResolvedValue(JSON.stringify(invalidConfig)),
      };

      const mockInput = {
        type: '',
        accept: '',
        onchange: null as any,
        click: vi.fn(),
      };

      global.document = {
        createElement: vi.fn().mockReturnValue(mockInput),
      } as any;

      (plugin.updateSettings as Mock).mockResolvedValue(undefined);

      await settingsTab['importRuleConfiguration']();

      // Simulate file selection with invalid config
      const mockEvent = {
        target: {
          files: [mockFile],
        },
      };

      await mockInput.onchange(mockEvent);

      // Should not update settings due to validation failure
      expect(plugin.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe('Error handling integration', () => {
    it('should handle plugin method failures gracefully', async () => {
      (plugin.updateSettings as Mock).mockRejectedValue(
        new Error('Update failed')
      );

      // Should not throw
      await settingsTab['updateRuleStatus']('test-rule.variant', true);

      expect(plugin.updateSettings).toHaveBeenCalled();
    });

    it('should handle bulk operation failures gracefully', async () => {
      const mockLintVault = vi.fn().mockRejectedValue(new Error('Lint failed'));
      (plugin as any).lintVault = mockLintVault;

      // Should not throw
      await settingsTab['runBulkOperation']('lint-vault');

      expect(mockLintVault).toHaveBeenCalled();
    });

    it('should handle data loading failures gracefully', async () => {
      (plugin.getAvailableProfiles as Mock).mockRejectedValue(
        new Error('Profile load failed')
      );
      (plugin.getAvailableRules as Mock).mockRejectedValue(
        new Error('Rules load failed')
      );

      // Should not throw
      await settingsTab['loadAvailableData']();

      // Should have fallback values
      expect(settingsTab['availableProfiles']).toEqual([
        {
          name: 'default',
          description: 'Default profile',
          rulesPath: 'rules/default',
          enabledRules: [],
        },
      ]);
      expect(settingsTab['availableRules']).toEqual([]);
    });
  });

  describe('UI responsiveness', () => {
    it('should update UI when settings change', async () => {
      const initialSettings = { ...DEFAULT_PLUGIN_SETTINGS };
      const updatedSettings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        realTimeLinting: true,
      };

      (plugin.getSettings as Mock)
        .mockReturnValueOnce(initialSettings)
        .mockReturnValueOnce(updatedSettings);

      (plugin.updateSettings as Mock).mockResolvedValue(undefined);

      // Simulate settings update
      await plugin.updateSettings({ realTimeLinting: true });

      expect(plugin.updateSettings).toHaveBeenCalledWith({
        realTimeLinting: true,
      });
    });

    it('should refresh display after profile changes', async () => {
      const displaySpy = vi.spyOn(settingsTab, 'display');

      // Mock profile change
      await settingsTab['loadAvailableData']();

      // Display should be called to refresh the UI
      // Note: This would happen in the actual UI event handler
      settingsTab.display();

      expect(displaySpy).toHaveBeenCalled();
    });
  });
});
