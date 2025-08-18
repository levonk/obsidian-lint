/**
 * Tag From Folders Rule Implementation
 * Generates tags based on directory structure with different strategies
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
 * Interface for tag-from-folders settings
 */
interface TagFromFoldersSettings {
  auto_fix: boolean;
  tag_prefix?: string;
  exclude_folders: string[];
  max_depth?: number;
  separator: string;
  case_transform: 'lowercase' | 'uppercase' | 'preserve';
  replace_spaces: boolean;
  space_replacement: string;
}

/**
 * Base class for tag-from-folders rules
 */
export abstract class TagFromFoldersRule extends BaseRule {
  protected settings: TagFromFoldersSettings;

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
  private parseSettings(settings: Record<string, any>): TagFromFoldersSettings {
    const defaultSettings: TagFromFoldersSettings = {
      auto_fix: true,
      exclude_folders: ['.git', '.obsidian', 'Meta', 'Templates'],
      max_depth: 5,
      separator: '/',
      case_transform: 'lowercase',
      replace_spaces: true,
      space_replacement: '-',
    };

    return {
      ...defaultSettings,
      ...settings,
      auto_fix:
        typeof settings.auto_fix === 'boolean'
          ? settings.auto_fix
          : defaultSettings.auto_fix,
      exclude_folders: Array.isArray(settings.exclude_folders)
        ? settings.exclude_folders
        : defaultSettings.exclude_folders,
      max_depth:
        typeof settings.max_depth === 'number'
          ? settings.max_depth
          : defaultSettings.max_depth,
      separator:
        typeof settings.separator === 'string'
          ? settings.separator
          : defaultSettings.separator,
      case_transform: ['lowercase', 'uppercase', 'preserve'].includes(
        settings.case_transform
      )
        ? settings.case_transform
        : defaultSettings.case_transform,
      replace_spaces:
        typeof settings.replace_spaces === 'boolean'
          ? settings.replace_spaces
          : defaultSettings.replace_spaces,
      space_replacement:
        typeof settings.space_replacement === 'string'
          ? settings.space_replacement
          : defaultSettings.space_replacement,
    };
  }

  /**
   * Lint implementation - check if tags match folder structure
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file, vaultPath } = context;

    // Get expected tags based on folder structure
    const expectedTags = this.generateTagsFromPath(file.path, vaultPath);

    if (expectedTags.length === 0) {
      return issues;
    }

    // Get current tags from frontmatter
    const currentTags = this.getCurrentTags(file);

    // Check for missing tags
    const missingTags = expectedTags.filter(tag => !currentTags.includes(tag));

    if (missingTags.length > 0) {
      issues.push({
        ruleId: this.id.full,
        severity: 'warning',
        message: `Missing folder-based tags: ${missingTags.join(', ')}`,
        file: file.path,
        fixable: this.settings.auto_fix,
      });
    }

    // Check for inconsistent tag format
    const formattedCurrentTags = currentTags.map(tag => this.formatTag(tag));
    const inconsistentTags = currentTags.filter(
      (tag, index) => tag !== formattedCurrentTags[index]
    );

    if (inconsistentTags.length > 0) {
      issues.push({
        ruleId: this.id.full,
        severity: 'info',
        message: `Inconsistent tag formatting: ${inconsistentTags.join(', ')}`,
        file: file.path,
        fixable: this.settings.auto_fix,
      });
    }

    return issues;
  }

  /**
   * Fix implementation - add missing tags and fix formatting
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_fix) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file, vaultPath } = context;
    const changes: FileChange[] = [];

    // Get expected tags and current tags
    const expectedTags = this.generateTagsFromPath(file.path, vaultPath);
    const currentTags = this.getCurrentTags(file);

    // Combine and deduplicate tags
    const allTags = [...new Set([...currentTags, ...expectedTags])];
    const formattedTags = allTags.map(tag => this.formatTag(tag));

    // Update frontmatter if tags changed
    if (
      JSON.stringify(currentTags.sort()) !==
      JSON.stringify(formattedTags.sort())
    ) {
      const updatedFrontmatter = { ...file.frontmatter };
      updatedFrontmatter.tags = formattedTags;

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
        description: 'Updated tags based on folder structure',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Generate tags from file path - to be implemented by subclasses
   */
  protected abstract generateTagsFromPath(
    filePath: string,
    vaultPath: string
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
   * Format a tag according to settings
   */
  protected formatTag(tag: string): string {
    let formatted = tag.trim();

    // Remove existing prefixes if any
    if (formatted.startsWith('#')) {
      formatted = formatted.substring(1);
    }

    // Replace spaces
    if (this.settings.replace_spaces) {
      formatted = formatted.replace(/\s+/g, this.settings.space_replacement);
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
   * Get relative path components excluding excluded folders
   */
  protected getPathComponents(filePath: string, vaultPath: string): string[] {
    const relativePath = path.relative(vaultPath, filePath);
    const components = path.dirname(relativePath).split(path.sep);

    // Filter out excluded folders and current directory marker
    return components.filter(
      component =>
        component !== '.' && !this.settings.exclude_folders.includes(component)
    );
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
 * Hierarchical variant - creates nested tags based on folder hierarchy
 */
export class TagFromFoldersHierarchicalRule extends TagFromFoldersRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-from-folders',
        minor: 'hierarchical',
        full: 'tag-from-folders.hierarchical',
      },
      'Hierarchical Folder Tags',
      'Generate hierarchical tags based on folder structure (e.g., projects/work/client)',
      config
    );
  }

  protected generateTagsFromPath(
    filePath: string,
    vaultPath: string
  ): string[] {
    const components = this.getPathComponents(filePath, vaultPath);

    if (components.length === 0) {
      return [];
    }

    const tags: string[] = [];
    let currentPath = '';

    // Create hierarchical tags
    for (
      let i = 0;
      i < Math.min(components.length, this.settings.max_depth || 5);
      i++
    ) {
      if (currentPath) {
        currentPath += this.settings.separator;
      }
      currentPath += components[i];
      tags.push(this.formatTag(currentPath));
    }

    return tags;
  }
}

/**
 * Flat variant - creates individual tags for each folder level
 */
export class TagFromFoldersFlatRule extends TagFromFoldersRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-from-folders',
        minor: 'flat',
        full: 'tag-from-folders.flat',
      },
      'Flat Folder Tags',
      'Generate individual tags for each folder level (e.g., projects, work, client)',
      config
    );
  }

  protected generateTagsFromPath(
    filePath: string,
    vaultPath: string
  ): string[] {
    const components = this.getPathComponents(filePath, vaultPath);

    return components
      .slice(0, this.settings.max_depth || 5)
      .map(component => this.formatTag(component));
  }
}

/**
 * Custom variant - uses custom mapping rules for folder-to-tag conversion
 */
export class TagFromFoldersCustomRule extends TagFromFoldersRule {
  private folderMappings: Record<string, string[]>;

  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-from-folders',
        minor: 'custom',
        full: 'tag-from-folders.custom',
      },
      'Custom Folder Tags',
      'Generate tags based on custom folder-to-tag mappings',
      config
    );

    this.folderMappings = config.settings.folder_mappings || {};
  }

  protected generateTagsFromPath(
    filePath: string,
    vaultPath: string
  ): string[] {
    const components = this.getPathComponents(filePath, vaultPath);
    const tags: string[] = [];

    for (const component of components) {
      // Check for exact mapping
      if (this.folderMappings[component]) {
        tags.push(
          ...this.folderMappings[component].map(tag => this.formatTag(tag))
        );
      } else {
        // Check for pattern mappings
        for (const [pattern, mappedTags] of Object.entries(
          this.folderMappings
        )) {
          if (
            pattern.includes('*') &&
            this.matchesPattern(component, pattern)
          ) {
            tags.push(...mappedTags.map(tag => this.formatTag(tag)));
            break;
          }
        }

        // If no mapping found, use the folder name as tag
        if (!tags.some(tag => tag.includes(component))) {
          tags.push(this.formatTag(component));
        }
      }
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Simple pattern matching for custom mappings
   */
  private matchesPattern(text: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(text);
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createTagFromFoldersRule(
  ruleId: string,
  config: RuleConfig
): TagFromFoldersRule {
  switch (ruleId) {
    case 'tag-from-folders.hierarchical':
      return new TagFromFoldersHierarchicalRule(config);
    case 'tag-from-folders.flat':
      return new TagFromFoldersFlatRule(config);
    case 'tag-from-folders.custom':
      return new TagFromFoldersCustomRule(config);
    default:
      throw new Error(`Unknown tag-from-folders rule variant: ${ruleId}`);
  }
}
