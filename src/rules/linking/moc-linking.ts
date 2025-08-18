/**
 * MOC (Map of Content) Linking Rules Implementation
 * Manages bidirectional linking between MOCs and notes based on directory structure
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Interface for MOC linking settings
 */
interface MocLinkingSettings {
  moc_directory: string;
  moc_suffix: string;
  auto_create_mocs: boolean;
  auto_link_to_moc: boolean;
  auto_link_from_moc: boolean;
  bidirectional_linking: boolean;
  moc_template_path?: string;
  exclude_directories: string[];
  min_files_for_moc: number;
  link_format: 'wikilink' | 'markdown';
  sort_links: boolean;
  group_by_type: boolean;
}

/**
 * Base class for MOC linking rules
 */
export abstract class MocLinkingRule extends BaseRule {
  protected settings: MocLinkingSettings;

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
  private parseSettings(settings: Record<string, any>): MocLinkingSettings {
    const defaultSettings: MocLinkingSettings = {
      moc_directory: 'MOCs',
      moc_suffix: ' MOC',
      auto_create_mocs: true,
      auto_link_to_moc: true,
      auto_link_from_moc: true,
      bidirectional_linking: true,
      exclude_directories: ['.git', '.obsidian', 'node_modules'],
      min_files_for_moc: 2,
      link_format: 'wikilink',
      sort_links: true,
      group_by_type: false,
    };

    return {
      ...defaultSettings,
      ...settings,
      moc_directory: settings['moc_directory'] ?? defaultSettings.moc_directory,
      moc_suffix: settings['moc_suffix'] ?? defaultSettings.moc_suffix,
      auto_create_mocs:
        settings['auto_create_mocs'] ?? defaultSettings.auto_create_mocs,
      auto_link_to_moc:
        settings['auto_link_to_moc'] ?? defaultSettings.auto_link_to_moc,
      auto_link_from_moc:
        settings['auto_link_from_moc'] ?? defaultSettings.auto_link_from_moc,
      bidirectional_linking:
        settings['bidirectional_linking'] ??
        defaultSettings.bidirectional_linking,
      moc_template_path: settings['moc_template_path'],
      exclude_directories:
        settings['exclude_directories'] ?? defaultSettings.exclude_directories,
      min_files_for_moc:
        settings['min_files_for_moc'] ?? defaultSettings.min_files_for_moc,
      link_format: settings['link_format'] ?? defaultSettings.link_format,
      sort_links: settings['sort_links'] ?? defaultSettings.sort_links,
      group_by_type: settings['group_by_type'] ?? defaultSettings.group_by_type,
    };
  }

  /**
   * Lint implementation - check for MOC linking issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file, vaultPath } = context;

    // Check if this file should link to a MOC
    const mocLinkIssues = await this.checkMocLinking(file.path, vaultPath);
    issues.push(...mocLinkIssues);

    // If this is a MOC file, check its content
    if (this.isMocFile(file.path)) {
      const mocContentIssues = await this.checkMocContent(file, vaultPath);
      issues.push(...mocContentIssues);
    }

    return issues;
  }

  /**
   * Fix implementation - create and update MOC links
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    const fixes: Fix[] = [];
    const { file, vaultPath } = context;

    // Create missing MOCs if needed
    if (this.settings.auto_create_mocs) {
      const mocCreationFixes = await this.createMissingMocs(
        file.path,
        vaultPath
      );
      fixes.push(...mocCreationFixes);
    }

    // Update MOC links
    const linkingFixes = await this.updateMocLinks(file, vaultPath);
    fixes.push(...linkingFixes);

    return fixes;
  }

  /**
   * Check if a file should link to a MOC and if that link exists
   */
  protected async checkMocLinking(
    filePath: string,
    vaultPath: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    if (this.isMocFile(filePath)) {
      return issues; // MOCs don't need to link to themselves
    }

    const expectedMocPath = await this.getExpectedMocPath(filePath, vaultPath);
    if (!expectedMocPath) {
      return issues; // No MOC expected for this location
    }

    const mocExists = await this.fileExists(expectedMocPath);
    if (!mocExists) {
      issues.push({
        ruleId: this.id.full,
        severity: 'info',
        message: `Missing MOC file: ${path.basename(expectedMocPath)}`,
        file: filePath,
        fixable: this.settings.auto_create_mocs,
      });
    }

    // Check if file links to its MOC
    if (mocExists) {
      const hasLinkToMoc = await this.hasLinkToMoc(filePath, expectedMocPath);
      if (!hasLinkToMoc) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `File should link to its MOC: ${path.basename(expectedMocPath)}`,
          file: filePath,
          fixable: this.settings.auto_link_to_moc,
        });
      }
    }

    return issues;
  }

  /**
   * Check MOC content for completeness and accuracy
   */
  protected async checkMocContent(
    file: any,
    vaultPath: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Always check MOC content, but only fix if auto_link_from_moc is enabled

    const expectedLinks = await this.getExpectedMocLinks(file.path, vaultPath);
    const currentLinks = this.extractMocLinks(file.content);

    // Check for missing links
    for (const expectedLink of expectedLinks) {
      if (!currentLinks.includes(expectedLink)) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `MOC missing link to: ${expectedLink}`,
          file: file.path,
          fixable: this.settings.auto_link_from_moc,
        });
      }
    }

    // Check for outdated links
    for (const currentLink of currentLinks) {
      if (!expectedLinks.includes(currentLink)) {
        const linkExists = await this.fileExists(
          path.join(vaultPath, `${currentLink}.md`)
        );
        if (!linkExists) {
          issues.push({
            ruleId: this.id.full,
            severity: 'warning',
            message: `MOC contains broken link: ${currentLink}`,
            file: file.path,
            fixable: this.settings.auto_link_from_moc,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Create missing MOC files
   */
  protected async createMissingMocs(
    filePath: string,
    vaultPath: string
  ): Promise<Fix[]> {
    const fixes: Fix[] = [];
    const expectedMocPath = await this.getExpectedMocPath(filePath, vaultPath);

    if (!expectedMocPath) {
      return fixes;
    }

    const mocExists = await this.fileExists(expectedMocPath);
    if (!mocExists) {
      const mocContent = await this.generateMocContent(
        expectedMocPath,
        vaultPath
      );

      fixes.push({
        ruleId: this.id.full,
        file: expectedMocPath,
        description: `Create MOC file: ${path.basename(expectedMocPath)}`,
        changes: [
          {
            type: 'insert',
            line: 1,
            column: 1,
            newText: mocContent,
          },
        ],
      });
    }

    return fixes;
  }

  /**
   * Update MOC links in files
   */
  protected async updateMocLinks(file: any, vaultPath: string): Promise<Fix[]> {
    const fixes: Fix[] = [];
    const changes: FileChange[] = [];

    if (this.isMocFile(file.path)) {
      // Update MOC content
      if (this.settings.auto_link_from_moc) {
        const expectedLinks = await this.getExpectedMocLinks(
          file.path,
          vaultPath
        );
        const updatedContent = await this.updateMocContent(
          file.content,
          expectedLinks
        );

        if (updatedContent !== file.content) {
          changes.push({
            type: 'replace',
            oldText: file.content,
            newText: updatedContent,
          });
        }
      }
    } else {
      // Add link to MOC in regular file
      if (this.settings.auto_link_to_moc) {
        const expectedMocPath = await this.getExpectedMocPath(
          file.path,
          vaultPath
        );
        if (expectedMocPath && (await this.fileExists(expectedMocPath))) {
          const hasLink = await this.hasLinkToMoc(file.path, expectedMocPath);
          if (!hasLink) {
            const linkText = this.formatLink(
              path.basename(expectedMocPath, '.md')
            );
            changes.push({
              type: 'insert',
              line: 1,
              column: 1,
              newText: `${linkText}\n\n`,
            });
          }
        }
      }
    }

    if (changes.length > 0) {
      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Updated MOC links',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Check if a file is a MOC file
   */
  protected isMocFile(filePath: string): boolean {
    const fileName = path.basename(filePath, '.md');
    return (
      fileName.endsWith(this.settings.moc_suffix) ||
      filePath.includes(this.settings.moc_directory)
    );
  }

  /**
   * Get the expected MOC path for a file
   */
  protected async getExpectedMocPath(
    filePath: string,
    vaultPath: string
  ): Promise<string | null> {
    const relativePath = path.relative(vaultPath, filePath);
    const directory = path.dirname(relativePath);

    if (
      directory === '.' ||
      this.settings.exclude_directories.includes(directory)
    ) {
      return null;
    }

    // Check if directory has enough files to warrant a MOC
    const filesInDirectory = await this.getFilesInDirectory(
      path.join(vaultPath, directory)
    );
    if (filesInDirectory.length < this.settings.min_files_for_moc) {
      return null;
    }

    const mocName = `${path.basename(directory)}${this.settings.moc_suffix}.md`;
    return path.join(vaultPath, this.settings.moc_directory, mocName);
  }

  /**
   * Check if a file has a link to its MOC
   */
  protected async hasLinkToMoc(
    filePath: string,
    mocPath: string
  ): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const mocName = path.basename(mocPath, '.md');

      // Check for wikilink format
      const wikilinkPattern = new RegExp(`\\[\\[${mocName}\\]\\]`);
      if (wikilinkPattern.test(content)) {
        return true;
      }

      // Check for markdown link format
      const markdownLinkPattern = new RegExp(`\\[.*\\]\\(.*${mocName}.*\\)`);
      if (markdownLinkPattern.test(content)) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get expected links for a MOC
   */
  protected async getExpectedMocLinks(
    mocPath: string,
    vaultPath: string
  ): Promise<string[]> {
    const mocName = path.basename(mocPath, '.md');
    const directoryName = mocName.replace(this.settings.moc_suffix, '');
    const targetDirectory = path.join(vaultPath, directoryName);

    const files = await this.getFilesInDirectory(targetDirectory);
    return files
      .filter(file => !this.isMocFile(file))
      .map(file => path.basename(file, '.md'))
      .sort();
  }

  /**
   * Extract existing links from MOC content
   */
  protected extractMocLinks(content: string): string[] {
    const links: string[] = [];

    // Extract wikilinks
    const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = wikilinkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }

    // Extract markdown links
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = markdownLinkRegex.exec(content)) !== null) {
      const target = match[2];
      if (!target.startsWith('http')) {
        links.push(path.basename(target, '.md'));
      }
    }

    return [...new Set(links)]; // Remove duplicates
  }

  /**
   * Generate MOC content
   */
  protected async generateMocContent(
    mocPath: string,
    vaultPath: string
  ): Promise<string> {
    const mocName = path.basename(mocPath, '.md');
    const directoryName = mocName.replace(this.settings.moc_suffix, '');

    let content = '';

    // Use template if available
    if (this.settings.moc_template_path) {
      try {
        const templatePath = path.join(
          vaultPath,
          this.settings.moc_template_path
        );
        const template = await fs.readFile(templatePath, 'utf-8');
        content = template.replace(/\{\{title\}\}/g, mocName);
      } catch {
        // Fall back to default template
      }
    }

    // Default template
    if (!content) {
      content = `# ${mocName}\n\n## Overview\n\nThis is a Map of Content for the ${directoryName} directory.\n\n## Contents\n\n`;
    }

    // Add links to files
    const expectedLinks = await this.getExpectedMocLinks(mocPath, vaultPath);
    for (const link of expectedLinks) {
      const linkText = this.formatLink(link);
      content += `- ${linkText}\n`;
    }

    return content;
  }

  /**
   * Update MOC content with current links
   */
  protected async updateMocContent(
    currentContent: string,
    expectedLinks: string[]
  ): Promise<string> {
    // Find the contents section
    const contentsMatch = currentContent.match(
      /(## Contents\s*\n)([\s\S]*?)(?=\n##|\n#|$)/
    );

    if (!contentsMatch) {
      // Add contents section
      let updatedContent = currentContent;
      if (!updatedContent.endsWith('\n')) {
        updatedContent += '\n';
      }
      updatedContent += '\n## Contents\n\n';

      for (const link of expectedLinks) {
        const linkText = this.formatLink(link);
        updatedContent += `- ${linkText}\n`;
      }

      return updatedContent;
    }

    // Replace contents section
    const beforeContents = currentContent.substring(
      0,
      contentsMatch.index! + contentsMatch[1].length
    );
    const afterContents = currentContent.substring(
      contentsMatch.index! + contentsMatch[0].length
    );

    let newContents = '';
    for (const link of expectedLinks) {
      const linkText = this.formatLink(link);
      newContents += `- ${linkText}\n`;
    }

    return beforeContents + newContents + afterContents;
  }

  /**
   * Format a link according to settings
   */
  protected formatLink(linkTarget: string): string {
    if (this.settings.link_format === 'wikilink') {
      return `[[${linkTarget}]]`;
    } else {
      return `[${linkTarget}](${linkTarget}.md)`;
    }
  }

  /**
   * Get all markdown files in a directory
   */
  protected async getFilesInDirectory(
    directoryPath: string
  ): Promise<string[]> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
        .map(entry => path.join(directoryPath, entry.name));
    } catch {
      return [];
    }
  }

  /**
   * Check if a file exists
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Automatic variant - automatically creates and maintains MOC links
 */
export class MocLinkingAutomaticRule extends MocLinkingRule {
  constructor(config: RuleConfig) {
    const automaticConfig = {
      ...config,
      settings: {
        ...config.settings,
        auto_create_mocs: true,
        auto_link_to_moc: true,
        auto_link_from_moc: true,
        bidirectional_linking: true,
      },
    };

    super(
      {
        major: 'moc-linking',
        minor: 'automatic',
        full: 'moc-linking.automatic',
      },
      'Automatic MOC Linking',
      'Automatically create and maintain MOC links based on directory structure',
      automaticConfig
    );
  }
}

/**
 * Manual variant - only reports MOC linking opportunities
 */
export class MocLinkingManualRule extends MocLinkingRule {
  constructor(config: RuleConfig) {
    const manualConfig = {
      ...config,
      settings: {
        ...config.settings,
        auto_create_mocs: false,
        auto_link_to_moc: false,
        auto_link_from_moc: false,
        bidirectional_linking: false,
      },
    };

    super(
      {
        major: 'moc-linking',
        minor: 'manual',
        full: 'moc-linking.manual',
      },
      'Manual MOC Linking',
      'Report MOC linking opportunities without automatic changes',
      manualConfig
    );
  }
}

/**
 * Hybrid variant - creates MOCs but requires manual linking
 */
export class MocLinkingHybridRule extends MocLinkingRule {
  constructor(config: RuleConfig) {
    const hybridConfig = {
      ...config,
      settings: {
        ...config.settings,
        auto_create_mocs: true,
        auto_link_to_moc: false,
        auto_link_from_moc: true,
        bidirectional_linking: false,
      },
    };

    super(
      {
        major: 'moc-linking',
        minor: 'hybrid',
        full: 'moc-linking.hybrid',
      },
      'Hybrid MOC Linking',
      'Create MOCs automatically but require manual linking from notes',
      hybridConfig
    );
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createMocLinkingRule(
  ruleId: string,
  config: RuleConfig
): MocLinkingRule {
  switch (ruleId) {
    case 'moc-linking.automatic':
      return new MocLinkingAutomaticRule(config);
    case 'moc-linking.manual':
      return new MocLinkingManualRule(config);
    case 'moc-linking.hybrid':
      return new MocLinkingHybridRule(config);
    default:
      throw new Error(`Unknown MOC linking rule variant: ${ruleId}`);
  }
}
