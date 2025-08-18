/**
 * Obsidian Editor Integration
 * Handles integration with Obsidian's editor API for real-time linting
 */

import type {
  Plugin,
  Editor,
  MarkdownView,
  EditorPosition,
  EditorRange,
} from '../types/obsidian.js';
import type {
  ObsidianEditorIntegration,
  EditorContext,
  EditorIndicator,
  QuickFixAction,
  EditorChange,
} from '../types/editor.js';
import { EditorLinter } from './editor-linter.js';
import { LintError, ErrorCodes } from '../types/errors.js';

/**
 * CSS classes for visual indicators
 */
const INDICATOR_CLASSES = {
  error: 'obsidian-lint-error',
  warning: 'obsidian-lint-warning',
  info: 'obsidian-lint-info',
} as const;

/**
 * Obsidian editor integration implementation
 */
export class ObsidianEditorIntegrationImpl
  implements ObsidianEditorIntegration
{
  private plugin: Plugin;
  private editorLinter: EditorLinter;
  private activeIndicators: Map<string, HTMLElement> = new Map();
  private changeHandlers: Map<
    Editor,
    (editor: Editor, change: EditorChange) => void
  > = new Map();
  private isEnabled = false;

  constructor(plugin: Plugin, editorLinter: EditorLinter) {
    this.plugin = plugin;
    this.editorLinter = editorLinter;
  }

  /**
   * Register editor change handlers for real-time linting
   */
  registerChangeHandlers(): void {
    if (this.isEnabled) {
      return;
    }

    try {
      // Register for editor changes
      this.plugin.registerEvent(
        this.plugin.app.workspace.on(
          'editor-change',
          this.handleEditorChange.bind(this)
        )
      );

      // Register for active leaf changes
      this.plugin.registerEvent(
        this.plugin.app.workspace.on(
          'active-leaf-change',
          this.handleActiveLeafChange.bind(this)
        )
      );

      // Register for file open events
      this.plugin.registerEvent(
        this.plugin.app.workspace.on(
          'file-open',
          this.handleFileOpen.bind(this)
        )
      );

      this.isEnabled = true;
      console.log('Obsidian editor integration enabled');
    } catch (error) {
      throw new LintError(
        'Failed to register editor change handlers',
        ErrorCodes.PLUGIN_API_ERROR,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Unregister editor change handlers
   */
  unregisterChangeHandlers(): void {
    if (!this.isEnabled) {
      return;
    }

    try {
      // Clear all change handlers
      this.changeHandlers.clear();

      // Clear all indicators
      this.clearIndicators();

      // Stop the editor linter
      this.editorLinter.stopLinting();

      this.isEnabled = false;
      console.log('Obsidian editor integration disabled');
    } catch (error) {
      console.error('Error unregistering editor change handlers:', error);
    }
  }

  /**
   * Show visual indicators in the editor
   */
  showIndicators(indicators: EditorIndicator[]): void {
    try {
      // Clear existing indicators first
      this.clearIndicators();

      const activeView =
        this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView || !activeView.editor) {
        return;
      }

      const editor = activeView.editor;

      // Add new indicators
      for (const indicator of indicators) {
        this.addIndicatorToEditor(editor, indicator);
      }
    } catch (error) {
      console.error('Error showing editor indicators:', error);
    }
  }

  /**
   * Clear visual indicators from the editor
   */
  clearIndicators(): void {
    try {
      // Remove all indicator elements
      for (const [id, element] of this.activeIndicators) {
        element.remove();
      }
      this.activeIndicators.clear();
    } catch (error) {
      console.error('Error clearing editor indicators:', error);
    }
  }

  /**
   * Get current editor context
   */
  getCurrentEditorContext(): EditorContext | null {
    try {
      const activeView =
        this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView || !activeView.editor || !activeView.file) {
        return null;
      }

      const editor = activeView.editor;
      const file = activeView.file;

      return {
        filePath: file.path,
        content: editor.getValue(),
        cursorPosition: this.convertObsidianPosition(editor.getCursor()),
        selection: this.getEditorSelection(editor),
        isDirty: activeView.leaf.view.getState().mode === 'source', // Simplified check
        lastModified: file.stat.mtime,
      };
    } catch (error) {
      console.error('Error getting editor context:', error);
      return null;
    }
  }

  /**
   * Apply text changes to the editor
   */
  async applyTextChanges(changes: QuickFixAction[]): Promise<void> {
    try {
      const activeView =
        this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView || !activeView.editor) {
        throw new Error('No active editor found');
      }

      const editor = activeView.editor;

      // Apply changes in reverse order to maintain positions
      const sortedChanges = [...changes].sort((a, b) => {
        if (a.type === 'replace' && b.type === 'replace') {
          return b.range.from.line - a.range.from.line;
        }
        if (a.type === 'insert' && b.type === 'insert') {
          return b.position.line - a.position.line;
        }
        return 0;
      });

      for (const change of sortedChanges) {
        await this.applyTextChange(editor, change);
      }
    } catch (error) {
      throw new LintError(
        'Failed to apply text changes to editor',
        ErrorCodes.RULE_FIX_ERROR,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Handle editor change events
   */
  private async handleEditorChange(
    editor: Editor,
    change: EditorChange
  ): Promise<void> {
    try {
      const context = this.getCurrentEditorContext();
      if (!context) {
        return;
      }

      // Start debounced linting
      await this.editorLinter.startLinting(context);
    } catch (error) {
      console.error('Error handling editor change:', error);
    }
  }

  /**
   * Handle active leaf change events
   */
  private async handleActiveLeafChange(): Promise<void> {
    try {
      // Clear indicators from previous editor
      this.clearIndicators();

      // Start linting for new editor
      const context = this.getCurrentEditorContext();
      if (context) {
        await this.editorLinter.startLinting(context);
      }
    } catch (error) {
      console.error('Error handling active leaf change:', error);
    }
  }

  /**
   * Handle file open events
   */
  private async handleFileOpen(): Promise<void> {
    try {
      // Start linting for newly opened file
      const context = this.getCurrentEditorContext();
      if (context) {
        await this.editorLinter.startLinting(context);
      }
    } catch (error) {
      console.error('Error handling file open:', error);
    }
  }

  /**
   * Add a visual indicator to the editor
   */
  private addIndicatorToEditor(
    editor: Editor,
    indicator: EditorIndicator
  ): void {
    try {
      // Create indicator element
      const indicatorEl = document.createElement('div');
      indicatorEl.className = `obsidian-lint-indicator ${INDICATOR_CLASSES[indicator.severity]}`;
      indicatorEl.title = `${indicator.ruleId}: ${indicator.message}`;

      // Add click handler for quick fix
      if (indicator.quickFix) {
        indicatorEl.classList.add('obsidian-lint-fixable');
        indicatorEl.addEventListener('click', async () => {
          try {
            const context = this.getCurrentEditorContext();
            if (context && indicator.quickFix) {
              await this.editorLinter.applyQuickFix(
                indicator.quickFix,
                context
              );
            }
          } catch (error) {
            console.error('Error applying quick fix:', error);
          }
        });
      }

      // Position the indicator (this would need to be adapted to Obsidian's editor implementation)
      // For now, we'll use a simplified approach
      this.positionIndicator(editor, indicatorEl, indicator);

      // Store reference for cleanup
      this.activeIndicators.set(indicator.id, indicatorEl);
    } catch (error) {
      console.error('Error adding indicator to editor:', error);
    }
  }

  /**
   * Position an indicator in the editor
   */
  private positionIndicator(
    editor: Editor,
    element: HTMLElement,
    indicator: EditorIndicator
  ): void {
    try {
      // This is a simplified implementation
      // In a real implementation, you would need to use Obsidian's editor API
      // to get the actual DOM position of the text range

      const editorEl = (editor as any).containerEl || (editor as any).cm?.dom;
      if (editorEl) {
        editorEl.appendChild(element);

        // Position relative to the line
        element.style.position = 'absolute';
        element.style.left = `${indicator.range.from.ch * 8}px`; // Approximate character width
        element.style.top = `${indicator.range.from.line * 20}px`; // Approximate line height
        element.style.zIndex = '1000';
      }
    } catch (error) {
      console.error('Error positioning indicator:', error);
    }
  }

  /**
   * Apply a single text change to the editor
   */
  private async applyTextChange(
    editor: Editor,
    change: QuickFixAction
  ): Promise<void> {
    try {
      switch (change.type) {
        case 'replace':
          editor.replaceRange(
            change.text,
            this.convertToObsidianPosition(change.range.from),
            this.convertToObsidianPosition(change.range.to)
          );
          break;

        case 'insert':
          editor.replaceRange(
            change.text,
            this.convertToObsidianPosition(change.position)
          );
          break;

        case 'delete':
          editor.replaceRange(
            '',
            this.convertToObsidianPosition(change.range.from),
            this.convertToObsidianPosition(change.range.to)
          );
          break;

        case 'custom':
          await change.handler();
          break;

        default:
          console.warn('Unknown quick fix action type:', (change as any).type);
      }
    } catch (error) {
      console.error('Error applying text change:', error);
    }
  }

  /**
   * Convert Obsidian editor position to our format
   */
  private convertObsidianPosition(
    pos: EditorPosition
  ): import('../types/editor.js').EditorPosition {
    return {
      line: pos.line,
      ch: pos.ch,
    };
  }

  /**
   * Convert our position format to Obsidian editor position
   */
  private convertToObsidianPosition(
    pos: import('../types/editor.js').EditorPosition
  ): EditorPosition {
    return {
      line: pos.line,
      ch: pos.ch,
    };
  }

  /**
   * Get current editor selection
   */
  private getEditorSelection(
    editor: Editor
  ): import('../types/editor.js').EditorRange | undefined {
    try {
      if (!editor.somethingSelected()) {
        return undefined;
      }

      const from = editor.getCursor('from');
      const to = editor.getCursor('to');

      return {
        from: this.convertObsidianPosition(from),
        to: this.convertObsidianPosition(to),
      };
    } catch (error) {
      console.error('Error getting editor selection:', error);
      return undefined;
    }
  }
}
