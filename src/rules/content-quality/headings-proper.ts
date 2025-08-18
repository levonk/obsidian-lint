/**
 * Headings Proper Rule Implementation
 * Validates and fixes heading structure and formatting
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange, Heading } from '../../types/common.js';

/**
 * Interface for headings validation settings
 */
interface HeadingsSettings {
  title_match: boolean;
  enforce_hierarchy: boolean;
  max_heading_level: number;
  require_h1: boolean;
  single_h1: boolean;
  auto_fix: boolean;
  title_case: boolean;
  no_empty_headings: boolean;
}

/**
 * Base class for headings proper rules
 */
export abstract class HeadingsProperRule extends BaseRule {
  protected settings: HeadingsSettings;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'content-quality', config);
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(settings: Record<string, any>): HeadingsSettings {
    const defaultSettings: HeadingsSettings = {
      title_match: true,
      enforce_hierarchy: true,
      max_heading_level: 6,
      require_h1: true,
      single_h1: true,
      auto_fix: true,
      title_case: false,
      no_empty_headings: true,
    };

    return {
      ...defaultSettings,
      ...settings,
      title_match:
        typeof settings.title_match === 'boolean'
          ? settings.title_match
          : defaultSettings.title_match,
      enforce_hierarchy:
        typeof settings.enforce_hierarchy === 'boolean'
          ? settings.enforce_hierarchy
          : defaultSettings.enforce_hierarchy,
      max_heading_level:
        typeof settings.max_heading_level === 'number' &&
        settings.max_heading_level >= 1 &&
        settings.max_heading_level <= 6
          ? settings.max_heading_level
          : defaultSettings.max_heading_level,
      require_h1:
        typeof settings.require_h1 === 'boolean'
          ? settings.require_h1
          : defaultSettings.require_h1,
      single_h1:
        typeof settings.single_h1 === 'boolean'
          ? settings.single_h1
          : defaultSettings.single_h1,
      auto_fix:
        typeof settings.auto_fix === 'boolean'
          ? settings.auto_fix
          : defaultSettings.auto_fix,
      title_case:
        typeof settings.title_case === 'boolean'
          ? settings.title_case
          : defaultSettings.title_case,
      no_empty_headings:
        typeof settings.no_empty_headings === 'boolean'
          ? settings.no_empty_headings
          : defaultSettings.no_empty_headings,
    };
  }

  /**
   * Lint implementation - check for heading issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    // Check if file has headings
    if (!file.headings || file.headings.length === 0) {
      if (this.settings.require_h1) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: 'Document should have at least one heading',
          file: file.path,
          line: 1,
          fixable: this.settings.auto_fix,
        });
      }
      return issues;
    }

    // Check for empty headings
    if (this.settings.no_empty_headings) {
      for (const heading of file.headings) {
        if (!heading.text || heading.text.trim() === '') {
          issues.push({
            ruleId: this.id.full,
            severity: 'error',
            message: 'Empty heading found',
            file: file.path,
            line: heading.line,
            fixable: this.settings.auto_fix,
          });
        }
      }
    }

    // Check H1 requirements
    const h1Headings = file.headings.filter(h => h.level === 1);

    if (this.settings.require_h1 && h1Headings.length === 0) {
      issues.push({
        ruleId: this.id.full,
        severity: 'error',
        message: 'Document must have an H1 heading',
        file: file.path,
        line: file.headings[0]?.line || 1,
        fixable: this.settings.auto_fix,
      });
    }

    if (this.settings.single_h1 && h1Headings.length > 1) {
      for (let i = 1; i < h1Headings.length; i++) {
        issues.push({
          ruleId: this.id.full,
          severity: 'error',
          message: 'Document should have only one H1 heading',
          file: file.path,
          line: h1Headings[i].line,
          fixable: this.settings.auto_fix,
        });
      }
    }

    // Check title match with frontmatter
    if (
      this.settings.title_match &&
      file.frontmatter?.title &&
      h1Headings.length > 0
    ) {
      const frontmatterTitle = file.frontmatter.title.toString().trim();
      const h1Title = h1Headings[0].text.trim();

      if (frontmatterTitle !== h1Title) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `H1 heading "${h1Title}" does not match frontmatter title "${frontmatterTitle}"`,
          file: file.path,
          line: h1Headings[0].line,
          fixable: this.settings.auto_fix,
        });
      }
    }

    // Check heading hierarchy
    if (this.settings.enforce_hierarchy) {
      const hierarchyIssues = this.validateHeadingHierarchy(
        file.headings,
        file.path
      );
      issues.push(...hierarchyIssues);
    }

    // Check maximum heading level
    for (const heading of file.headings) {
      if (heading.level > this.settings.max_heading_level) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `Heading level ${heading.level} exceeds maximum allowed level ${this.settings.max_heading_level}`,
          file: file.path,
          line: heading.line,
          fixable: this.settings.auto_fix,
        });
      }
    }

    // Check title case if enabled
    if (this.settings.title_case) {
      for (const heading of file.headings) {
        if (heading.text && !this.isTitleCase(heading.text)) {
          issues.push({
            ruleId: this.id.full,
            severity: 'info',
            message: `Heading "${heading.text}" should use title case`,
            file: file.path,
            line: heading.line,
            fixable: this.settings.auto_fix,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Fix implementation - fix heading issues
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_fix) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file } = context;
    const changes: FileChange[] = [];

    // Only process fixable issues
    const fixableIssues = issues.filter(issue => issue.fixable);

    // Process issues and generate fixes
    for (const issue of fixableIssues) {
      if (issue.message.includes('Empty heading found')) {
        // Remove empty headings
        const heading = file.headings.find(h => h.line === issue.line);
        if (heading) {
          changes.push({
            type: 'delete',
            line: heading.line,
            oldText: this.getHeadingText(heading),
          });
        }
      } else if (issue.message.includes('Document must have an H1 heading')) {
        // Add H1 heading at the beginning
        const title = file.frontmatter?.title || 'Untitled';
        changes.push({
          type: 'insert',
          line: this.findInsertionPoint(file),
          column: 1,
          newText: `# ${title}\n\n`,
        });
      } else if (issue.message.includes('should have only one H1 heading')) {
        // Convert extra H1s to H2s
        const heading = file.headings.find(h => h.line === issue.line);
        if (heading && heading.level === 1) {
          changes.push({
            type: 'replace',
            line: heading.line,
            oldText: this.getHeadingText(heading),
            newText: `## ${heading.text}`,
          });
        }
      } else if (issue.message.includes('does not match frontmatter title')) {
        // Update H1 to match frontmatter title
        const heading = file.headings.find(h => h.line === issue.line);
        if (heading && file.frontmatter?.title) {
          changes.push({
            type: 'replace',
            line: heading.line,
            oldText: this.getHeadingText(heading),
            newText: `# ${file.frontmatter.title}`,
          });
        }
      } else if (issue.message.includes('exceeds maximum allowed level')) {
        // Reduce heading level to maximum allowed
        const heading = file.headings.find(h => h.line === issue.line);
        if (heading) {
          const newLevel = Math.min(
            heading.level,
            this.settings.max_heading_level
          );
          const newHeadingText = '#'.repeat(newLevel) + ' ' + heading.text;
          changes.push({
            type: 'replace',
            line: heading.line,
            oldText: this.getHeadingText(heading),
            newText: newHeadingText,
          });
        }
      } else if (issue.message.includes('should use title case')) {
        // Convert to title case
        const heading = file.headings.find(h => h.line === issue.line);
        if (heading) {
          const titleCaseText = this.toTitleCase(heading.text);
          changes.push({
            type: 'replace',
            line: heading.line,
            oldText: this.getHeadingText(heading),
            newText: '#'.repeat(heading.level) + ' ' + titleCaseText,
          });
        }
      } else if (issue.message.includes('heading hierarchy')) {
        // Fix hierarchy issues
        const hierarchyFixes = this.fixHeadingHierarchy(
          file.headings,
          file.path
        );
        changes.push(...hierarchyFixes);
      }
    }

    if (changes.length > 0) {
      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Fixed heading structure and formatting',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Validate heading hierarchy
   */
  private validateHeadingHierarchy(
    headings: Heading[],
    filePath: string
  ): Issue[] {
    const issues: Issue[] = [];

    for (let i = 0; i < headings.length; i++) {
      const current = headings[i];
      const previous = i > 0 ? headings[i - 1] : null;

      if (previous && current.level > previous.level + 1) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `Heading hierarchy violation: H${current.level} follows H${previous.level} (should not skip levels)`,
          file: filePath,
          line: current.line,
          fixable: this.settings.auto_fix,
        });
      }
    }

    return issues;
  }

  /**
   * Fix heading hierarchy issues
   */
  private fixHeadingHierarchy(
    headings: Heading[],
    filePath: string
  ): FileChange[] {
    const changes: FileChange[] = [];

    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];

      if (current.level > previous.level + 1) {
        // Adjust level to be one more than previous
        const newLevel = previous.level + 1;
        const newHeadingText = '#'.repeat(newLevel) + ' ' + current.text;

        changes.push({
          type: 'replace',
          line: current.line,
          oldText: this.getHeadingText(current),
          newText: newHeadingText,
        });
      }
    }

    return changes;
  }

  /**
   * Get the full heading text including markdown syntax
   */
  private getHeadingText(heading: Heading): string {
    return '#'.repeat(heading.level) + ' ' + heading.text;
  }

  /**
   * Find appropriate insertion point for new H1 heading
   */
  private findInsertionPoint(file: any): number {
    // Insert after frontmatter if it exists
    if (file.frontmatter && Object.keys(file.frontmatter).length > 0) {
      const lines = file.content.split('\n');
      let endOfFrontmatter = 0;

      if (lines[0] === '---') {
        for (let i = 1; i < lines.length; i++) {
          if (lines[i] === '---') {
            endOfFrontmatter = i + 1;
            break;
          }
        }
      }

      return endOfFrontmatter + 1;
    }

    return 1;
  }

  /**
   * Check if text is in title case
   */
  private isTitleCase(text: string): boolean {
    const words = text.split(/\s+/);
    const minorWords = [
      'a',
      'an',
      'and',
      'as',
      'at',
      'but',
      'by',
      'for',
      'if',
      'in',
      'nor',
      'of',
      'on',
      'or',
      'so',
      'the',
      'to',
      'up',
      'yet',
    ];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const isFirstOrLast = i === 0 || i === words.length - 1;
      const isMinorWord = minorWords.includes(word.toLowerCase());

      if (isFirstOrLast || !isMinorWord) {
        if (word[0] !== word[0].toUpperCase()) {
          return false;
        }
      } else {
        if (word[0] !== word[0].toLowerCase()) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Convert text to title case
   */
  private toTitleCase(text: string): string {
    const words = text.split(/\s+/);
    const minorWords = [
      'a',
      'an',
      'and',
      'as',
      'at',
      'but',
      'by',
      'for',
      'if',
      'in',
      'nor',
      'of',
      'on',
      'or',
      'so',
      'the',
      'to',
      'up',
      'yet',
    ];

    return words
      .map((word, index) => {
        const isFirstOrLast = index === 0 || index === words.length - 1;
        const isMinorWord = minorWords.includes(word.toLowerCase());

        if (isFirstOrLast || !isMinorWord) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        } else {
          return word.toLowerCase();
        }
      })
      .join(' ');
  }
}

/**
 * Title Match variant - ensures H1 matches frontmatter title
 */
export class HeadingsProperTitleMatchRule extends HeadingsProperRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'headings-proper',
        minor: 'title-match',
        full: 'headings-proper.title-match',
      },
      'Headings Title Match',
      'Ensure H1 heading matches frontmatter title',
      config
    );
  }
}

/**
 * Hierarchy Enforced variant - strict heading hierarchy validation
 */
export class HeadingsProperHierarchyEnforcedRule extends HeadingsProperRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'headings-proper',
        minor: 'hierarchy-enforced',
        full: 'headings-proper.hierarchy-enforced',
      },
      'Headings Hierarchy Enforced',
      'Enforce strict heading hierarchy without level skipping',
      config
    );
  }
}

/**
 * Flexible variant - relaxed heading validation
 */
export class HeadingsProperFlexibleRule extends HeadingsProperRule {
  constructor(config: RuleConfig) {
    const flexibleConfig = {
      ...config,
      settings: {
        ...config.settings,
        enforce_hierarchy: false,
        require_h1: false,
        single_h1: false,
        title_match: false,
      },
    };

    super(
      {
        major: 'headings-proper',
        minor: 'flexible',
        full: 'headings-proper.flexible',
      },
      'Headings Flexible',
      'Flexible heading validation with minimal requirements',
      flexibleConfig
    );
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createHeadingsProperRule(
  ruleId: string,
  config: RuleConfig
): HeadingsProperRule {
  switch (ruleId) {
    case 'headings-proper.title-match':
      return new HeadingsProperTitleMatchRule(config);
    case 'headings-proper.hierarchy-enforced':
      return new HeadingsProperHierarchyEnforcedRule(config);
    case 'headings-proper.flexible':
      return new HeadingsProperFlexibleRule(config);
    default:
      throw new Error(`Unknown headings proper rule variant: ${ruleId}`);
  }
}
