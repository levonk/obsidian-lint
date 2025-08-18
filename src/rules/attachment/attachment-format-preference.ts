/**
 * Attachment Format Preference Rules Implementation
 * Manages attachment format conversion and optimization
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange, Attachment } from '../../types/common.js';
import { basename, extname, join, resolve, dirname } from 'path';
import { existsSync } from 'fs';

/**
 * Interface for attachment format preference settings
 */
interface AttachmentFormatPreferenceSettings {
  target_format: string;
  quality: number;
  max_width: number;
  max_height: number;
  preserve_original: boolean;
  update_links: boolean;
  allowed_source_formats: string[];
  compression_level: number;
  convert_on_import: boolean;
}

/**
 * Base class for attachment format preference rules
 */
export abstract class AttachmentFormatPreferenceRule extends BaseRule {
  protected settings: AttachmentFormatPreferenceSettings;

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
  ): AttachmentFormatPreferenceSettings {
    const defaultSettings: AttachmentFormatPreferenceSettings = {
      target_format: 'png',
      quality: 85,
      max_width: 1920,
      max_height: 1080,
      preserve_original: false,
      update_links: true,
      allowed_source_formats: [
        '.jpg',
        '.jpeg',
        '.gif',
        '.bmp',
        '.tiff',
        '.webp',
      ],
      compression_level: 6,
      convert_on_import: true,
    };

    return {
      ...defaultSettings,
      ...settings,
      target_format:
        typeof settings.target_format === 'string'
          ? settings.target_format
          : defaultSettings.target_format,
      quality:
        typeof settings.quality === 'number' &&
        settings.quality >= 1 &&
        settings.quality <= 100
          ? settings.quality
          : defaultSettings.quality,
      max_width:
        typeof settings.max_width === 'number' && settings.max_width > 0
          ? settings.max_width
          : defaultSettings.max_width,
      max_height:
        typeof settings.max_height === 'number' && settings.max_height > 0
          ? settings.max_height
          : defaultSettings.max_height,
      preserve_original:
        typeof settings.preserve_original === 'boolean'
          ? settings.preserve_original
          : defaultSettings.preserve_original,
      update_links:
        typeof settings.update_links === 'boolean'
          ? settings.update_links
          : defaultSettings.update_links,
      allowed_source_formats: Array.isArray(settings.allowed_source_formats)
        ? settings.allowed_source_formats
        : defaultSettings.allowed_source_formats,
      compression_level:
        typeof settings.compression_level === 'number' &&
        settings.compression_level >= 0 &&
        settings.compression_level <= 9
          ? settings.compression_level
          : defaultSettings.compression_level,
      convert_on_import:
        typeof settings.convert_on_import === 'boolean'
          ? settings.convert_on_import
          : defaultSettings.convert_on_import,
    };
  }

  /**
   * Lint implementation - check for format preference violations
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file, vaultPath } = context;

    // Find all image attachments referenced in the file
    const imageAttachments = this.findImageAttachments(
      file.content,
      file.path,
      vaultPath
    );

    for (const attachment of imageAttachments) {
      const shouldConvert = this.shouldConvertAttachment(attachment);

      if (shouldConvert) {
        const targetPath = this.getTargetPath(attachment);
        issues.push({
          ruleId: this.id.full,
          severity: 'info',
          message: `Image "${attachment.name}" should be converted to ${this.settings.target_format.toUpperCase()} format`,
          file: file.path,
          fixable: true,
        });
      }

      // Check if image needs optimization
      if (this.needsOptimization(attachment, vaultPath)) {
        issues.push({
          ruleId: this.id.full,
          severity: 'info',
          message: `Image "${attachment.name}" can be optimized to reduce file size`,
          file: file.path,
          fixable: true,
        });
      }
    }

    return issues;
  }

  /**
   * Fix implementation - convert and optimize attachments
   */
  override async fix(
    context: RuleExecutionContext,
    issues: Issue[]
  ): Promise<Fix[]> {
    const fixes: Fix[] = [];
    const { file, vaultPath } = context;

    if (issues.length === 0) {
      return fixes;
    }

    const imageAttachments = this.findImageAttachments(
      file.content,
      file.path,
      vaultPath
    );
    const changes: FileChange[] = [];
    let updatedContent = file.content;

    for (const attachment of imageAttachments) {
      if (this.shouldConvertAttachment(attachment)) {
        const targetPath = this.getTargetPath(attachment);
        const conversionResult = await this.convertAttachment(
          attachment,
          targetPath,
          vaultPath
        );

        if (conversionResult.success && this.settings.update_links) {
          // Update links in content
          updatedContent = this.updateAttachmentLinks(
            updatedContent,
            attachment.path,
            targetPath
          );
        }
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
        description: `Converted attachments to ${this.settings.target_format.toUpperCase()} format`,
        changes,
      });
    }

    return fixes;
  }

  /**
   * Find all image attachments referenced in the file content
   */
  protected findImageAttachments(
    content: string,
    filePath: string,
    vaultPath: string
  ): Attachment[] {
    const attachments: Attachment[] = [];

    // Match image attachment link formats:
    // ![[image.png]]
    // ![alt text](image.png)
    const imagePatterns = [
      {
        pattern: /!\[\[([^\]]+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff))\]\]/gi,
        filenameIndex: 1,
      },
      {
        pattern:
          /!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff))\)/gi,
        filenameIndex: 2,
      },
    ];

    for (const { pattern, filenameIndex } of imagePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const imageName = match[filenameIndex]; // Get the filename
        const imagePath = this.resolveAttachmentPath(
          imageName,
          filePath,
          vaultPath
        );

        if (imagePath) {
          const fullPath = resolve(vaultPath, imagePath);
          let size = 0;
          try {
            const stats = require('fs').statSync(fullPath);
            size = stats.size;
          } catch {
            // File doesn't exist, size remains 0
          }

          attachments.push({
            name: basename(imageName),
            path: imagePath,
            type: 'image',
            size,
            referencedBy: [filePath],
          });
        }
      }
    }

    return attachments;
  }

  /**
   * Resolve the current path of an attachment relative to vault
   */
  protected resolveAttachmentPath(
    attachmentName: string,
    filePath: string,
    vaultPath: string
  ): string | null {
    // Try different possible locations
    const possiblePaths = [
      attachmentName, // Direct reference
      join(dirname(filePath), attachmentName), // Same directory as note
      join('Meta/Attachments', attachmentName), // Standard attachments directory
      join('attachments', attachmentName), // Alternative attachments directory
      join('assets', attachmentName), // Assets directory
    ];

    for (const possiblePath of possiblePaths) {
      const fullPath = resolve(vaultPath, possiblePath);
      if (existsSync(fullPath)) {
        return possiblePath.replace(/\\/g, '/'); // Normalize path separators
      }
    }

    return null;
  }

  /**
   * Check if an attachment should be converted
   */
  protected abstract shouldConvertAttachment(attachment: Attachment): boolean;

  /**
   * Check if an image needs optimization
   */
  protected needsOptimization(
    attachment: Attachment,
    vaultPath: string
  ): boolean {
    // Simple heuristic: files larger than 1MB might benefit from optimization
    const maxSize = 1024 * 1024; // 1MB
    return attachment.size > maxSize;
  }

  /**
   * Get the target path for a converted attachment
   */
  protected getTargetPath(attachment: Attachment): string {
    const nameWithoutExt = basename(attachment.name, extname(attachment.name));
    const targetName = `${nameWithoutExt}.${this.settings.target_format}`;
    return join(dirname(attachment.path), targetName).replace(/\\/g, '/');
  }

  /**
   * Convert an attachment (placeholder implementation)
   * In a real implementation, this would use image processing libraries
   */
  protected async convertAttachment(
    attachment: Attachment,
    targetPath: string,
    vaultPath: string
  ): Promise<{ success: boolean; error?: string }> {
    // This is a placeholder implementation
    // In a real implementation, you would use libraries like sharp, jimp, or canvas
    // to perform actual image conversion and optimization

    try {
      // Simulate conversion process
      const sourcePath = resolve(vaultPath, attachment.path);
      const targetFullPath = resolve(vaultPath, targetPath);

      // Check if source exists
      if (!existsSync(sourcePath)) {
        return { success: false, error: 'Source file not found' };
      }

      // For now, just copy the file (in real implementation, convert it)
      const fs = require('fs');
      fs.copyFileSync(sourcePath, targetFullPath);

      // If not preserving original, delete the source
      if (!this.settings.preserve_original) {
        fs.unlinkSync(sourcePath);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update attachment links in content
   */
  protected updateAttachmentLinks(
    content: string,
    oldPath: string,
    newPath: string
  ): string {
    const oldName = basename(oldPath);
    const newName = basename(newPath);

    // Update various link formats
    let updatedContent = content;

    // ![[attachment.png]] format
    updatedContent = updatedContent.replace(
      new RegExp(`!\\[\\[${this.escapeRegex(oldName)}\\]\\]`, 'g'),
      `![[${newName}]]`
    );

    // ![alt](attachment.png) format
    updatedContent = updatedContent.replace(
      new RegExp(`!\\[([^\\]]*)\\]\\(${this.escapeRegex(oldPath)}\\)`, 'g'),
      `![$1](${newPath})`
    );

    return updatedContent;
  }

  /**
   * Escape special regex characters
   */
  protected escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Convert to PNG variant
 */
export class AttachmentFormatPreferenceConvertToPngRule extends AttachmentFormatPreferenceRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-format-preference',
        minor: 'convert-to-png',
        full: 'attachment-format-preference.convert-to-png',
      },
      'Convert Images to PNG',
      'Convert all supported image formats to PNG for consistency',
      config
    );

    // Override target format to PNG
    this.settings.target_format = 'png';
  }

  protected shouldConvertAttachment(attachment: Attachment): boolean {
    const currentExt = extname(attachment.name).toLowerCase();

    // Convert if it's not already PNG and is in allowed source formats
    return (
      currentExt !== '.png' &&
      this.settings.allowed_source_formats.includes(currentExt)
    );
  }
}

/**
 * Preserve Original variant
 */
export class AttachmentFormatPreferencePreserveOriginalRule extends AttachmentFormatPreferenceRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-format-preference',
        minor: 'preserve-original',
        full: 'attachment-format-preference.preserve-original',
      },
      'Preserve Original Format',
      'Keep attachments in their original format without conversion',
      config
    );

    // Override settings to preserve originals
    this.settings.preserve_original = true;
    this.settings.convert_on_import = false;
  }

  protected shouldConvertAttachment(_attachment: Attachment): boolean {
    // Never convert when preserving originals
    return false;
  }

  async lint(_context: RuleExecutionContext): Promise<Issue[]> {
    // This rule doesn't generate any issues since it preserves everything
    return [];
  }
}

/**
 * Optimize Size variant
 */
export class AttachmentFormatPreferenceOptimizeSizeRule extends AttachmentFormatPreferenceRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-format-preference',
        minor: 'optimize-size',
        full: 'attachment-format-preference.optimize-size',
      },
      'Optimize Image Size',
      'Optimize images for smaller file size while maintaining quality',
      config
    );

    // Override settings for size optimization
    this.settings.quality = 75; // Lower quality for smaller size
    this.settings.compression_level = 9; // Maximum compression
  }

  protected shouldConvertAttachment(attachment: Attachment): boolean {
    // Convert if the file is large or in an unoptimized format
    const currentExt = extname(attachment.name).toLowerCase();
    const isLarge = attachment.size > 500 * 1024; // 500KB threshold
    const isUnoptimized = ['.bmp', '.tiff', '.gif'].includes(currentExt);

    return isLarge || isUnoptimized;
  }

  protected needsOptimization(
    attachment: Attachment,
    _vaultPath: string
  ): boolean {
    // More aggressive optimization threshold
    const maxSize = 500 * 1024; // 500KB
    return attachment.size > maxSize;
  }
}

/**
 * Factory function to create attachment format preference rule instances
 */
export function createAttachmentFormatPreferenceRule(
  ruleId: string,
  config: RuleConfig
): AttachmentFormatPreferenceRule {
  switch (ruleId) {
    case 'attachment-format-preference.convert-to-png':
      return new AttachmentFormatPreferenceConvertToPngRule(config);
    case 'attachment-format-preference.preserve-original':
      return new AttachmentFormatPreferencePreserveOriginalRule(config);
    case 'attachment-format-preference.optimize-size':
      return new AttachmentFormatPreferenceOptimizeSizeRule(config);
    default:
      throw new Error(
        `Unknown attachment format preference rule variant: ${ruleId}`
      );
  }
}
