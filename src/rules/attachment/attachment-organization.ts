/**
 * Attachment Organization Rule Implementation
 * Manages attachment file organization and location within the vault
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange, Attachment } from '../../types/common.js';
import { join, dirname, basename, extname, relative, resolve } from 'path';
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from 'fs';

/**
 * Interface for attachment organization settings
 */
interface AttachmentOrganizationSettings {
  attachment_directory: string;
  create_subdirectories: boolean;
  preserve_structure: boolean;
  update_links: boolean;
  allowed_extensions: string[];
  organization_strategy: 'centralized' | 'keep-with-note' | 'by-type';
  type_subdirectories?: Record<string, string>;
}

/**
 * Base class for attachment organization rules
 */
export abstract class AttachmentOrganizationRule extends BaseRule {
  protected settings: AttachmentOrganizationSettings;

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
  ): AttachmentOrganizationSettings {
    const defaultSettings: AttachmentOrganizationSettings = {
      attachment_directory: 'Meta/Attachments',
      create_subdirectories: true,
      preserve_structure: false,
      update_links: true,
      allowed_extensions: [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.pdf',
        '.mp4',
        '.mov',
        '.docx',
        '.doc',
        '.xlsx',
        '.xls',
        '.pptx',
        '.ppt',
      ],
      organization_strategy: 'centralized',
      type_subdirectories: {
        image: 'images',
        video: 'videos',
        document: 'documents',
        other: 'other',
      },
    };

    return {
      ...defaultSettings,
      ...settings,
      attachment_directory:
        typeof settings.attachment_directory === 'string'
          ? settings.attachment_directory
          : defaultSettings.attachment_directory,
      create_subdirectories:
        typeof settings.create_subdirectories === 'boolean'
          ? settings.create_subdirectories
          : defaultSettings.create_subdirectories,
      preserve_structure:
        typeof settings.preserve_structure === 'boolean'
          ? settings.preserve_structure
          : defaultSettings.preserve_structure,
      update_links:
        typeof settings.update_links === 'boolean'
          ? settings.update_links
          : defaultSettings.update_links,
      allowed_extensions: Array.isArray(settings.allowed_extensions)
        ? settings.allowed_extensions
        : defaultSettings.allowed_extensions,
      organization_strategy: [
        'centralized',
        'keep-with-note',
        'by-type',
      ].includes(settings.organization_strategy)
        ? settings.organization_strategy
        : defaultSettings.organization_strategy,
      type_subdirectories:
        typeof settings.type_subdirectories === 'object'
          ? {
              ...defaultSettings.type_subdirectories,
              ...settings.type_subdirectories,
            }
          : defaultSettings.type_subdirectories,
    };
  }

  /**
   * Lint implementation - check for attachment organization issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file, vaultPath } = context;

    // Find all attachments referenced in the file
    const referencedAttachments = this.findReferencedAttachments(
      file.content,
      file.path,
      vaultPath
    );

    for (const attachment of referencedAttachments) {
      const expectedPath = this.getExpectedAttachmentPath(
        attachment,
        file.path,
        vaultPath
      );

      if (attachment.path !== expectedPath) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `Attachment "${attachment.name}" should be located at "${expectedPath}" instead of "${attachment.path}"`,
          file: file.path,
          fixable: true,
        });
      }

      // Check if attachment file exists
      const fullAttachmentPath = resolve(vaultPath, attachment.path);
      if (!existsSync(fullAttachmentPath)) {
        issues.push({
          ruleId: this.id.full,
          severity: 'error',
          message: `Referenced attachment "${attachment.name}" not found at "${attachment.path}"`,
          file: file.path,
          fixable: false,
        });
      }

      // Check if attachment extension is allowed
      const ext = extname(attachment.name).toLowerCase();
      if (
        this.settings.allowed_extensions.length > 0 &&
        !this.settings.allowed_extensions.includes(ext)
      ) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `Attachment "${attachment.name}" has unsupported extension "${ext}"`,
          file: file.path,
          fixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Fix implementation - move attachments to correct locations and update links
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    const fixes: Fix[] = [];
    const { file, vaultPath } = context;
    const changes: FileChange[] = [];

    // Find all attachments referenced in the file
    const referencedAttachments = this.findReferencedAttachments(
      file.content,
      file.path,
      vaultPath
    );
    let updatedContent = file.content;

    for (const attachment of referencedAttachments) {
      const expectedPath = this.getExpectedAttachmentPath(
        attachment,
        file.path,
        vaultPath
      );

      if (attachment.path !== expectedPath) {
        const oldFullPath = resolve(vaultPath, attachment.path);
        const newFullPath = resolve(vaultPath, expectedPath);

        // Check if source file exists
        if (existsSync(oldFullPath)) {
          // Create target directory if needed
          const targetDir = dirname(newFullPath);
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }

          // Move the file (copy then delete to handle cross-device moves)
          try {
            copyFileSync(oldFullPath, newFullPath);
            unlinkSync(oldFullPath);

            // Update links in content
            if (this.settings.update_links) {
              updatedContent = this.updateAttachmentLinks(
                updatedContent,
                attachment.path,
                expectedPath
              );
            }
          } catch (error) {
            // If move fails, skip this attachment
            continue;
          }
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
        description: 'Moved attachments and updated links',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Find all attachments referenced in the file content
   */
  protected findReferencedAttachments(
    content: string,
    filePath: string,
    vaultPath: string
  ): Attachment[] {
    const attachments: Attachment[] = [];

    // Match various attachment link formats:
    // ![[attachment.png]]
    // ![alt text](attachment.png)
    // [link text](attachment.pdf)
    const linkPatterns = [
      {
        pattern:
          /!\[\[([^\]]+\.(png|jpg|jpeg|gif|svg|pdf|mp4|mov|docx?|xlsx?|pptx?))\]\]/gi,
        filenameIndex: 1,
      },
      {
        pattern:
          /!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|svg|pdf|mp4|mov|docx?|xlsx?|pptx?))\)/gi,
        filenameIndex: 2,
      },
      {
        pattern: /\[([^\]]+)\]\(([^)]+\.(pdf|docx?|xlsx?|pptx?))\)/gi,
        filenameIndex: 2,
      },
    ];

    for (const { pattern, filenameIndex } of linkPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const attachmentName = match[filenameIndex]; // Get the filename
        const attachmentPath = this.resolveAttachmentPath(
          attachmentName,
          filePath,
          vaultPath
        );

        // If we found the file, use the resolved path
        if (attachmentPath) {
          const fullPath = resolve(vaultPath, attachmentPath);
          let size = 0;
          try {
            const stats = require('fs').statSync(fullPath);
            size = stats.size;
          } catch {
            // File doesn't exist, size remains 0
          }

          attachments.push({
            name: basename(attachmentName),
            path: attachmentPath,
            type: this.getAttachmentType(attachmentName),
            size,
            referencedBy: [filePath],
          });
        } else {
          // File not found, but we still need to track it for error reporting
          attachments.push({
            name: basename(attachmentName),
            path: attachmentName, // Use the original reference as path
            type: this.getAttachmentType(attachmentName),
            size: 0,
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
   * Get the expected path for an attachment based on organization strategy
   */
  protected abstract getExpectedAttachmentPath(
    attachment: Attachment,
    noteFilePath: string,
    vaultPath: string
  ): string;

  /**
   * Get attachment type based on file extension
   */
  protected getAttachmentType(filename: string): string {
    const ext = extname(filename).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
      return 'image';
    } else if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
      return 'video';
    } else if (
      ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)
    ) {
      return 'document';
    } else {
      return 'other';
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

    // [text](attachment.pdf) format
    updatedContent = updatedContent.replace(
      new RegExp(`\\[([^\\]]+)\\]\\(${this.escapeRegex(oldPath)}\\)`, 'g'),
      `[$1](${newPath})`
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
 * Centralized variant - moves all attachments to a central directory
 */
export class AttachmentOrganizationCentralizedRule extends AttachmentOrganizationRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-organization',
        minor: 'centralized',
        full: 'attachment-organization.centralized',
      },
      'Centralized Attachment Organization',
      'Move all attachments to a centralized directory (e.g., Meta/Attachments)',
      config
    );
  }

  protected getExpectedAttachmentPath(
    attachment: Attachment,
    noteFilePath: string,
    vaultPath: string
  ): string {
    if (this.settings.create_subdirectories) {
      const typeSubdir =
        this.settings.type_subdirectories?.[attachment.type] || 'other';
      return join(
        this.settings.attachment_directory,
        typeSubdir,
        attachment.name
      ).replace(/\\/g, '/');
    } else {
      return join(this.settings.attachment_directory, attachment.name).replace(
        /\\/g,
        '/'
      );
    }
  }
}

/**
 * Keep-with-note variant - keeps attachments near their referencing notes
 */
export class AttachmentOrganizationKeepWithNoteRule extends AttachmentOrganizationRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-organization',
        minor: 'keep-with-note',
        full: 'attachment-organization.keep-with-note',
      },
      'Keep Attachments With Notes',
      'Keep attachments in the same directory as their referencing notes',
      config
    );
  }

  protected getExpectedAttachmentPath(
    attachment: Attachment,
    noteFilePath: string,
    vaultPath: string
  ): string {
    const noteDir = dirname(noteFilePath);

    if (this.settings.create_subdirectories) {
      const attachmentSubdir = join(noteDir, 'attachments');
      return join(attachmentSubdir, attachment.name).replace(/\\/g, '/');
    } else {
      return join(noteDir, attachment.name).replace(/\\/g, '/');
    }
  }
}

/**
 * By-type variant - organizes attachments by file type
 */
export class AttachmentOrganizationByTypeRule extends AttachmentOrganizationRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'attachment-organization',
        minor: 'by-type',
        full: 'attachment-organization.by-type',
      },
      'Organize Attachments By Type',
      'Organize attachments into subdirectories based on file type',
      config
    );
  }

  protected getExpectedAttachmentPath(
    attachment: Attachment,
    noteFilePath: string,
    vaultPath: string
  ): string {
    const typeSubdir =
      this.settings.type_subdirectories?.[attachment.type] || 'other';
    return join(
      this.settings.attachment_directory,
      typeSubdir,
      attachment.name
    ).replace(/\\/g, '/');
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createAttachmentOrganizationRule(
  ruleId: string,
  config: RuleConfig
): AttachmentOrganizationRule {
  switch (ruleId) {
    case 'attachment-organization.centralized':
      return new AttachmentOrganizationCentralizedRule(config);
    case 'attachment-organization.keep-with-note':
      return new AttachmentOrganizationKeepWithNoteRule(config);
    case 'attachment-organization.by-type':
      return new AttachmentOrganizationByTypeRule(config);
    default:
      throw new Error(
        `Unknown attachment organization rule variant: ${ruleId}`
      );
  }
}
