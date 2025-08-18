/**
 * Broken Link Detection Rule Implementation
 * Comprehensive broken link detection and resolution for both internal and external links
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
 * Interface for broken link detection settings
 */
interface BrokenLinkDetectionSettings {
  check_internal_links: boolean;
  check_external_links: boolean;
  check_attachments: boolean;
  auto_fix_internal: boolean;
  auto_fix_external: boolean;
  suggest_alternatives: boolean;
  max_suggestions: number;
  external_timeout_ms: number;
  case_sensitive: boolean;
  follow_redirects: boolean;
  ignore_fragments: boolean;
  report_only: boolean;
}

/**
 * Broken link detection and resolution rule
 */
export class BrokenLinkDetectionRule extends BaseRule {
  protected settings: BrokenLinkDetectionSettings;

  constructor(config: RuleConfig) {
    super(
      {
        major: 'broken-link-detection',
        minor: 'comprehensive',
        full: 'broken-link-detection.comprehensive',
      },
      'Broken Link Detection',
      'Detect and resolve broken internal and external links',
      'linking',
      config
    );
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(
    settings: Record<string, any>
  ): BrokenLinkDetectionSettings {
    const defaultSettings: BrokenLinkDetectionSettings = {
      check_internal_links: true,
      check_external_links: true,
      check_attachments: true,
      auto_fix_internal: true,
      auto_fix_external: false,
      suggest_alternatives: true,
      max_suggestions: 3,
      external_timeout_ms: 5000,
      case_sensitive: false,
      follow_redirects: true,
      ignore_fragments: true,
      report_only: false,
    };

    return {
      ...defaultSettings,
      ...settings,
      check_internal_links:
        settings['check_internal_links'] ??
        defaultSettings.check_internal_links,
      check_external_links:
        settings['check_external_links'] ??
        defaultSettings.check_external_links,
      check_attachments:
        settings['check_attachments'] ?? defaultSettings.check_attachments,
      auto_fix_internal:
        settings['auto_fix_internal'] ?? defaultSettings.auto_fix_internal,
      auto_fix_external:
        settings['auto_fix_external'] ?? defaultSettings.auto_fix_external,
      suggest_alternatives:
        settings['suggest_alternatives'] ??
        defaultSettings.suggest_alternatives,
      max_suggestions:
        settings['max_suggestions'] ?? defaultSettings.max_suggestions,
      external_timeout_ms:
        settings['external_timeout_ms'] ?? defaultSettings.external_timeout_ms,
      case_sensitive:
        settings['case_sensitive'] ?? defaultSettings.case_sensitive,
      follow_redirects:
        settings['follow_redirects'] ?? defaultSettings.follow_redirects,
      ignore_fragments:
        settings['ignore_fragments'] ?? defaultSettings.ignore_fragments,
      report_only: settings['report_only'] ?? defaultSettings.report_only,
    };
  }

  /**
   * Lint implementation - detect broken links
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file, vaultPath } = context;

    // Check internal links
    if (this.settings.check_internal_links) {
      const internalIssues = await this.checkInternalLinks(
        file.links,
        file.path,
        vaultPath
      );
      issues.push(...internalIssues);
    }

    // Check external links
    if (this.settings.check_external_links) {
      const externalIssues = await this.checkExternalLinks(
        file.links,
        file.path
      );
      issues.push(...externalIssues);
    }

    // Check attachment links
    if (this.settings.check_attachments) {
      const attachmentIssues = await this.checkAttachmentLinks(
        file.attachments,
        file.path,
        vaultPath
      );
      issues.push(...attachmentIssues);
    }

    return issues;
  }

  /**
   * Fix implementation - resolve broken links
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (this.settings.report_only) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file, vaultPath } = context;
    const changes: FileChange[] = [];

    // Fix internal links
    if (this.settings.auto_fix_internal) {
      const internalFixes = await this.fixInternalLinks(
        file.links,
        file.content,
        vaultPath
      );
      changes.push(...internalFixes);
    }

    // Fix external links (limited fixes available)
    if (this.settings.auto_fix_external) {
      const externalFixes = await this.fixExternalLinks(
        file.links,
        file.content
      );
      changes.push(...externalFixes);
    }

    if (changes.length > 0) {
      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Fixed broken links',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Check internal links for broken references
   */
  protected async checkInternalLinks(
    links: Link[],
    filePath: string,
    vaultPath: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    for (const link of links) {
      if (link.type === 'internal') {
        const exists = await this.internalLinkExists(link.target, vaultPath);

        if (!exists) {
          let message = `Broken internal link: ${link.target}`;

          if (this.settings.suggest_alternatives) {
            const suggestions = await this.findInternalLinkSuggestions(
              link.target,
              vaultPath
            );
            if (suggestions.length > 0) {
              message += `. Did you mean: ${suggestions.slice(0, this.settings.max_suggestions).join(', ')}?`;
            }
          }

          issues.push({
            ruleId: this.id.full,
            severity: 'error',
            message,
            file: filePath,
            line: link.line,
            column: link.column,
            fixable:
              this.settings.auto_fix_internal &&
              this.settings.suggest_alternatives,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check external links for accessibility
   */
  protected async checkExternalLinks(
    links: Link[],
    filePath: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    for (const link of links) {
      if (link.type === 'external') {
        const isAccessible = await this.externalLinkAccessible(link.target);

        if (!isAccessible) {
          issues.push({
            ruleId: this.id.full,
            severity: 'warning',
            message: `External link may be broken or inaccessible: ${link.target}`,
            file: filePath,
            line: link.line,
            column: link.column,
            fixable: false,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check attachment links for missing files
   */
  protected async checkAttachmentLinks(
    attachments: any[],
    filePath: string,
    vaultPath: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    for (const attachment of attachments) {
      const exists = await this.attachmentExists(attachment.path, vaultPath);

      if (!exists) {
        let message = `Missing attachment: ${attachment.path}`;

        if (this.settings.suggest_alternatives) {
          const suggestions = await this.findAttachmentSuggestions(
            attachment.name,
            vaultPath
          );
          if (suggestions.length > 0) {
            message += `. Similar files found: ${suggestions.slice(0, this.settings.max_suggestions).join(', ')}`;
          }
        }

        issues.push({
          ruleId: this.id.full,
          severity: 'error',
          message,
          file: filePath,
          fixable:
            this.settings.suggest_alternatives &&
            this.settings.auto_fix_internal,
        });
      }
    }

    return issues;
  }

  /**
   * Fix internal links by finding and replacing with suggestions
   */
  protected async fixInternalLinks(
    links: Link[],
    content: string,
    vaultPath: string
  ): Promise<FileChange[]> {
    const changes: FileChange[] = [];

    for (const link of links) {
      if (link.type === 'internal') {
        const exists = await this.internalLinkExists(link.target, vaultPath);

        if (!exists && this.settings.suggest_alternatives) {
          const suggestions = await this.findInternalLinkSuggestions(
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

    return changes;
  }

  /**
   * Fix external links (limited fixes available)
   */
  protected async fixExternalLinks(
    links: Link[],
    content: string
  ): Promise<FileChange[]> {
    const changes: FileChange[] = [];

    // For now, we can only fix simple issues like HTTP -> HTTPS conversion
    for (const link of links) {
      if (link.type === 'external' && link.target.startsWith('http://')) {
        const httpsUrl = link.target.replace('http://', 'https://');
        const isHttpsAccessible = await this.externalLinkAccessible(httpsUrl);

        if (isHttpsAccessible) {
          // Find the line content and replace the HTTP URL with HTTPS
          const lines = content.split('\n');
          const lineContent = lines[link.line - 1];
          const updatedLineContent = lineContent.replace(link.target, httpsUrl);

          changes.push({
            type: 'replace',
            line: link.line,
            oldText: lineContent,
            newText: updatedLineContent,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Check if an internal link target exists
   */
  protected async internalLinkExists(
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

      // Handle fragments (e.g., "file#heading")
      const [baseTarget] = target.split('#');
      if (baseTarget !== target) {
        possiblePaths.push(
          path.join(vaultPath, `${baseTarget}.md`),
          path.join(vaultPath, baseTarget),
          path.join(vaultPath, baseTarget, 'index.md')
        );
      }

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
        return await this.findCaseInsensitiveMatch(baseTarget, vaultPath);
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if an external link is accessible
   */
  protected async externalLinkAccessible(url: string): Promise<boolean> {
    try {
      // Remove fragment if ignoring fragments
      let checkUrl = url;
      if (this.settings.ignore_fragments) {
        checkUrl = url.split('#')[0];
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.settings.external_timeout_ms
      );

      const response = await fetch(checkUrl, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: this.settings.follow_redirects ? 'follow' : 'manual',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if an attachment exists
   */
  protected async attachmentExists(
    attachmentPath: string,
    vaultPath: string
  ): Promise<boolean> {
    try {
      const fullPath = path.isAbsolute(attachmentPath)
        ? attachmentPath
        : path.join(vaultPath, attachmentPath);

      await fs.access(fullPath);
      return true;
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
   * Find suggestions for broken internal links
   */
  protected async findInternalLinkSuggestions(
    target: string,
    vaultPath: string
  ): Promise<string[]> {
    try {
      const files = await this.getAllMarkdownFiles(vaultPath);
      const suggestions: Array<{ file: string; score: number }> = [];

      // Remove fragment for comparison
      const baseTarget = target.split('#')[0];

      for (const file of files) {
        const baseName = path.basename(file, '.md');
        const score = this.calculateSimilarity(baseTarget, baseName);

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
   * Find suggestions for missing attachments
   */
  protected async findAttachmentSuggestions(
    attachmentName: string,
    vaultPath: string
  ): Promise<string[]> {
    try {
      const attachments = await this.getAllAttachmentFiles(vaultPath);
      const suggestions: Array<{ file: string; score: number }> = [];

      for (const attachment of attachments) {
        const baseName = path.basename(attachment);
        const score = this.calculateSimilarity(attachmentName, baseName);

        if (score > 0.5) {
          suggestions.push({ file: baseName, score });
        }
      }

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

  /**
   * Get all attachment files in the vault
   */
  protected async getAllAttachmentFiles(vaultPath: string): Promise<string[]> {
    const files: string[] = [];
    const attachmentExtensions = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.svg',
      '.mp4',
      '.mov',
      '.avi',
      '.mkv',
      '.webm',
      '.mp3',
      '.wav',
      '.ogg',
      '.flac',
      '.pdf',
      '.doc',
      '.docx',
      '.txt',
    ];

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (attachmentExtensions.includes(ext)) {
              files.push(fullPath);
            }
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
 * Factory function to create broken link detection rule
 */
export function createBrokenLinkDetectionRule(
  config: RuleConfig
): BrokenLinkDetectionRule {
  return new BrokenLinkDetectionRule(config);
}
