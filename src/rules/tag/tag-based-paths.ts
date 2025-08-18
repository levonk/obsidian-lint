/**
 * Tag Based Paths Rule Implementation
 * Enforces or suggests file organization based on tags
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
 * Interface for tag-based-paths settings
 */
interface TagBasedPathsSettings {
  auto_fix: boolean;
  tag_to_path_mappings: Record<string, string>;
  path_template: string;
  primary_tag_priority: string[];
  create_missing_directories: boolean;
  update_links: boolean;
  exclude_tags: string[];
  max_path_depth: number;
  path_separator: string;
  case_transform: 'lowercase' | 'uppercase' | 'preserve';
  replace_spaces: boolean;
  space_replacement: string;
}

/**
 * Base class for tag-based-paths rules
 */
export abstract class TagBasedPathsRule extends BaseRule {
  protected settings: TagBasedPathsSettings;

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
  private parseSettings(settings: Record<string, any>): TagBasedPathsSettings {
    const defaultSettings: TagBasedPathsSettings = {
      auto_fix: true,
      tag_to_path_mappings: {},
      path_template: '{primary_tag}/{secondary_tag}',
      primary_tag_priority: [],
      create_missing_directories: true,
      update_links: true,
      exclude_tags: ['meta', 'template', 'draft'],
      max_path_depth: 3,
      path_separator: '/',
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
      tag_to_path_mappings:
        typeof settings.tag_to_path_mappings === 'object'
          ? settings.tag_to_path_mappings
          : defaultSettings.tag_to_path_mappings,
      path_template:
        typeof settings.path_template === 'string'
          ? settings.path_template
          : defaultSettings.path_template,
      primary_tag_priority: Array.isArray(settings.primary_tag_priority)
        ? settings.primary_tag_priority
        : defaultSettings.primary_tag_priority,
      create_missing_directories:
        typeof settings.create_missing_directories === 'boolean'
          ? settings.create_missing_directories
          : defaultSettings.create_missing_directories,
      update_links:
        typeof settings.update_links === 'boolean'
          ? settings.update_links
          : defaultSettings.update_links,
      exclude_tags: Array.isArray(settings.exclude_tags)
        ? settings.exclude_tags
        : defaultSettings.exclude_tags,
      max_path_depth:
        typeof settings.max_path_depth === 'number'
          ? settings.max_path_depth
          : defaultSettings.max_path_depth,
      path_separator:
        typeof settings.path_separator === 'string'
          ? settings.path_separator
          : defaultSettings.path_separator,
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
   * Lint implementation - check if file path matches tag-based organization
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file, vaultPath } = context;

    // Get current tags from frontmatter
    const currentTags = this.getCurrentTags(file);

    if (currentTags.length === 0) {
      return issues;
    }

    // Calculate expected path based on tags
    const expectedPath = this.calculateExpectedPath(
      currentTags,
      file.path,
      vaultPath
    );

    if (!expectedPath) {
      return issues;
    }

    const currentRelativePath = path.relative(vaultPath, file.path);
    const expectedRelativePath = path.relative(vaultPath, expectedPath);

    if (currentRelativePath !== expectedRelativePath) {
      const severity = this.getSeverityForPathMismatch();
      const message = this.getMessageForPathMismatch(expectedRelativePath);

      issues.push({
        ruleId: this.id.full,
        severity,
        message,
        file: file.path,
        fixable: this.settings.auto_fix && this.canAutoFix(),
      });
    }

    return issues;
  }

  /**
   * Fix implementation - move file to tag-based path
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_fix || !this.canAutoFix()) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file, vaultPath } = context;
    const changes: FileChange[] = [];

    // Get current tags and calculate expected path
    const currentTags = this.getCurrentTags(file);
    const expectedPath = this.calculateExpectedPath(
      currentTags,
      file.path,
      vaultPath
    );

    if (!expectedPath || expectedPath === file.path) {
      return fixes;
    }

    // Create file move operation
    changes.push({
      type: 'move',
      oldPath: file.path,
      newPath: expectedPath,
      updateLinks: this.settings.update_links,
    });

    fixes.push({
      ruleId: this.id.full,
      file: file.path,
      description: `Move file to tag-based path: ${path.relative(vaultPath, expectedPath)}`,
      changes,
    });

    return fixes;
  }

  /**
   * Calculate expected path based on tags - to be implemented by subclasses
   */
  protected abstract calculateExpectedPath(
    tags: string[],
    currentPath: string,
    vaultPath: string
  ): string | null;

  /**
   * Get severity for path mismatch - to be implemented by subclasses
   */
  protected abstract getSeverityForPathMismatch(): 'error' | 'warning' | 'info';

  /**
   * Get message for path mismatch - to be implemented by subclasses
   */
  protected abstract getMessageForPathMismatch(expectedPath: string): string;

  /**
   * Check if auto-fix is allowed - to be implemented by subclasses
   */
  protected abstract canAutoFix(): boolean;

  /**
   * Get current tags from file frontmatter
   */
  protected getCurrentTags(file: any): string[] {
    if (!file.frontmatter || !file.frontmatter.tags) {
      return [];
    }

    if (Array.isArray(file.frontmatter.tags)) {
      return file.frontmatter.tags
        .filter(tag => typeof tag === 'string')
        .filter(tag => !this.settings.exclude_tags.includes(tag.toLowerCase()));
    }

    if (typeof file.frontmatter.tags === 'string') {
      const tag = file.frontmatter.tags;
      return this.settings.exclude_tags.includes(tag.toLowerCase())
        ? []
        : [tag];
    }

    return [];
  }

  /**
   * Select primary tag based on priority settings
   */
  protected selectPrimaryTag(tags: string[]): string | null {
    // Check priority list first
    for (const priorityTag of this.settings.primary_tag_priority) {
      const matchingTag = tags.find(
        tag => tag.toLowerCase() === priorityTag.toLowerCase()
      );
      if (matchingTag) {
        return matchingTag;
      }
    }

    // Check tag mappings
    for (const tag of tags) {
      if (this.settings.tag_to_path_mappings[tag]) {
        return tag;
      }
    }

    // Return first tag if no priority match
    return tags.length > 0 ? tags[0] : null;
  }

  /**
   * Format path component according to settings
   */
  protected formatPathComponent(component: string): string {
    let formatted = component.trim();

    // Remove tag prefix if present
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

    // Remove invalid path characters
    formatted = formatted.replace(/[<>:"|?*]/g, '');

    return formatted;
  }

  /**
   * Build path from template and tags
   */
  protected buildPathFromTemplate(tags: string[], fileName: string): string {
    const primaryTag = this.selectPrimaryTag(tags);
    const secondaryTags = tags.filter(tag => tag !== primaryTag);

    let pathTemplate = this.settings.path_template;

    // Replace template variables
    pathTemplate = pathTemplate.replace(
      '{primary_tag}',
      primaryTag ? this.formatPathComponent(primaryTag) : ''
    );

    pathTemplate = pathTemplate.replace(
      '{secondary_tag}',
      secondaryTags.length > 0 ? this.formatPathComponent(secondaryTags[0]) : ''
    );

    pathTemplate = pathTemplate.replace(
      '{all_tags}',
      tags
        .map(tag => this.formatPathComponent(tag))
        .join(this.settings.path_separator)
    );

    pathTemplate = pathTemplate.replace(
      '{filename}',
      path.parse(fileName).name
    );

    // Clean up empty path segments
    const pathSegments = pathTemplate
      .split('/')
      .filter(segment => segment.length > 0)
      .slice(0, this.settings.max_path_depth);

    return pathSegments.join('/');
  }

  /**
   * Apply tag-to-path mappings
   */
  protected applyTagMappings(tags: string[]): string[] {
    const mappedPaths: string[] = [];

    for (const tag of tags) {
      if (this.settings.tag_to_path_mappings[tag]) {
        mappedPaths.push(this.settings.tag_to_path_mappings[tag]);
      } else {
        mappedPaths.push(this.formatPathComponent(tag));
      }
    }

    return mappedPaths;
  }
}

/**
 * Enforce variant - strictly enforces tag-based paths
 */
export class TagBasedPathsEnforceRule extends TagBasedPathsRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-based-paths',
        minor: 'enforce',
        full: 'tag-based-paths.enforce',
      },
      'Enforce Tag-Based Paths',
      'Strictly enforce file organization based on tags',
      config
    );
  }

  protected calculateExpectedPath(
    tags: string[],
    currentPath: string,
    vaultPath: string
  ): string | null {
    if (tags.length === 0) {
      return null;
    }

    const fileName = path.basename(currentPath);
    const pathFromTemplate = this.buildPathFromTemplate(tags, fileName);

    if (!pathFromTemplate) {
      return null;
    }

    return path.join(vaultPath, pathFromTemplate, fileName);
  }

  protected getSeverityForPathMismatch(): 'error' | 'warning' | 'info' {
    return 'error';
  }

  protected getMessageForPathMismatch(expectedPath: string): string {
    return `File must be moved to tag-based path: ${expectedPath}`;
  }

  protected canAutoFix(): boolean {
    return true;
  }
}

/**
 * Suggest variant - suggests tag-based paths without enforcing
 */
export class TagBasedPathsSuggestRule extends TagBasedPathsRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-based-paths',
        minor: 'suggest',
        full: 'tag-based-paths.suggest',
      },
      'Suggest Tag-Based Paths',
      'Suggest file organization based on tags without enforcing',
      config
    );
  }

  protected calculateExpectedPath(
    tags: string[],
    currentPath: string,
    vaultPath: string
  ): string | null {
    if (tags.length === 0) {
      return null;
    }

    const fileName = path.basename(currentPath);
    const pathFromTemplate = this.buildPathFromTemplate(tags, fileName);

    if (!pathFromTemplate) {
      return null;
    }

    return path.join(vaultPath, pathFromTemplate, fileName);
  }

  protected getSeverityForPathMismatch(): 'error' | 'warning' | 'info' {
    return 'info';
  }

  protected getMessageForPathMismatch(expectedPath: string): string {
    return `Consider moving file to tag-based path: ${expectedPath}`;
  }

  protected canAutoFix(): boolean {
    return false; // Don't auto-fix in suggest mode
  }
}

/**
 * Ignore variant - ignores tag-based path organization
 */
export class TagBasedPathsIgnoreRule extends TagBasedPathsRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'tag-based-paths',
        minor: 'ignore',
        full: 'tag-based-paths.ignore',
      },
      'Ignore Tag-Based Paths',
      'Ignore tag-based file organization (no-op rule)',
      config
    );
  }

  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    // No-op: ignore tag-based path organization
    return [];
  }

  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    // No-op: no fixes needed
    return [];
  }

  protected calculateExpectedPath(): string | null {
    return null;
  }

  protected getSeverityForPathMismatch(): 'error' | 'warning' | 'info' {
    return 'info';
  }

  protected getMessageForPathMismatch(): string {
    return '';
  }

  protected canAutoFix(): boolean {
    return false;
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createTagBasedPathsRule(
  ruleId: string,
  config: RuleConfig
): TagBasedPathsRule {
  switch (ruleId) {
    case 'tag-based-paths.enforce':
      return new TagBasedPathsEnforceRule(config);
    case 'tag-based-paths.suggest':
      return new TagBasedPathsSuggestRule(config);
    case 'tag-based-paths.ignore':
      return new TagBasedPathsIgnoreRule(config);
    default:
      throw new Error(`Unknown tag-based-paths rule variant: ${ruleId}`);
  }
}
