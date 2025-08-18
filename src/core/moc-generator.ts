/**
 * MOC (Map of Content) Generation System
 * Implements comprehensive MOC template processing, directory analysis, and generation
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { MarkdownFile, Issue, Fix, FileChange } from '../types/common.js';
import { FileProcessor } from '../utils/file-processor.js';
import { MarkdownFile as MarkdownFileImpl } from './markdown-file.js';

export interface MocGeneratorSettings {
  mocDirectory: string;
  mocSuffix: string;
  templatePath?: string;
  parallelStructure: boolean;
  parallelStructurePath?: string;
  autoCreateMocs: boolean;
  bidirectionalLinking: boolean;
  excludeDirectories: string[];
  minFilesForMoc: number;
  linkFormat: 'wikilink' | 'markdown';
  sortLinks: boolean;
  groupByType: boolean;
  preserveManualContent: boolean;
  generatedSectionMarker: string;
}

export interface DirectoryAnalysis {
  path: string;
  relativePath: string;
  files: string[];
  subdirectories: DirectoryAnalysis[];
  mocPath: string;
  shouldHaveMoc: boolean;
  existingMocPath?: string;
}

export interface MocTemplate {
  content: string;
  variables: Record<string, string>;
  generatedSections: string[];
}

export interface MocGenerationResult {
  created: string[];
  updated: string[];
  issues: Issue[];
  fixes: Fix[];
}

export class MocGenerator {
  private settings: MocGeneratorSettings;
  private fileProcessor: FileProcessor;

  constructor(settings: Partial<MocGeneratorSettings> = {}) {
    this.settings = this.mergeWithDefaults(settings);
    this.fileProcessor = new FileProcessor();
  }

  /**
   * Merge user settings with defaults
   */
  private mergeWithDefaults(
    settings: Partial<MocGeneratorSettings>
  ): MocGeneratorSettings {
    return {
      mocDirectory: settings.mocDirectory || 'MOCs',
      mocSuffix: settings.mocSuffix || ' MOC',
      templatePath: settings.templatePath,
      parallelStructure: settings.parallelStructure || false,
      parallelStructurePath: settings.parallelStructurePath || 'MOCs',
      autoCreateMocs: settings.autoCreateMocs !== false,
      bidirectionalLinking: settings.bidirectionalLinking !== false,
      excludeDirectories: settings.excludeDirectories || [
        '.git',
        '.obsidian',
        'node_modules',
        '.kiro',
      ],
      minFilesForMoc: settings.minFilesForMoc || 2,
      linkFormat: settings.linkFormat || 'wikilink',
      sortLinks: settings.sortLinks !== false,
      groupByType: settings.groupByType || false,
      preserveManualContent: settings.preserveManualContent !== false,
      generatedSectionMarker:
        settings.generatedSectionMarker || '<!-- MOC_GENERATED -->',
    };
  }

  /**
   * Analyze directory structure and determine MOC requirements
   */
  async analyzeDirectoryStructure(
    vaultPath: string
  ): Promise<DirectoryAnalysis> {
    return this.analyzeDirectory(vaultPath, vaultPath, '');
  }

  /**
   * Recursively analyze a directory
   */
  private async analyzeDirectory(
    directoryPath: string,
    vaultPath: string,
    relativePath: string
  ): Promise<DirectoryAnalysis> {
    const files: string[] = [];
    const subdirectories: DirectoryAnalysis[] = [];

    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);

        if (entry.isFile() && entry.name.endsWith('.md')) {
          // Skip MOC files when counting
          if (!this.isMocFile(entry.name)) {
            files.push(entryPath);
          }
        } else if (
          entry.isDirectory() &&
          !this.isExcludedDirectory(entry.name)
        ) {
          const subAnalysis = await this.analyzeDirectory(
            entryPath,
            vaultPath,
            entryRelativePath
          );
          subdirectories.push(subAnalysis);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
      console.warn(`Could not analyze directory ${directoryPath}:`, error);
    }

    const shouldHaveMoc =
      files.length >= this.settings.minFilesForMoc && relativePath !== '';
    const mocPath = this.getMocPath(relativePath, vaultPath);
    const existingMocPath = await this.findExistingMoc(
      directoryPath,
      path.basename(directoryPath)
    );

    return {
      path: directoryPath,
      relativePath,
      files,
      subdirectories,
      mocPath,
      shouldHaveMoc,
      existingMocPath,
    };
  }

  /**
   * Generate MOCs for entire vault structure
   */
  async generateMocsForVault(vaultPath: string): Promise<MocGenerationResult> {
    const analysis = await this.analyzeDirectoryStructure(vaultPath);
    const result: MocGenerationResult = {
      created: [],
      updated: [],
      issues: [],
      fixes: [],
    };

    await this.generateMocsFromAnalysis(analysis, vaultPath, result);
    return result;
  }

  /**
   * Generate MOCs based on directory analysis
   */
  private async generateMocsFromAnalysis(
    analysis: DirectoryAnalysis,
    vaultPath: string,
    result: MocGenerationResult
  ): Promise<void> {
    // Process current directory
    if (analysis.shouldHaveMoc) {
      try {
        const mocResult = await this.generateMocForDirectory(
          analysis,
          vaultPath
        );

        if (mocResult.created) {
          result.created.push(mocResult.mocPath);
        } else if (mocResult.updated) {
          result.updated.push(mocResult.mocPath);
        }

        result.issues.push(...mocResult.issues);
        result.fixes.push(...mocResult.fixes);
      } catch (error) {
        result.issues.push({
          ruleId: 'moc-generator',
          severity: 'error',
          message: `Failed to generate MOC for ${analysis.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
          file: analysis.path,
          fixable: false,
        });
      }
    }

    // Process subdirectories
    for (const subdir of analysis.subdirectories) {
      await this.generateMocsFromAnalysis(subdir, vaultPath, result);
    }
  }

  /**
   * Generate or update MOC for a specific directory
   */
  async generateMocForDirectory(
    analysis: DirectoryAnalysis,
    vaultPath: string
  ): Promise<{
    mocPath: string;
    created: boolean;
    updated: boolean;
    issues: Issue[];
    fixes: Fix[];
  }> {
    const issues: Issue[] = [];
    const fixes: Fix[] = [];
    let created = false;
    let updated = false;

    const targetMocPath = analysis.mocPath; // Always use the target path (parallel structure if enabled)
    const existingMocPath = analysis.existingMocPath;
    const targetExists = await this.fileExists(targetMocPath);
    const existingExists = existingMocPath
      ? await this.fileExists(existingMocPath)
      : false;

    if (!targetExists && !existingExists && this.settings.autoCreateMocs) {
      // Create new MOC
      const mocContent = await this.generateMocContent(analysis, vaultPath);

      // Ensure MOC directory exists
      await fs.mkdir(path.dirname(targetMocPath), { recursive: true });

      await fs.writeFile(targetMocPath, mocContent, 'utf-8');
      created = true;

      fixes.push({
        ruleId: 'moc-generator',
        file: targetMocPath,
        description: `Created MOC file: ${path.basename(targetMocPath)}`,
        changes: [
          {
            type: 'insert',
            line: 1,
            column: 1,
            newText: mocContent,
          },
        ],
      });
    } else if (targetExists || existingExists) {
      // Update existing MOC (and move if necessary)
      const sourcePath = targetExists ? targetMocPath : existingMocPath!;
      const currentContent = await fs.readFile(sourcePath, 'utf-8');
      const updatedContent = await this.updateMocContent(
        currentContent,
        analysis,
        vaultPath
      );

      // If we need to move the MOC to a new location
      if (sourcePath !== targetMocPath) {
        // Ensure target directory exists
        await fs.mkdir(path.dirname(targetMocPath), { recursive: true });

        // Write to new location
        await fs.writeFile(targetMocPath, updatedContent, 'utf-8');

        // Remove old location
        await fs.unlink(sourcePath);

        created = true; // Treat as creation since it's in a new location

        fixes.push({
          ruleId: 'moc-generator',
          file: targetMocPath,
          description: `Moved and updated MOC: ${path.basename(sourcePath)} -> ${path.basename(targetMocPath)}`,
          changes: [
            {
              type: 'move',
              oldPath: sourcePath,
              newPath: targetMocPath,
            },
          ],
        });
      } else if (updatedContent !== currentContent) {
        // Update in place
        await fs.writeFile(targetMocPath, updatedContent, 'utf-8');
        updated = true;

        fixes.push({
          ruleId: 'moc-generator',
          file: targetMocPath,
          description: `Updated MOC content: ${path.basename(targetMocPath)}`,
          changes: [
            {
              type: 'replace',
              oldText: currentContent,
              newText: updatedContent,
            },
          ],
        });
      }
    } else {
      // MOC should exist but doesn't
      issues.push({
        ruleId: 'moc-generator',
        severity: 'info',
        message: `MOC should be created for directory: ${analysis.relativePath}`,
        file: analysis.path,
        fixable: this.settings.autoCreateMocs,
      });
    }

    const finalMocPath = targetMocPath;

    // Handle bidirectional linking
    if (this.settings.bidirectionalLinking) {
      const linkingResult = await this.updateBidirectionalLinks(
        analysis,
        vaultPath,
        finalMocPath
      );
      issues.push(...linkingResult.issues);
      fixes.push(...linkingResult.fixes);
    }

    return {
      mocPath: finalMocPath,
      created,
      updated,
      issues,
      fixes,
    };
  }

  /**
   * Generate MOC content from template and directory analysis
   */
  async generateMocContent(
    analysis: DirectoryAnalysis,
    vaultPath: string
  ): Promise<string> {
    const template = await this.loadTemplate(vaultPath);
    const directoryName = analysis.relativePath
      ? path.basename(analysis.relativePath)
      : 'Root';
    const mocTitle = `${directoryName}${this.settings.mocSuffix}`;

    // Prepare template variables
    const variables = {
      ...template.variables, // Template defaults first
      title: mocTitle,
      directory: directoryName,
      path: analysis.relativePath,
      fileCount: analysis.files.length.toString(),
      subdirCount: analysis.subdirectories.length.toString(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    };

    // Replace variables in template
    let content = template.content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value || '');
    }

    // Generate links section
    const linksSection = await this.generateLinksSection(analysis, vaultPath);

    // Insert generated content
    if (content.includes('{{links}}')) {
      content = content.replace('{{links}}', linksSection);
    } else {
      // Append links section if no placeholder
      content += '\n\n## Contents\n\n' + linksSection;
    }

    return content;
  }

  /**
   * Update existing MOC content while preserving manual content
   */
  async updateMocContent(
    currentContent: string,
    analysis: DirectoryAnalysis,
    vaultPath: string
  ): Promise<string> {
    if (!this.settings.preserveManualContent) {
      // Replace entire content
      return this.generateMocContent(analysis, vaultPath);
    }

    // Find generated sections and update only those
    const linksSection = await this.generateLinksSection(analysis, vaultPath);
    const marker = this.settings.generatedSectionMarker;

    // Look for existing generated section
    const generatedSectionRegex = new RegExp(
      `${this.escapeRegex(marker)}\\s*START[\\s\\S]*?${this.escapeRegex(marker)}\\s*END`,
      'g'
    );

    if (generatedSectionRegex.test(currentContent)) {
      // Update existing generated section
      return currentContent.replace(
        generatedSectionRegex,
        `${marker} START\n${linksSection}\n${marker} END`
      );
    } else {
      // Look for Contents section to replace
      const contentsSectionRegex = /(## Contents\s*\n)([\s\S]*?)(?=\n##|\n#|$)/;
      const match = currentContent.match(contentsSectionRegex);

      if (match) {
        const beforeContents = currentContent.substring(
          0,
          match.index! + match[1].length
        );
        const afterContents = currentContent.substring(
          match.index! + match[0].length
        );

        return (
          beforeContents +
          `${marker} START\n${linksSection}\n${marker} END` +
          afterContents
        );
      } else {
        // Append new contents section
        return (
          currentContent +
          `\n\n## Contents\n\n${marker} START\n${linksSection}\n${marker} END`
        );
      }
    }
  }

  /**
   * Generate links section for MOC
   */
  async generateLinksSection(
    analysis: DirectoryAnalysis,
    vaultPath: string
  ): Promise<string> {
    const links: string[] = [];

    // Get file links
    const fileLinks = await this.generateFileLinks(analysis.files, vaultPath);

    if (this.settings.groupByType) {
      // Group by file type or other criteria
      const groupedLinks = this.groupLinks(fileLinks);

      for (const [groupName, groupLinks] of Object.entries(groupedLinks)) {
        if (groupLinks.length > 0) {
          links.push(`### ${groupName}`);
          links.push('');
          links.push(...groupLinks.map(link => `- ${link}`));
          links.push('');
        }
      }
    } else {
      // Simple list
      if (fileLinks.length > 0) {
        links.push(...fileLinks.map(link => `- ${link}`));
      }
    }

    // Add subdirectory MOC links if they exist
    const subdirLinks = await this.generateSubdirectoryLinks(
      analysis.subdirectories,
      vaultPath
    );
    if (subdirLinks.length > 0) {
      if (links.length > 0) {
        links.push('');
      }
      links.push('### Subdirectories');
      links.push('');
      links.push(...subdirLinks.map(link => `- ${link}`));
    }

    return links.join('\n');
  }

  /**
   * Generate links for files in directory
   */
  async generateFileLinks(
    files: string[],
    vaultPath: string
  ): Promise<string[]> {
    const links: string[] = [];

    for (const filePath of files) {
      const fileName = path.basename(filePath, '.md');
      const link = this.formatLink(fileName);
      links.push(link);
    }

    if (this.settings.sortLinks) {
      links.sort();
    }

    return links;
  }

  /**
   * Generate links for subdirectory MOCs
   */
  async generateSubdirectoryLinks(
    subdirs: DirectoryAnalysis[],
    vaultPath: string
  ): Promise<string[]> {
    const links: string[] = [];

    for (const subdir of subdirs) {
      if (subdir.shouldHaveMoc) {
        const mocPath = subdir.existingMocPath || subdir.mocPath;
        const mocExists = await this.fileExists(mocPath);

        // Include link if MOC exists or will be created
        if (mocExists || this.settings.autoCreateMocs) {
          const mocName = path.basename(mocPath, '.md');
          const link = this.formatLink(mocName);
          links.push(link);
        }
      }
    }

    if (this.settings.sortLinks) {
      links.sort();
    }

    return links;
  }

  /**
   * Group links by type or other criteria
   */
  private groupLinks(links: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {
      Notes: [],
    };

    // Simple grouping - could be enhanced with more sophisticated logic
    for (const link of links) {
      groups['Notes'].push(link);
    }

    return groups;
  }

  /**
   * Update bidirectional links between MOCs and notes
   */
  async updateBidirectionalLinks(
    analysis: DirectoryAnalysis,
    vaultPath: string,
    mocPath: string
  ): Promise<{ issues: Issue[]; fixes: Fix[] }> {
    const issues: Issue[] = [];
    const fixes: Fix[] = [];

    const mocName = path.basename(mocPath, '.md');
    const mocLink = this.formatLink(mocName);

    // Add links from notes to MOC
    for (const filePath of analysis.files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const hasLinkToMoc = this.hasLinkToTarget(content, mocName);

        if (!hasLinkToMoc) {
          // Add link to MOC at the top of the file
          const updatedContent = `${mocLink}\n\n${content}`;

          // Actually write the file
          await fs.writeFile(filePath, updatedContent, 'utf-8');

          fixes.push({
            ruleId: 'moc-generator',
            file: filePath,
            description: `Added link to MOC: ${mocName}`,
            changes: [
              {
                type: 'replace',
                oldText: content,
                newText: updatedContent,
              },
            ],
          });
        }
      } catch (error) {
        issues.push({
          ruleId: 'moc-generator',
          severity: 'warning',
          message: `Could not update bidirectional link for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          fixable: false,
        });
      }
    }

    return { issues, fixes };
  }

  /**
   * Load MOC template
   */
  async loadTemplate(vaultPath: string): Promise<MocTemplate> {
    const defaultTemplate = `# {{title}}

## Overview

This is a Map of Content for the {{directory}} directory.

{{links}}
`;

    if (!this.settings.templatePath) {
      return {
        content: defaultTemplate,
        variables: {},
        generatedSections: ['links'],
      };
    }

    try {
      const templatePath = path.isAbsolute(this.settings.templatePath)
        ? this.settings.templatePath
        : path.join(vaultPath, this.settings.templatePath);
      const templateContent = await fs.readFile(templatePath, 'utf-8');

      // Parse template for variables and sections
      const variables: Record<string, string> = {};
      const generatedSections: string[] = [];

      // Extract variables from template (simple implementation)
      const variableMatches = templateContent.match(/\{\{(\w+)\}\}/g);
      if (variableMatches) {
        for (const match of variableMatches) {
          const varName = match.slice(2, -2);
          if (!variables[varName]) {
            variables[varName] = '';
          }
          if (varName === 'links') {
            generatedSections.push('links');
          }
        }
      }

      return {
        content: templateContent,
        variables,
        generatedSections,
      };
    } catch (error) {
      console.warn(
        `Could not load template from ${this.settings.templatePath}, using default:`,
        error
      );
      return {
        content: defaultTemplate,
        variables: {},
        generatedSections: ['links'],
      };
    }
  }

  /**
   * Get MOC path for a directory
   */
  private getMocPath(relativePath: string, vaultPath: string): string {
    const directoryName = path.basename(relativePath) || 'Root';
    const mocName = `${directoryName}${this.settings.mocSuffix}.md`;

    if (
      this.settings.parallelStructure &&
      this.settings.parallelStructurePath
    ) {
      // Create parallel structure
      const parallelPath = path.join(
        vaultPath,
        this.settings.parallelStructurePath,
        relativePath,
        mocName
      );
      return parallelPath;
    } else {
      // Use centralized MOC directory
      return path.join(vaultPath, this.settings.mocDirectory, mocName);
    }
  }

  /**
   * Find existing MOC file for a directory
   */
  async findExistingMoc(
    directoryPath: string,
    directoryName: string
  ): Promise<string | undefined> {
    const possibleNames = [
      `${directoryName}${this.settings.mocSuffix}.md`,
      `${directoryName} MOC.md`,
      `${directoryName}_MOC.md`,
      'MOC.md',
      'index.md',
    ];

    // Check in the directory itself
    for (const name of possibleNames) {
      const filePath = path.join(directoryPath, name);
      if (await this.fileExists(filePath)) {
        return filePath;
      }
    }

    // Check in MOC directory
    const mocDir = path.join(
      path.dirname(directoryPath),
      this.settings.mocDirectory
    );
    for (const name of possibleNames) {
      const filePath = path.join(mocDir, name);
      if (await this.fileExists(filePath)) {
        return filePath;
      }
    }

    return undefined;
  }

  /**
   * Check if a file name represents a MOC file
   */
  private isMocFile(fileName: string): boolean {
    const nameWithoutExt = path.basename(fileName, '.md');
    return (
      nameWithoutExt.endsWith(this.settings.mocSuffix) ||
      nameWithoutExt.endsWith(' MOC') ||
      nameWithoutExt.endsWith('_MOC') ||
      nameWithoutExt === 'MOC' ||
      nameWithoutExt === 'index'
    );
  }

  /**
   * Check if a directory should be excluded
   */
  private isExcludedDirectory(dirName: string): boolean {
    return (
      this.settings.excludeDirectories.includes(dirName) ||
      dirName.startsWith('.')
    );
  }

  /**
   * Format a link according to settings
   */
  private formatLink(target: string): string {
    if (this.settings.linkFormat === 'wikilink') {
      return `[[${target}]]`;
    } else {
      return `[${target}](${target}.md)`;
    }
  }

  /**
   * Check if content has a link to target
   */
  private hasLinkToTarget(content: string, target: string): boolean {
    // Check for wikilink
    const wikilinkRegex = new RegExp(
      `\\[\\[${this.escapeRegex(target)}(?:\\|[^\\]]+)?\\]\\]`
    );
    if (wikilinkRegex.test(content)) {
      return true;
    }

    // Check for markdown link
    const markdownLinkRegex = new RegExp(
      `\\[([^\\]]+)\\]\\([^)]*${this.escapeRegex(target)}[^)]*\\)`
    );
    if (markdownLinkRegex.test(content)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<MocGeneratorSettings>): void {
    this.settings = this.mergeWithDefaults({
      ...this.settings,
      ...newSettings,
    });
  }

  /**
   * Get current settings
   */
  getSettings(): MocGeneratorSettings {
    return { ...this.settings };
  }
}
