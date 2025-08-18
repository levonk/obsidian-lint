/**
 * Attachment Image Alt Text Rules Implementation
 * Manages alt text for image attachments for accessibility
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';
import { basename, extname } from 'path';

/**
 * Interface for attachment image alt text settings
 */
interface AttachmentImageAltTextSettings {
  require_alt_text: boolean;
  auto_generate_from_filename: boolean;
  auto_generate_from_context: boolean;
  min_alt_text_length: number;
  max_alt_text_length: number;
  default_alt_text: string;
  filename_cleanup_patterns: string[];
  context_analysis_enabled: boolean;
}

/**
 * Interface for image reference found in content
 */
interface ImageReference {
  fullMatch: string;
  altText: string;
  imagePath: string;
  startIndex: number;
  endIndex: number;
  format: 'obsidian' | 'markdown';
}

/**
 * Base class for attachment image alt text rules
 */
export abstract class AttachmentImageAltTextRule extends BaseRule {
  protected settings: AttachmentImageAltTextSettings;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'attachment', config);
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(
    settings: Record<string, any>
  ): AttachmentImageAltTextSettings {
    const defaultSettings: AttachmentImageAltTextSettings = {
      require_alt_text: true,
      auto_generate_from_filename: true,
      auto_generate_from_context: false,
      min_alt_text_length: 3,
      max_alt_text_length: 100,
      default_alt_text: 'Image',
      filename_cleanup_patterns: [
        '-',
        '_',
        '\\d{4}-\\d{2}-\\d{2}', // Date patterns
        '\\d{8}', // Timestamp patterns
        'IMG',
        'image',
        'photo',
        'pic',
      ],
      context_analysis_enabled: false,
    };

    return {
      ...defaultSettings,
      ...settings,
      require_alt_text:
        typeof settings.require_alt_text === 'boolean'
          ? settings.require_alt_text
          : defaultSettings.require_alt_text,
      auto_generate_from_filename:
        typeof settings.auto_generate_from_filename === 'boolean'
          ? settings.auto_generate_from_filename
          : defaultSettings.auto_generate_from_filename,
      auto_generate_from_context:
        typeof settings.auto_generate_from_context === 'boolean'
          ? settings.auto_generate_from_context
          : defaultSettings.auto_generate_from_context,
      min_alt_text_length:
        typeof settings.min_alt_text_length === 'number' &&
        settings.min_alt_text_length >= 0
          ? settings.min_alt_text_length
          : defaultSettings.min_alt_text_length,
      max_alt_text_length:
        typeof settings.max_alt_text_length === 'number' &&
        settings.max_alt_text_length > 0
          ? settings.max_alt_text_length
          : defaultSettings.max_alt_text_length,
      default_alt_text:
        typeof settings.default_alt_text === 'string'
          ? settings.default_alt_text
          : defaultSettings.default_alt_text,
      filename_cleanup_patterns: Array.isArray(
        settings.filename_cleanup_patterns
      )
        ? settings.filename_cleanup_patterns
        : defaultSettings.filename_cleanup_patterns,
      context_analysis_enabled:
        typeof settings.context_analysis_enabled === 'boolean'
          ? settings.context_analysis_enabled
          : defaultSettings.context_analysis_enabled,
    };
  }

  /**
   * Lint implementation - check for alt text issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    const imageReferences = this.findImageReferences(file.content);

    for (const imageRef of imageReferences) {
      const altTextIssues = this.validateAltText(imageRef);
      issues.push(...altTextIssues);
    }

    return issues;
  }

  /**
   * Fix implementation - add or improve alt text
   */
  override async fix(
    context: RuleExecutionContext,
    issues: Issue[]
  ): Promise<Fix[]> {
    const fixes: Fix[] = [];
    const { file } = context;

    if (issues.length === 0) {
      return fixes;
    }

    const imageReferences = this.findImageReferences(file.content);
    let updatedContent = file.content;
    const changes: FileChange[] = [];

    // Process images in reverse order to maintain correct indices
    for (let i = imageReferences.length - 1; i >= 0; i--) {
      const imageRef = imageReferences[i];
      const altTextIssues = this.validateAltText(imageRef);

      if (altTextIssues.length > 0) {
        const improvedAltText = this.generateAltText(imageRef, file.content);
        const updatedImageRef = this.updateImageReference(
          imageRef,
          improvedAltText
        );

        // Replace the image reference in content
        updatedContent =
          updatedContent.slice(0, imageRef.startIndex) +
          updatedImageRef +
          updatedContent.slice(imageRef.endIndex);
      }
    }

    // If content was updated, add a change
    if (updatedContent !== file.content) {
      changes.push({
        type: 'replace',
        line: 1,
        oldText: file.content,
        newText: updatedContent,
      });

      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Added or improved alt text for images',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Find all image references in the content
   */
  protected findImageReferences(content: string): ImageReference[] {
    const references: ImageReference[] = [];

    // Find Obsidian-style image references: ![[image.png]]
    const obsidianPattern =
      /!\[\[([^\]]+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff))\]\]/gi;
    let match;
    while ((match = obsidianPattern.exec(content)) !== null) {
      references.push({
        fullMatch: match[0],
        altText: '', // Obsidian format doesn't have alt text
        imagePath: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        format: 'obsidian',
      });
    }

    // Find Markdown-style image references: ![alt text](image.png)
    const markdownPattern =
      /!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff))\)/gi;
    while ((match = markdownPattern.exec(content)) !== null) {
      references.push({
        fullMatch: match[0],
        altText: match[1] || '',
        imagePath: match[2],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        format: 'markdown',
      });
    }

    return references;
  }

  /**
   * Validate alt text for an image reference
   */
  protected abstract validateAltText(imageRef: ImageReference): Issue[];

  /**
   * Generate appropriate alt text for an image
   */
  protected generateAltText(imageRef: ImageReference, content: string): string {
    // Try different generation strategies
    let altText = '';

    // 1. Use existing alt text if it's good enough
    if (this.isAltTextValid(imageRef.altText)) {
      return imageRef.altText;
    }

    // 2. Generate from filename if enabled
    if (this.settings.auto_generate_from_filename) {
      altText = this.generateFromFilename(imageRef.imagePath);
      if (this.isAltTextValid(altText)) {
        return altText;
      }
    }

    // 3. Generate from context if enabled
    if (this.settings.auto_generate_from_context) {
      altText = this.generateFromContext(imageRef, content);
      if (this.isAltTextValid(altText)) {
        return altText;
      }
    }

    // 4. Fall back to default
    return this.settings.default_alt_text;
  }

  /**
   * Check if alt text is valid according to settings
   */
  protected isAltTextValid(altText: string): boolean {
    if (!altText || altText.trim().length === 0) {
      return false;
    }

    const trimmed = altText.trim();
    return (
      trimmed.length >= this.settings.min_alt_text_length &&
      trimmed.length <= this.settings.max_alt_text_length
    );
  }

  /**
   * Generate alt text from filename
   */
  protected generateFromFilename(imagePath: string): string {
    let filename = basename(imagePath, extname(imagePath));

    // First, replace underscores and hyphens with spaces
    filename = filename.replace(/[_-]+/g, ' ');

    // Apply cleanup patterns - remove common unwanted parts
    for (const pattern of this.settings.filename_cleanup_patterns) {
      filename = filename.replace(new RegExp(pattern, 'gi'), ' ');
    }

    // Clean up the result
    filename = filename
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    // If nothing meaningful remains, use default
    if (!filename || filename.length < this.settings.min_alt_text_length) {
      return this.settings.default_alt_text;
    }

    // Convert to title case
    filename = filename.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

    return filename;
  }

  /**
   * Generate alt text from surrounding context
   */
  protected generateFromContext(
    imageRef: ImageReference,
    content: string
  ): string {
    if (!this.settings.context_analysis_enabled) {
      return '';
    }

    // Simple context analysis: look for nearby headings or text
    const beforeText = content.slice(
      Math.max(0, imageRef.startIndex - 200),
      imageRef.startIndex
    );
    const afterText = content.slice(imageRef.endIndex, imageRef.endIndex + 200);

    // Look for the nearest heading
    const headingMatch = beforeText.match(/#+\s+([^\n]+)$/);
    if (headingMatch) {
      return `Image related to ${headingMatch[1].trim()}`;
    }

    // Look for descriptive text nearby
    const sentences = (beforeText + afterText)
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    if (sentences.length > 0) {
      // Use the first meaningful sentence as context
      const contextSentence = sentences[0];
      if (contextSentence.length <= this.settings.max_alt_text_length) {
        return contextSentence;
      }
    }

    return '';
  }

  /**
   * Update an image reference with new alt text
   */
  protected updateImageReference(
    imageRef: ImageReference,
    newAltText: string
  ): string {
    if (imageRef.format === 'obsidian') {
      // Convert Obsidian format to Markdown format with alt text
      return `![${newAltText}](${imageRef.imagePath})`;
    } else {
      // Update Markdown format
      return `![${newAltText}](${imageRef.imagePath})`;
    }
  }
}

/**
 * Required variant - requires alt text for all images
 */
export class AttachmentImageAltTextRequiredRule extends AttachmentImageAltTextRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-image-alt-text',
        minor: 'required',
        full: 'attachment-image-alt-text.required',
      },
      'Require Image Alt Text',
      'Require alt text for all image attachments for accessibility',
      config
    );

    // Override settings to require alt text
    this.settings.require_alt_text = true;
  }

  protected validateAltText(imageRef: ImageReference): Issue[] {
    const issues: Issue[] = [];

    // Check if alt text is missing or invalid
    if (!this.isAltTextValid(imageRef.altText)) {
      issues.push({
        ruleId: this.id.full,
        severity: 'error',
        message: `Image "${basename(imageRef.imagePath)}" is missing required alt text`,
        file: '', // Will be set by the calling context
        fixable: true,
      });
    }

    return issues;
  }
}

/**
 * Optional variant - suggests alt text but doesn't require it
 */
export class AttachmentImageAltTextOptionalRule extends AttachmentImageAltTextRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-image-alt-text',
        minor: 'optional',
        full: 'attachment-image-alt-text.optional',
      },
      'Optional Image Alt Text',
      'Suggest alt text for images but do not require it',
      config
    );

    // Override settings to make alt text optional
    this.settings.require_alt_text = false;
  }

  protected validateAltText(imageRef: ImageReference): Issue[] {
    const issues: Issue[] = [];

    // Only suggest if alt text is completely missing
    if (!imageRef.altText || imageRef.altText.trim().length === 0) {
      issues.push({
        ruleId: this.id.full,
        severity: 'info',
        message: `Image "${basename(imageRef.imagePath)}" could benefit from alt text for accessibility`,
        file: '', // Will be set by the calling context
        fixable: true,
      });
    }

    return issues;
  }
}

/**
 * Auto-generate variant - automatically generates alt text for all images
 */
export class AttachmentImageAltTextAutoGenerateRule extends AttachmentImageAltTextRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-image-alt-text',
        minor: 'auto-generate',
        full: 'attachment-image-alt-text.auto-generate',
      },
      'Auto-Generate Image Alt Text',
      'Automatically generate alt text for all images based on filename and context',
      config
    );

    // Override settings for auto-generation
    this.settings.auto_generate_from_filename = true;
    this.settings.auto_generate_from_context = true;
    this.settings.context_analysis_enabled = true;
  }

  protected validateAltText(imageRef: ImageReference): Issue[] {
    const issues: Issue[] = [];

    // Always try to improve alt text
    if (
      !this.isAltTextValid(imageRef.altText) ||
      imageRef.altText === this.settings.default_alt_text
    ) {
      issues.push({
        ruleId: this.id.full,
        severity: 'info',
        message: `Image "${basename(imageRef.imagePath)}" alt text can be auto-generated`,
        file: '', // Will be set by the calling context
        fixable: true,
      });
    }

    return issues;
  }
}

/**
 * Factory function to create attachment image alt text rule instances
 */
export function createAttachmentImageAltTextRule(
  ruleId: string,
  config: RuleConfig
): AttachmentImageAltTextRule {
  switch (ruleId) {
    case 'attachment-image-alt-text.required':
      return new AttachmentImageAltTextRequiredRule(config);
    case 'attachment-image-alt-text.optional':
      return new AttachmentImageAltTextOptionalRule(config);
    case 'attachment-image-alt-text.auto-generate':
      return new AttachmentImageAltTextAutoGenerateRule(config);
    default:
      throw new Error(
        `Unknown attachment image alt text rule variant: ${ruleId}`
      );
  }
}
