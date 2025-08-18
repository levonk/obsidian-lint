/**
 * Integration tests for MOC Generation System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { LintEngine } from '../../src/core/engine.js';
import type { MocGeneratorSettings } from '../../src/core/moc-generator.js';

describe('MOC Generation Integration', () => {
  let tempDir: string;
  let vaultPath: string;
  let engine: LintEngine;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'obsidian-lint-moc-integration-')
    );
    vaultPath = tempDir;
    engine = new LintEngine();

    // Create comprehensive test vault structure
    await createComprehensiveVaultStructure(vaultPath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createComprehensiveVaultStructure(vaultPath: string) {
    // Create main directories
    await fs.mkdir(path.join(vaultPath, 'Projects'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'Research'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'Research', 'AI'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'Research', 'Blockchain'), {
      recursive: true,
    });
    await fs.mkdir(path.join(vaultPath, 'Personal'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'Personal', 'Health'), {
      recursive: true,
    });
    await fs.mkdir(path.join(vaultPath, 'Archive'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'Templates'), { recursive: true });
    await fs.mkdir(path.join(vaultPath, 'MOCs'), { recursive: true });

    // Create project files
    await fs.writeFile(
      path.join(vaultPath, 'Projects', 'project-alpha.md'),
      '# Project Alpha\n\nA revolutionary new project.\n\n## Goals\n- Achieve excellence\n- Deliver value'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Projects', 'project-beta.md'),
      '# Project Beta\n\nSecond major project.\n\n## Status\nIn progress'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Projects', 'project-gamma.md'),
      '# Project Gamma\n\nThird project in the pipeline.\n\n## Priority\nHigh'
    );

    // Create research files
    await fs.writeFile(
      path.join(vaultPath, 'Research', 'methodology.md'),
      '# Research Methodology\n\nOur approach to research.\n\n## Principles\n- Evidence-based\n- Systematic'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Research', 'literature-review.md'),
      '# Literature Review\n\nKey findings from literature.\n\n## Sources\n- Academic papers\n- Industry reports'
    );

    // Create AI research files
    await fs.writeFile(
      path.join(vaultPath, 'Research', 'AI', 'machine-learning.md'),
      '# Machine Learning\n\nML research and findings.\n\n## Algorithms\n- Neural networks\n- Decision trees'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Research', 'AI', 'natural-language-processing.md'),
      '# Natural Language Processing\n\nNLP research notes.\n\n## Techniques\n- Tokenization\n- Sentiment analysis'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Research', 'AI', 'computer-vision.md'),
      '# Computer Vision\n\nCV research and applications.\n\n## Applications\n- Image recognition\n- Object detection'
    );

    // Create blockchain research files
    await fs.writeFile(
      path.join(vaultPath, 'Research', 'Blockchain', 'consensus-mechanisms.md'),
      '# Consensus Mechanisms\n\nDifferent blockchain consensus approaches.\n\n## Types\n- Proof of Work\n- Proof of Stake'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Research', 'Blockchain', 'smart-contracts.md'),
      '# Smart Contracts\n\nSelf-executing contracts.\n\n## Platforms\n- Ethereum\n- Solana'
    );

    // Create personal files
    await fs.writeFile(
      path.join(vaultPath, 'Personal', 'goals-2024.md'),
      '# Goals 2024\n\nPersonal goals for the year.\n\n## Categories\n- Career\n- Health\n- Learning'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Personal', 'reading-list.md'),
      '# Reading List\n\nBooks to read.\n\n## Fiction\n- Novel A\n- Novel B'
    );

    // Create health files
    await fs.writeFile(
      path.join(vaultPath, 'Personal', 'Health', 'exercise-routine.md'),
      '# Exercise Routine\n\nDaily exercise plan.\n\n## Schedule\n- Monday: Cardio\n- Tuesday: Strength'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Personal', 'Health', 'nutrition-plan.md'),
      '# Nutrition Plan\n\nHealthy eating guidelines.\n\n## Meals\n- Breakfast\n- Lunch\n- Dinner'
    );

    // Create single file in archive (should not get MOC)
    await fs.writeFile(
      path.join(vaultPath, 'Archive', 'old-project.md'),
      '# Old Project\n\nArchived project notes.'
    );

    // Create template files (should be excluded)
    await fs.writeFile(
      path.join(vaultPath, 'Templates', 'project-template.md'),
      '# {{title}}\n\nTemplate for new projects.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'Templates', 'meeting-template.md'),
      '# Meeting: {{date}}\n\nTemplate for meeting notes.'
    );

    // Create existing MOC
    await fs.writeFile(
      path.join(vaultPath, 'MOCs', 'Projects MOC.md'),
      '# Projects MOC\n\n## Overview\n\nMap of all project-related content.\n\n## Contents\n\n- [[project-alpha]]\n- [[project-beta]]'
    );

    // Create custom template
    await fs.writeFile(
      path.join(vaultPath, 'moc-template.md'),
      '# {{title}}\n\n> **Directory:** {{directory}}  \n> **Files:** {{fileCount}}  \n> **Last Updated:** {{date}}\n\n## Overview\n\nThis MOC organizes content in the {{directory}} directory.\n\n## Contents\n\n{{links}}\n\n---\n*This MOC was automatically generated.*'
    );
  }

  describe('Full Vault MOC Generation', () => {
    it('should generate MOCs for entire vault structure', async () => {
      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
        autoCreateMocs: true,
        bidirectionalLinking: true,
        excludeDirectories: ['.git', '.obsidian', 'Templates', 'Archive'],
      };

      const result = await engine.generateMocs(vaultPath, settings);

      // Should create MOCs for directories with enough files
      expect(result.created.length).toBeGreaterThan(0);
      expect(result.updated.length).toBeGreaterThan(0); // Should update existing Projects MOC

      // Verify specific MOCs were created
      const expectedMocs = [
        'Research MOC.md',
        'AI MOC.md',
        'Blockchain MOC.md',
        'Personal MOC.md',
        'Health MOC.md',
      ];

      for (const mocName of expectedMocs) {
        const mocPath = path.join(vaultPath, 'MOCs', mocName);
        expect(await fileExists(mocPath)).toBe(true);
      }

      // Verify MOC content
      const researchMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'Research MOC.md'),
        'utf-8'
      );
      expect(researchMocContent).toContain('# Research MOC');
      expect(researchMocContent).toContain('[[methodology]]');
      expect(researchMocContent).toContain('[[literature-review]]');
      expect(researchMocContent).toContain('[[AI MOC]]'); // Should link to subdirectory MOC

      // Verify AI MOC content
      const aiMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'AI MOC.md'),
        'utf-8'
      );
      expect(aiMocContent).toContain('# AI MOC');
      expect(aiMocContent).toContain('[[machine-learning]]');
      expect(aiMocContent).toContain('[[natural-language-processing]]');
      expect(aiMocContent).toContain('[[computer-vision]]');

      // Verify existing MOC was updated
      const projectsMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'Projects MOC.md'),
        'utf-8'
      );
      expect(projectsMocContent).toContain('[[project-gamma]]'); // Should add missing link

      // Should not create MOC for Archive (only 1 file)
      expect(
        await fileExists(path.join(vaultPath, 'MOCs', 'Archive MOC.md'))
      ).toBe(false);

      // Should not create MOC for Templates (excluded)
      expect(
        await fileExists(path.join(vaultPath, 'MOCs', 'Templates MOC.md'))
      ).toBe(false);
    });

    it('should handle bidirectional linking correctly', async () => {
      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
        bidirectionalLinking: true,
        excludeDirectories: ['Templates', 'Archive'],
      };

      const result = await engine.generateMocs(vaultPath, settings);

      // Check that notes now link to their MOCs
      const projectAlphaContent = await fs.readFile(
        path.join(vaultPath, 'Projects', 'project-alpha.md'),
        'utf-8'
      );
      expect(projectAlphaContent).toContain('[[Projects MOC]]');

      const mlContent = await fs.readFile(
        path.join(vaultPath, 'Research', 'AI', 'machine-learning.md'),
        'utf-8'
      );
      expect(mlContent).toContain('[[AI MOC]]');

      const methodologyContent = await fs.readFile(
        path.join(vaultPath, 'Research', 'methodology.md'),
        'utf-8'
      );
      expect(methodologyContent).toContain('[[Research MOC]]');
    });

    it('should use custom template when provided', async () => {
      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        templatePath: 'moc-template.md',
        minFilesForMoc: 2,
        excludeDirectories: ['Templates', 'Archive'],
      };

      const result = await engine.generateMocs(vaultPath, settings);

      const aiMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'AI MOC.md'),
        'utf-8'
      );

      expect(aiMocContent).toContain('> **Directory:** AI');
      expect(aiMocContent).toContain('> **Files:** 3');
      expect(aiMocContent).toContain(
        'This MOC organizes content in the AI directory'
      );
      expect(aiMocContent).toContain('*This MOC was automatically generated.*');
    });
  });

  describe('Parallel Structure Generation', () => {
    it('should create parallel MOC structure when enabled', async () => {
      const settings: Partial<MocGeneratorSettings> = {
        parallelStructure: true,
        parallelStructurePath: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
        excludeDirectories: ['Templates', 'Archive'],
      };

      const result = await engine.generateMocs(vaultPath, settings);

      // Check that MOCs are created in parallel structure
      const expectedPaths = [
        path.join(vaultPath, 'MOCs', 'Projects', 'Projects MOC.md'),
        path.join(vaultPath, 'MOCs', 'Research', 'Research MOC.md'),
        path.join(vaultPath, 'MOCs', 'Research', 'AI', 'AI MOC.md'),
        path.join(
          vaultPath,
          'MOCs',
          'Research',
          'Blockchain',
          'Blockchain MOC.md'
        ),
        path.join(vaultPath, 'MOCs', 'Personal', 'Personal MOC.md'),
        path.join(vaultPath, 'MOCs', 'Personal', 'Health', 'Health MOC.md'),
      ];

      for (const mocPath of expectedPaths) {
        expect(await fileExists(mocPath)).toBe(true);
      }

      // Verify content is correct
      const aiMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'Research', 'AI', 'AI MOC.md'),
        'utf-8'
      );
      expect(aiMocContent).toContain('# AI MOC');
      expect(aiMocContent).toContain('[[machine-learning]]');
    });
  });

  describe('Content Preservation', () => {
    it('should preserve manual content when updating existing MOCs', async () => {
      // Create MOC with manual content
      const mocPath = path.join(vaultPath, 'MOCs', 'Research MOC.md');
      const manualContent = `# Research MOC

## Overview

This is my custom overview that should be preserved.

## Important Notes

These are my personal notes that should not be touched.

## Contents

<!-- MOC_GENERATED --> START
- [[old-link]]
<!-- MOC_GENERATED --> END

## References

Manual references section.`;

      await fs.writeFile(mocPath, manualContent);

      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        preserveManualContent: true,
        generatedSectionMarker: '<!-- MOC_GENERATED -->',
        minFilesForMoc: 2,
        excludeDirectories: ['Templates', 'Archive'],
      };

      const result = await engine.generateMocs(vaultPath, settings);

      const updatedContent = await fs.readFile(mocPath, 'utf-8');

      // Manual content should be preserved
      expect(updatedContent).toContain(
        'This is my custom overview that should be preserved'
      );
      expect(updatedContent).toContain(
        'These are my personal notes that should not be touched'
      );
      expect(updatedContent).toContain('Manual references section');

      // Generated content should be updated
      expect(updatedContent).toContain('[[methodology]]');
      expect(updatedContent).toContain('[[literature-review]]');
      expect(updatedContent).not.toContain('[[old-link]]');
    });
  });

  describe('Link Format Options', () => {
    it('should generate markdown links when configured', async () => {
      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        linkFormat: 'markdown',
        minFilesForMoc: 2,
        excludeDirectories: ['Templates', 'Archive'],
      };

      const result = await engine.generateMocs(vaultPath, settings);

      const aiMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'AI MOC.md'),
        'utf-8'
      );

      expect(aiMocContent).toContain('[machine-learning](machine-learning.md)');
      expect(aiMocContent).toContain(
        '[natural-language-processing](natural-language-processing.md)'
      );
      expect(aiMocContent).toContain('[computer-vision](computer-vision.md)');
    });

    it('should sort links when enabled', async () => {
      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        sortLinks: true,
        minFilesForMoc: 2,
        excludeDirectories: ['Templates', 'Archive'],
      };

      const result = await engine.generateMocs(vaultPath, settings);

      const aiMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'AI MOC.md'),
        'utf-8'
      );

      // Links should appear in alphabetical order
      const linkMatches = aiMocContent.match(/- \[\[[^\]]+\]\]/g);
      expect(linkMatches).toEqual([
        '- [[computer-vision]]',
        '- [[machine-learning]]',
        '- [[natural-language-processing]]',
      ]);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing template gracefully', async () => {
      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        templatePath: 'non-existent-template.md',
        minFilesForMoc: 2,
        excludeDirectories: ['Templates', 'Archive'],
      };

      const result = await engine.generateMocs(vaultPath, settings);

      // Should still create MOCs with default template
      expect(result.created.length).toBeGreaterThan(0);
      expect(result.issues.length).toBe(0); // Should not report template missing as error

      const aiMocContent = await fs.readFile(
        path.join(vaultPath, 'MOCs', 'AI MOC.md'),
        'utf-8'
      );
      expect(aiMocContent).toContain('# AI MOC'); // Should use default template
    });

    it('should handle directories with mixed content correctly', async () => {
      // Create directory with both markdown and non-markdown files
      await fs.mkdir(path.join(vaultPath, 'Mixed'), { recursive: true });
      await fs.writeFile(path.join(vaultPath, 'Mixed', 'note1.md'), '# Note 1');
      await fs.writeFile(path.join(vaultPath, 'Mixed', 'note2.md'), '# Note 2');
      await fs.writeFile(
        path.join(vaultPath, 'Mixed', 'image.png'),
        'fake image data'
      );
      await fs.writeFile(
        path.join(vaultPath, 'Mixed', 'document.pdf'),
        'fake pdf data'
      );

      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
      };

      const result = await engine.generateMocs(vaultPath, settings);

      const mixedMocPath = path.join(vaultPath, 'MOCs', 'Mixed MOC.md');
      expect(await fileExists(mixedMocPath)).toBe(true);

      const mixedMocContent = await fs.readFile(mixedMocPath, 'utf-8');
      expect(mixedMocContent).toContain('[[note1]]');
      expect(mixedMocContent).toContain('[[note2]]');
      // Should not include non-markdown files
      expect(mixedMocContent).not.toContain('image.png');
      expect(mixedMocContent).not.toContain('document.pdf');
    });
  });

  describe('Analysis Only Mode', () => {
    it('should analyze structure without creating MOCs', async () => {
      const settings: Partial<MocGeneratorSettings> = {
        mocDirectory: 'MOCs',
        mocSuffix: ' MOC',
        minFilesForMoc: 2,
        autoCreateMocs: false, // Analysis only
        excludeDirectories: ['Templates', 'Archive'],
      };

      const analysis = await engine.analyzeMocStructure(vaultPath, settings);

      // Should analyze structure correctly
      expect(analysis.subdirectories.length).toBeGreaterThan(0);

      const projectsDir = analysis.subdirectories.find(
        d => path.basename(d.path) === 'Projects'
      );
      expect(projectsDir).toBeDefined();
      expect(projectsDir!.shouldHaveMoc).toBe(true);
      expect(projectsDir!.files.length).toBe(3);

      // Should not have created any new MOCs
      const researchMocPath = path.join(vaultPath, 'MOCs', 'Research MOC.md');
      expect(await fileExists(researchMocPath)).toBe(false);
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
