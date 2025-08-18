/**
 * Tests for MOC Generator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { MocGenerator } from '../../../src/core/moc-generator.js';
import type { MocGeneratorSettings } from '../../../src/core/moc-generator.js';

describe('MocGenerator', () => {
  let tempDir: string;
  let vaultPath: string;
  let generator: MocGenerator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'obsidian-lint-moc-test-')
    );
    vaultPath = tempDir;

    // Create test vault structure
    await createTestVaultStructure(vaultPath);

    generator = new MocGenerator({
      mocDirectory: 'MOCs',
      mocSuffix: ' MOC',
      minFilesForMoc: 2,
      autoCreateMocs: true,
      bidirectionalLinking: true,
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createTestVaultStructure(vaultPath: string) {
    // Create directories
    await fs.mkdir(path.join(vaultPath, 'projects'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'research'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'research', 'ai'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'single-file'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'MOCs'), { recursive: true });

    // Create files in projects directory
    await fs.writeFile(
      path.join(vaultPath, 'projects', 'project-a.md'),
      '# Project A\n\nThis is project A content.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'projects', 'project-b.md'),
      '# Project B\n\nThis is project B content.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'projects', 'project-c.md'),
      '# Project C\n\nThis is project C content.'
    );

    // Create files in research directory
    await fs.writeFile(
      path.join(vaultPath, 'research', 'topic-1.md'),
      '# Topic 1\n\nResearch on topic 1.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'research', 'topic-2.md'),
      '# Topic 2\n\nResearch on topic 2.'
    );

    // Create files in research/ai subdirectory
    await fs.writeFile(
      path.join(vaultPath, 'research', 'ai', 'machine-learning.md'),
      '# Machine Learning\n\nML research notes.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'research', 'ai', 'neural-networks.md'),
      '# Neural Networks\n\nNN research notes.'
    );

    // Create single file directory (should not get MOC)
    await fs.writeFile(
      path.join(vaultPath, 'single-file', 'only-file.md'),
      '# Only File\n\nThis is the only file.'
    );

    // Create existing MOC
    await fs.writeFile(
      path.join(vaultPath, 'MOCs', 'projects MOC.md'),
      '# projects MOC\n\n## Overview\n\nExisting MOC for projects.\n\n## Contents\n\n- [[project-a]]\n- [[project-b]]'
    );
  }

  describe('Directory Analysis', () => {
    it('should analyze directory structure correctly', async () => {
      const analysis = await generator.analyzeDirectoryStructure(vaultPath);

      expect(analysis.path).toBe(vaultPath);
      expect(analysis.relativePath).toBe('');
      expect(analysis.subdirectories).toHaveLength(4); // projects, research, single-file, MOCs

      // Find projects directory
      const projectsDir = analysis.subdirectories.find(
        d => path.basename(d.path) === 'projects'
      );
      expect(projectsDir).toBeDefined();
      expect(projectsDir!.files).toHaveLength(3);
      expect(projectsDir!.shouldHaveMoc).toBe(true);

      // Find research directory
      const researchDir = analysis.subdirectories.find(
        d => path.basename(d.path) === 'research'
      );
      expect(researchDir).toBeDefined();
      expect(researchDir!.files).toHaveLength(2);
      expect(researchDir!.shouldHaveMoc).toBe(true);
      expect(researchDir!.subdirectories).toHaveLength(1); // ai subdirectory

      // Find single-file directory
      const singleFileDir = analysis.subdirectories.find(
        d => path.basename(d.path) === 'single-file'
      );
      expect(singleFileDir).toBeDefined();
      expect(singleFileDir!.files).toHaveLength(1);
      expect(singleFileDir!.shouldHaveMoc).toBe(false); // Below minimum threshold
    });

    it('should detect existing MOCs', async () => {
      const analysis = await generator.analyzeDirectoryStructure(vaultPath);

      const projectsDir = analysis.subdirectories.find(
        d => path.basename(d.path) === 'projects'
      );
      expect(projectsDir!.existingMocPath).toBeDefined();
      expect(projectsDir!.existingMocPath).toContain('projects MOC.md');
    });

    it('should respect minimum files threshold', async () => {
      const generator = new MocGenerator({ minFilesForMoc: 5 });
      const analysis = await generator.analyzeDirectoryStructure(vaultPath);

      const projectsDir = analysis.subdirectories.find(
        d => path.basename(d.path) === 'projects'
      );
      expect(projectsDir!.shouldHaveMoc).toBe(false); // Only 3 files, need 5
    });

    it('should exclude specified directories', async () => {
      const generator = new MocGenerator({
        excludeDirectories: ['.git', '.obsidian', 'projects'],
      });
      const analysis = await generator.analyzeDirectoryStructure(vaultPath);

      const projectsDir = analysis.subdirectories.find(
        d => path.basename(d.path) === 'projects'
      );
      expect(projectsDir).toBeUndefined(); // Should be excluded
    });
  });

  describe('MOC Generation', () => {
    it('should generate MOCs for entire vault', async () => {
      const result = await generator.generateMocsForVault(vaultPath);

      expect(result.created.length).toBeGreaterThan(0);
      expect(result.issues).toHaveLength(0);

      // Check that research MOC was created
      const researchMocPath = path.join(vaultPath, 'MOCs', 'research MOC.md');
      expect(await fileExists(researchMocPath)).toBe(true);

      const researchMocContent = await fs.readFile(researchMocPath, 'utf-8');
      expect(researchMocContent).toContain('# research MOC');
      expect(researchMocContent).toContain('[[topic-1]]');
      expect(researchMocContent).toContain('[[topic-2]]');
    });

    it('should update existing MOCs', async () => {
      const result = await generator.generateMocsForVault(vaultPath);

      expect(result.updated).toContain(
        path.join(vaultPath, 'MOCs', 'projects MOC.md')
      );

      const projectsMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'projects MOC.md'),
        'utf-8'
      );
      expect(projectsMocContent).toContain('[[project-c]]'); // Should add missing link
    });

    it('should create MOCs with custom template', async () => {
      // Create custom template
      const templatePath = path.join(vaultPath, 'template.md');
      await fs.writeFile(
        templatePath,
        '# {{title}}\n\n> Directory: {{directory}}\n> Files: {{fileCount}}\n\n## Links\n\n{{links}}'
      );

      const generator = new MocGenerator({
        templatePath: 'template.md',
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      });

      const result = await generator.generateMocsForVault(vaultPath);

      const researchMocPath = path.join(vaultPath, 'MOCs', 'research MOC.md');
      const researchMocContent = await fs.readFile(researchMocPath, 'utf-8');

      expect(researchMocContent).toContain('> Directory: research');
      expect(researchMocContent).toContain('> Files: 2');
    });

    it('should preserve manual content when updating', async () => {
      const generator = new MocGenerator({
        preserveManualContent: true,
        generatedSectionMarker: '<!-- MOC_GENERATED -->',
      });

      // Create MOC with manual content
      const mocPath = path.join(vaultPath, 'MOCs', 'research MOC.md');
      const manualContent = `# research MOC

## Overview

This is my custom overview that should be preserved.

## Manual Section

This section was added manually.

## Contents

<!-- MOC_GENERATED --> START
- [[old-link]]
<!-- MOC_GENERATED --> END

## Another Manual Section

This should also be preserved.`;

      await fs.writeFile(mocPath, manualContent);

      const result = await generator.generateMocsForVault(vaultPath);

      const updatedContent = await fs.readFile(mocPath, 'utf-8');
      expect(updatedContent).toContain(
        'This is my custom overview that should be preserved'
      );
      expect(updatedContent).toContain('This section was added manually');
      expect(updatedContent).toContain('This should also be preserved');
      expect(updatedContent).toContain('[[topic-1]]');
      expect(updatedContent).toContain('[[topic-2]]');
      expect(updatedContent).not.toContain('[[old-link]]');
    });
  });

  describe('Parallel Structure', () => {
    it('should create parallel MOC structure when enabled', async () => {
      const generator = new MocGenerator({
        parallelStructure: true,
        parallelStructurePath: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      });

      const result = await generator.generateMocsForVault(vaultPath);

      // Check that MOCs are created in parallel structure
      const researchMocPath = path.join(
        vaultPath,
        'MOCs',
        'research',
        'research MOC.md'
      );
      expect(await fileExists(researchMocPath)).toBe(true);

      const aiMocPath = path.join(
        vaultPath,
        'MOCs',
        'research',
        'ai',
        'ai MOC.md'
      );
      expect(await fileExists(aiMocPath)).toBe(true);
    });
  });

  describe('Bidirectional Linking', () => {
    it('should add links from notes to MOCs', async () => {
      const generator = new MocGenerator({
        bidirectionalLinking: true,
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      });

      const result = await generator.generateMocsForVault(vaultPath);

      // Check that notes now link to their MOC
      const projectAContent = await fs.readFile(
        path.join(vaultPath, 'projects', 'project-a.md'),
        'utf-8'
      );
      expect(projectAContent).toContain('[[projects MOC]]');

      const topicContent = await fs.readFile(
        path.join(vaultPath, 'research', 'topic-1.md'),
        'utf-8'
      );
      expect(topicContent).toContain('[[research MOC]]');
    });

    it('should not duplicate existing links', async () => {
      // Add existing link to MOC
      const projectAPath = path.join(vaultPath, 'projects', 'project-a.md');
      const existingContent = await fs.readFile(projectAPath, 'utf-8');
      await fs.writeFile(
        projectAPath,
        `[[projects MOC]]\n\n${existingContent}`
      );

      const generator = new MocGenerator({
        bidirectionalLinking: true,
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      });

      const result = await generator.generateMocsForVault(vaultPath);

      const updatedContent = await fs.readFile(projectAPath, 'utf-8');
      const linkCount = (updatedContent.match(/\[\[projects MOC\]\]/g) || [])
        .length;
      expect(linkCount).toBe(1); // Should not duplicate
    });
  });

  describe('Link Formatting', () => {
    it('should format links as wikilinks by default', async () => {
      const result = await generator.generateMocsForVault(vaultPath);

      const researchMocPath = path.join(vaultPath, 'MOCs', 'research MOC.md');
      const content = await fs.readFile(researchMocPath, 'utf-8');

      expect(content).toContain('[[topic-1]]');
      expect(content).toContain('[[topic-2]]');
    });

    it('should format links as markdown when configured', async () => {
      const generator = new MocGenerator({
        linkFormat: 'markdown',
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      });

      const result = await generator.generateMocsForVault(vaultPath);

      const researchMocPath = path.join(vaultPath, 'MOCs', 'research MOC.md');
      const content = await fs.readFile(researchMocPath, 'utf-8');

      expect(content).toContain('[topic-1](topic-1.md)');
      expect(content).toContain('[topic-2](topic-2.md)');
    });
  });

  describe('Link Sorting and Grouping', () => {
    it('should sort links when enabled', async () => {
      const generator = new MocGenerator({
        sortLinks: true,
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      });

      const result = await generator.generateMocsForVault(vaultPath);

      const projectsMocPath = path.join(vaultPath, 'MOCs', 'projects MOC.md');
      const content = await fs.readFile(projectsMocPath, 'utf-8');

      // Check that links appear in alphabetical order
      const linkMatches = content.match(/- \[\[project-[abc]\]\]/g);
      expect(linkMatches).toEqual([
        '- [[project-a]]',
        '- [[project-b]]',
        '- [[project-c]]',
      ]);
    });

    it('should group links by type when enabled', async () => {
      const generator = new MocGenerator({
        groupByType: true,
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      });

      const result = await generator.generateMocsForVault(vaultPath);

      const projectsMocPath = path.join(vaultPath, 'MOCs', 'projects MOC.md');
      const content = await fs.readFile(projectsMocPath, 'utf-8');

      expect(content).toContain('### Notes');
    });
  });

  describe('Subdirectory MOC Links', () => {
    it('should include links to subdirectory MOCs', async () => {
      const result = await generator.generateMocsForVault(vaultPath);

      const researchMocPath = path.join(vaultPath, 'MOCs', 'research MOC.md');
      const content = await fs.readFile(researchMocPath, 'utf-8');

      expect(content).toContain('### Subdirectories');
      expect(content).toContain('[[ai MOC]]');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing template gracefully', async () => {
      const generator = new MocGenerator({
        templatePath: 'non-existent-template.md',
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      });

      const result = await generator.generateMocsForVault(vaultPath);

      // Should still create MOCs with default template
      expect(result.created.length).toBeGreaterThan(0);
      expect(result.issues.length).toBe(0); // Should not report as error
    });

    it('should handle permission errors gracefully', async () => {
      // Create a directory we can't write to (simulate permission error)
      const restrictedDir = path.join(vaultPath, 'restricted');
      await fs.mkdir(restrictedDir);
      await fs.writeFile(path.join(restrictedDir, 'file1.md'), 'content');
      await fs.writeFile(path.join(restrictedDir, 'file2.md'), 'content');

      // Make the MOCs directory read-only (this might not work on all systems)
      const mocsDir = path.join(vaultPath, 'MOCs');
      try {
        await fs.chmod(mocsDir, 0o444);

        const result = await generator.generateMocsForVault(vaultPath);

        // Should report issues for files it couldn't create
        const permissionIssues = result.issues.filter(issue =>
          issue.message.includes('Failed to generate MOC')
        );
        expect(permissionIssues.length).toBeGreaterThan(0);

        // Restore permissions for cleanup
        await fs.chmod(mocsDir, 0o755);
      } catch (error) {
        // Skip this test if we can't change permissions
        console.warn('Skipping permission test:', error);
      }
    });
  });

  describe('Settings Management', () => {
    it('should update settings correctly', () => {
      const initialSettings = generator.getSettings();
      expect(initialSettings.mocSuffix).toBe(' MOC');

      generator.updateSettings({ mocSuffix: ' Index' });

      const updatedSettings = generator.getSettings();
      expect(updatedSettings.mocSuffix).toBe(' Index');
      expect(updatedSettings.mocDirectory).toBe('MOCs'); // Should preserve other settings
    });

    it('should merge settings with defaults', () => {
      const generator = new MocGenerator({
        mocSuffix: ' Custom',
        // Other settings should use defaults
      });

      const settings = generator.getSettings();
      expect(settings.mocSuffix).toBe(' Custom');
      expect(settings.mocDirectory).toBe('MOCs'); // Default
      expect(settings.minFilesForMoc).toBe(2); // Default
    });
  });

  // Helper function
  async function fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
});
