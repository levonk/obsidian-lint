import { describe, it, expect } from 'bun:test';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Plugin Structure Integration', () => {
  describe('Manifest File', () => {
    it('should have valid manifest.json', async () => {
      const manifestPath = join(process.cwd(), 'manifest.json');
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      // Verify required fields
      expect(typeof manifest.id).toBe('string');
      expect(typeof manifest.name).toBe('string');
      expect(typeof manifest.version).toBe('string');
      expect(typeof manifest.minAppVersion).toBe('string');
      expect(typeof manifest.description).toBe('string');
      expect(typeof manifest.author).toBe('string');

      // Verify specific values
      expect(manifest.id).toBe('obsidian-lint');
      expect(manifest.name).toBe('Obsidian Lint');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.minAppVersion).toBe('1.0.0');
    });

    it('should have reasonable manifest values', async () => {
      const manifestPath = join(process.cwd(), 'manifest.json');
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      // Verify description is meaningful
      expect(manifest.description.length).toBeGreaterThan(20);
      expect(manifest.description).toContain('linting');
      expect(manifest.description).toContain('Obsidian');

      // Verify boolean fields
      expect(typeof manifest.isDesktopOnly).toBe('boolean');
    });
  });

  describe('Plugin Files Structure', () => {
    it('should have main plugin file', async () => {
      const mainPath = join(process.cwd(), 'src/plugin/main.ts');
      const content = await readFile(mainPath, 'utf-8');

      // Verify it exports the plugin class
      expect(content).toContain('export default class ObsidianLintPlugin');
      expect(content).toContain('extends Plugin');
      expect(content).toContain('async onload()');
      expect(content).toContain('async onunload()');
    });

    it('should have settings file', async () => {
      const settingsPath = join(process.cwd(), 'src/plugin/settings.ts');
      const content = await readFile(settingsPath, 'utf-8');

      // Verify it exports settings interface and defaults
      expect(content).toContain('export interface PluginSettings');
      expect(content).toContain('export const DEFAULT_PLUGIN_SETTINGS');
      expect(content).toContain('export function validatePluginSettings');
    });

    it('should have settings tab file', async () => {
      const settingsTabPath = join(process.cwd(), 'src/plugin/settings-tab.ts');
      const content = await readFile(settingsTabPath, 'utf-8');

      // Verify it exports settings tab class
      expect(content).toContain('export class ObsidianLintSettingTab');
      expect(content).toContain('extends PluginSettingTab');
      expect(content).toContain('display()');
    });

    it('should have plugin index file', async () => {
      const indexPath = join(process.cwd(), 'src/plugin/index.ts');
      const content = await readFile(indexPath, 'utf-8');

      // Verify it exports main components
      expect(content).toContain('export { default as ObsidianLintPlugin }');
      expect(content).toContain('export type { PluginSettings }');
      expect(content).toContain('export { ObsidianLintSettingTab }');
    });
  });

  describe('Package Configuration', () => {
    it('should have plugin export in package.json', async () => {
      const packagePath = join(process.cwd(), 'package.json');
      const packageContent = await readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      // Verify plugin export is configured
      expect('./plugin' in packageJson.exports).toBe(true);
      expect(packageJson.exports['./plugin']).toHaveProperty('import');
      expect(packageJson.exports['./plugin']).toHaveProperty('types');
      expect(packageJson.exports['./plugin'].import).toBe(
        './dist/plugin/index.js'
      );
    });

    it('should have obsidian peer dependency', async () => {
      const packagePath = join(process.cwd(), 'package.json');
      const packageContent = await readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      // Verify Obsidian is listed as peer dependency
      expect(packageJson.peerDependencies).toHaveProperty('obsidian');
      expect(packageJson.peerDependenciesMeta).toHaveProperty('obsidian');
      expect(packageJson.peerDependenciesMeta.obsidian.optional).toBe(true);
    });

    it('should have plugin build script', async () => {
      const packagePath = join(process.cwd(), 'package.json');
      const packageContent = await readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      // Verify build scripts include plugin
      expect(packageJson.scripts).toHaveProperty('build:plugin');
      expect(packageJson.scripts['build:compile']).toContain(
        'src/plugin/index.ts'
      );
    });
  });

  describe('Plugin Command Structure', () => {
    it('should define expected commands in main file', async () => {
      const mainPath = join(process.cwd(), 'src/plugin/main.ts');
      const content = await readFile(mainPath, 'utf-8');

      // Verify all expected commands are registered
      const expectedCommands = [
        'lint-current-file',
        'lint-vault',
        'fix-current-file',
        'fix-vault',
        'show-lint-results',
      ];

      for (const command of expectedCommands) {
        expect(content).toContain(`id: '${command}'`);
      }
    });

    it('should have proper command names', async () => {
      const mainPath = join(process.cwd(), 'src/plugin/main.ts');
      const content = await readFile(mainPath, 'utf-8');

      // Verify command names are user-friendly
      expect(content).toContain("name: 'Lint current file'");
      expect(content).toContain("name: 'Lint entire vault'");
      expect(content).toContain("name: 'Fix current file'");
      expect(content).toContain("name: 'Fix entire vault'");
    });

    it('should have hotkey for main command', async () => {
      const mainPath = join(process.cwd(), 'src/plugin/main.ts');
      const content = await readFile(mainPath, 'utf-8');

      // Verify hotkey is defined for lint-current-file
      expect(content).toContain(
        "hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'l' }]"
      );
    });
  });

  describe('Settings Tab Structure', () => {
    it('should have proper settings sections', async () => {
      const settingsTabPath = join(process.cwd(), 'src/plugin/settings-tab.ts');
      const content = await readFile(settingsTabPath, 'utf-8');

      // Verify settings sections are defined
      expect(content).toContain('addGeneralSettings()');
      expect(content).toContain('addLintingSettings()');
      expect(content).toContain('addPerformanceSettings()');
      expect(content).toContain('addAdvancedSettings()');
    });

    it('should have settings validation', async () => {
      const settingsTabPath = join(process.cwd(), 'src/plugin/settings-tab.ts');
      const content = await readFile(settingsTabPath, 'utf-8');

      // Verify settings have proper validation and UI elements
      expect(content).toContain('addText');
      expect(content).toContain('addToggle');
      expect(content).toContain('addSlider');
      expect(content).toContain('addTextArea');
      expect(content).toContain('addButton');
    });

    it('should have action buttons', async () => {
      const settingsTabPath = join(process.cwd(), 'src/plugin/settings-tab.ts');
      const content = await readFile(settingsTabPath, 'utf-8');

      // Verify action buttons are present
      expect(content).toContain('testConfiguration');
      expect(content).toContain('resetSettings');
      expect(content).toContain("setButtonText('Test Config')");
      expect(content).toContain("setButtonText('Reset')");
    });
  });
});
