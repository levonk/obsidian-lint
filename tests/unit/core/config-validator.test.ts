/**
 * Tests for Configuration Validator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, statSync } from 'fs';
import {
  ConfigurationValidator,
  ConfigurationValidationOptions,
} from '../../../src/core/config-validator.js';
import type { Configuration } from '../../../src/types/config.js';
import { ErrorCodes } from '../../../src/types/errors.js';

// Mock fs functions
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockStatSync = vi.mocked(statSync);

describe('ConfigurationValidator', () => {
  let validator: ConfigurationValidator;
  let validConfig: Configuration;

  beforeEach(() => {
    validator = new ConfigurationValidator();

    validConfig = {
      general: {
        vaultRoot: '/test/vault',
        dryRun: false,
        verbose: true,
        fix: true,
        parallel: true,
        maxConcurrency: 4,
      },
      activeProfile: 'default',
      profiles: {
        default: {
          name: 'Default Profile',
          description: 'Standard rules',
          rulesPath: 'rules/default',
          enabledRules: ['rule1', 'rule2'],
        },
      },
    };

    // Reset mocks
    vi.clearAllMocks();

    // Default mock implementations
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true } as any);
  });

  describe('validateConfiguration', () => {
    it('should validate a correct configuration', () => {
      const result = validator.validateConfiguration(validConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate general configuration', () => {
      const invalidConfig = {
        ...validConfig,
        general: {
          ...validConfig.general,
          vaultRoot: 123 as any, // Invalid type
          maxConcurrency: -1, // Invalid value
        },
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe(ErrorCodes.CONFIG_INVALID_FIELD_TYPE);
      expect(result.errors[0].message).toContain('vaultRoot must be a string');
      expect(result.errors[1].message).toContain(
        'maxConcurrency must be at least 1'
      );
    });

    it('should validate boolean fields', () => {
      const invalidConfig = {
        ...validConfig,
        general: {
          ...validConfig.general,
          dryRun: 'true' as any, // Should be boolean
          verbose: 1 as any, // Should be boolean
        },
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('dryRun must be a boolean'))
      ).toBe(true);
      expect(
        result.errors.some(e => e.message.includes('verbose must be a boolean'))
      ).toBe(true);
    });

    it('should validate active profile exists', () => {
      const invalidConfig = {
        ...validConfig,
        activeProfile: 'nonexistent',
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCodes.CONFIG_PROFILE_NOT_FOUND);
      expect(result.errors[0].message).toContain(
        "Active profile 'nonexistent' not found"
      );
    });

    it('should validate empty active profile', () => {
      const invalidConfig = {
        ...validConfig,
        activeProfile: '',
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(
        ErrorCodes.CONFIG_MISSING_REQUIRED_FIELD
      );
    });

    it('should validate profiles object', () => {
      const invalidConfig = {
        ...validConfig,
        profiles: null as any,
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('profiles must be an object');
    });

    it('should require at least one profile', () => {
      const invalidConfig = {
        ...validConfig,
        profiles: {},
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain(
        'At least one profile must be defined'
      );
    });

    it('should validate profile structure', () => {
      const invalidConfig = {
        ...validConfig,
        profiles: {
          invalid: {
            // Missing required fields
            description: 'Invalid profile',
          } as any,
        },
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e =>
          e.message.includes("missing required field 'name'")
        )
      ).toBe(true);
      expect(
        result.errors.some(e =>
          e.message.includes("missing required field 'rulesPath'")
        )
      ).toBe(true);
    });

    it('should validate profile name format', () => {
      const invalidConfig = {
        ...validConfig,
        profiles: {
          'invalid name!': {
            name: 'Invalid Name',
            rulesPath: 'rules/invalid',
            enabledRules: [],
          },
        },
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('contains invalid characters');
    });

    it('should validate enabledRules array', () => {
      const invalidConfig = {
        ...validConfig,
        profiles: {
          default: {
            ...validConfig.profiles.default,
            enabledRules: ['valid', 123, 'another'] as any,
          },
        },
      };

      const result = validator.validateConfiguration(invalidConfig, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain(
        'enabledRules[1] must be a string'
      );
    });

    it('should validate file system paths when enabled', () => {
      mockExistsSync.mockReturnValue(false);

      const result = validator.validateConfiguration(validConfig, {
        validateFileSystem: true,
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          e => e.code === ErrorCodes.CONFIG_RULES_PATH_NOT_FOUND
        )
      ).toBe(true);
    });

    it('should validate vault root exists', () => {
      mockExistsSync.mockImplementation(path => {
        return path !== '/test/vault'; // Vault root doesn't exist
      });

      const result = validator.validateConfiguration(validConfig, {
        validateFileSystem: true,
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e =>
          e.message.includes('Vault root directory does not exist')
        )
      ).toBe(true);
    });

    it('should validate vault root is directory', () => {
      mockStatSync.mockImplementation(path => {
        if (path === '/test/vault') {
          return { isDirectory: () => false } as any; // Not a directory
        }
        return { isDirectory: () => true } as any;
      });

      const result = validator.validateConfiguration(validConfig, {
        validateFileSystem: true,
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('is not a directory'))
      ).toBe(true);
    });

    it('should warn about high maxConcurrency', () => {
      const configWithHighConcurrency = {
        ...validConfig,
        general: {
          ...validConfig.general,
          maxConcurrency: 20,
        },
      };

      const result = validator.validateConfiguration(
        configWithHighConcurrency,
        {
          validateFileSystem: false,
        }
      );

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some(w => w.includes('High maxConcurrency value'))
      ).toBe(true);
    });

    it('should enforce strict mode limits', () => {
      const configWithHighConcurrency = {
        ...validConfig,
        general: {
          ...validConfig.general,
          maxConcurrency: 20,
        },
      };

      const result = validator.validateConfiguration(
        configWithHighConcurrency,
        {
          validateFileSystem: false,
          strictMode: true,
        }
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e =>
          e.message.includes('cannot exceed 16 in strict mode')
        )
      ).toBe(true);
    });

    it('should warn about missing default profile', () => {
      const configWithoutDefault = {
        ...validConfig,
        profiles: {
          custom: validConfig.profiles.default,
        },
        activeProfile: 'custom',
      };

      const result = validator.validateConfiguration(configWithoutDefault, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some(w => w.includes('No default profile found'))
      ).toBe(true);
    });

    it('should detect duplicate profile names (case-insensitive)', () => {
      const configWithDuplicates = {
        ...validConfig,
        profiles: {
          Default: validConfig.profiles.default,
          default: validConfig.profiles.default,
        },
      };

      const result = validator.validateConfiguration(configWithDuplicates, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('Duplicate profile names'))
      ).toBe(true);
    });

    it('should warn about conflicting settings', () => {
      const configWithConflicts = {
        ...validConfig,
        general: {
          ...validConfig.general,
          parallel: true,
          maxConcurrency: 1,
        },
      };

      const result = validator.validateConfiguration(configWithConflicts, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some(w => w.includes('maxConcurrency is set to 1'))
      ).toBe(true);
    });

    it('should warn about dry-run and fix both enabled', () => {
      const configWithConflicts = {
        ...validConfig,
        general: {
          ...validConfig.general,
          dryRun: true,
          fix: true,
        },
      };

      const result = validator.validateConfiguration(configWithConflicts, {
        validateFileSystem: false,
      });

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some(w => w.includes('Both dryRun and fix are enabled'))
      ).toBe(true);
    });

    it('should handle validation errors gracefully', () => {
      // Create a config that will cause an error during validation
      const problematicConfig = {
        ...validConfig,
        general: {
          ...validConfig.general,
          vaultRoot: undefined,
        },
      };

      // Mock a function to throw an error
      mockExistsSync.mockImplementation(() => {
        throw new Error('Mock filesystem error');
      });

      const result = validator.validateConfiguration(problematicConfig, {
        validateFileSystem: true,
      });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.code === ErrorCodes.CONFIG_VALIDATION_FAILED)
      ).toBe(true);
    });
  });

  describe('validateConfigurationFileStructure', () => {
    it('should validate empty configuration', () => {
      const result = validator.validateConfigurationFileStructure('');

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Configuration file is empty');
    });

    it('should warn about missing sections', () => {
      const configContent = `
        [other]
        value = "test"
      `;

      const result =
        validator.validateConfigurationFileStructure(configContent);

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some(w =>
          w.includes('missing recommended section: [general]')
        )
      ).toBe(true);
      expect(
        result.warnings.some(w =>
          w.includes('missing recommended section: [profiles]')
        )
      ).toBe(true);
    });

    it('should warn about unquoted strings', () => {
      const configContent = `
        [general]
        vault_root = /path/with spaces
        dry_run = false
      `;

      const result =
        validator.validateConfigurationFileStructure(configContent);

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some(w => w.includes('Consider quoting string value'))
      ).toBe(true);
    });

    it('should handle validation errors', () => {
      // This should not throw but handle the error gracefully
      const result = validator.validateConfigurationFileStructure(null as any);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCodes.CONFIG_VALIDATION_FAILED);
    });
  });

  describe('generateValidationReport', () => {
    it('should generate report for valid configuration', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: ['Test warning'],
      };

      const report = validator.generateValidationReport(result);

      expect(report).toContain('✅ Configuration is valid');
      expect(report).toContain('Warnings (1):');
      expect(report).toContain('1. Test warning');
    });

    it('should generate report for invalid configuration', () => {
      const error = new (class extends Error {
        constructor() {
          super('Test error');
          this.name = 'ConfigurationError';
        }
        code = ErrorCodes.CONFIG_INVALID_TOML;
        path = '/config/path';
        context = { lineNumber: 42 };
      })();

      const result = {
        valid: false,
        errors: [error as any],
        warnings: ['Test warning'],
      };

      const report = validator.generateValidationReport(result);

      expect(report).toContain('❌ Configuration validation failed');
      expect(report).toContain('Errors (1):');
      expect(report).toContain('1. [CONFIG_INVALID_TOML] Test error');
      expect(report).toContain('Path: /config/path');
      expect(report).toContain('Context: lineNumber: 42');
      expect(report).toContain('Warnings (1):');
      expect(report).toContain('1. Test warning');
    });

    it('should generate minimal report', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const report = validator.generateValidationReport(result);

      expect(report).toContain('✅ Configuration is valid');
      expect(report).not.toContain('Errors');
      expect(report).not.toContain('Warnings');
    });
  });
});
