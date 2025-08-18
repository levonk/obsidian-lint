/**
 * Integration tests for linking rules
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { LintEngine } from '../../src/core/engine.js';
import { MarkdownParser } from '../../src/utils/markdown.js';
import type { Configuration } from '../../src/types/config.js';

// Mock fetch for external URL testing
global.fetch = vi.fn();

describe('Linking Rules Integration', () => {
  let tempDir: string;
  let vaultPath: string;
  let engine: LintEngine;
  let parser: MarkdownParser;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-lint-test-'));
    vaultPath = tempDir;
    engine = new LintEngine();
    parser = new MarkdownParser();

    // Create test vault structure
    await fs.mkdir(path.join(vaultPath, '.config'));
    await fs.mkdir(path.join(vaultPath, '.config', 'obsidian-lint'));
    await fs.mkdir(path.join(vaultPath, '.config', 'obsidian-lint', 'rules'));
    await fs.mkdir(
      path.join(vaultPath, '.config', 'obsidian-lint', 'rules', 'default')
    );
    await fs.mkdir(
      path.join(
        vaultPath,
        '.config',
        'obsidian-lint',
        'rules',
        'default',
        'enabled'
      )
    );
    await fs.mkdir(
      path.join(
        vaultPath,
        '.config',
        'obsidian-lint',
        'rules',
        'default',
        'enabled',
        'linking'
      )
    );

    // Create test notes
    await fs.writeFile(
      path.join(vaultPath, 'existing-note.md'),
      '# Existing Note\n\nThis note exists and links to [[another-note]].'
    );
    await fs.writeFile(
      path.join(vaultPath, 'another-note.md'),
      '# Another Note\n\nThis note has an external link to [Example](https://example.com).'
    );
    await fs.writeFile(
      path.join(vaultPath, 'broken-links.md'),
      '# Broken Links\n\nThis has a [broken internal](non-existent.md) and [[missing-note]] and [broken external](https://broken-site-12345.com).'
    );

    // Create projects directory for MOC testing
    await fs.mkdir(path.join(vaultPath, 'projects'));
    await fs.mkdir(path.join(vaultPath, 'MOCs'));
    await fs.writeFile(
      path.join(vaultPath, 'projects', 'project-alpha.md'),
      '# Project Alpha\n\nFirst project.'
    );
    await fs.writeFile(
      path.join(vaultPath, 'projects', 'project-beta.md'),
      '# Project Beta\n\nSecond project.'
    );

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Internal linking rules', () => {
    beforeEach(async () => {
      // Create internal linking rule configuration
      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'linking',
          'internal-strict.toml'
        ),
        `[rule]
id = "linking-internal.strict-brackets"
name = "Strict Internal Link Brackets"
description = "Enforce double bracket format for all internal links"
category = "linking"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = []

[settings]
enforce_double_brackets = true
auto_convert = true
check_file_existence = true
suggest_alternatives = true
max_suggestions = 3`
      );
    });

    it('should detect and fix internal linking issues', async () => {
      const config: Configuration = {
        general: {
          vaultRoot: vaultPath,
          dryRun: false,
          verbose: false,
          fix: true,
          parallel: false,
          maxConcurrency: 1,
        },
        activeProfile: 'default',
        profiles: {
          default: {
            name: 'Default',
            description: 'Default profile',
            rulesPath: path.join(
              vaultPath,
              '.config',
              'obsidian-lint',
              'rules',
              'default'
            ),
            enabledRules: [],
          },
        },
      };

      const result = await engine.processVault(
        vaultPath,
        {
          dryRun: false,
          fix: true,
          verbose: false,
          generateMoc: false,
          parallel: false,
        },
        config
      );

      expect(result.filesProcessed).toBeGreaterThan(0);

      // Should detect broken internal links
      const brokenLinkIssues = result.issuesFound.filter(
        issue =>
          issue.message.includes('Broken internal link') ||
          issue.message.includes('should use double bracket format')
      );
      expect(brokenLinkIssues.length).toBeGreaterThan(0);

      // Should provide fixes for internal link issues
      const internalLinkFixes = result.fixesApplied.filter(fix =>
        fix.ruleId.includes('linking-internal')
      );
      expect(internalLinkFixes.length).toBeGreaterThan(0);
    });
  });

  describe('External linking rules', () => {
    beforeEach(async () => {
      // Create external linking rule configuration
      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'linking',
          'external-validate.toml'
        ),
        `[rule]
id = "linking-external.validate-urls"
name = "Validate External URLs"
description = "Validate external URLs for accessibility and proper formatting"
category = "linking"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = []

[settings]
validate_urls = true
check_accessibility = true
preferred_format = "markdown"
auto_convert = true
timeout_ms = 1000
suggest_https = true`
      );

      // Mock fetch responses
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({ ok: true, status: 200 });
        } else if (url.includes('broken-site')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
    });

    it('should detect and validate external links', async () => {
      const config: Configuration = {
        general: {
          vaultRoot: vaultPath,
          dryRun: false,
          verbose: false,
          fix: true,
          parallel: false,
          maxConcurrency: 1,
        },
        activeProfile: 'default',
        profiles: {
          default: {
            name: 'Default',
            description: 'Default profile',
            rulesPath: path.join(
              vaultPath,
              '.config',
              'obsidian-lint',
              'rules',
              'default'
            ),
            enabledRules: [],
          },
        },
      };

      const result = await engine.processVault(
        vaultPath,
        {
          dryRun: false,
          fix: true,
          verbose: false,
          generateMoc: false,
          parallel: false,
        },
        config
      );

      expect(result.filesProcessed).toBeGreaterThan(0);

      // Should detect broken external links
      const brokenExternalIssues = result.issuesFound.filter(issue =>
        issue.message.includes('may be broken or inaccessible')
      );
      expect(brokenExternalIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Broken link detection', () => {
    beforeEach(async () => {
      // Create broken link detection rule configuration
      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'linking',
          'broken-links.toml'
        ),
        `[rule]
id = "broken-link-detection.comprehensive"
name = "Broken Link Detection"
description = "Detect and resolve broken internal and external links"
category = "linking"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = []

[settings]
check_internal_links = true
check_external_links = true
check_attachments = true
auto_fix_internal = true
suggest_alternatives = true
max_suggestions = 3
external_timeout_ms = 1000`
      );

      // Mock fetch for external link checking
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('broken-site')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
    });

    it('should comprehensively detect broken links', async () => {
      const config: Configuration = {
        general: {
          vaultRoot: vaultPath,
          dryRun: false,
          verbose: false,
          fix: true,
          parallel: false,
          maxConcurrency: 1,
        },
        activeProfile: 'default',
        profiles: {
          default: {
            name: 'Default',
            description: 'Default profile',
            rulesPath: path.join(
              vaultPath,
              '.config',
              'obsidian-lint',
              'rules',
              'default'
            ),
            enabledRules: [],
          },
        },
      };

      const result = await engine.processVault(
        vaultPath,
        {
          dryRun: false,
          fix: true,
          verbose: false,
          generateMoc: false,
          parallel: false,
        },
        config
      );

      expect(result.filesProcessed).toBeGreaterThan(0);

      // Should detect various types of broken links
      const brokenLinkIssues = result.issuesFound.filter(
        issue =>
          issue.message.includes('Broken internal link') ||
          issue.message.includes('may be broken or inaccessible')
      );
      expect(brokenLinkIssues.length).toBeGreaterThan(0);

      // Should suggest alternatives for broken internal links
      const suggestionIssues = result.issuesFound.filter(issue =>
        issue.message.includes('Did you mean')
      );
      expect(suggestionIssues.length).toBeGreaterThan(0);
    });
  });

  describe('MOC linking rules', () => {
    beforeEach(async () => {
      // Create MOC linking rule configuration
      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'linking',
          'moc-automatic.toml'
        ),
        `[rule]
id = "moc-linking.automatic"
name = "Automatic MOC Linking"
description = "Automatically create and maintain MOC links based on directory structure"
category = "linking"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = []

[settings]
moc_directory = "MOCs"
moc_suffix = " MOC"
auto_create_mocs = true
auto_link_to_moc = true
auto_link_from_moc = true
min_files_for_moc = 2
link_format = "wikilink"`
      );
    });

    it('should create and manage MOC links automatically', async () => {
      const config: Configuration = {
        general: {
          vaultRoot: vaultPath,
          dryRun: false,
          verbose: false,
          fix: true,
          parallel: false,
          maxConcurrency: 1,
        },
        activeProfile: 'default',
        profiles: {
          default: {
            name: 'Default',
            description: 'Default profile',
            rulesPath: path.join(
              vaultPath,
              '.config',
              'obsidian-lint',
              'rules',
              'default'
            ),
            enabledRules: [],
          },
        },
      };

      const result = await engine.processVault(
        vaultPath,
        {
          dryRun: false,
          fix: true,
          verbose: false,
          generateMoc: false,
          parallel: false,
        },
        config
      );

      expect(result.filesProcessed).toBeGreaterThan(0);

      // Should detect missing MOC
      const missingMocIssues = result.issuesFound.filter(issue =>
        issue.message.includes('Missing MOC file')
      );
      expect(missingMocIssues.length).toBeGreaterThan(0);

      // Should detect missing links to MOC
      const missingMocLinkIssues = result.issuesFound.filter(issue =>
        issue.message.includes('should link to its MOC')
      );
      expect(missingMocLinkIssues.length).toBeGreaterThan(0);

      // Should provide fixes for MOC creation and linking
      const mocFixes = result.fixesApplied.filter(fix =>
        fix.ruleId.includes('moc-linking')
      );
      expect(mocFixes.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple linking rules interaction', () => {
    beforeEach(async () => {
      // Enable multiple linking rules
      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'linking',
          'internal-auto.toml'
        ),
        `[rule]
id = "linking-internal.auto-convert"
name = "Auto-Convert Internal Links"
description = "Automatically convert and fix internal link formats"
category = "linking"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = []

[settings]
enforce_double_brackets = true
auto_convert = true
suggest_alternatives = true`
      );

      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'linking',
          'broken-detection.toml'
        ),
        `[rule]
id = "broken-link-detection.comprehensive"
name = "Broken Link Detection"
description = "Detect and resolve broken internal and external links"
category = "linking"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = []

[settings]
check_internal_links = true
auto_fix_internal = true
suggest_alternatives = true`
      );

      // Mock external link responses
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('broken-site')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
    });

    it('should handle multiple linking rules without conflicts', async () => {
      const config: Configuration = {
        general: {
          vaultRoot: vaultPath,
          dryRun: false,
          verbose: false,
          fix: true,
          parallel: false,
          maxConcurrency: 1,
        },
        activeProfile: 'default',
        profiles: {
          default: {
            name: 'Default',
            description: 'Default profile',
            rulesPath: path.join(
              vaultPath,
              '.config',
              'obsidian-lint',
              'rules',
              'default'
            ),
            enabledRules: [],
          },
        },
      };

      const result = await engine.processVault(
        vaultPath,
        {
          dryRun: false,
          fix: true,
          verbose: false,
          generateMoc: false,
          parallel: false,
        },
        config
      );

      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0); // No conflicts or errors

      // Should detect issues from multiple rules
      const linkingIssues = result.issuesFound.filter(
        issue =>
          issue.ruleId.includes('linking-internal') ||
          issue.ruleId.includes('broken-link-detection')
      );
      expect(linkingIssues.length).toBeGreaterThan(0);

      // Should provide fixes from multiple rules
      const linkingFixes = result.fixesApplied.filter(
        fix =>
          fix.ruleId.includes('linking-internal') ||
          fix.ruleId.includes('broken-link-detection')
      );
      expect(linkingFixes.length).toBeGreaterThan(0);
    });
  });

  describe('Link parsing and processing', () => {
    it('should correctly parse various link formats', async () => {
      const testContent = `# Test Links

Internal wikilinks: [[existing-note]] and [[another-note|Display Text]]
Internal markdown: [existing note](existing-note.md)
External markdown: [Example](https://example.com)
External wikilink: [[https://example.org|External Site]]
Broken internal: [[non-existent-note]]
Broken external: [Broken](https://broken-site-12345.com)`;

      await fs.writeFile(path.join(vaultPath, 'link-test.md'), testContent);

      const file = await parser.parseMarkdown(
        path.join(vaultPath, 'link-test.md'),
        testContent
      );

      expect(file.links.length).toBeGreaterThan(0);

      // Should have both internal and external links
      const internalLinks = file.links.filter(link => link.type === 'internal');
      const externalLinks = file.links.filter(link => link.type === 'external');

      expect(internalLinks.length).toBeGreaterThan(0);
      expect(externalLinks.length).toBeGreaterThan(0);

      // Should correctly identify link targets
      const existingNoteLinks = internalLinks.filter(
        link => link.target === 'existing-note'
      );
      expect(existingNoteLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Performance with many links', () => {
    it('should handle files with many links efficiently', async () => {
      // Create a file with many links
      let content = '# Many Links Test\n\n';
      for (let i = 0; i < 50; i++) {
        content += `Link ${i}: [[existing-note]] and [External ${i}](https://example${i}.com)\n`;
      }

      await fs.writeFile(path.join(vaultPath, 'many-links.md'), content);

      // Enable a simple internal linking rule
      await fs.writeFile(
        path.join(
          vaultPath,
          '.config',
          'obsidian-lint',
          'rules',
          'default',
          'enabled',
          'linking',
          'internal-simple.toml'
        ),
        `[rule]
id = "linking-internal.flexible"
name = "Flexible Internal Links"
description = "Allow both wikilinks and markdown links for internal references"
category = "linking"

[config]
path_allowlist = ["**/*.md"]
path_denylist = []
include_patterns = ["**/*"]
exclude_patterns = []

[settings]
check_file_existence = true`
      );

      const config: Configuration = {
        general: {
          vaultRoot: vaultPath,
          dryRun: false,
          verbose: false,
          fix: false,
          parallel: false,
          maxConcurrency: 1,
        },
        activeProfile: 'default',
        profiles: {
          default: {
            name: 'Default',
            description: 'Default profile',
            rulesPath: path.join(
              vaultPath,
              '.config',
              'obsidian-lint',
              'rules',
              'default'
            ),
            enabledRules: [],
          },
        },
      };

      const startTime = Date.now();
      const result = await engine.processVault(
        vaultPath,
        {
          dryRun: false,
          fix: false,
          verbose: false,
          generateMoc: false,
          parallel: false,
        },
        config
      );
      const duration = Date.now() - startTime;

      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.errors.length).toBe(0);
    });
  });
});
