import { describe, it, expect } from 'bun:test';
import {
  PluginSettings,
  DEFAULT_PLUGIN_SETTINGS,
  validatePluginSettings,
  serializePluginSettings,
  deserializePluginSettings,
} from '../../../src/plugin/settings.js';

describe('Plugin Settings', () => {
  describe('Default Settings', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_PLUGIN_SETTINGS).toEqual({
        configPath: '',
        activeProfile: 'default',
        realTimeLinting: false,
        showInlineErrors: true,
        autoFix: false,
        verbose: false,
        enableParallelProcessing: true,
        maxConcurrency: 4,
        enabledRules: [],
        disabledRules: [],
        showProgressNotifications: true,
        autoSaveAfterFix: true,
        realTimeLintingDelay: 1000,
        dryRun: false,
      });
    });
  });

  describe('Settings Validation', () => {
    it('should return default settings for empty input', () => {
      const result = validatePluginSettings({});
      expect(result).toEqual(DEFAULT_PLUGIN_SETTINGS);
    });

    it('should validate string fields correctly', () => {
      const input = {
        configPath: '/path/to/config.toml',
        activeProfile: 'work',
      };

      const result = validatePluginSettings(input);
      expect(result.configPath).toBe('/path/to/config.toml');
      expect(result.activeProfile).toBe('work');
    });

    it('should trim whitespace from activeProfile', () => {
      const input = { activeProfile: '  work  ' };
      const result = validatePluginSettings(input);
      expect(result.activeProfile).toBe('work');
    });

    it('should fallback to default for empty activeProfile', () => {
      const input = { activeProfile: '' };
      const result = validatePluginSettings(input);
      expect(result.activeProfile).toBe('default');
    });

    it('should validate boolean fields correctly', () => {
      const input = {
        realTimeLinting: true,
        showInlineErrors: false,
        autoFix: true,
        verbose: true,
      };

      const result = validatePluginSettings(input);
      expect(result.realTimeLinting).toBe(true);
      expect(result.showInlineErrors).toBe(false);
      expect(result.autoFix).toBe(true);
      expect(result.verbose).toBe(true);
    });

    it('should validate and clamp maxConcurrency', () => {
      // Test valid range
      expect(validatePluginSettings({ maxConcurrency: 8 }).maxConcurrency).toBe(
        8
      );

      // Test minimum clamping
      expect(validatePluginSettings({ maxConcurrency: 0 }).maxConcurrency).toBe(
        1
      );
      expect(
        validatePluginSettings({ maxConcurrency: -5 }).maxConcurrency
      ).toBe(1);

      // Test maximum clamping
      expect(
        validatePluginSettings({ maxConcurrency: 20 }).maxConcurrency
      ).toBe(16);

      // Test decimal handling
      expect(
        validatePluginSettings({ maxConcurrency: 4.7 }).maxConcurrency
      ).toBe(4);
    });

    it('should validate and clamp realTimeLintingDelay', () => {
      // Test valid range
      expect(
        validatePluginSettings({ realTimeLintingDelay: 2000 })
          .realTimeLintingDelay
      ).toBe(2000);

      // Test minimum clamping
      expect(
        validatePluginSettings({ realTimeLintingDelay: 50 })
          .realTimeLintingDelay
      ).toBe(100);

      // Test maximum clamping
      expect(
        validatePluginSettings({ realTimeLintingDelay: 10000 })
          .realTimeLintingDelay
      ).toBe(5000);

      // Test decimal handling
      expect(
        validatePluginSettings({ realTimeLintingDelay: 1500.7 })
          .realTimeLintingDelay
      ).toBe(1500);
    });

    it('should validate array fields correctly', () => {
      const input = {
        enabledRules: ['rule1', 'rule2', 123, 'rule3'],
        disabledRules: ['rule4', null, 'rule5', undefined],
      };

      const result = validatePluginSettings(input);
      expect(result.enabledRules).toEqual(['rule1', 'rule2', 'rule3']);
      expect(result.disabledRules).toEqual(['rule4', 'rule5']);
    });

    it('should ignore invalid types', () => {
      const input = {
        configPath: 123,
        realTimeLinting: 'true',
        maxConcurrency: 'invalid',
        enabledRules: 'not-an-array',
      };

      const result = validatePluginSettings(input);
      expect(result.configPath).toBe(''); // default
      expect(result.realTimeLinting).toBe(false); // default
      expect(result.maxConcurrency).toBe(4); // default
      expect(result.enabledRules).toEqual([]); // default
    });
  });

  describe('Settings Serialization', () => {
    it('should serialize settings correctly', () => {
      const settings: PluginSettings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        configPath: '/test/config.toml',
        verbose: true,
        enabledRules: ['rule1', 'rule2'],
      };

      const serialized = serializePluginSettings(settings);

      expect(serialized).toEqual({
        configPath: '/test/config.toml',
        activeProfile: 'default',
        realTimeLinting: false,
        showInlineErrors: true,
        autoFix: false,
        verbose: true,
        enableParallelProcessing: true,
        maxConcurrency: 4,
        enabledRules: ['rule1', 'rule2'],
        disabledRules: [],
        showProgressNotifications: true,
        autoSaveAfterFix: true,
        realTimeLintingDelay: 1000,
        dryRun: false,
      });
    });

    it('should create independent arrays during serialization', () => {
      const settings: PluginSettings = {
        ...DEFAULT_PLUGIN_SETTINGS,
        enabledRules: ['rule1', 'rule2'],
      };

      const serialized = serializePluginSettings(settings);

      // Modify original array
      settings.enabledRules.push('rule3');

      // Serialized array should be unchanged
      expect(serialized.enabledRules).toEqual(['rule1', 'rule2']);
    });
  });

  describe('Settings Deserialization', () => {
    it('should deserialize valid data correctly', () => {
      const data = {
        configPath: '/test/config.toml',
        activeProfile: 'work',
        verbose: true,
        enabledRules: ['rule1', 'rule2'],
      };

      const result = deserializePluginSettings(data);

      expect(result.configPath).toBe('/test/config.toml');
      expect(result.activeProfile).toBe('work');
      expect(result.verbose).toBe(true);
      expect(result.enabledRules).toEqual(['rule1', 'rule2']);
    });

    it('should return defaults for null/undefined data', () => {
      expect(deserializePluginSettings(null)).toEqual(DEFAULT_PLUGIN_SETTINGS);
      expect(deserializePluginSettings(undefined)).toEqual(
        DEFAULT_PLUGIN_SETTINGS
      );
    });

    it('should return defaults for invalid data types', () => {
      expect(deserializePluginSettings('invalid')).toEqual(
        DEFAULT_PLUGIN_SETTINGS
      );
      expect(deserializePluginSettings(123)).toEqual(DEFAULT_PLUGIN_SETTINGS);
      expect(deserializePluginSettings([])).toEqual(DEFAULT_PLUGIN_SETTINGS);
    });

    it('should handle partial data correctly', () => {
      const data = {
        verbose: true,
        invalidField: 'should be ignored',
      };

      const result = deserializePluginSettings(data);

      expect(result.verbose).toBe(true);
      expect(result.configPath).toBe(''); // default
      expect(result.activeProfile).toBe('default'); // default
    });
  });

  describe('Settings Roundtrip', () => {
    it('should maintain data integrity through serialize/deserialize cycle', () => {
      const originalSettings: PluginSettings = {
        configPath: '/test/config.toml',
        activeProfile: 'work',
        realTimeLinting: true,
        showInlineErrors: false,
        autoFix: true,
        verbose: true,
        enableParallelProcessing: false,
        maxConcurrency: 8,
        enabledRules: ['rule1', 'rule2', 'rule3'],
        disabledRules: ['rule4', 'rule5'],
        showProgressNotifications: false,
        autoSaveAfterFix: false,
        realTimeLintingDelay: 2000,
        dryRun: false,
      };

      const serialized = serializePluginSettings(originalSettings);
      const deserialized = deserializePluginSettings(serialized);

      expect(deserialized).toEqual(originalSettings);
    });
  });
});
