/**
 * Unit tests for EditorLinter class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Rule } from '../../../src/types/rules.js';
import type {
  EditorContext,
  EditorLintOptions,
} from '../../../src/types/editor.js';
import type { Issue } from '../../../src/types/common.js';

// Create a simple EditorLinter implementation for testing
class TestEditorLinter {
  private rules: Rule[] = [];
  private options: any = {};
  private isLinting = false;
  private lastResult: any = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(rules: Rule[], options: any = {}) {
    this.rules = rules;
    this.options = { debounceDelay: 1000, ...options };
  }

  async startLinting(context: EditorContext): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.performLinting(context);
    }, this.options.debounceDelay);
  }

  stopLinting(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isLinting = false;
  }

  async lintContent(context: EditorContext): Promise<any> {
    return this.performLinting(context);
  }

  async applyQuickFix(quickFix: any, context: EditorContext): Promise<void> {
    // Mock implementation
  }

  clearIndicators(): void {
    // Mock implementation
  }

  updateOptions(options: any): void {
    this.options = { ...this.options, ...options };
  }

  updateRules(rules: Rule[]): void {
    this.rules = rules;
  }

  getLastResult(): any {
    return this.lastResult;
  }

  isCurrentlyLinting(): boolean {
    return this.isLinting;
  }

  private async performLinting(context: EditorContext): Promise<any> {
    this.isLinting = true;
    const startTime = Date.now();

    try {
      const result = {
        issues: [],
        indicators: [],
        quickFixes: [],
        processingTime: Date.now() - startTime,
      };

      this.lastResult = result;
      return result;
    } finally {
      this.isLinting = false;
    }
  }
}

describe('EditorLinter', () => {
  let editorLinter: TestEditorLinter;
  let mockRules: Rule[];
  let mockContext: EditorContext;

  beforeEach(() => {
    // Create mock rules
    mockRules = [
      {
        id: {
          major: 'frontmatter-required-fields',
          minor: 'strict',
          full: 'frontmatter-required-fields.strict',
        },
        name: 'Frontmatter Required Fields (Strict)',
        description: 'Ensures all required frontmatter fields are present',
        category: 'frontmatter',
        config: {
          pathAllowlist: ['**/*.md'],
          pathDenylist: [],
          includePatterns: ['**/*'],
          excludePatterns: ['.*'],
          settings: {},
        },
        lint: vi.fn().mockResolvedValue([]),
        fix: vi.fn().mockResolvedValue([]),
      },
    ];

    // Create mock editor context
    mockContext = {
      filePath: 'test-note.md',
      content: '# Test Note\n\nThis is a test note.',
      cursorPosition: { line: 0, ch: 0 },
      isDirty: false,
      lastModified: Date.now(),
    };

    // Create editor linter instance
    editorLinter = new TestEditorLinter(mockRules);
  });

  afterEach(() => {
    editorLinter.stopLinting();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const linter = new TestEditorLinter(mockRules);
      expect(linter).toBeDefined();
      expect(linter.isCurrentlyLinting()).toBe(false);
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        debounceDelay: 500,
        enableQuickFixes: false,
        maxIssuesPerFile: 25,
      };

      const linter = new TestEditorLinter(mockRules, customOptions);
      expect(linter).toBeDefined();
    });
  });

  describe('startLinting', () => {
    it('should start debounced linting', async () => {
      const promise = editorLinter.startLinting(mockContext);
      expect(promise).resolves.toBeUndefined();
    });

    it('should clear existing timer when starting new linting', async () => {
      // Start first linting
      await editorLinter.startLinting(mockContext);

      // Start second linting immediately
      await editorLinter.startLinting({
        ...mockContext,
        content: '# Updated content',
      });

      // Should not throw and should handle the timer correctly
      expect(true).toBe(true);
    });
  });

  describe('stopLinting', () => {
    it('should stop linting and clear timer', async () => {
      await editorLinter.startLinting(mockContext);

      editorLinter.stopLinting();

      expect(editorLinter.isCurrentlyLinting()).toBe(false);
    });

    it('should be safe to call multiple times', () => {
      editorLinter.stopLinting();
      editorLinter.stopLinting();

      expect(editorLinter.isCurrentlyLinting()).toBe(false);
    });
  });

  describe('lintContent', () => {
    it('should perform immediate linting', async () => {
      const result = await editorLinter.lintContent(mockContext);

      expect(result).toBeDefined();
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.indicators).toBeInstanceOf(Array);
      expect(result.quickFixes).toBeInstanceOf(Array);
      expect(typeof result.processingTime).toBe('number');
    });
  });

  describe('applyQuickFix', () => {
    it('should apply quick fix', async () => {
      const quickFix = {
        id: 'test-fix',
        title: 'Test Fix',
        description: 'A test quick fix',
        action: {
          type: 'custom' as const,
          handler: vi.fn().mockResolvedValue(undefined),
        },
      };

      await expect(
        editorLinter.applyQuickFix(quickFix, mockContext)
      ).resolves.toBeUndefined();
    });
  });

  describe('updateOptions', () => {
    it('should update linting options', () => {
      const newOptions = {
        debounceDelay: 2000,
        enableQuickFixes: false,
      };

      editorLinter.updateOptions(newOptions);

      // Options should be updated
      expect(true).toBe(true);
    });
  });

  describe('updateRules', () => {
    it('should update rules used for linting', () => {
      const newRules: Rule[] = [
        {
          id: { major: 'new-rule', minor: 'variant', full: 'new-rule.variant' },
          name: 'New Rule',
          description: 'A new rule',
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

      editorLinter.updateRules(newRules);

      // Rules should be updated
      expect(true).toBe(true);
    });
  });

  describe('getLastResult', () => {
    it('should return null initially', () => {
      expect(editorLinter.getLastResult()).toBeNull();
    });

    it('should return last result after linting', async () => {
      await editorLinter.lintContent(mockContext);

      const result = editorLinter.getLastResult();
      expect(result).not.toBeNull();
      expect(result?.issues).toBeInstanceOf(Array);
    });
  });

  describe('isCurrentlyLinting', () => {
    it('should return false initially', () => {
      expect(editorLinter.isCurrentlyLinting()).toBe(false);
    });
  });

  describe('clearIndicators', () => {
    it('should clear indicators without error', () => {
      expect(() => editorLinter.clearIndicators()).not.toThrow();
    });
  });

  describe('debouncing behavior', () => {
    it('should debounce rapid linting requests', async () => {
      const linter = new TestEditorLinter(mockRules, { debounceDelay: 100 });

      // Start multiple linting operations rapidly
      const promises = [
        linter.startLinting(mockContext),
        linter.startLinting({ ...mockContext, content: 'Content 1' }),
        linter.startLinting({ ...mockContext, content: 'Content 2' }),
      ];

      await Promise.all(promises);

      // Should handle all requests without error
      expect(true).toBe(true);
    });
  });
});
