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

// Mock Obsidian API
const mockActiveFile = {
  name: 'test.md',
  path: 'test.md',
};

const mockApp = {
  workspace: {
    getActiveFile: mock(() => mockActiveFile),
  },
  vault: {
    adapter: {
      basePath: '/test/vault',
    },
  },
};

const mockEngine = {
  processFiles: mock(() =>
    Promise.resolve({
      filesProcessed: 1,
      issuesFound: [],
      fixesApplied: [],
      errors: [],
      duration: 100,
    })
  ),
  processVault: mock(() =>
    Promise.resolve({
      filesProcessed: 10,
      issuesFound: [],
      fixesApplied: [],
      errors: [],
      duration: 1000,
    })
  ),
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

// Mock Notice
global.Notice = mock();

describe('Plugin Commands', () => {
  let plugin: ObsidianLintPlugin;
  let registeredCommands: Map<string, any>;

  beforeEach(async () => {
    // Reset mocks
    mock.restore();
    registeredCommands = new Map();

    // Create plugin instance with mocked dependencies
    plugin = Object.assign(new ObsidianLintPlugin(), mockPlugin);

    // Mock the engine
    (plugin as any).engine = mockEngine;

    // Capture registered commands
    mockPlugin.addCommand.mockImplementation(command => {
      registeredCommands.set(command.id, command);
    });

    // Load the plugin to register commands
    await plugin.onload();
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Command Registration', () => {
    it('should register all required commands', () => {
      expect(registeredCommands.size).toBe(5);
      expect(registeredCommands.has('lint-current-file')).toBe(true);
      expect(registeredCommands.has('lint-vault')).toBe(true);
      expect(registeredCommands.has('fix-current-file')).toBe(true);
      expect(registeredCommands.has('fix-vault')).toBe(true);
      expect(registeredCommands.has('show-lint-results')).toBe(true);
    });

    it('should register commands with correct names', () => {
      expect(registeredCommands.get('lint-current-file').name).toBe(
        'Lint current file'
      );
      expect(registeredCommands.get('lint-vault').name).toBe(
        'Lint entire vault'
      );
      expect(registeredCommands.get('fix-current-file').name).toBe(
        'Fix current file'
      );
      expect(registeredCommands.get('fix-vault').name).toBe('Fix entire vault');
      expect(registeredCommands.get('show-lint-results').name).toBe(
        'Show lint results'
      );
    });

    it('should register hotkey for lint-current-file command', () => {
      const command = registeredCommands.get('lint-current-file');
      expect(command.hotkeys).toEqual([
        { modifiers: ['Mod', 'Shift'], key: 'l' },
      ]);
    });
  });

  describe('Lint Current File Command', () => {
    it('should lint current file successfully', async () => {
      const command = registeredCommands.get('lint-current-file');

      await command.callback();

      expect(mockEngine.processFiles).toHaveBeenCalledWith(['test.md'], {
        dryRun: false,
        fix: false,
        verbose: false,
        parallel: false,
      });
      expect(global.Notice).toHaveBeenCalledWith(
        'Linted test.md: No issues found'
      );
    });

    it('should handle no active file', async () => {
      mockApp.workspace.getActiveFile.mockReturnValue(null);
      const command = registeredCommands.get('lint-current-file');

      await command.callback();

      expect(mockEngine.processFiles).not.toHaveBeenCalled();
      expect(global.Notice).toHaveBeenCalledWith('No active file to lint');
    });

    it('should handle non-markdown file', async () => {
      mockApp.workspace.getActiveFile.mockReturnValue({
        name: 'test.txt',
        path: 'test.txt',
      });
      const command = registeredCommands.get('lint-current-file');

      await command.callback();

      expect(mockEngine.processFiles).not.toHaveBeenCalled();
      expect(global.Notice).toHaveBeenCalledWith(
        'Active file is not a markdown file'
      );
    });

    it('should handle linting errors', async () => {
      mockEngine.processFiles.mockRejectedValue(new Error('Linting failed'));
      const command = registeredCommands.get('lint-current-file');

      await command.callback();

      expect(global.Notice).toHaveBeenCalledWith(
        'Failed to lint current file: Linting failed'
      );
    });

    it('should report issues found', async () => {
      mockEngine.processFiles.mockResolvedValue({
        filesProcessed: 1,
        issuesFound: [
          {
            ruleId: 'test-rule',
            severity: 'error',
            message: 'Test issue',
            file: 'test.md',
            fixable: false,
          },
        ],
        fixesApplied: [],
        errors: [],
        duration: 100,
      });

      const command = registeredCommands.get('lint-current-file');
      await command.callback();

      expect(global.Notice).toHaveBeenCalledWith(
        'Linted test.md: 1 issues found, 1 remaining'
      );
    });
  });

  describe('Lint Vault Command', () => {
    it('should lint entire vault successfully', async () => {
      const command = registeredCommands.get('lint-vault');

      await command.callback();

      expect(mockEngine.processVault).toHaveBeenCalledWith('/test/vault', {
        dryRun: false,
        fix: false,
        verbose: false,
        parallel: true,
        profile: 'default',
      });
      expect(global.Notice).toHaveBeenCalledWith(
        'Vault linting complete: No issues found'
      );
    });

    it('should handle vault linting errors', async () => {
      mockEngine.processVault.mockRejectedValue(
        new Error('Vault linting failed')
      );
      const command = registeredCommands.get('lint-vault');

      await command.callback();

      expect(global.Notice).toHaveBeenCalledWith(
        'Failed to lint vault: Vault linting failed'
      );
    });
  });

  describe('Fix Current File Command', () => {
    it('should fix current file successfully', async () => {
      const command = registeredCommands.get('fix-current-file');

      await command.callback();

      expect(mockEngine.processFiles).toHaveBeenCalledWith(['test.md'], {
        dryRun: false,
        fix: true,
        verbose: false,
        parallel: false,
      });
      expect(global.Notice).toHaveBeenCalledWith(
        'Fixed test.md: No issues found'
      );
    });

    it('should handle no active file for fixing', async () => {
      mockApp.workspace.getActiveFile.mockReturnValue(null);
      const command = registeredCommands.get('fix-current-file');

      await command.callback();

      expect(mockEngine.processFiles).not.toHaveBeenCalled();
      expect(global.Notice).toHaveBeenCalledWith('No active file to fix');
    });

    it('should report fixes applied', async () => {
      mockEngine.processFiles.mockResolvedValue({
        filesProcessed: 1,
        issuesFound: [
          {
            ruleId: 'test-rule',
            severity: 'error',
            message: 'Test issue',
            file: 'test.md',
            fixable: true,
          },
        ],
        fixesApplied: [
          {
            ruleId: 'test-rule',
            file: 'test.md',
            description: 'Fixed test issue',
            changes: [],
          },
        ],
        errors: [],
        duration: 100,
      });

      const command = registeredCommands.get('fix-current-file');
      await command.callback();

      expect(global.Notice).toHaveBeenCalledWith(
        'Fixed test.md: 1 issues found, 1 fixed'
      );
    });
  });

  describe('Fix Vault Command', () => {
    it('should fix entire vault successfully', async () => {
      const command = registeredCommands.get('fix-vault');

      await command.callback();

      expect(mockEngine.processVault).toHaveBeenCalledWith('/test/vault', {
        dryRun: false,
        fix: true,
        verbose: false,
        parallel: true,
        profile: 'default',
      });
      expect(global.Notice).toHaveBeenCalledWith(
        'Vault fixing complete: No issues found'
      );
    });

    it('should handle vault fixing errors', async () => {
      mockEngine.processVault.mockRejectedValue(
        new Error('Vault fixing failed')
      );
      const command = registeredCommands.get('fix-vault');

      await command.callback();

      expect(global.Notice).toHaveBeenCalledWith(
        'Failed to fix vault: Vault fixing failed'
      );
    });
  });

  describe('Show Lint Results Command', () => {
    it('should show not implemented notice', async () => {
      const command = registeredCommands.get('show-lint-results');

      await command.callback();

      expect(global.Notice).toHaveBeenCalledWith(
        'Lint results display not yet implemented'
      );
    });
  });

  describe('Status Bar Updates', () => {
    let mockStatusBar: any;

    beforeEach(() => {
      mockStatusBar = {
        setText: mock(),
        addClass: mock(),
        remove: mock(),
      };
      mockPlugin.addStatusBarItem.mockReturnValue(mockStatusBar);
    });

    it('should update status bar during operations', async () => {
      // Reload plugin to get new status bar mock
      await plugin.onunload();
      await plugin.onload();

      const command = registeredCommands.get('lint-current-file');
      await command.callback();

      // Should update status during operation and reset after
      expect(mockStatusBar.setText).toHaveBeenCalledWith(
        'Obsidian Lint: Linting current file...'
      );
      expect(mockStatusBar.setText).toHaveBeenCalledWith(
        'Obsidian Lint: Ready'
      );
    });

    it('should show error status on failure', async () => {
      mockEngine.processFiles.mockRejectedValue(new Error('Test error'));

      // Reload plugin to get new status bar mock
      await plugin.onunload();
      await plugin.onload();

      const command = registeredCommands.get('lint-current-file');
      await command.callback();

      expect(mockStatusBar.setText).toHaveBeenCalledWith(
        'Obsidian Lint: Error'
      );
    });
  });
});
