/**
 * Tag From Context Rule Implementation
 * Generates tags based on note content and context analysis
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';

/**
 * Interface for tag-from-context settings
 */
interface TagFromContextSettings {
  auto_fix: boolean;
  min_word_frequency: number;
  max_tags_per_note: number;
  keyword_patterns: string[];
  exclude_words: string[];
  tag_prefix?: string;
  case_transform: 'lowercase' | 'uppercase' | 'preserve';
  content_analysis: {
    analyze_headings: boolean;
    analyze_links: boolean;
    analyze_bold_text: boolean;
    analyze_code_blocks: boolean;
  };
  manual_tag_markers: string[];
  context_weight: {
    headings: number;
    links: number;
    bold_text: number;
    repeated_words: number;
  };
}

/**
 * Base class for tag-from-context rules
 */
export abstract class TagFromContextRule extends BaseRule {
  protected settings: TagFromContextSettings;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'tag', config);
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(settings: Record<string, any>): TagFromContextSettings {
    const defaultSettings: TagFromContextSettings = {
      auto_fix: true,
      min_word_frequency: 2,
      max_tags_per_note: 10,
      keyword_patterns: [],
      exclude_words: [
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
        'myself',
        'we',
        'our',
        'ours',
        'ourselves',
        'you',
        'your',
        'yours',
        'yourself',
        'yourselves',
        'he',
        'him',
        'his',
        'himself',
        'she',
        'her',
        'hers',
        'herself',
        'it',
        'its',
        'itself',
        'they',
        'them',
        'their',
        'theirs',
        'themselves',
        'what',
        'which',
        'who',
        'whom',
        'whose',
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
      case_transform: 'lowercase',
      content_analysis: {
        analyze_headings: true,
        analyze_links: true,
        analyze_bold_text: true,
        analyze_code_blocks: false,
      },
      manual_tag_markers: ['#tag:', 'tags:', 'keywords:'],
      context_weight: {
        headings: 3.0,
        links: 2.0,
        bold_text: 1.5,
        repeated_words: 1.0,
      },
    };

    return {
      ...defaultSettings,
      ...settings,
      auto_fix:
        typeof settings.auto_fix === 'boolean'
          ? settings.auto_fix
          : defaultSettings.auto_fix,
      min_word_frequency:
        typeof settings.min_word_frequency === 'number'
          ? settings.min_word_frequency
          : defaultSettings.min_word_frequency,
      max_tags_per_note:
        typeof settings.max_tags_per_note === 'number'
          ? settings.max_tags_per_note
          : defaultSettings.max_tags_per_note,
      keyword_patterns: Array.isArray(settings.keyword_patterns)
        ? settings.keyword_patterns
        : defaultSettings.keyword_patterns,
      exclude_words: Array.isArray(settings.exclude_words)
        ? settings.exclude_words
        : defaultSettings.exclude_words,
      case_transform: ['lowercase', 'uppercase', 'preserve'].includes(
        settings.case_transform
      )
        ? settings.case_transform
        : defaultSettings.case_transform,
      content_analysis: {
        ...defaultSettings.content_analysis,
        ...settings.content_analysis,
      },
      manual_tag_markers: Array.isArray(settings.manual_tag_markers)
        ? settings.manual_tag_markers
        : defaultSettings.manual_tag_markers,
      context_weight: {
        ...defaultSettings.context_weight,
        ...settings.context_weight,
      },
    };
  }

  /**
   * Lint implementation - check if tags match content context
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    // Analyze content to get suggested tags
    const suggestedTags = await this.analyzeContentForTags(file);

    if (suggestedTags.length === 0) {
      return issues;
    }

    // Get current tags from frontmatter
    const currentTags = this.getCurrentTags(file);

    // Check for missing contextual tags
    const missingTags = suggestedTags.filter(
      tag => !currentTags.includes(tag.name)
    );

    if (missingTags.length > 0) {
      const topMissing = missingTags
        .slice(0, 5) // Show top 5 suggestions
        .map(tag => `${tag.name} (${tag.confidence.toFixed(2)})`)
        .join(', ');

      issues.push({
        ruleId: this.id.full,
        severity: 'info',
        message: `Suggested context-based tags: ${topMissing}`,
        file: file.path,
        fixable: this.settings.auto_fix,
      });
    }

    return issues;
  }

  /**
   * Fix implementation - add suggested tags based on content
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_fix) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file } = context;
    const changes: FileChange[] = [];

    // Analyze content for tags
    const suggestedTags = await this.analyzeContentForTags(file);
    const currentTags = this.getCurrentTags(file);

    // Select tags to add based on strategy
    const tagsToAdd = this.selectTagsToAdd(suggestedTags, currentTags);

    if (tagsToAdd.length > 0) {
      const allTags = [...new Set([...currentTags, ...tagsToAdd])];

      // Update frontmatter
      const updatedFrontmatter = { ...file.frontmatter };
      updatedFrontmatter.tags = allTags;

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
      } else {
        // Add frontmatter at the beginning
        changes.push({
          type: 'insert',
          line: 1,
          column: 1,
          newText: newFrontmatterContent + '\n',
        });
      }

      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: `Added context-based tags: ${tagsToAdd.join(', ')}`,
        changes,
      });
    }

    return fixes;
  }

  /**
   * Analyze content to extract potential tags - to be implemented by subclasses
   */
  protected abstract analyzeContentForTags(
    file: any
  ): Promise<Array<{ name: string; confidence: number }>>;

  /**
   * Select which tags to add based on strategy - to be implemented by subclasses
   */
  protected abstract selectTagsToAdd(
    suggestedTags: Array<{ name: string; confidence: number }>,
    currentTags: string[]
  ): string[];

  /**
   * Get current tags from file frontmatter
   */
  protected getCurrentTags(file: any): string[] {
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
   * Extract words from content with context weighting
   */
  protected extractWordsWithContext(file: any): Map<string, number> {
    const wordFrequency = new Map<string, number>();
    const content = file.content;

    // Analyze headings
    if (this.settings.content_analysis.analyze_headings && file.headings) {
      for (const heading of file.headings) {
        const words = this.extractWords(heading.text);
        for (const word of words) {
          const current = wordFrequency.get(word) || 0;
          wordFrequency.set(
            word,
            current + this.settings.context_weight.headings
          );
        }
      }
    }

    // Analyze links
    if (this.settings.content_analysis.analyze_links && file.links) {
      for (const link of file.links) {
        const words = this.extractWords(link.text || link.target);
        for (const word of words) {
          const current = wordFrequency.get(word) || 0;
          wordFrequency.set(word, current + this.settings.context_weight.links);
        }
      }
    }

    // Analyze bold text
    if (this.settings.content_analysis.analyze_bold_text) {
      const boldMatches = content.match(/\*\*(.*?)\*\*/g) || [];
      for (const match of boldMatches) {
        const text = match.replace(/\*\*/g, '');
        const words = this.extractWords(text);
        for (const word of words) {
          const current = wordFrequency.get(word) || 0;
          wordFrequency.set(
            word,
            current + this.settings.context_weight.bold_text
          );
        }
      }
    }

    // Analyze regular content
    const plainContent = content
      .replace(/^---[\s\S]*?---/m, '') // Remove frontmatter
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks if not analyzing them
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Extract link text
      .replace(/#+ /g, '') // Remove heading markers
      .replace(/[^\w\s]/g, ' '); // Remove punctuation

    const words = this.extractWords(plainContent);
    for (const word of words) {
      const current = wordFrequency.get(word) || 0;
      wordFrequency.set(
        word,
        current + this.settings.context_weight.repeated_words
      );
    }

    return wordFrequency;
  }

  /**
   * Extract individual words from text
   */
  protected extractWords(text: string): string[] {
    if (!text) return [];

    return text
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(
        word =>
          word.length > 2 &&
          !this.settings.exclude_words.includes(word) &&
          !/^\d+$/.test(word) // Exclude pure numbers
      );
  }

  /**
   * Format a tag according to settings
   */
  protected formatTag(tag: string): string {
    let formatted = tag.trim();

    // Remove existing prefixes if any
    if (formatted.startsWith('#')) {
      formatted = formatted.substring(1);
    }

    // Apply case transformation
    switch (this.settings.case_transform) {
      case 'lowercase':
        formatted = formatted.toLowerCase();
        break;
      case 'uppercase':
        formatted = formatted.toUpperCase();
        break;
      case 'preserve':
        // Keep original case
        break;
    }

    // Add prefix if specified
    if (this.settings.tag_prefix) {
      formatted = `${this.settings.tag_prefix}${formatted}`;
    }

    return formatted;
  }

  /**
   * Generate frontmatter content from object
   */
  protected generateFrontmatterContent(
    frontmatter: Record<string, any>
  ): string {
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
  protected formatFrontmatterField(field: string, value: any): string {
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
  protected escapeYamlValue(value: any): string {
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
  protected findFrontmatterBounds(content: string): {
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
 * Automatic variant - automatically suggests tags based on content analysis
 */
export class TagFromContextAutomaticRule extends TagFromContextRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-from-context',
        minor: 'automatic',
        full: 'tag-from-context.automatic',
      },
      'Automatic Context Tags',
      'Automatically generate tags based on content analysis and word frequency',
      config
    );
  }

  protected async analyzeContentForTags(
    file: any
  ): Promise<Array<{ name: string; confidence: number }>> {
    const wordFrequency = this.extractWordsWithContext(file);
    const tags: Array<{ name: string; confidence: number }> = [];

    // Convert frequency to confidence scores
    const maxFrequency = Math.max(...wordFrequency.values());

    for (const [word, frequency] of wordFrequency.entries()) {
      if (frequency >= this.settings.min_word_frequency) {
        const confidence = frequency / maxFrequency;
        tags.push({
          name: this.formatTag(word),
          confidence,
        });
      }
    }

    // Sort by confidence and return top candidates
    return tags
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.settings.max_tags_per_note);
  }

  protected selectTagsToAdd(
    suggestedTags: Array<{ name: string; confidence: number }>,
    currentTags: string[]
  ): string[] {
    // Automatically add tags above confidence threshold
    const confidenceThreshold = 0.3;

    return suggestedTags
      .filter(
        tag =>
          tag.confidence >= confidenceThreshold &&
          !currentTags.includes(tag.name)
      )
      .slice(
        0,
        Math.min(5, this.settings.max_tags_per_note - currentTags.length)
      )
      .map(tag => tag.name);
  }
}

/**
 * Manual variant - only suggests tags, requires manual approval
 */
export class TagFromContextManualRule extends TagFromContextRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-from-context',
        minor: 'manual',
        full: 'tag-from-context.manual',
      },
      'Manual Context Tags',
      'Suggest tags based on content analysis but require manual approval',
      config
    );
  }

  protected async analyzeContentForTags(
    file: any
  ): Promise<Array<{ name: string; confidence: number }>> {
    const wordFrequency = this.extractWordsWithContext(file);
    const tags: Array<{ name: string; confidence: number }> = [];

    // Look for manual tag markers in content
    const manualTags = this.extractManualTagMarkers(file.content);

    // Add manual tags with high confidence
    for (const tag of manualTags) {
      tags.push({
        name: this.formatTag(tag),
        confidence: 1.0,
      });
    }

    // Add content-based suggestions with lower confidence
    const maxFrequency = Math.max(...wordFrequency.values());

    for (const [word, frequency] of wordFrequency.entries()) {
      if (frequency >= this.settings.min_word_frequency) {
        const confidence = (frequency / maxFrequency) * 0.8; // Lower confidence for auto-suggestions
        tags.push({
          name: this.formatTag(word),
          confidence,
        });
      }
    }

    return tags
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.settings.max_tags_per_note);
  }

  protected selectTagsToAdd(
    suggestedTags: Array<{ name: string; confidence: number }>,
    currentTags: string[]
  ): string[] {
    // Only add tags that were manually marked (confidence = 1.0)
    return suggestedTags
      .filter(tag => tag.confidence === 1.0 && !currentTags.includes(tag.name))
      .map(tag => tag.name);
  }

  /**
   * Extract manually marked tags from content
   */
  private extractManualTagMarkers(content: string): string[] {
    const tags: string[] = [];

    for (const marker of this.settings.manual_tag_markers) {
      const regex = new RegExp(`${marker}\\s*([^\\n]+)`, 'gi');
      const matches = content.match(regex);

      if (matches) {
        for (const match of matches) {
          const tagText = match.replace(new RegExp(marker, 'i'), '').trim();
          const extractedTags = tagText
            .split(/[,;]/)
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);

          tags.push(...extractedTags);
        }
      }
    }

    return [...new Set(tags)]; // Remove duplicates
  }
}

/**
 * Hybrid variant - combines automatic suggestions with manual markers
 */
export class TagFromContextHybridRule extends TagFromContextRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-from-context',
        minor: 'hybrid',
        full: 'tag-from-context.hybrid',
      },
      'Hybrid Context Tags',
      'Combine automatic content analysis with manual tag markers',
      config
    );
  }

  protected async analyzeContentForTags(
    file: any
  ): Promise<Array<{ name: string; confidence: number }>> {
    const wordFrequency = this.extractWordsWithContext(file);
    const tags: Array<{ name: string; confidence: number }> = [];

    // Extract manual tags with high confidence
    const manualTags = this.extractManualTagMarkers(file.content);
    for (const tag of manualTags) {
      tags.push({
        name: this.formatTag(tag),
        confidence: 1.0,
      });
    }

    // Add automatic suggestions with medium confidence
    const maxFrequency = Math.max(...wordFrequency.values());

    for (const [word, frequency] of wordFrequency.entries()) {
      if (frequency >= this.settings.min_word_frequency) {
        const confidence = (frequency / maxFrequency) * 0.6; // Medium confidence for auto-suggestions
        tags.push({
          name: this.formatTag(word),
          confidence,
        });
      }
    }

    return tags
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.settings.max_tags_per_note);
  }

  protected selectTagsToAdd(
    suggestedTags: Array<{ name: string; confidence: number }>,
    currentTags: string[]
  ): string[] {
    // Add manual tags (confidence = 1.0) and high-confidence auto tags
    const manualThreshold = 1.0;
    const autoThreshold = 0.4;

    return suggestedTags
      .filter(
        tag =>
          (tag.confidence === manualThreshold ||
            tag.confidence >= autoThreshold) &&
          !currentTags.includes(tag.name)
      )
      .slice(
        0,
        Math.min(5, this.settings.max_tags_per_note - currentTags.length)
      )
      .map(tag => tag.name);
  }

  /**
   * Extract manually marked tags from content
   */
  private extractManualTagMarkers(content: string): string[] {
    const tags: string[] = [];

    for (const marker of this.settings.manual_tag_markers) {
      const regex = new RegExp(`${marker}\\s*([^\\n]+)`, 'gi');
      const matches = content.match(regex);

      if (matches) {
        for (const match of matches) {
          const tagText = match.replace(new RegExp(marker, 'i'), '').trim();
          const extractedTags = tagText
            .split(/[,;]/)
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);

          tags.push(...extractedTags);
        }
      }
    }

    return [...new Set(tags)]; // Remove duplicates
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createTagFromContextRule(
  ruleId: string,
  config: RuleConfig
): TagFromContextRule {
  switch (ruleId) {
    case 'tag-from-context.automatic':
      return new TagFromContextAutomaticRule(config);
    case 'tag-from-context.manual':
      return new TagFromContextManualRule(config);
    case 'tag-from-context.hybrid':
      return new TagFromContextHybridRule(config);
    default:
      throw new Error(`Unknown tag-from-context rule variant: ${ruleId}`);
  }
}
