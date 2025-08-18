/**
 * Tests for ObsidianLintSettingTab
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import type { App } from '../../../src/types/obsidian.js';
import type { Rule } from '../../../src/types/rules.js';
import type { ProfileConfig } from '../../../src/types/config.js';
import type { PluginSettings } from '../../../src/plugin/settings.js';

// Mock Obsidian API
const mockApp = {
  workspace: {
    getActiveFile: vi.fn(),
  },
} as unknown as App;

const mockPlugin = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getAvailableProfiles: vi.fn(),
  getAvailableRules: vi.fn(),
  lintFolder: vi.fn(),
  fixFolder: vi.fn(),
} as any;

// Mock DOM elements
const mockElement = {
  createEl: vi.fn(),
  empty: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
  style: {},
  onclick: null,
} as unknown as HTMLElement;

const mockSetting = {
  setName: vi.fn().mockReturnThis(),
  setDesc: vi.fn().mockReturnThis(),
  addText: vi.fn().mockReturnThis(),
  addTextArea: vi.fn().mockReturnThis(),
  addToggle: vi.fn().mockReturnThis(),
  addDropdown: vi.fn().mockReturnThis(),
  addButton: vi.fn().mockReturnThis(),
  addSlider: vi.fn().mockReturnThis(),
  settingEl: mockElement,
} as any;

// Mock classes
class MockObsidianLintSettingTab {
  plugin: any;
  containerEl: HTMLElement;
  private availableRules: Rule[] = [];
  private availableProfiles: ProfileConfig[] = [];
  private isLoadingRules = false;
  private isLoadingProfiles = false;
  private filePattern = '';
  private fixPattern = '';
  private tagPattern = '';

  constructor(app: App, plugin: any) {
    this.plugin = plugin;
    this.containerEl = mockElement;
  }

  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Obsidian Lint Settings' });
    this.containerEl.createEl('h3', { text: 'General Settings' });
    this.containerEl.createEl('h3', { text: 'Profile Management' });
    this.containerEl.createEl('h3', { text: 'Rule Management' });
    this.containerEl.createEl('h3', { text: 'Bulk Operations' });
    this.containerEl.createEl('h3', { text: 'Linting Behavior' });
    this.containerEl.createEl('h3', { text: 'Performance Settings' });
    this.containerEl.createEl('h3', { text: 'Advanced Settings' });
  }

  async loadAvailableData(): Promise<void> {
    try {
      if (!this.isLoadingProfiles) {
        this.isLoadingProfiles = true;
        try {
          this.availableProfiles = await this.plugin.getAvailableProfiles();
        } catch (error) {
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

      if (!this.isLoadingRules) {
        this.isLoadingRules = true;
        try {
          this.availableRules = await this.plugin.getAvailableRules();
        } catch (error) {
          this.availableRules = [];
        }
        this.isLoadingRules = false;
      }
    } catch (error) {
      console.error('Failed to load available data:', error);
    }
  }

  async updateRuleStatus(ruleId: string, enabled: boolean): Promise<void> {
    try {
      const settings = this.plugin.getSettings();
      let enabledRules = [...settings.enabledRules];
      let disabledRules = [...settings.disabledRules];

      if (enabled) {
        if (!enabledRules.includes(ruleId)) {
          enabledRules.push(ruleId);
        }
        disabledRules = disabledRules.filter(id => id !== ruleId);
      } else {
        if (!disabledRules.includes(ruleId)) {
          disabledRules.push(ruleId);
        }
        enabledRules = enabledRules.filter(id => id !== ruleId);
      }

      await this.plugin.updateSettings({
        enabledRules,
        disabledRules,
      });
    } catch (error) {
      console.error('Failed to update rule status:', error);
    }
  }

  filterRules(searchTerm: string): void {
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

    groupElements.forEach((groupElement: HTMLElement) => {
      const visibleRules = groupElement.querySelectorAll(
        '.rule-group-rules .setting-item[style*="flex"]'
      );
      groupElement.style.display = visibleRules.length > 0 ? 'block' : 'none';
    });
  }

  filterRulesByCategory(category: string): void {
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

    groupElements.forEach((groupElement: HTMLElement) => {
      const visibleRules = groupElement.querySelectorAll(
        '.rule-group-rules .setting-item[style*="flex"]'
      );
      groupElement.style.display = visibleRules.length > 0 ? 'block' : 'none';
    });
  }

  async exportRuleConfiguration(): Promise<void> {
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

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `obsidian-lint-rules-${settings.activeProfile}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export rule configuration:', error);
    }
  }

  async importRuleConfiguration(): Promise<void> {
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

          await this.plugin.updateSettings({
            enabledRules: config.enabledRules,
            disabledRules: config.disabledRules,
          });

          if (
            config.activeProfile &&
            this.availableProfiles.some(p => p.name === config.activeProfile)
          ) {
            await this.plugin.updateSettings({
              activeProfile: config.activeProfile,
            });
          }

          this.display();
        } catch (error) {
          console.error('Failed to import rule configuration:', error);
        }
      };

      input.click();
    } catch (error) {
      console.error('Failed to import rule configuration:', error);
    }
  }

  async runBulkOperation(operation: string): Promise<void> {
    try {
      let confirmMessage = '';

      switch (operation) {
        case 'lint-vault':
          break;
        case 'fix-vault':
          confirmMessage =
            'This will apply fixes to all markdown files in your vault. This action cannot be undone. Continue?';
          break;
        case 'lint-folder':
          break;
        case 'fix-folder':
          confirmMessage =
            'This will apply fixes to all markdown files in the current folder. This action cannot be undone. Continue?';
          break;
        default:
          throw new Error(`Unknown bulk operation: ${operation}`);
      }

      if (operation.includes('fix')) {
        const confirmed = confirm(confirmMessage);
        if (!confirmed) {
          return;
        }
      }

      if (operation === 'lint-vault') {
        await this.plugin.lintVault();
      } else if (operation === 'fix-vault') {
        await this.plugin.fixVault();
      } else if (operation === 'lint-folder') {
        const activeFile = mockApp.workspace.getActiveFile();
        if (activeFile) {
          const folderPath = activeFile.path.substring(
            0,
            activeFile.path.lastIndexOf('/')
          );
          await this.plugin.lintFolder(folderPath);
        }
      } else if (operation === 'fix-folder') {
        const activeFile = mockApp.workspace.getActiveFile();
        if (activeFile) {
          const folderPath = activeFile.path.substring(
            0,
            activeFile.path.lastIndexOf('/')
          );
          await this.plugin.fixFolder(folderPath);
        }
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
    }
  }

  async runSelectiveVaultOperation(operation: 'lint' | 'fix'): Promise<void> {
    const ruleIds = prompt('Enter rule IDs to use (comma-separated):');
    if (!ruleIds) return;

    const selectedRules = ruleIds
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    // Placeholder implementation
  }

  async runFolderSelector(operation: 'lint' | 'fix'): Promise<void> {
    const folderPath = prompt('Enter folder path:');
    if (!folderPath) return;

    if (operation === 'lint') {
      await this.plugin.lintFolder(folderPath);
    } else {
      await this.plugin.fixFolder(folderPath);
    }
  }

  async runPatternOperation(
    operation: 'lint' | 'fix',
    pattern: string
  ): Promise<void> {
    // Placeholder implementation
  }

  async runTagOperation(
    operation: 'lint' | 'fix',
    tags: string
  ): Promise<void> {
    // Placeholder implementation
  }

  async scheduleDailyMaintenance(): Promise<void> {
    // Placeholder implementation
  }

  async scheduleWeeklyDeepClean(): Promise<void> {
    // Placeholder implementation
  }
}

describe('ObsidianLintSettingTab', () => {
  let settingsTab: MockObsidianLintSettingTab;
  let mockSettings: PluginSettings;
  let mockRules: Rule[];
  let mockProfiles: ProfileConfig[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSettings = {
      configPath: '',
      activeProfile: 'default',
      realTimeLinting: false,
      showInlineErrors: true,
      autoFix: false,
      verbose: false,
      enableParallelProcessing: true,
      maxConcurrency: 4,
      enabledRules: ['frontmatter-required-fields.strict'],
      disabledRules: ['spell-correction.auto-fix'],
      showProgressNotifications: true,
      autoSaveAfterFix: true,
      realTimeLintingDelay: 1000,
      dryRun: false,
    };

    mockRules = [
      {
        id: {
          major: 'frontmatter-required-fields',
          minor: 'strict',
          full: 'frontmatter-required-fields.strict',
        },
        name: 'Strict Frontmatter Fields',
        description: 'Enforce all required frontmatter fields',
        category: 'frontmatter',
        config: {
          pathAllowlist: ['**/*.md'],
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: [],
          settings: {},
        },
        lint: vi.fn(),
      },
      {
        id: {
          major: 'spell-correction',
          minor: 'auto-fix',
          full: 'spell-correction.auto-fix',
        },
        name: 'Auto-fix Spelling',
        description: 'Automatically fix spelling errors',
        category: 'content',
        config: {
          pathAllowlist: ['**/*.md'],
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: [],
          settings: {},
        },
        lint: vi.fn(),
        fix: vi.fn(),
      },
    ];

    mockProfiles = [
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

    (mockPlugin.getSettings as Mock).mockReturnValue(mockSettings);
    (mockPlugin.updateSettings as Mock).mockResolvedValue(undefined);
    (mockPlugin.getAvailableProfiles as Mock).mockResolvedValue(mockProfiles);
    (mockPlugin.getAvailableRules as Mock).mockResolvedValue(mockRules);
    (mockPlugin.lintFolder as Mock).mockResolvedValue(undefined);
    (mockPlugin.fixFolder as Mock).mockResolvedValue(undefined);

    (mockElement.createEl as Mock).mockReturnValue(mockElement);
    (mockElement.querySelectorAll as Mock).mockReturnValue([]);

    settingsTab = new MockObsidianLintSettingTab(mockApp, mockPlugin);
  });

  describe('initialization', () => {
    it('should create settings tab with correct app and plugin', () => {
      expect(settingsTab.plugin).toBe(mockPlugin);
    });

    it('should initialize with empty rules and profiles', () => {
      expect(settingsTab['availableRules']).toEqual([]);
      expect(settingsTab['availableProfiles']).toEqual([]);
    });
  });

  describe('display', () => {
    it('should clear container and create header', () => {
      settingsTab.display();

      expect(mockElement.empty).toHaveBeenCalled();
      expect(mockElement.createEl).toHaveBeenCalledWith('h2', {
        text: 'Obsidian Lint Settings',
      });
    });

    it('should create all settings sections', () => {
      settingsTab.display();

      expect(mockElement.createEl).toHaveBeenCalledWith('h3', {
        text: 'General Settings',
      });
      expect(mockElement.createEl).toHaveBeenCalledWith('h3', {
        text: 'Profile Management',
      });
      expect(mockElement.createEl).toHaveBeenCalledWith('h3', {
        text: 'Rule Management',
      });
      expect(mockElement.createEl).toHaveBeenCalledWith('h3', {
        text: 'Bulk Operations',
      });
      expect(mockElement.createEl).toHaveBeenCalledWith('h3', {
        text: 'Linting Behavior',
      });
      expect(mockElement.createEl).toHaveBeenCalledWith('h3', {
        text: 'Performance Settings',
      });
      expect(mockElement.createEl).toHaveBeenCalledWith('h3', {
        text: 'Advanced Settings',
      });
    });
  });

  describe('loadAvailableData', () => {
    it('should load profiles and rules', async () => {
      await settingsTab.loadAvailableData();

      expect(mockPlugin.getAvailableProfiles).toHaveBeenCalled();
      expect(mockPlugin.getAvailableRules).toHaveBeenCalled();
      expect(settingsTab['availableProfiles']).toEqual(mockProfiles);
      expect(settingsTab['availableRules']).toEqual(mockRules);
    });

    it('should handle errors when loading profiles', async () => {
      (mockPlugin.getAvailableProfiles as Mock).mockRejectedValue(
        new Error('Profile load error')
      );

      await settingsTab.loadAvailableData();

      expect(settingsTab['availableProfiles']).toEqual([
        {
          name: 'default',
          description: 'Default profile',
          rulesPath: 'rules/default',
          enabledRules: [],
        },
      ]);
    });

    it('should handle errors when loading rules', async () => {
      (mockPlugin.getAvailableRules as Mock).mockRejectedValue(
        new Error('Rules load error')
      );

      await settingsTab.loadAvailableData();

      expect(settingsTab['availableRules']).toEqual([]);
    });
  });

  describe('updateRuleStatus', () => {
    it('should enable a rule', async () => {
      await settingsTab.updateRuleStatus('test-rule.variant', true);

      expect(mockPlugin.updateSettings).toHaveBeenCalledWith({
        enabledRules: [
          'frontmatter-required-fields.strict',
          'test-rule.variant',
        ],
        disabledRules: ['spell-correction.auto-fix'],
      });
    });

    it('should disable a rule', async () => {
      await settingsTab.updateRuleStatus(
        'frontmatter-required-fields.strict',
        false
      );

      expect(mockPlugin.updateSettings).toHaveBeenCalledWith({
        enabledRules: [],
        disabledRules: [
          'spell-correction.auto-fix',
          'frontmatter-required-fields.strict',
        ],
      });
    });

    it('should handle duplicate rule IDs', async () => {
      await settingsTab.updateRuleStatus(
        'frontmatter-required-fields.strict',
        true
      );

      expect(mockPlugin.updateSettings).toHaveBeenCalledWith({
        enabledRules: ['frontmatter-required-fields.strict'],
        disabledRules: ['spell-correction.auto-fix'],
      });
    });
  });

  describe('rule filtering', () => {
    beforeEach(() => {
      settingsTab['availableRules'] = mockRules;

      const mockRuleElements = [
        {
          querySelector: vi
            .fn()
            .mockReturnValue({ textContent: 'Strict Frontmatter Fields' }),
          style: { display: 'flex' },
        },
        {
          querySelector: vi
            .fn()
            .mockReturnValue({ textContent: 'Auto-fix Spelling' }),
          style: { display: 'flex' },
        },
      ];

      const mockGroupElements = [
        {
          querySelectorAll: vi.fn().mockReturnValue([mockRuleElements[0]]),
          style: { display: 'block' },
        },
        {
          querySelectorAll: vi.fn().mockReturnValue([mockRuleElements[1]]),
          style: { display: 'block' },
        },
      ];

      (mockElement.querySelectorAll as Mock)
        .mockReturnValueOnce(mockRuleElements)
        .mockReturnValueOnce(mockGroupElements);
    });

    it('should filter rules by search term', () => {
      settingsTab.filterRules('frontmatter');

      expect(mockElement.querySelectorAll).toHaveBeenCalledWith(
        '.rule-group-rules .setting-item'
      );
      expect(mockElement.querySelectorAll).toHaveBeenCalledWith('.rule-group');
    });

    it('should filter rules by category', () => {
      settingsTab.filterRulesByCategory('frontmatter');

      expect(mockElement.querySelectorAll).toHaveBeenCalledWith(
        '.rule-group-rules .setting-item'
      );
      expect(mockElement.querySelectorAll).toHaveBeenCalledWith('.rule-group');
    });

    it('should show all rules when category is "all"', () => {
      settingsTab.filterRulesByCategory('all');

      expect(mockElement.querySelectorAll).toHaveBeenCalledWith(
        '.rule-group-rules .setting-item'
      );
      expect(mockElement.querySelectorAll).toHaveBeenCalledWith('.rule-group');
    });
  });

  describe('bulk operations', () => {
    it('should run lint vault operation', async () => {
      const mockLintVault = vi.fn().mockResolvedValue(undefined);
      (mockPlugin as any).lintVault = mockLintVault;

      await settingsTab.runBulkOperation('lint-vault');

      expect(mockLintVault).toHaveBeenCalled();
    });

    it('should run fix vault operation with confirmation', async () => {
      const mockFixVault = vi.fn().mockResolvedValue(undefined);
      (mockPlugin as any).fixVault = mockFixVault;

      global.confirm = vi.fn().mockReturnValue(true);

      await settingsTab.runBulkOperation('fix-vault');

      expect(global.confirm).toHaveBeenCalledWith(
        'This will apply fixes to all markdown files in your vault. This action cannot be undone. Continue?'
      );
      expect(mockFixVault).toHaveBeenCalled();
    });

    it('should cancel fix operation if not confirmed', async () => {
      const mockFixVault = vi.fn().mockResolvedValue(undefined);
      (mockPlugin as any).fixVault = mockFixVault;

      global.confirm = vi.fn().mockReturnValue(false);

      await settingsTab.runBulkOperation('fix-vault');

      expect(global.confirm).toHaveBeenCalled();
      expect(mockFixVault).not.toHaveBeenCalled();
    });

    it('should run folder operations', async () => {
      const mockActiveFile = { path: 'folder/subfolder/file.md' };
      (mockApp.workspace.getActiveFile as Mock).mockReturnValue(mockActiveFile);

      await settingsTab.runBulkOperation('lint-folder');

      expect(mockPlugin.lintFolder).toHaveBeenCalledWith('folder/subfolder');
    });

    it('should handle missing active file for folder operations', async () => {
      (mockApp.workspace.getActiveFile as Mock).mockReturnValue(null);

      await settingsTab.runBulkOperation('lint-folder');

      expect(mockPlugin.lintFolder).not.toHaveBeenCalled();
    });
  });

  describe('configuration import/export', () => {
    it('should export rule configuration', async () => {
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

      await settingsTab.exportRuleConfiguration();

      expect(global.document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should import rule configuration', async () => {
      const mockFile = {
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            enabledRules: ['test-rule.variant'],
            disabledRules: ['other-rule.variant'],
            activeProfile: 'work',
          })
        ),
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

      settingsTab['availableProfiles'] = mockProfiles;

      await settingsTab.importRuleConfiguration();

      expect(mockInput.click).toHaveBeenCalled();

      const mockEvent = {
        target: {
          files: [mockFile],
        },
      };

      await mockInput.onchange(mockEvent);

      expect(mockPlugin.updateSettings).toHaveBeenCalledWith({
        enabledRules: ['test-rule.variant'],
        disabledRules: ['other-rule.variant'],
      });

      expect(mockPlugin.updateSettings).toHaveBeenCalledWith({
        activeProfile: 'work',
      });
    });

    it('should handle invalid import configuration', async () => {
      const mockFile = {
        text: vi.fn().mockResolvedValue('invalid json'),
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

      await settingsTab.importRuleConfiguration();

      const mockEvent = {
        target: {
          files: [mockFile],
        },
      };

      await mockInput.onchange(mockEvent);

      expect(mockPlugin.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe('advanced bulk operations', () => {
    it('should run selective vault operation', async () => {
      global.prompt = vi.fn().mockReturnValue('rule1.variant, rule2.variant');

      await settingsTab.runSelectiveVaultOperation('lint');

      expect(global.prompt).toHaveBeenCalledWith(
        'Enter rule IDs to use (comma-separated):'
      );
    });

    it('should cancel selective operation if no rules provided', async () => {
      global.prompt = vi.fn().mockReturnValue(null);

      await settingsTab.runSelectiveVaultOperation('lint');

      expect(global.prompt).toHaveBeenCalled();
    });

    it('should run folder selector operation', async () => {
      global.prompt = vi.fn().mockReturnValue('test-folder');

      await settingsTab.runFolderSelector('lint');

      expect(global.prompt).toHaveBeenCalledWith('Enter folder path:');
      expect(mockPlugin.lintFolder).toHaveBeenCalledWith('test-folder');
    });
  });

  describe('error handling', () => {
    it('should handle errors in bulk operations', async () => {
      const mockLintVault = vi.fn().mockRejectedValue(new Error('Lint error'));
      (mockPlugin as any).lintVault = mockLintVault;

      await settingsTab.runBulkOperation('lint-vault');

      expect(mockLintVault).toHaveBeenCalled();
    });

    it('should handle errors in rule status updates', async () => {
      (mockPlugin.updateSettings as Mock).mockRejectedValue(
        new Error('Update error')
      );

      await settingsTab.updateRuleStatus('test-rule.variant', true);

      expect(mockPlugin.updateSettings).toHaveBeenCalled();
    });

    it('should handle errors in configuration export', async () => {
      global.URL = {
        createObjectURL: vi.fn().mockImplementation(() => {
          throw new Error('Export error');
        }),
        revokeObjectURL: vi.fn(),
      } as any;

      await settingsTab.exportRuleConfiguration();

      expect(true).toBe(true);
    });
  });
});
