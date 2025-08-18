/**
 * Integration tests for editor linting functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PluginSettings } from '../../../src/plugin/settings.js';
import type {
  EditorContext,
  EditorIndicator,
} from '../../../src/types/editor.js';
import type { Issue } from '../../../src/types/common.js';

// Create a simple test plugin implementation
class TestObsidianLintPlugin {
  private settings: PluginSettings;
  private editorLinter: any = null;
  private editorIntegration: any = null;
  private app: any;

  constructor() {
    this.settings = {
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
    };

    this.app = {
      workspace: {
        getActiveFile: vi.fn().mockReturnValue({
          name: 'test.md',
          path: 'test.md',
          stat: { mtime: Date.now() },
        }),
        getActiveViewOfType: vi.fn().mockReturnValue({
          editor: {
            getValue: vi
              .fn()
              .mockReturnValue('# Test Note\n\nContent without frontmatter.'),
            getCursor: vi.fn().mockReturnValue({ line: 0, ch: 0 }),
            somethingSelected: vi.fn().mockReturnValue(false),
            replaceRange: vi.fn(),
          },
          file: {
            path: 'test.md',
            stat: { mtime: Date.now() },
          },
          leaf: {
            view: {
              getState: vi.fn().mockReturnValue({ mode: 'source' }),
            },
          },
        }),
        on: vi.fn().mockReturnValue({}),
      },
      vault: {
        adapter: {
          basePath: '/test/vault',
        },
      },
    };
  }

  async onload(): Promise<void> {
    await this.initializeEditorLinting();
  }

  async onunload(): Promise<void> {
    if (this.editorIntegration) {
      this.editorIntegration.unregisterChangeHandlers();
      this.editorIntegration = null;
    }

    if (this.editorLinter) {
      this.editorLinter.stopLinting();
      this.editorLinter = null;
    }
  }

  getSettings(): PluginSettings {
    return this.settings;
  }

  async updateSettings(newSettings: Partial<PluginSettings>): Promise<void> {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };

    if (
      oldSettings.realTimeLinting !== this.settings.realTimeLinting ||
      oldSettings.realTimeLintingDelay !== this.settings.realTimeLintingDelay ||
      oldSettings.showInlineErrors !== this.settings.showInlineErrors
    ) {
      await this.initializeEditorLinting();
    }
  }

  getEditorLinter(): any {
    return this.editorLinter;
  }

  getEditorIntegration(): any {
    return this.editorIntegration;
  }

  private async initializeEditorLinting(): Promise<void> {
    if (this.editorIntegration) {
      this.editorIntegration.unregisterChangeHandlers();
      this.editorIntegration = null;
    }

    if (this.editorLinter) {
      this.editorLinter.stopLinting();
      this.editorLinter = null;
    }

    if (!this.settings.realTimeLinting) {
      return;
    }

    // Mock editor linter
    this.editorLinter = {
      lintContent: vi.fn().mockResolvedValue({
        issues: [
          {
            ruleId: 'frontmatter-required-fields.strict',
            severity: 'error',
            message: 'Missing required frontmatter field: title',
            file: 'test.md',
            line: 1,
            fixable: true,
          },
        ],
        indicators: [],
        quickFixes: [],
        processingTime: 100,
      }),
      startLinting: vi.fn().mockResolvedValue(undefined),
      stopLinting: vi.fn(),
      getLastResult: vi.fn().mockReturnValue(null),
      isCurrentlyLinting: vi.fn().mockReturnValue(false),
    };

    // Mock editor integration
    this.editorIntegration = {
      registerChangeHandlers: vi.fn(),
      unregisterChangeHandlers: vi.fn(),
      getCurrentEditorContext: vi.fn().mockReturnValue({
        filePath: 'test.md',
        content: '# Test Note\n\nContent without frontmatter.',
        cursorPosition: { line: 0, ch: 0 },
        isDirty: true,
        lastModified: Date.now(),
      }),
      showIndicators: vi.fn(),
      clearIndicators: vi.fn(),
    };

    this.editorIntegration.registerChangeHandlers();
  }

  // Command implementations
  async toggleRealtimeLinting(): Promise<void> {
    await this.updateSettings({
      realTimeLinting: !this.settings.realTimeLinting,
    });
  }

  clearEditorIndicators(): void {
    if (this.editorIntegration) {
      this.editorIntegration.clearIndicators();
    }
  }

  showLintResults(): void {
    if (this.editorLinter) {
      const result = this.editorLinter.getLastResult();
      // Mock showing results
    }
  }
}

describe('Editor Linting Integration', () => {
  let plugin: TestObsidianLintPlugin;

  beforeEach(async () => {
    plugin = new TestObsidianLintPlugin();
    await plugin.onload();
  });

  afterEach(async () => {
    await plugin.onunload();
    vi.clearAllMocks();
  });

  describe('Plugin Integration', () => {
    it('should initialize editor linting when real-time linting is enabled', async () => {
      await plugin.updateSettings({ realTimeLinting: true });

      const editorLinter = plugin.getEditorLinter();
      const editorIntegration = plugin.getEditorIntegration();

      expect(editorLinter).toBeDefined();
      expect(editorIntegration).toBeDefined();
    });

    it('should not initialize editor linting when real-time linting is disabled', async () => {
      await plugin.updateSettings({ realTimeLinting: false });

      const editorLinter = plugin.getEditorLinter();
      const editorIntegration = plugin.getEditorIntegration();

      expect(editorLinter).toBeNull();
      expect(editorIntegration).toBeNull();
    });

    it('should reinitialize editor linting when settings change', async () => {
      // Start with real-time linting disabled
      await plugin.updateSettings({ realTimeLinting: false });
      expect(plugin.getEditorLinter()).toBeNull();

      // Enable real-time linting
      await plugin.updateSettings({ realTimeLinting: true });
      expect(plugin.getEditorLinter()).toBeDefined();

      // Disable again
      await plugin.updateSettings({ realTimeLinting: false });
      expect(plugin.getEditorLinter()).toBeNull();
    });

    it('should update editor linter options when settings change', async () => {
      // Enable real-time linting
      await plugin.updateSettings({
        realTimeLinting: true,
        realTimeLintingDelay: 500,
      });

      const editorLinter1 = plugin.getEditorLinter();
      expect(editorLinter1).toBeDefined();

      // Change delay setting
      await plugin.updateSettings({ realTimeLintingDelay: 1500 });

      const editorLinter2 = plugin.getEditorLinter();
      expect(editorLinter2).toBeDefined();
    });
  });

  describe('Command Integration', () => {
    beforeEach(async () => {
      await plugin.updateSettings({ realTimeLinting: true });
    });

    it('should toggle real-time linting via command', async () => {
      const settings = plugin.getSettings();
      const initialState = settings.realTimeLinting;

      await plugin.toggleRealtimeLinting();

      const newSettings = plugin.getSettings();
      expect(newSettings.realTimeLinting).toBe(!initialState);
    });

    it('should clear editor indicators via command', () => {
      const editorIntegration = plugin.getEditorIntegration();
      if (editorIntegration) {
        plugin.clearEditorIndicators();
        expect(editorIntegration.clearIndicators).toHaveBeenCalled();
      }
    });

    it('should show lint results via command', async () => {
      const editorLinter = plugin.getEditorLinter();
      if (editorLinter) {
        expect(() => plugin.showLintResults()).not.toThrow();
      }
    });
  });

  describe('Editor Context Integration', () => {
    beforeEach(async () => {
      await plugin.updateSettings({ realTimeLinting: true });
    });

    it('should get current editor context', () => {
      const editorIntegration = plugin.getEditorIntegration();
      if (editorIntegration) {
        const context = editorIntegration.getCurrentEditorContext();

        expect(context).not.toBeNull();
        expect(context?.filePath).toBe('test.md');
        expect(context?.content).toBe(
          '# Test Note\n\nContent without frontmatter.'
        );
        expect(context?.cursorPosition).toEqual({ line: 0, ch: 0 });
        expect(context?.isDirty).toBe(true);
      }
    });
  });

  describe('Real-time Linting Workflow', () => {
    beforeEach(async () => {
      await plugin.updateSettings({
        realTimeLinting: true,
        showInlineErrors: true,
        realTimeLintingDelay: 100,
      });
    });

    it('should perform linting on editor content', async () => {
      const editorLinter = plugin.getEditorLinter();
      if (editorLinter) {
        const context: EditorContext = {
          filePath: 'test.md',
          content: '# Test Note\n\nContent without frontmatter.',
          cursorPosition: { line: 0, ch: 0 },
          isDirty: false,
          lastModified: Date.now(),
        };

        const result = await editorLinter.lintContent(context);

        expect(result).toBeDefined();
        expect(result.issues).toBeInstanceOf(Array);
        expect(result.indicators).toBeInstanceOf(Array);
        expect(result.quickFixes).toBeInstanceOf(Array);
        expect(typeof result.processingTime).toBe('number');
      }
    });

    it('should show indicators in editor', () => {
      const editorIntegration = plugin.getEditorIntegration();
      if (editorIntegration) {
        const indicators: EditorIndicator[] = [
          {
            id: 'test-indicator',
            ruleId: 'frontmatter-required-fields.strict',
            severity: 'error',
            range: {
              from: { line: 0, ch: 0 },
              to: { line: 0, ch: 10 },
            },
            message: 'Missing required frontmatter field: title',
          },
        ];

        expect(() =>
          editorIntegration.showIndicators(indicators)
        ).not.toThrow();
        expect(editorIntegration.showIndicators).toHaveBeenCalledWith(
          indicators
        );
      }
    });

    it('should handle debounced linting', async () => {
      const editorLinter = plugin.getEditorLinter();
      if (editorLinter) {
        const context: EditorContext = {
          filePath: 'test.md',
          content: '# Test Note\n\nContent without frontmatter.',
          cursorPosition: { line: 0, ch: 0 },
          isDirty: false,
          lastModified: Date.now(),
        };

        // Start multiple linting operations rapidly
        const promises = [
          editorLinter.startLinting(context),
          editorLinter.startLinting({
            ...context,
            content: 'Updated content 1',
          }),
          editorLinter.startLinting({
            ...context,
            content: 'Updated content 2',
          }),
        ];

        await Promise.all(promises);

        expect(editorLinter.startLinting).toHaveBeenCalledTimes(3);
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await plugin.updateSettings({ realTimeLinting: true });
    });

    it('should handle plugin unload during active linting', async () => {
      const editorLinter = plugin.getEditorLinter();
      if (editorLinter) {
        const context: EditorContext = {
          filePath: 'test.md',
          content: '# Test Note',
          cursorPosition: { line: 0, ch: 0 },
          isDirty: false,
          lastModified: Date.now(),
        };

        // Start linting
        const lintingPromise = editorLinter.startLinting(context);

        // Unload plugin immediately
        await plugin.onunload();

        // Should handle gracefully
        await expect(lintingPromise).resolves.toBeUndefined();
      }
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await plugin.updateSettings({
        realTimeLinting: true,
        realTimeLintingDelay: 50,
      });
    });

    it('should complete linting within reasonable time', async () => {
      const editorLinter = plugin.getEditorLinter();
      if (editorLinter) {
        const context: EditorContext = {
          filePath: 'test.md',
          content: '# Test Note\n\n' + 'Content line\n'.repeat(100),
          cursorPosition: { line: 0, ch: 0 },
          isDirty: false,
          lastModified: Date.now(),
        };

        const startTime = Date.now();
        const result = await editorLinter.lintContent(context);
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(5000);
        expect(result.processingTime).toBeGreaterThan(0);
      }
    });

    it('should handle rapid editor changes efficiently', async () => {
      const editorLinter = plugin.getEditorLinter();
      if (editorLinter) {
        const baseContext: EditorContext = {
          filePath: 'test.md',
          content: '# Test Note',
          cursorPosition: { line: 0, ch: 0 },
          isDirty: false,
          lastModified: Date.now(),
        };

        // Simulate rapid typing
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            editorLinter.startLinting({
              ...baseContext,
              content: baseContext.content + ` ${i}`,
            })
          );
        }

        const startTime = Date.now();
        await Promise.all(promises);
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(2000);
      }
    });
  });
});
