import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { LintEngine } from '../../src/core/engine.js';
import { Configuration } from '../../src/types/config.js';

describe('End-to-End Complete Workflows', () => {
  let tempDir: string;
  let engine: LintEngine;
  let testVaultPath: string;

  beforeEach(async () => {
    // Create temporary directory for test vault
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'obsidian-lint-e2e-'));
    testVaultPath = path.join(tempDir, 'test-vault');
    await fs.mkdir(testVaultPath, { recursive: true });

    // Initialize engine
    engine = new LintEngine();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Complete Vault Setup and Processing', () => {
    it('should process a new vault from scratch with default configuration', async () => {
      // Create a basic vault structure
      await createTestVault(testVaultPath, {
        notes: [
          { path: 'note1.md', content: '# Note 1\n\nSome content' },
          {
            path: 'note2.md',
            content: '# Note 2\n\nContent with [[note1]] link',
          },
          { path: 'folder/note3.md', content: '# Note 3\n\nNested note' },
        ],
        attachments: [{ path: 'image.png', content: 'fake-image-data' }],
      });

      // Create configuration
      const config = await createTestConfiguration(testVaultPath);

      // Process vault
      const result = await engine.processVault(testVaultPath, {
        dryRun: false,
        fix: true,
        verbose: true,
        parallel: false,
      });

      // Verify results
      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      // Verify frontmatter was added
      const note1Content = await fs.readFile(
        path.join(testVaultPath, 'note1.md'),
        'utf-8'
      );
      expect(note1Content).toContain('---');
      expect(note1Content).toContain('title:');
      expect(note1Content).toContain('date_created:');
    });

    it('should handle complex vault with multiple rule types', async () => {
      // Create complex vault
      await createComplexTestVault(testVaultPath);

      // Create comprehensive configuration
      const config = await createComprehensiveConfiguration(testVaultPath);

      // Process with all rules enabled
      const result = await engine.processVault(testVaultPath, {
        dryRun: false,
        fix: true,
        verbose: true,
        parallel: true,
        generateMoc: true,
      });

      // Verify comprehensive processing
      expect(result.filesProcessed).toBeGreaterThan(5);
      expect(result.fixesApplied.length).toBeGreaterThan(0);

      // Verify MOC generation
      const mocExists = await fs
        .access(path.join(testVaultPath, 'Meta/MOCs/index.md'))
        .then(() => true)
        .catch(() => false);
      expect(mocExists).toBe(true);

      // Verify attachment organization
      const attachmentDir = path.join(testVaultPath, 'Meta/Attachments');
      const attachmentExists = await fs
        .access(attachmentDir)
        .then(() => true)
        .catch(() => false);
      expect(attachmentExists).toBe(true);
    });

    it('should handle dry-run mode without making changes', async () => {
      // Create vault with issues
      await createTestVault(testVaultPath, {
        notes: [
          { path: 'bad-note.md', content: '# Bad Note\n\nNo frontmatter here' },
        ],
      });

      // Get initial file content
      const initialContent = await fs.readFile(
        path.join(testVaultPath, 'bad-note.md'),
        'utf-8'
      );

      // Process in dry-run mode
      const result = await engine.processVault(testVaultPath, {
        dryRun: true,
        fix: true,
        verbose: true,
      });

      // Verify issues were found but no changes made
      expect(result.issuesFound.length).toBeGreaterThan(0);
      expect(result.fixesApplied).toHaveLength(0);

      // Verify file content unchanged
      const finalContent = await fs.readFile(
        path.join(testVaultPath, 'bad-note.md'),
        'utf-8'
      );
      expect(finalContent).toBe(initialContent);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle corrupted files gracefully', async () => {
      // Create vault with corrupted markdown
      await createTestVault(testVaultPath, {
        notes: [
          {
            path: 'good-note.md',
            content: '---\ntitle: Good Note\n---\n\n# Good Note',
          },
          {
            path: 'corrupted.md',
            content:
              '---\ntitle: Corrupted\nbroken-yaml: [unclosed array\n---\n\n# Corrupted',
          },
          {
            path: 'another-good.md',
            content: '---\ntitle: Another Good\n---\n\n# Another Good',
          },
        ],
      });

      const result = await engine.processVault(testVaultPath, {
        dryRun: false,
        fix: true,
        verbose: true,
      });

      // Should process good files despite corrupted one
      expect(result.filesProcessed).toBeGreaterThanOrEqual(2);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('corrupted.md'))).toBe(
        true
      );
    });

    it('should handle permission errors gracefully', async () => {
      // Create vault
      await createTestVault(testVaultPath, {
        notes: [{ path: 'note.md', content: '# Note\n\nContent' }],
      });

      // Make file read-only (simulate permission error)
      const notePath = path.join(testVaultPath, 'note.md');
      await fs.chmod(notePath, 0o444);

      const result = await engine.processVault(testVaultPath, {
        dryRun: false,
        fix: true,
        verbose: true,
      });

      // Should handle permission error gracefully
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some(
          e => e.message.includes('permission') || e.message.includes('EACCES')
        )
      ).toBe(true);

      // Restore permissions for cleanup
      await fs.chmod(notePath, 0o644);
    });
  });

  describe('Profile and Configuration Workflows', () => {
    it('should switch between profiles correctly', async () => {
      // Create vault
      await createTestVault(testVaultPath, {
        notes: [{ path: 'note.md', content: '# Note\n\nContent' }],
      });

      // Create multiple profiles
      await createMultipleProfiles(testVaultPath);

      // Process with strict profile
      const strictResult = await engine.processVault(testVaultPath, {
        dryRun: true,
        fix: false,
        profile: 'strict',
      });

      // Process with minimal profile
      const minimalResult = await engine.processVault(testVaultPath, {
        dryRun: true,
        fix: false,
        profile: 'minimal',
      });

      // Strict should find more issues than minimal
      expect(strictResult.issuesFound.length).toBeGreaterThan(
        minimalResult.issuesFound.length
      );
    });

    it('should handle configuration validation workflow', async () => {
      // Create vault with invalid configuration
      await createTestVault(testVaultPath, {
        notes: [{ path: 'note.md', content: '# Note\n\nContent' }],
      });

      const configDir = path.join(testVaultPath, '.config/obsidian-lint');
      await fs.mkdir(configDir, { recursive: true });

      // Create invalid config
      const invalidConfig = `
[general]
vault_root = "${testVaultPath}"
invalid_field = "should cause error"

[profiles]
active = "nonexistent"
`;

      await fs.writeFile(
        path.join(configDir, 'obsidian-lint.toml'),
        invalidConfig
      );

      // Should handle invalid configuration gracefully
      try {
        await engine.loadConfiguration(
          path.join(configDir, 'obsidian-lint.toml')
        );
        expect.fail('Should have thrown configuration error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('configuration');
      }
    });

    it('should handle rule conflict detection workflow', async () => {
      // Create vault with conflicting rules
      await createTestVault(testVaultPath, {
        notes: [{ path: 'note.md', content: '# Note\n\nContent' }],
      });

      await createConflictingRulesConfiguration(testVaultPath);

      // Should detect and report rule conflicts
      try {
        await engine.processVault(testVaultPath, {
          dryRun: true,
          fix: false,
        });
        expect.fail('Should have detected rule conflicts');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('conflict');
      }
    });
  });

  describe('CLI Integration Workflows', () => {
    it('should handle complete CLI workflow with JSON output', async () => {
      // Create vault
      await createTestVault(testVaultPath, {
        notes: [
          {
            path: 'note1.md',
            content: '# Note 1\n\nContent without frontmatter',
          },
          {
            path: 'note2.md',
            content: '---\ntitle: Note 2\n---\n\n# Note 2\n\nProper note',
          },
        ],
      });

      await createTestConfiguration(testVaultPath);

      // Process with JSON output
      const result = await engine.processVault(testVaultPath, {
        dryRun: true,
        fix: false,
        verbose: false,
        outputFormat: 'json',
      });

      // Verify JSON structure
      expect(result).toHaveProperty('filesProcessed');
      expect(result).toHaveProperty('issuesFound');
      expect(result).toHaveProperty('fixesApplied');
      expect(result).toHaveProperty('duration');
      expect(Array.isArray(result.issuesFound)).toBe(true);
      expect(Array.isArray(result.fixesApplied)).toBe(true);
    });

    it('should handle incremental processing workflow', async () => {
      // Create vault
      await createTestVault(testVaultPath, {
        notes: [
          { path: 'old-note.md', content: '# Old Note\n\nOld content' },
          { path: 'new-note.md', content: '# New Note\n\nNew content' },
        ],
      });

      await createTestConfiguration(testVaultPath);

      // First full processing
      const firstResult = await engine.processVault(testVaultPath, {
        dryRun: false,
        fix: true,
      });

      // Modify one file
      await fs.writeFile(
        path.join(testVaultPath, 'modified-note.md'),
        '# Modified Note\n\nModified content'
      );

      // Second processing should only process changed files
      const secondResult = await engine.processVault(testVaultPath, {
        dryRun: false,
        fix: true,
        incremental: true,
      });

      expect(secondResult.filesProcessed).toBeLessThan(
        firstResult.filesProcessed
      );
    });
  });

  // Helper functions
  async function createTestVault(
    vaultPath: string,
    structure: {
      notes: Array<{ path: string; content: string }>;
      attachments?: Array<{ path: string; content: string }>;
    }
  ) {
    // Create notes
    for (const note of structure.notes) {
      const notePath = path.join(vaultPath, note.path);
      await fs.mkdir(path.dirname(notePath), { recursive: true });
      await fs.writeFile(notePath, note.content);
    }

    // Create attachments
    if (structure.attachments) {
      for (const attachment of structure.attachments) {
        const attachmentPath = path.join(vaultPath, attachment.path);
        await fs.mkdir(path.dirname(attachmentPath), { recursive: true });
        await fs.writeFile(attachmentPath, attachment.content);
      }
    }
  }

  async function createComplexTestVault(vaultPath: string) {
    const structure = {
      notes: [
        {
          path: 'Daily/2024-01-01.md',
          content: '# Daily Note\n\nDaily content',
        },
        {
          path: 'Projects/project-a.md',
          content: '# Project A\n\nProject content with [[Daily/2024-01-01]]',
        },
        { path: 'Areas/work.md', content: '# Work\n\nWork area content' },
        {
          path: 'Resources/article.md',
          content: '# Article\n\nResource content',
        },
        {
          path: 'Archive/old-note.md',
          content: '# Old Note\n\nArchived content',
        },
        {
          path: 'Templates/daily-template.md',
          content: '# {{title}}\n\nTemplate content',
        },
      ],
      attachments: [
        { path: 'image1.png', content: 'fake-image-1' },
        { path: 'Projects/diagram.svg', content: 'fake-svg' },
        { path: 'document.pdf', content: 'fake-pdf' },
      ],
    };

    await createTestVault(vaultPath, structure);
  }

  async function createTestConfiguration(
    vaultPath: string
  ): Promise<Configuration> {
    const configDir = path.join(vaultPath, '.config/obsidian-lint');
    await fs.mkdir(configDir, { recursive: true });

    const config = `
[general]
vault_root = "${vaultPath.replace(/\\/g, '\\\\')}"
dry_run = false
verbose = true
fix = true

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Standard rules"
rules_path = "rules/default"
`;

    await fs.writeFile(path.join(configDir, 'obsidian-lint.toml'), config);

    // Create basic rule
    const rulesDir = path.join(configDir, 'rules/default/enabled');
    await fs.mkdir(rulesDir, { recursive: true });

    const rule = `
[rule]
id = "frontmatter-required-fields.minimal"
name = "Minimal Frontmatter"
description = "Ensure basic frontmatter fields"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = ["Templates/**"]

[settings]
required_fields = ["title", "date_created"]
`;

    await fs.writeFile(path.join(rulesDir, 'frontmatter-minimal.toml'), rule);

    return engine.loadConfiguration(path.join(configDir, 'obsidian-lint.toml'));
  }

  async function createComprehensiveConfiguration(vaultPath: string) {
    const configDir = path.join(vaultPath, '.config/obsidian-lint');
    await fs.mkdir(configDir, { recursive: true });

    const config = `
[general]
vault_root = "${vaultPath.replace(/\\/g, '\\\\')}"
dry_run = false
verbose = true
fix = true
parallel = true

[profiles]
active = "comprehensive"

[profiles.comprehensive]
name = "Comprehensive Profile"
description = "All rules enabled"
rules_path = "rules/comprehensive"
`;

    await fs.writeFile(path.join(configDir, 'obsidian-lint.toml'), config);

    // Create comprehensive rules
    const rulesDir = path.join(configDir, 'rules/comprehensive/enabled');
    await fs.mkdir(rulesDir, { recursive: true });

    const rules = [
      {
        file: 'frontmatter-strict.toml',
        content: `
[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter"
description = "Comprehensive frontmatter validation"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = ["Templates/**"]

[settings]
required_fields = ["title", "aliases", "tags", "status", "date_created", "date_updated"]
`,
      },
      {
        file: 'attachment-centralized.toml',
        content: `
[rule]
id = "attachment-organization.centralized"
name = "Centralized Attachments"
description = "Move attachments to Meta/Attachments"
category = "attachment"

[config]
path_allowlist = ["**/*"]

[settings]
attachment_directory = "Meta/Attachments"
create_subdirectories = true
`,
      },
    ];

    for (const rule of rules) {
      await fs.writeFile(path.join(rulesDir, rule.file), rule.content);
    }
  }

  async function createMultipleProfiles(vaultPath: string) {
    const configDir = path.join(vaultPath, '.config/obsidian-lint');
    await fs.mkdir(configDir, { recursive: true });

    const config = `
[general]
vault_root = "${vaultPath.replace(/\\/g, '\\\\')}"

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
rules_path = "rules/default"

[profiles.strict]
name = "Strict Profile"
rules_path = "rules/strict"

[profiles.minimal]
name = "Minimal Profile"
rules_path = "rules/minimal"
`;

    await fs.writeFile(path.join(configDir, 'obsidian-lint.toml'), config);

    // Create strict profile rules
    const strictDir = path.join(configDir, 'rules/strict/enabled');
    await fs.mkdir(strictDir, { recursive: true });
    await fs.writeFile(
      path.join(strictDir, 'frontmatter-strict.toml'),
      `
[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter"
category = "frontmatter"

[settings]
required_fields = ["title", "aliases", "tags", "status", "date_created", "date_updated"]
`
    );

    // Create minimal profile rules
    const minimalDir = path.join(configDir, 'rules/minimal/enabled');
    await fs.mkdir(minimalDir, { recursive: true });
    await fs.writeFile(
      path.join(minimalDir, 'frontmatter-minimal.toml'),
      `
[rule]
id = "frontmatter-required-fields.minimal"
name = "Minimal Frontmatter"
category = "frontmatter"

[settings]
required_fields = ["title"]
`
    );
  }

  async function createConflictingRulesConfiguration(vaultPath: string) {
    const configDir = path.join(vaultPath, '.config/obsidian-lint');
    await fs.mkdir(configDir, { recursive: true });

    const config = `
[general]
vault_root = "${vaultPath.replace(/\\/g, '\\\\')}"

[profiles]
active = "conflicting"

[profiles.conflicting]
name = "Conflicting Profile"
rules_path = "rules/conflicting"
`;

    await fs.writeFile(path.join(configDir, 'obsidian-lint.toml'), config);

    // Create conflicting rules (same major ID)
    const rulesDir = path.join(configDir, 'rules/conflicting/enabled');
    await fs.mkdir(rulesDir, { recursive: true });

    // Two rules with same major ID - should conflict
    await fs.writeFile(
      path.join(rulesDir, 'frontmatter-strict.toml'),
      `
[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter"
category = "frontmatter"

[settings]
required_fields = ["title", "aliases", "tags", "status", "date_created", "date_updated"]
`
    );

    await fs.writeFile(
      path.join(rulesDir, 'frontmatter-minimal.toml'),
      `
[rule]
id = "frontmatter-required-fields.minimal"
name = "Minimal Frontmatter"
category = "frontmatter"

[settings]
required_fields = ["title"]
`
    );
  }
});
