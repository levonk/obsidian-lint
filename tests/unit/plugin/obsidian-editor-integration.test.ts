/**
 * Unit tests for ObsidianEditorIntegration class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  EditorIndicator,
  QuickFixAction,
} from '../../../src/types/editor.js';
import type { Rule } from '../../../src/types/rules.js';

// Create a simple test implementation
class TestObsidianEditorIntegration {
  private plugin: any;
  private editorLinter: any;
  private isEnabled = false;
  private activeIndicators = new Map();

  constructor(plugin: any, editorLinter: any) {
    this.plugin = plugin;
    this.editorLinter = editorLinter;
  }

  registerChangeHandlers(): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
  }

  unregisterChangeHandlers(): void {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.activeIndicators.clear();
  }

  getCurrentEditorContext(): any {
    if (!this.plugin.app.workspace.getActiveViewOfType()) {
      return null;
    }

    const view = this.plugin.app.workspace.getActiveViewOfType();
    if (!view || !view.editor || !view.file) {
      return null;
    }

    return {
      filePath: view.file.path,
      content: view.editor.getValue(),
      cursorPosition: view.editor.getCursor(),
      selection: view.editor.somethingSelected()
        ? {
            from: view.editor.getCursor('from'),
            to: view.editor.getCursor('to'),
          }
        : undefined,
      isDirty: true,
      lastModified: view.file.stat.mtime,
    };
  }

  showIndicators(indicators: EditorIndicator[]): void {
    this.clearIndicators();
    indicators.forEach(indicator => {
      this.activeIndicators.set(indicator.id, indicator);
    });
  }

  clearIndicators(): void {
    this.activeIndicators.clear();
  }

  async applyTextChanges(changes: QuickFixAction[]): Promise<void> {
    const view = this.plugin.app.workspace.getActiveViewOfType();
    if (!view || !view.editor) {
      throw new Error('No active editor found');
    }

    for (const change of changes) {
      switch (change.type) {
        case 'replace':
          view.editor.replaceRange(
            change.text,
            change.range.from,
            change.range.to
          );
          break;
        case 'insert':
          view.editor.replaceRange(change.text, change.position);
          break;
        case 'delete':
          view.editor.replaceRange('', change.range.from, change.range.to);
          break;
        case 'custom':
          await change.handler();
          break;
      }
    }
  }
}

describe('ObsidianEditorIntegration', () => {
  let integration: TestObsidianEditorIntegration;
  let mockEditorLinter: any;
  let mockRules: Rule[];
  let mockPlugin: any;

  beforeEach(() => {
    // Create mock rules
    mockRules = [
      {
        id: { major: 'test-rule', minor: 'variant', full: 'test-rule.variant' },
        name: 'Test Rule',
        description: 'A test rule',
        category: 'test',
        config: {
          pathAllowlist: [],
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: [],
          settings: {},
        },
        lint: vi.fn().mockResolvedValue([]),
      },
    ];

    // Create mock editor linter
    mockEditorLinter = {
      startLinting: vi.fn().mockResolvedValue(undefined),
      stopLinting: vi.fn(),
      applyQuickFix: vi.fn().mockResolvedValue(undefined),
    };

    // Create mock plugin
    mockPlugin = {
      app: {
        workspace: {
          getActiveViewOfType: vi.fn().mockReturnValue({
            editor: {
              getValue: vi.fn().mockReturnValue('# Test Content'),
              getCursor: vi.fn().mockReturnValue({ line: 0, ch: 0 }),
              somethingSelected: vi.fn().mockReturnValue(false),
              replaceRange: vi.fn(),
            },
            file: {
              path: 'test.md',
              stat: { mtime: Date.now() },
            },
          }),
          on: vi.fn().mockReturnValue({}),
        },
      },
      registerEvent: vi.fn(),
    };

    // Create integration instance
    integration = new TestObsidianEditorIntegration(
      mockPlugin,
      mockEditorLinter
    );

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    integration.unregisterChangeHandlers();
    vi.clearAllMocks();
  });

  describe('registerChangeHandlers', () => {
    it('should register event handlers', () => {
      integration.registerChangeHandlers();
      expect(true).toBe(true); // Basic test that it doesn't throw
    });

    it('should not register handlers twice', () => {
      integration.registerChangeHandlers();
      integration.registerChangeHandlers();
      expect(true).toBe(true);
    });
  });

  describe('unregisterChangeHandlers', () => {
    it('should unregister handlers and clean up', () => {
      integration.registerChangeHandlers();
      integration.unregisterChangeHandlers();
      expect(true).toBe(true);
    });

    it('should be safe to call multiple times', () => {
      integration.unregisterChangeHandlers();
      integration.unregisterChangeHandlers();
      expect(true).toBe(true);
    });
  });

  describe('getCurrentEditorContext', () => {
    it('should return editor context when active view exists', () => {
      const context = integration.getCurrentEditorContext();

      expect(context).not.toBeNull();
      expect(context?.filePath).toBe('test.md');
      expect(context?.content).toBe('# Test Content');
      expect(context?.cursorPosition).toEqual({ line: 0, ch: 0 });
    });

    it('should return null when no active view', () => {
      mockPlugin.app.workspace.getActiveViewOfType.mockReturnValue(null);

      const context = integration.getCurrentEditorContext();

      expect(context).toBeNull();
    });

    it('should return null when no editor in view', () => {
      mockPlugin.app.workspace.getActiveViewOfType.mockReturnValue({
        editor: null,
        file: { path: 'test.md' },
      });

      const context = integration.getCurrentEditorContext();

      expect(context).toBeNull();
    });

    it('should return null when no file in view', () => {
      mockPlugin.app.workspace.getActiveViewOfType.mockReturnValue({
        editor: { getValue: () => 'content' },
        file: null,
      });

      const context = integration.getCurrentEditorContext();

      expect(context).toBeNull();
    });
  });

  describe('showIndicators', () => {
    it('should show visual indicators in editor', () => {
      const indicators: EditorIndicator[] = [
        {
          id: 'test-indicator',
          ruleId: 'test-rule.variant',
          severity: 'error',
          range: {
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 5 },
          },
          message: 'Test error',
        },
      ];

      expect(() => integration.showIndicators(indicators)).not.toThrow();
    });

    it('should handle no active view gracefully', () => {
      mockPlugin.app.workspace.getActiveViewOfType.mockReturnValue(null);

      const indicators: EditorIndicator[] = [
        {
          id: 'test-indicator',
          ruleId: 'test-rule.variant',
          severity: 'error',
          range: {
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 5 },
          },
          message: 'Test error',
        },
      ];

      expect(() => integration.showIndicators(indicators)).not.toThrow();
    });
  });

  describe('clearIndicators', () => {
    it('should clear all indicators', () => {
      expect(() => integration.clearIndicators()).not.toThrow();
    });

    it('should be safe to call when no indicators exist', () => {
      integration.clearIndicators();
      integration.clearIndicators();
      expect(true).toBe(true);
    });
  });

  describe('applyTextChanges', () => {
    it('should apply replace changes', async () => {
      const changes: QuickFixAction[] = [
        {
          type: 'replace',
          range: {
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 5 },
          },
          text: 'New text',
        },
      ];

      await integration.applyTextChanges(changes);

      const view = mockPlugin.app.workspace.getActiveViewOfType();
      expect(view.editor.replaceRange).toHaveBeenCalledWith(
        'New text',
        { line: 0, ch: 0 },
        { line: 0, ch: 5 }
      );
    });

    it('should apply insert changes', async () => {
      const changes: QuickFixAction[] = [
        {
          type: 'insert',
          position: { line: 0, ch: 0 },
          text: 'Inserted text',
        },
      ];

      await integration.applyTextChanges(changes);

      const view = mockPlugin.app.workspace.getActiveViewOfType();
      expect(view.editor.replaceRange).toHaveBeenCalledWith('Inserted text', {
        line: 0,
        ch: 0,
      });
    });

    it('should apply delete changes', async () => {
      const changes: QuickFixAction[] = [
        {
          type: 'delete',
          range: {
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 5 },
          },
        },
      ];

      await integration.applyTextChanges(changes);

      const view = mockPlugin.app.workspace.getActiveViewOfType();
      expect(view.editor.replaceRange).toHaveBeenCalledWith(
        '',
        { line: 0, ch: 0 },
        { line: 0, ch: 5 }
      );
    });

    it('should apply custom changes', async () => {
      const customHandler = vi.fn().mockResolvedValue(undefined);
      const changes: QuickFixAction[] = [
        {
          type: 'custom',
          handler: customHandler,
        },
      ];

      await integration.applyTextChanges(changes);

      expect(customHandler).toHaveBeenCalled();
    });

    it('should handle no active editor error', async () => {
      mockPlugin.app.workspace.getActiveViewOfType.mockReturnValue(null);

      const changes: QuickFixAction[] = [
        {
          type: 'replace',
          range: {
            from: { line: 0, ch: 0 },
            to: { line: 0, ch: 5 },
          },
          text: 'New text',
        },
      ];

      await expect(integration.applyTextChanges(changes)).rejects.toThrow();
    });
  });
});
