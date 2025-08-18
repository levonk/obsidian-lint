/**
 * Editor Integration Type Definitions
 * Types for real-time linting and editor integration
 */

import type { Issue, Fix } from './common.js';

/**
 * Editor position interface
 */
export interface EditorPosition {
  line: number;
  ch: number;
}

/**
 * Editor range interface
 */
export interface EditorRange {
  from: EditorPosition;
  to: EditorPosition;
}

/**
 * Editor change event
 */
export interface EditorChange {
  from: EditorPosition;
  to: EditorPosition;
  text: string[];
  removed: string[];
}

/**
 * Visual indicator for rule violations in the editor
 */
export interface EditorIndicator {
  id: string;
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  range: EditorRange;
  message: string;
  quickFix?: QuickFix;
}

/**
 * Quick fix action for editor issues
 */
export interface QuickFix {
  id: string;
  title: string;
  description: string;
  action: QuickFixAction;
}

/**
 * Quick fix action types
 */
export type QuickFixAction =
  | { type: 'replace'; range: EditorRange; text: string }
  | { type: 'insert'; position: EditorPosition; text: string }
  | { type: 'delete'; range: EditorRange }
  | { type: 'custom'; handler: () => Promise<void> };

/**
 * Editor linting options
 */
export interface EditorLintOptions {
  debounceDelay: number;
  enableQuickFixes: boolean;
  showInlineErrors: boolean;
  maxIssuesPerFile: number;
  enabledSeverities: Array<'error' | 'warning' | 'info'>;
}

/**
 * Editor linting result
 */
export interface EditorLintResult {
  issues: Issue[];
  indicators: EditorIndicator[];
  quickFixes: QuickFix[];
  processingTime: number;
}

/**
 * Editor context for rule execution
 */
export interface EditorContext {
  filePath: string;
  content: string;
  cursorPosition?: EditorPosition;
  selection?: EditorRange;
  isDirty: boolean;
  lastModified: number;
}

/**
 * Editor linter interface
 */
export interface IEditorLinter {
  /**
   * Start real-time linting for the given editor
   */
  startLinting(context: EditorContext): Promise<void>;

  /**
   * Stop real-time linting
   */
  stopLinting(): void;

  /**
   * Manually trigger linting for current content
   */
  lintContent(context: EditorContext): Promise<EditorLintResult>;

  /**
   * Apply a quick fix
   */
  applyQuickFix(quickFix: QuickFix, context: EditorContext): Promise<void>;

  /**
   * Clear all visual indicators
   */
  clearIndicators(): void;

  /**
   * Update linting options
   */
  updateOptions(options: Partial<EditorLintOptions>): void;
}

/**
 * Editor integration interface for Obsidian
 */
export interface ObsidianEditorIntegration {
  /**
   * Register editor change handlers
   */
  registerChangeHandlers(): void;

  /**
   * Unregister editor change handlers
   */
  unregisterChangeHandlers(): void;

  /**
   * Show visual indicators in the editor
   */
  showIndicators(indicators: EditorIndicator[]): void;

  /**
   * Clear visual indicators from the editor
   */
  clearIndicators(): void;

  /**
   * Get current editor context
   */
  getCurrentEditorContext(): EditorContext | null;

  /**
   * Apply text changes to the editor
   */
  applyTextChanges(changes: QuickFixAction[]): Promise<void>;
}
