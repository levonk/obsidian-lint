/**
 * File Path Organization Rules Implementation
 * Validates and fixes file organization within vault structure
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';
import path from 'path';

/**
 * Interface for file path organization settings
 */
interface FilePathOrganizationSettings {
  base_directory: string;
  create_subdirectories: boolean;
  update_links: boolean;
  preserve_existing_structure: boolean;
  date_format: string;
  topic_extraction_method: 'frontmatter' | 'filename' | 'content';
  type_mapping: Record<string, string>;
  max_depth: number;
}

/**
 * Base class for file path organization rules
 */
export abstract class FilePathOrganizationRule extends BaseRule {
  protected settings: FilePathOrganizationSettings;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'file-organization', config);
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(
    settings: Record<string, any>
  ): FilePathOrganizationSettings {
    const defaultSettings: FilePathOrganizationSettings = {
      base_directory: '',
      create_subdirectories: true,
      update_links: true,
      preserve_existing_structure: false,
      date_format: 'YYYY/MM',
      topic_extraction_method: 'frontmatter',
      type_mapping: {
        daily: 'Daily Notes',
        meeting: 'Meetings',
        project: 'Projects',
        reference: 'Reference',
      },
      max_depth: 3,
    };

    return {
      ...defaultSettings,
      ...settings,
      base_directory:
        typeof settings.base_directory === 'string'
          ? settings.base_directory
          : defaultSettings.base_directory,
      create_subdirectories:
        typeof settings.create_subdirectories === 'boolean'
          ? settings.create_subdirectories
          : defaultSettings.create_subdirectories,
      update_links:
        typeof settings.update_links === 'boolean'
          ? settings.update_links
          : defaultSettings.update_links,
      preserve_existing_structure:
        typeof settings.preserve_existing_structure === 'boolean'
          ? settings.preserve_existing_structure
          : defaultSettings.preserve_existing_structure,
      date_format:
        typeof settings.date_format === 'string'
          ? settings.date_format
          : defaultSettings.date_format,
      topic_extraction_method: ['frontmatter', 'filename', 'content'].includes(
        settings.topic_extraction_method
      )
        ? settings.topic_extraction_method
        : defaultSettings.topic_extraction_method,
      type_mapping:
        typeof settings.type_mapping === 'object' &&
        settings.type_mapping !== null
          ? { ...defaultSettings.type_mapping, ...settings.type_mapping }
          : defaultSettings.type_mapping,
      max_depth:
        typeof settings.max_depth === 'number' && settings.max_depth > 0
          ? settings.max_depth
          : defaultSettings.max_depth,
    };
  }

  /**
   * Lint implementation - check file organization
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    if (this.settings.preserve_existing_structure) {
      return issues; // Skip if preserving existing structure
    }

    const expectedPath = await this.calculateExpectedPath(context);
    const currentPath = file.path;

    // Normalize paths for comparison (handle different path separators)
    const normalizedExpected = path.normalize(expectedPath);
    const normalizedCurrent = path.normalize(currentPath);

    if (normalizedExpected !== normalizedCurrent) {
      issues.push({
        ruleId: this.id.full,
        severity: 'warning',
        message: `File should be located at "${expectedPath}" instead of "${currentPath}"`,
        file: file.path,
        fixable: true,
      });
    }

    // Check directory depth
    const depth = this.getDirectoryDepth(currentPath);
    if (depth > this.settings.max_depth) {
      issues.push({
        ruleId: this.id.full,
        severity: 'warning',
        message: `File is nested too deeply (${depth} levels, max: ${this.settings.max_depth})`,
        file: file.path,
        fixable: true,
      });
    }

    return issues;
  }

  /**
   * Fix implementation - move file to correct location
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

    const expectedPath = await this.calculateExpectedPath(context);

    if (expectedPath !== file.path) {
      const changes: FileChange[] = [
        {
          type: 'move',
          oldPath: file.path,
          newPath: expectedPath,
        },
      ];

      // If update_links is enabled, we would need to update all references
      if (this.settings.update_links) {
        // Note: Link updating would be handled by the file processor
        // This is a placeholder for the link update logic
      }

      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: `Move file to "${expectedPath}"`,
        changes,
      });
    }

    return fixes;
  }

  /**
   * Abstract method to calculate expected file path
   */
  protected abstract calculateExpectedPath(
    context: RuleExecutionContext
  ): Promise<string>;

  /**
   * Helper methods
   */
  protected getDirectoryDepth(filePath: string): number {
    // Normalize path and split by both possible separators
    const normalizedPath = filePath.replace(/[/\\]/g, path.sep);
    return normalizedPath.split(path.sep).length - 1;
  }

  protected extractDateFromFile(context: RuleExecutionContext): Date | null {
    const { file } = context;

    // Try frontmatter first
    if (file.frontmatter.date_created) {
      const date = new Date(file.frontmatter.date_created);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try filename pattern (YYYY-MM-DD)
    const dateMatch = path.basename(file.path).match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const date = new Date(dateMatch[1]);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }

  protected extractTopicFromFile(context: RuleExecutionContext): string | null {
    const { file } = context;

    switch (this.settings.topic_extraction_method) {
      case 'frontmatter':
        if (file.frontmatter.topic) {
          return String(file.frontmatter.topic);
        }
        if (
          file.frontmatter.tags &&
          Array.isArray(file.frontmatter.tags) &&
          file.frontmatter.tags.length > 0
        ) {
          return String(file.frontmatter.tags[0]);
        }
        break;

      case 'filename':
        const fileName = path.basename(file.path, path.extname(file.path));
        const parts = fileName.split(/[-_\s]+/);
        if (parts.length > 1) {
          return parts[0];
        }
        break;

      case 'content':
        // Extract from first heading
        if (file.headings && file.headings.length > 0) {
          return file.headings[0].text;
        }
        break;
    }

    return null;
  }

  protected extractTypeFromFile(context: RuleExecutionContext): string | null {
    const { file } = context;

    // Check frontmatter type field
    if (file.frontmatter.type) {
      const type = String(file.frontmatter.type);
      // Check if type exists in mapping
      if (this.settings.type_mapping[type]) {
        return this.settings.type_mapping[type];
      }
      return type;
    }

    // Check tags for type indicators
    if (file.frontmatter.tags && Array.isArray(file.frontmatter.tags)) {
      for (const tag of file.frontmatter.tags) {
        if (this.settings.type_mapping[tag]) {
          return this.settings.type_mapping[tag];
        }
      }
    }

    // Check filename patterns
    const fileName = path.basename(file.path, path.extname(file.path));
    for (const [pattern, type] of Object.entries(this.settings.type_mapping)) {
      if (fileName.toLowerCase().includes(pattern.toLowerCase())) {
        return type;
      }
    }

    return null;
  }

  protected formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  }

  protected sanitizePath(pathComponent: string): string {
    return pathComponent
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid path characters
      .replace(/\s+/g, ' ') // Collapse spaces
      .trim();
  }
}

/**
 * By Date Organization Rule
 */
export class FilePathOrganizationByDateRule extends FilePathOrganizationRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'file-path-organization',
        minor: 'by-date',
        full: 'file-path-organization.by-date',
      },
      'By Date File Organization',
      'Organize files by creation date in hierarchical folders',
      config
    );
  }

  protected async calculateExpectedPath(
    context: RuleExecutionContext
  ): Promise<string> {
    const { file } = context;
    const date = this.extractDateFromFile(context);

    if (!date) {
      // If no date found, use current date or keep in root
      const fallbackDate = new Date();
      const datePath = this.formatDate(fallbackDate, this.settings.date_format);
      return path.join(
        this.settings.base_directory,
        datePath,
        path.basename(file.path)
      );
    }

    const datePath = this.formatDate(date, this.settings.date_format);
    return path.join(
      this.settings.base_directory,
      datePath,
      path.basename(file.path)
    );
  }
}

/**
 * By Topic Organization Rule
 */
export class FilePathOrganizationByTopicRule extends FilePathOrganizationRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'file-path-organization',
        minor: 'by-topic',
        full: 'file-path-organization.by-topic',
      },
      'By Topic File Organization',
      'Organize files by topic extracted from frontmatter, filename, or content',
      config
    );
  }

  protected async calculateExpectedPath(
    context: RuleExecutionContext
  ): Promise<string> {
    const { file } = context;
    const topic = this.extractTopicFromFile(context);

    if (!topic) {
      // If no topic found, use miscellaneous folder
      return path.join('Miscellaneous', path.basename(file.path));
    }

    const sanitizedTopic = this.sanitizePath(topic);
    return path.join(
      this.settings.base_directory,
      sanitizedTopic,
      path.basename(file.path)
    );
  }
}

/**
 * By Type Organization Rule
 */
export class FilePathOrganizationByTypeRule extends FilePathOrganizationRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'file-path-organization',
        minor: 'by-type',
        full: 'file-path-organization.by-type',
      },
      'By Type File Organization',
      'Organize files by type based on frontmatter, tags, or filename patterns',
      config
    );
  }

  protected async calculateExpectedPath(
    context: RuleExecutionContext
  ): Promise<string> {
    const { file } = context;
    const type = this.extractTypeFromFile(context);

    if (!type) {
      // If no type found, use general folder
      return path.join('General', path.basename(file.path));
    }

    const sanitizedType = this.sanitizePath(type);
    return path.join(
      this.settings.base_directory,
      sanitizedType,
      path.basename(file.path)
    );
  }
}

/**
 * Flat Organization Rule
 */
export class FilePathOrganizationFlatRule extends FilePathOrganizationRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'file-path-organization',
        minor: 'flat',
        full: 'file-path-organization.flat',
      },
      'Flat File Organization',
      'Keep all files in a flat structure within the base directory',
      config
    );
  }

  protected async calculateExpectedPath(
    context: RuleExecutionContext
  ): Promise<string> {
    const { file } = context;
    return path.join(this.settings.base_directory, path.basename(file.path));
  }
}

/**
 * Factory function to create file path organization rule instances
 */
export function createFilePathOrganizationRule(
  ruleId: string,
  config: RuleConfig
): FilePathOrganizationRule {
  switch (ruleId) {
    case 'file-path-organization.by-date':
      return new FilePathOrganizationByDateRule(config);
    case 'file-path-organization.by-topic':
      return new FilePathOrganizationByTopicRule(config);
    case 'file-path-organization.by-type':
      return new FilePathOrganizationByTypeRule(config);
    case 'file-path-organization.flat':
      return new FilePathOrganizationFlatRule(config);
    default:
      throw new Error(`Unknown file path organization rule variant: ${ruleId}`);
  }
}
