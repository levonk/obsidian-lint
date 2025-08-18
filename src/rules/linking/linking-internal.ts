/**
 * Internal Linking Rules Implementation
 * Validates and fixes internal link formatting according to different strategies
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange, Link } from '../../types/common.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Interface for internal linking settings
 */
interface InternalLinkingSettings {
  enforce_double_brackets: boolean;
  allow_markdown_links: boolean;
  auto_convert: boolean;
  check_file_existence: boolean;
  case_sensitive: boolean;
  suggest_alternatives: boolean;
  max_suggestions: number;
}

/**
 * Base class for internal linking rules
 */
export abstract class LinkingInternalRule extends BaseRule {
  protected settings: InternalLinkingSettings;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'linking', config);
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(
    settings: Record<string, any>
  ): InternalLinkingSettings {
    const defaultSettings: InternalLinkingSettings = {
      enforce_double_brackets: true,
      allow_markdown_links: false,
      auto_convert: true,
      check_file_existence: true,
      case_sensitive: false,
      suggest_alternatives: true,
      max_suggestions: 3,
    };

    return {
      ...defaultSettings,
      ...settings,
      enforce_double_brackets:
        settings['enforce_double_brackets'] ??
        defaultSettings.enforce_double_brackets,
      allow_markdown_links:
        settings['allow_markdown_links'] ??
        defaultSettings.allow_markdown_links,
      auto_convert: settings['auto_convert'] ?? defaultSettings.auto_convert,
      check_file_existence:
        settings['check_file_existence'] ??
        defaultSettings.check_file_existence,
      case_sensitive:
        settings['case_sensitive'] ?? defaultSettings.case_sensitive,
      suggest_alternatives:
        settings['suggest_alternatives'] ??
        defaultSettings.suggest_alternatives,
      max_suggestions:
        settings['max_suggestions'] ?? defaultSettings.max_suggestions,
    };
  }

  /**
   * Lint implementation - check for internal linking issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file, vaultPath } = context;

    // Check each link in the file
    for (const link of file.links) {
      if (link.type === 'internal') {
        const linkIssues = await this.validateInternalLink(
          link,
          file.path,
          vaultPath
        );
        issues.push(...linkIssues);
      }
    }

    // Check for markdown-style internal links that should be wikilinks
    if (this.settings.enforce_double_brackets) {
      const markdownInternalLinks = await this.findMarkdownInternalLinks(
        file.content,
        vaultPath
      );
      for (const link of markdownInternalLinks) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `Internal link should use double bracket format: [[${link.target}]]`,
          file: file.path,
          line: link.line,
          column: link.column,
          fixable: this.settings.auto_convert,
        });
      }
    }

    return issues;
  }

  /**
   * Fix implementation - convert and fix internal links
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_convert) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file, vaultPath } = context;
    const changes: FileChange[] = [];

    // Convert markdown-style internal links to wikilinks
    if (this.settings.enforce_double_brackets) {
      const markdownInternalLinks = await this.findMarkdownInternalLinks(
        file.content,
        vaultPath
      );

      for (const link of markdownInternalLinks) {
        const oldText = `[${link.text}](${link.target})`;
        const newText =
          link.text === link.target
            ? `[[${link.target}]]`
            : `[[${link.target}|${link.text}]]`;

        changes.push({
          type: 'replace',
          line: link.line,
          oldText,
          newText,
        });
      }
    }

    // Fix broken internal links with suggestions
    if (this.settings.suggest_alternatives) {
      for (const link of file.links) {
        if (
          link.type === 'internal' &&
          !(await this.linkTargetExists(link.target, vaultPath))
        ) {
          const suggestions = await this.findLinkSuggestions(
            link.target,
            vaultPath
          );
          if (suggestions.length > 0) {
            const bestSuggestion = suggestions[0];
            const oldText = `[[${link.target}]]`;
            const newText = `[[${bestSuggestion}]]`;

            changes.push({
              type: 'replace',
              line: link.line,
              oldText,
              newText,
            });
          }
        }
      }
    }

    if (changes.length > 0) {
      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Fixed internal link formatting and broken links',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Validate a single internal link
   */
  protected async validateInternalLink(
    link: Link,
    filePath: string,
    vaultPath: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Check if target file exists
    if (this.settings.check_file_existence) {
      const exists = await this.linkTargetExists(link.target, vaultPath);
      if (!exists) {
        const suggestions = this.settings.suggest_alternatives
          ? await this.findLinkSuggestions(link.target, vaultPath)
          : [];

        let message = `Broken internal link: ${link.target}`;
        if (suggestions.length > 0) {
          message += `. Did you mean: ${suggestions.slice(0, this.settings.max_suggestions).join(', ')}?`;
        }

        issues.push({
          ruleId: this.id.full,
          severity: 'error',
          message,
          file: filePath,
          line: link.line,
          column: link.column,
          fixable: this.settings.suggest_alternatives && suggestions.length > 0,
        });
      }
    }

    return issues;
  }

  /**
   * Find markdown-style links that point to internal files
   */
  protected async findMarkdownInternalLinks(
    content: string,
    vaultPath: string
  ): Promise<Link[]> {
    const internalLinks: Link[] = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;

      while ((match = markdownLinkRegex.exec(line)) !== null) {
        const text = match[1];
        const target = match[2];
        const column = match.index;

        // Check if this is an internal link (not http/https)
        if (!target.startsWith('http') && !target.startsWith('https')) {
          // Check if the target could be a markdown file
          const isMarkdownFile =
            target.endsWith('.md') ||
            (await this.couldBeInternalFile(target, vaultPath));

          if (isMarkdownFile) {
            internalLinks.push({
              type: 'internal',
              text,
              target: target.replace(/\.md$/, ''), // Remove .md extension for wikilink
              line: lineIndex + 1,
              column: column + 1,
            });
          }
        }
      }
    }

    return internalLinks;
  }

  /**
   * Check if a target could be an internal file
   */
  protected async couldBeInternalFile(
    target: string,
    vaultPath: string
  ): Promise<boolean> {
    try {
      // Try with .md extension
      const mdPath = path.join(vaultPath, `${target}.md`);
      await fs.access(mdPath);
      return true;
    } catch {
      // Try as-is
      try {
        const directPath = path.join(vaultPath, target);
        await fs.access(directPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Check if a link target exists
   */
  protected async linkTargetExists(
    target: string,
    vaultPath: string
  ): Promise<boolean> {
    try {
      // Try various possible paths
      const possiblePaths = [
        path.join(vaultPath, `${target}.md`),
        path.join(vaultPath, target),
        path.join(vaultPath, target, 'index.md'),
      ];

      for (const possiblePath of possiblePaths) {
        try {
          await fs.access(possiblePath);
          return true;
        } catch {
          continue;
        }
      }

      // Try case-insensitive search if not case sensitive
      if (!this.settings.case_sensitive) {
        return await this.findCaseInsensitiveMatch(target, vaultPath);
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Find case-insensitive match for a target
   */
  protected async findCaseInsensitiveMatch(
    target: string,
    vaultPath: string
  ): Promise<boolean> {
    try {
      const files = await this.getAllMarkdownFiles(vaultPath);
      const targetLower = target.toLowerCase();

      return files.some(file => {
        const baseName = path.basename(file, '.md').toLowerCase();
        return baseName === targetLower;
      });
    } catch {
      return false;
    }
  }

  /**
   * Find suggestions for broken links
   */
  protected async findLinkSuggestions(
    target: string,
    vaultPath: string
  ): Promise<string[]> {
    try {
      const files = await this.getAllMarkdownFiles(vaultPath);
      const suggestions: Array<{ file: string; score: number }> = [];

      for (const file of files) {
        const baseName = path.basename(file, '.md');
        const score = this.calculateSimilarity(target, baseName);

        if (score > 0.5) {
          // Only suggest if similarity is above threshold
          suggestions.push({ file: baseName, score });
        }
      }

      // Sort by similarity score and return top suggestions
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, this.settings.max_suggestions)
        .map(s => s.file);
    } catch {
      return [];
    }
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  protected calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  protected levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get all markdown files in the vault
   */
  protected async getAllMarkdownFiles(vaultPath: string): Promise<string[]> {
    const files: string[] = [];

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      } catch {
        // Ignore directories we can't read
      }
    };

    await scanDirectory(vaultPath);
    return files;
  }
}

/**
 * Strict brackets variant - enforces double bracket format for all internal links
 */
export class LinkingInternalStrictBracketsRule extends LinkingInternalRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'linking-internal',
        minor: 'strict-brackets',
        full: 'linking-internal.strict-brackets',
      },
      'Strict Internal Link Brackets',
      'Enforce double bracket format [[link]] for all internal links',
      config
    );
  }
}

/**
 * Flexible variant - allows both wikilinks and markdown links for internal references
 */
export class LinkingInternalFlexibleRule extends LinkingInternalRule {
  constructor(config: RuleConfig) {
    const flexibleConfig = {
      ...config,
      settings: {
        ...config.settings,
        enforce_double_brackets: false,
        allow_markdown_links: true,
      },
    };

    super(
      {
        major: 'linking-internal',
        minor: 'flexible',
        full: 'linking-internal.flexible',
      },
      'Flexible Internal Links',
      'Allow both wikilinks and markdown links for internal references',
      flexibleConfig
    );
  }
}

/**
 * Auto-convert variant - automatically converts between link formats
 */
export class LinkingInternalAutoConvertRule extends LinkingInternalRule {
  constructor(config: RuleConfig) {
    const autoConvertConfig = {
      ...config,
      settings: {
        ...config.settings,
        enforce_double_brackets: true,
        auto_convert: true,
        suggest_alternatives: true,
      },
    };

    super(
      {
        major: 'linking-internal',
        minor: 'auto-convert',
        full: 'linking-internal.auto-convert',
      },
      'Auto-Convert Internal Links',
      'Automatically convert and fix internal link formats',
      autoConvertConfig
    );
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createLinkingInternalRule(
  ruleId: string,
  config: RuleConfig
): LinkingInternalRule {
  switch (ruleId) {
    case 'linking-internal.strict-brackets':
      return new LinkingInternalStrictBracketsRule(config);
    case 'linking-internal.flexible':
      return new LinkingInternalFlexibleRule(config);
    case 'linking-internal.auto-convert':
      return new LinkingInternalAutoConvertRule(config);
    default:
      throw new Error(`Unknown linking internal rule variant: ${ruleId}`);
  }
}
