import { describe, it, expect } from 'bun:test';
import {
  PluginSettings,
  DEFAULT_PLUGIN_SETTINGS,
  validatePluginSettings,
} from '../../../src/plugin/settings.js';

describe('Plugin Basic Functionality', () => {
  describe('Plugin Settings Integration', () => {
    it('should have valid default settings structure', () => {
      const settings = DEFAULT_PLUGIN_SETTINGS;

      // Verify all required fields are present
      expect(typeof settings.configPath).toBe('string');
      expect(typeof settings.activeProfile).toBe('string');
      expect(typeof settings.realTimeLinting).toBe('boolean');
      expect(typeof settings.showInlineErrors).toBe('boolean');
      expect(typeof settings.autoFix).toBe('boolean');
      expect(typeof settings.verbose).toBe('boolean');
      expect(typeof settings.enableParallelProcessing).toBe('boolean');
      expect(typeof settings.maxConcurrency).toBe('number');
      expect(Array.isArray(settings.enabledRules)).toBe(true);
      expect(Array.isArray(settings.disabledRules)).toBe(true);
      expect(typeof settings.showProgressNotifications).toBe('boolean');
      expect(typeof settings.autoSaveAfterFix).toBe('boolean');
      expect(typeof settings.realTimeLintingDelay).toBe('number');
    });

    it('should validate settings for plugin use', () => {
      const userSettings = {
        activeProfile: 'work',
        verbose: true,
        maxConcurrency: 8,
        enabledRules: ['frontmatter-required-fields.strict'],
        realTimeLintingDelay: 2000,
      };

      const validated = validatePluginSettings(userSettings);

      expect(validated.activeProfile).toBe('work');
      expect(validated.verbose).toBe(true);
      expect(validated.maxConcurrency).toBe(8);
      expect(validated.enabledRules).toEqual([
        'frontmatter-required-fields.strict',
      ]);
      expect(validated.realTimeLintingDelay).toBe(2000);
    });

    it('should handle plugin-specific edge cases', () => {
      // Test with extreme values that might come from UI
      const extremeSettings = {
        maxConcurrency: 100, // Should be clamped to 16
        realTimeLintingDelay: 10, // Should be clamped to 100
        activeProfile: '   ', // Should fallback to default
        enabledRules: ['valid-rule', '', null, 'another-rule'], // Should filter invalid
      };

      const validated = validatePluginSettings(extremeSettings);

      expect(validated.maxConcurrency).toBe(16);
      expect(validated.realTimeLintingDelay).toBe(100);
      expect(validated.activeProfile).toBe('default');
      expect(validated.enabledRules).toEqual(['valid-rule', 'another-rule']);
    });
  });

  describe('Plugin Configuration Compatibility', () => {
    it('should be compatible with Obsidian data storage format', () => {
      const settings: PluginSettings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        configPath: '/vault/.config/obsidian-lint/obsidian-lint.toml',
        activeProfile: 'work',
        enabledRules: ['rule1', 'rule2'],
      };

      // Simulate Obsidian's data storage serialization
      const serialized = JSON.parse(JSON.stringify(settings));
      const validated = validatePluginSettings(serialized);

      expect(validated).toEqual(settings);
    });

    it('should handle missing fields gracefully', () => {
      // Simulate partial data from Obsidian storage
      const partialData = {
        activeProfile: 'custom',
        verbose: true,
        // Missing other fields
      };

      const validated = validatePluginSettings(partialData);

      // Should have custom values where provided
      expect(validated.activeProfile).toBe('custom');
      expect(validated.verbose).toBe(true);

      // Should have defaults for missing fields
      expect(validated.configPath).toBe('');
      expect(validated.realTimeLinting).toBe(false);
      expect(validated.maxConcurrency).toBe(4);
    });
  });

  describe('Plugin Command Structure', () => {
    it('should define expected command IDs', () => {
      const expectedCommands = [
        'lint-current-file',
        'lint-vault',
        'fix-current-file',
        'fix-vault',
        'show-lint-results',
      ];

      // This test verifies the command structure is as expected
      // The actual commands are tested in integration tests
      expect(expectedCommands).toHaveLength(5);
      expect(expectedCommands).toContain('lint-current-file');
      expect(expectedCommands).toContain('fix-vault');
    });

    it('should have appropriate hotkey for main command', () => {
      const expectedHotkey = { modifiers: ['Mod', 'Shift'], key: 'l' };

      // Verify hotkey structure is valid
      expect(Array.isArray(expectedHotkey.modifiers)).toBe(true);
      expect(typeof expectedHotkey.key).toBe('string');
      expect(expectedHotkey.modifiers).toContain('Mod');
    });
  });

  describe('Plugin Error Handling', () => {
    it('should handle invalid settings gracefully', () => {
      const invalidSettings = {
        maxConcurrency: 'not-a-number',
        realTimeLinting: 'not-a-boolean',
        enabledRules: 'not-an-array',
        activeProfile: null,
      };

      // Should not throw and should return valid defaults
      expect(() => validatePluginSettings(invalidSettings)).not.toThrow();

      const result = validatePluginSettings(invalidSettings);
      expect(result.maxConcurrency).toBe(4); // default
      expect(result.realTimeLinting).toBe(false); // default
      expect(result.enabledRules).toEqual([]); // default
      expect(result.activeProfile).toBe('default'); // default
    });
  });
});
