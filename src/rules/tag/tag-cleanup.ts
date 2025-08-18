/**
 * Tag Cleanup Rule Implementation
 * Removes redundant, unused, and inconsistent tags
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';

/**
 * Interface for tag cleanup settings
 */
interface TagCleanupSettings {
  auto_fix: boolean;
  remove_duplicates: boolean;
  remove_empty_tags: boolean;
  normalize_case: boolean;
  target_case: 'lowercase' | 'uppercase' | 'preserve';
  remove_invalid_characters: boolean;
  valid_tag_pattern: string;
  min_tag_length: number;
  max_tag_length: number;
  remove_numeric_only_tags: boolean;
  consolidate_similar_tags: boolean;
  similarity_threshold: number;
  tag_prefix_cleanup: boolean;
  allowed_prefixes: string[];
  remove_common_words: boolean;
  common_words_list: string[];
}

/**
 * Tag cleanup rule for removing redundant and inconsistent tags
 */
export class TagCleanupRule extends BaseRule {
  protected settings: TagCleanupSettings;

  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-cleanup',
        minor: 'standard',
        full: 'tag-cleanup.standard',
      },
      'Tag Cleanup',
      'Remove redundant, unused, and inconsistent tags',
      'tag',
      config
    );
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(settings: Record<string, any>): TagCleanupSettings {
    const defaultSettings: TagCleanupSettings = {
      auto_fix: true,
      remove_duplicates: true,
      remove_empty_tags: true,
      normalize_case: true,
      target_case: 'lowercase',
      remove_invalid_characters: true,
      valid_tag_pattern: '^[a-zA-Z0-9_-]+$',
      min_tag_length: 2,
      max_tag_length: 50,
      remove_numeric_only_tags: true,
      consolidate_similar_tags: false,
      similarity_threshold: 0.8,
      tag_prefix_cleanup: true,
      allowed_prefixes: [],
      remove_common_words: true,
      common_words_list: [
        'the',
        'and',
        'or',
        'but',
        'in',
        'on',
        'at',
        'to',
        'for',
        'of',
        'with',
        'by',
        'from',
        'up',
        'about',
        'into',
        'through',
        'during',
        'before',
        'after',
        'above',
        'below',
        'between',
        'among',
        'this',
        'that',
        'these',
        'those',
        'i',
        'me',
        'my',
        'we',
        'our',
        'you',
        'your',
        'he',
        'him',
        'his',
        'she',
        'her',
        'it',
        'its',
        'they',
        'them',
        'their',
        'what',
        'which',
        'who',
        'whom',
        'where',
        'when',
        'why',
        'how',
        'all',
        'any',
        'both',
        'each',
        'few',
        'more',
        'most',
        'other',
        'some',
        'such',
        'no',
        'nor',
        'not',
        'only',
        'own',
        'same',
        'so',
        'than',
        'too',
        'very',
        'can',
        'will',
        'just',
        'should',
        'now',
      ],
    };

    return {
      ...defaultSettings,
      ...settings,
      auto_fix:
        typeof settings.auto_fix === 'boolean'
          ? settings.auto_fix
          : defaultSettings.auto_fix,
      remove_duplicates:
        typeof settings.remove_duplicates === 'boolean'
          ? settings.remove_duplicates
          : defaultSettings.remove_duplicates,
      remove_empty_tags:
        typeof settings.remove_empty_tags === 'boolean'
          ? settings.remove_empty_tags
          : defaultSettings.remove_empty_tags,
      normalize_case:
        typeof settings.normalize_case === 'boolean'
          ? settings.normalize_case
          : defaultSettings.normalize_case,
      target_case: ['lowercase', 'uppercase', 'preserve'].includes(
        settings.target_case
      )
        ? settings.target_case
        : defaultSettings.target_case,
      remove_invalid_characters:
        typeof settings.remove_invalid_characters === 'boolean'
          ? settings.remove_invalid_characters
          : defaultSettings.remove_invalid_characters,
      valid_tag_pattern:
        typeof settings.valid_tag_pattern === 'string'
          ? settings.valid_tag_pattern
          : defaultSettings.valid_tag_pattern,
      min_tag_length:
        typeof settings.min_tag_length === 'number'
          ? settings.min_tag_length
          : defaultSettings.min_tag_length,
      max_tag_length:
        typeof settings.max_tag_length === 'number'
          ? settings.max_tag_length
          : defaultSettings.max_tag_length,
      remove_numeric_only_tags:
        typeof settings.remove_numeric_only_tags === 'boolean'
          ? settings.remove_numeric_only_tags
          : defaultSettings.remove_numeric_only_tags,
      consolidate_similar_tags:
        typeof settings.consolidate_similar_tags === 'boolean'
          ? settings.consolidate_similar_tags
          : defaultSettings.consolidate_similar_tags,
      similarity_threshold:
        typeof settings.similarity_threshold === 'number'
          ? settings.similarity_threshold
          : defaultSettings.similarity_threshold,
      tag_prefix_cleanup:
        typeof settings.tag_prefix_cleanup === 'boolean'
          ? settings.tag_prefix_cleanup
          : defaultSettings.tag_prefix_cleanup,
      allowed_prefixes: Array.isArray(settings.allowed_prefixes)
        ? settings.allowed_prefixes
        : defaultSettings.allowed_prefixes,
      remove_common_words:
        typeof settings.remove_common_words === 'boolean'
          ? settings.remove_common_words
          : defaultSettings.remove_common_words,
      common_words_list: Array.isArray(settings.common_words_list)
        ? settings.common_words_list
        : defaultSettings.common_words_list,
    };
  }

  /**
   * Lint implementation - identify tag cleanup issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    // Get current tags from frontmatter
    const currentTags = this.getCurrentTags(file);

    if (currentTags.length === 0) {
      return issues;
    }

    // Analyze tags for cleanup opportunities
    const cleanupAnalysis = this.analyzeTagsForCleanup(currentTags);

    if (cleanupAnalysis.hasIssues) {
      const issueMessages: string[] = [];

      if (cleanupAnalysis.duplicates.length > 0) {
        issueMessages.push(
          `Duplicate tags: ${cleanupAnalysis.duplicates.join(', ')}`
        );
      }

      if (cleanupAnalysis.emptyTags.length > 0) {
        issueMessages.push(
          `Empty/invalid tags: ${cleanupAnalysis.emptyTags.length} found`
        );
      }

      if (cleanupAnalysis.caseInconsistencies.length > 0) {
        issueMessages.push(
          `Case inconsistencies: ${cleanupAnalysis.caseInconsistencies.length} tags`
        );
      }

      if (cleanupAnalysis.invalidCharacters.length > 0) {
        issueMessages.push(
          `Invalid characters: ${cleanupAnalysis.invalidCharacters.length} tags`
        );
      }

      if (cleanupAnalysis.commonWords.length > 0) {
        issueMessages.push(
          `Common words as tags: ${cleanupAnalysis.commonWords.join(', ')}`
        );
      }

      if (cleanupAnalysis.similarTags.length > 0) {
        issueMessages.push(
          `Similar tags that could be consolidated: ${cleanupAnalysis.similarTags.length} groups`
        );
      }

      issues.push({
        ruleId: this.id.full,
        severity: 'warning',
        message: `Tag cleanup needed: ${issueMessages.join('; ')}`,
        file: file.path,
        fixable: this.settings.auto_fix,
      });
    }

    return issues;
  }

  /**
   * Fix implementation - clean up tags
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_fix) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file } = context;
    const changes: FileChange[] = [];

    // Get current tags and clean them up
    const currentTags = this.getCurrentTags(file);
    const cleanedTags = this.cleanupTags(currentTags);

    // Update frontmatter if tags changed
    if (
      JSON.stringify(currentTags.sort()) !== JSON.stringify(cleanedTags.sort())
    ) {
      const updatedFrontmatter = { ...file.frontmatter };
      updatedFrontmatter.tags = cleanedTags;

      const newFrontmatterContent =
        this.generateFrontmatterContent(updatedFrontmatter);
      const frontmatterBounds = this.findFrontmatterBounds(file.content);

      if (frontmatterBounds) {
        changes.push({
          type: 'replace',
          line: frontmatterBounds.startLine,
          oldText: file.content.substring(
            frontmatterBounds.startIndex,
            frontmatterBounds.endIndex
          ),
          newText: newFrontmatterContent,
        });
      } else if (cleanedTags.length > 0) {
        // Add frontmatter at the beginning if tags exist after cleanup
        changes.push({
          type: 'insert',
          line: 1,
          column: 1,
          newText: newFrontmatterContent + '\n',
        });
      }

      const removedCount = currentTags.length - cleanedTags.length;
      const description =
        removedCount > 0
          ? `Cleaned up tags: removed ${removedCount} redundant/invalid tags`
          : 'Cleaned up tag formatting and consistency';

      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description,
        changes,
      });
    }

    return fixes;
  }

  /**
   * Get current tags from file frontmatter
   */
  private getCurrentTags(file: any): string[] {
    if (!file.frontmatter || !file.frontmatter.tags) {
      return [];
    }

    if (Array.isArray(file.frontmatter.tags)) {
      return file.frontmatter.tags.filter(tag => typeof tag === 'string');
    }

    if (typeof file.frontmatter.tags === 'string') {
      return [file.frontmatter.tags];
    }

    return [];
  }

  /**
   * Analyze tags for cleanup opportunities
   */
  private analyzeTagsForCleanup(tags: string[]): {
    hasIssues: boolean;
    duplicates: string[];
    emptyTags: string[];
    caseInconsistencies: string[];
    invalidCharacters: string[];
    commonWords: string[];
    similarTags: string[][];
  } {
    const analysis = {
      hasIssues: false,
      duplicates: [] as string[],
      emptyTags: [] as string[],
      caseInconsistencies: [] as string[],
      invalidCharacters: [] as string[],
      commonWords: [] as string[],
      similarTags: [] as string[][],
    };

    // Check for duplicates (case-insensitive)
    if (this.settings.remove_duplicates) {
      const seen = new Set<string>();
      const duplicates = new Set<string>();

      for (const tag of tags) {
        const normalized = tag.toLowerCase();
        if (seen.has(normalized)) {
          duplicates.add(tag);
        } else {
          seen.add(normalized);
        }
      }

      analysis.duplicates = Array.from(duplicates);
    }

    // Check for empty or invalid tags
    if (this.settings.remove_empty_tags) {
      analysis.emptyTags = tags.filter(
        tag =>
          !tag ||
          tag.trim().length === 0 ||
          tag.trim().length < this.settings.min_tag_length ||
          tag.trim().length > this.settings.max_tag_length
      );
    }

    // Check for case inconsistencies
    if (
      this.settings.normalize_case &&
      this.settings.target_case !== 'preserve'
    ) {
      analysis.caseInconsistencies = tags.filter(tag => {
        const expected =
          this.settings.target_case === 'lowercase'
            ? tag.toLowerCase()
            : tag.toUpperCase();
        return tag !== expected;
      });
    }

    // Check for invalid characters
    if (this.settings.remove_invalid_characters) {
      const pattern = new RegExp(this.settings.valid_tag_pattern);
      analysis.invalidCharacters = tags.filter(tag => !pattern.test(tag));
    }

    // Check for common words
    if (this.settings.remove_common_words) {
      analysis.commonWords = tags.filter(tag =>
        this.settings.common_words_list.includes(tag.toLowerCase())
      );
    }

    // Check for numeric-only tags
    if (this.settings.remove_numeric_only_tags) {
      const numericTags = tags.filter(tag => /^\d+$/.test(tag));
      analysis.emptyTags.push(...numericTags);
    }

    // Check for similar tags that could be consolidated
    if (this.settings.consolidate_similar_tags) {
      analysis.similarTags = this.findSimilarTags(tags);
    }

    analysis.hasIssues =
      analysis.duplicates.length > 0 ||
      analysis.emptyTags.length > 0 ||
      analysis.caseInconsistencies.length > 0 ||
      analysis.invalidCharacters.length > 0 ||
      analysis.commonWords.length > 0 ||
      analysis.similarTags.length > 0;

    return analysis;
  }

  /**
   * Clean up tags by applying all cleanup rules
   */
  private cleanupTags(tags: string[]): string[] {
    let cleanedTags = [...tags];

    // Remove empty and invalid tags
    if (this.settings.remove_empty_tags) {
      cleanedTags = cleanedTags.filter(
        tag =>
          tag &&
          tag.trim().length >= this.settings.min_tag_length &&
          tag.trim().length <= this.settings.max_tag_length
      );
    }

    // Remove numeric-only tags
    if (this.settings.remove_numeric_only_tags) {
      cleanedTags = cleanedTags.filter(tag => !/^\d+$/.test(tag));
    }

    // Remove common words
    if (this.settings.remove_common_words) {
      cleanedTags = cleanedTags.filter(
        tag => !this.settings.common_words_list.includes(tag.toLowerCase())
      );
    }

    // Clean invalid characters
    if (this.settings.remove_invalid_characters) {
      cleanedTags = cleanedTags.map(tag => this.cleanInvalidCharacters(tag));
    }

    // Normalize case
    if (
      this.settings.normalize_case &&
      this.settings.target_case !== 'preserve'
    ) {
      cleanedTags = cleanedTags.map(tag =>
        this.settings.target_case === 'lowercase'
          ? tag.toLowerCase()
          : tag.toUpperCase()
      );
    }

    // Clean up prefixes
    if (this.settings.tag_prefix_cleanup) {
      cleanedTags = cleanedTags.map(tag => this.cleanTagPrefix(tag));
    }

    // Remove duplicates (case-insensitive)
    if (this.settings.remove_duplicates) {
      const seen = new Set<string>();
      cleanedTags = cleanedTags.filter(tag => {
        const normalized = tag.toLowerCase();
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });
    }

    // Consolidate similar tags
    if (this.settings.consolidate_similar_tags) {
      cleanedTags = this.consolidateSimilarTags(cleanedTags);
    }

    // Final filter to remove any empty tags that might have been created
    cleanedTags = cleanedTags.filter(tag => tag && tag.trim().length > 0);

    return cleanedTags;
  }

  /**
   * Clean invalid characters from a tag
   */
  private cleanInvalidCharacters(tag: string): string {
    const pattern = new RegExp(this.settings.valid_tag_pattern);
    if (pattern.test(tag)) {
      return tag;
    }

    // Remove or replace invalid characters
    return tag
      .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Clean tag prefix
   */
  private cleanTagPrefix(tag: string): string {
    // Remove # prefix if present
    let cleaned = tag.startsWith('#') ? tag.substring(1) : tag;

    // If allowed prefixes are specified, ensure tag has one of them
    if (this.settings.allowed_prefixes.length > 0) {
      const hasAllowedPrefix = this.settings.allowed_prefixes.some(prefix =>
        cleaned.startsWith(prefix)
      );

      if (!hasAllowedPrefix) {
        // Add the first allowed prefix
        cleaned = `${this.settings.allowed_prefixes[0]}${cleaned}`;
      }
    }

    return cleaned;
  }

  /**
   * Find groups of similar tags
   */
  private findSimilarTags(tags: string[]): string[][] {
    const similarGroups: string[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < tags.length; i++) {
      if (processed.has(tags[i])) continue;

      const similarTags = [tags[i]];
      processed.add(tags[i]);

      for (let j = i + 1; j < tags.length; j++) {
        if (processed.has(tags[j])) continue;

        const similarity = this.calculateSimilarity(tags[i], tags[j]);
        if (similarity >= this.settings.similarity_threshold) {
          similarTags.push(tags[j]);
          processed.add(tags[j]);
        }
      }

      if (similarTags.length > 1) {
        similarGroups.push(similarTags);
      }
    }

    return similarGroups;
  }

  /**
   * Calculate similarity between two tags using Levenshtein distance
   */
  private calculateSimilarity(tag1: string, tag2: string): number {
    const a = tag1.toLowerCase();
    const b = tag2.toLowerCase();

    if (a === b) return 1.0;

    const matrix = Array(b.length + 1)
      .fill(null)
      .map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    const maxLength = Math.max(a.length, b.length);
    return 1 - matrix[b.length][a.length] / maxLength;
  }

  /**
   * Consolidate similar tags by keeping the most common variant
   */
  private consolidateSimilarTags(tags: string[]): string[] {
    const similarGroups = this.findSimilarTags(tags);
    const consolidated = [...tags];

    for (const group of similarGroups) {
      // Keep the shortest tag as the canonical form
      const canonical = group.reduce((shortest, current) =>
        current.length < shortest.length ? current : shortest
      );

      // Replace all similar tags with the canonical form
      for (let i = 0; i < consolidated.length; i++) {
        if (group.includes(consolidated[i]) && consolidated[i] !== canonical) {
          consolidated[i] = canonical;
        }
      }
    }

    // Remove duplicates that may have been created
    return [...new Set(consolidated)];
  }

  /**
   * Generate frontmatter content from object
   */
  private generateFrontmatterContent(frontmatter: Record<string, any>): string {
    const lines = ['---'];

    // Order fields consistently
    const orderedFields = [
      'title',
      'aliases',
      'tags',
      'status',
      'date_created',
      'date_updated',
    ];
    const processedFields = new Set<string>();

    // Add ordered fields first
    for (const field of orderedFields) {
      if (field in frontmatter) {
        lines.push(this.formatFrontmatterField(field, frontmatter[field]));
        processedFields.add(field);
      }
    }

    // Add remaining fields
    for (const [field, value] of Object.entries(frontmatter)) {
      if (!processedFields.has(field)) {
        lines.push(this.formatFrontmatterField(field, value));
      }
    }

    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Format a single frontmatter field
   */
  private formatFrontmatterField(field: string, value: any): string {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return `${field}: []`;
      }
      const items = value
        .map(item => `  - ${this.escapeYamlValue(item)}`)
        .join('\n');
      return `${field}:\n${items}`;
    } else {
      return `${field}: ${this.escapeYamlValue(value)}`;
    }
  }

  /**
   * Escape YAML value if needed
   */
  private escapeYamlValue(value: any): string {
    const str = String(value);
    if (
      str.includes(':') ||
      str.includes('#') ||
      str.includes('[') ||
      str.includes(']')
    ) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }

  /**
   * Find frontmatter boundaries in content
   */
  private findFrontmatterBounds(content: string): {
    startIndex: number;
    endIndex: number;
    startLine: number;
    endLine: number;
  } | null {
    const lines = content.split('\n');

    if (lines[0] !== '---') {
      return null;
    }

    let endLine = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        endLine = i;
        break;
      }
    }

    if (endLine === -1) {
      return null;
    }

    const startIndex = 0;
    const endIndex = lines.slice(0, endLine + 1).join('\n').length;

    return {
      startIndex,
      endIndex,
      startLine: 1,
      endLine: endLine + 1,
    };
  }
}

/**
 * Factory function to create tag cleanup rule
 */
export function createTagCleanupRule(config: RuleConfig): TagCleanupRule {
  return new TagCleanupRule(config);
}
