/**
 * Configuration Manager
 * Handles loading, parsing, and validating TOML configuration files
 */

import * as TOML from '@iarna/toml';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type {
  Configuration,
  GeneralConfig,
  ProfileConfig,
  ConfigurationPaths,
  ConfigurationLoadResult,
  ConfigurationValidationResult,
  ConfigurationError,
  RawTomlConfig,
} from '../types/config.js';
import { ConfigurationErrorCodes } from '../types/config.js';

export class ConfigurationManager {
  private static readonly DEFAULT_CONFIG_FILENAME = 'obsidian-lint.toml';
  private static readonly DEFAULT_PROFILE = 'default';

  /**
   * Load configuration with fallback logic
   */
  async loadConfiguration(
    vaultPath?: string,
    configPath?: string
  ): Promise<ConfigurationLoadResult> {
    const paths = this.getConfigurationPaths(vaultPath);

    // If explicit config path provided, use it
    if (configPath) {
      if (!existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      const config = await this.parseConfigurationFile(configPath);
      return { config, source: 'vault', path: configPath };
    }

    // Try XDG config first
    if (existsSync(paths.xdgConfig)) {
      const config = await this.parseConfigurationFile(paths.xdgConfig);
      return { config, source: 'xdg', path: paths.xdgConfig };
    }

    // Try global config
    if (existsSync(paths.global)) {
      const config = await this.parseConfigurationFile(paths.global);
      return { config, source: 'global', path: paths.global };
    }

    // Try vault-specific config
    if (existsSync(paths.vault)) {
      const config = await this.parseConfigurationFile(paths.vault);
      return { config, source: 'vault', path: paths.vault };
    }

    // Return default configuration
    const defaultConfig = this.createDefaultConfiguration();
    return { config: defaultConfig, source: 'default' };
  }

  /**
   * Parse a TOML configuration file
   */
  private async parseConfigurationFile(
    filePath: string
  ): Promise<Configuration> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const rawConfig = TOML.parse(content) as RawTomlConfig;

      const config = this.transformRawConfig(rawConfig);
      const validation = this.validateConfiguration(config);

      if (!validation.valid) {
        throw new Error(
          `Configuration validation failed: ${validation.errors
            .map(e => e.message)
            .join(', ')}`
        );
      }

      return config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to parse configuration file ${filePath}: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Transform raw TOML data into Configuration object
   */
  private transformRawConfig(rawConfig: RawTomlConfig): Configuration {
    const general: GeneralConfig = {
      vaultRoot: rawConfig.general?.vault_root,
      dryRun: rawConfig.general?.dry_run ?? false,
      verbose: rawConfig.general?.verbose ?? false,
      fix: rawConfig.general?.fix ?? false,
      parallel: rawConfig.general?.parallel ?? true,
      maxConcurrency: rawConfig.general?.max_concurrency ?? 4,
    };

    const activeProfile =
      rawConfig.profiles?.active ?? ConfigurationManager.DEFAULT_PROFILE;
    const profiles: Record<string, ProfileConfig> = {};

    // Process profiles
    if (rawConfig.profiles) {
      for (const [key, value] of Object.entries(rawConfig.profiles)) {
        if (key === 'active') continue;

        if (typeof value === 'object' && value !== null) {
          profiles[key] = {
            name: value.name ?? key,
            description: value.description ?? '',
            rulesPath: value.rules_path ?? `rules/${key}`,
            enabledRules: [], // Will be populated by rule discovery
          };
        }
      }
    }

    // Ensure default profile exists
    if (!profiles[ConfigurationManager.DEFAULT_PROFILE]) {
      profiles[ConfigurationManager.DEFAULT_PROFILE] = {
        name: 'Default Profile',
        description: 'Standard Obsidian organization rules',
        rulesPath: 'rules/default',
        enabledRules: [],
      };
    }

    return {
      general,
      activeProfile,
      profiles,
    };
  }

  /**
   * Validate configuration object with comprehensive checks
   */
  validateConfiguration(config: Configuration): ConfigurationValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: string[] = [];

    // Validate general config
    this.validateGeneralConfig(config.general, errors, warnings);

    // Validate active profile exists
    if (!config.profiles[config.activeProfile]) {
      errors.push({
        code: ConfigurationErrorCodes.PROFILE_NOT_FOUND,
        message: `Active profile '${config.activeProfile}' not found in profiles. Available profiles: ${Object.keys(config.profiles).join(', ')}`,
        path: 'activeProfile',
        context: {
          activeProfile: config.activeProfile,
          availableProfiles: Object.keys(config.profiles),
        },
      });
    }

    // Validate profiles
    this.validateProfiles(config.profiles, errors, warnings);

    // Cross-validation checks
    this.performCrossValidation(config, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate general configuration section
   */
  private validateGeneralConfig(
    general: GeneralConfig,
    errors: ConfigurationError[],
    warnings: string[]
  ): void {
    // Validate maxConcurrency
    if (typeof general.maxConcurrency !== 'number') {
      errors.push({
        code: ConfigurationErrorCodes.INVALID_FIELD_TYPE,
        message: `maxConcurrency must be a number, got ${typeof general.maxConcurrency}`,
        path: 'general.maxConcurrency',
        context: { value: general.maxConcurrency, expectedType: 'number' },
      });
    } else if (general.maxConcurrency < 1) {
      errors.push({
        code: ConfigurationErrorCodes.INVALID_FIELD_TYPE,
        message: `maxConcurrency must be at least 1, got ${general.maxConcurrency}`,
        path: 'general.maxConcurrency',
        context: { value: general.maxConcurrency, minimum: 1 },
      });
    } else if (general.maxConcurrency > 16) {
      warnings.push(
        `High concurrency setting (${general.maxConcurrency}) may impact performance. Consider using 4-8 for optimal results.`
      );
    }

    // Validate boolean fields
    const booleanFields: (keyof GeneralConfig)[] = [
      'dryRun',
      'verbose',
      'fix',
      'parallel',
    ];
    for (const field of booleanFields) {
      if (typeof general[field] !== 'boolean') {
        errors.push({
          code: ConfigurationErrorCodes.INVALID_FIELD_TYPE,
          message: `${field} must be a boolean, got ${typeof general[field]}`,
          path: `general.${field}`,
          context: { value: general[field], expectedType: 'boolean' },
        });
      }
    }

    // Validate vaultRoot if provided
    if (general.vaultRoot !== undefined) {
      if (typeof general.vaultRoot !== 'string') {
        errors.push({
          code: ConfigurationErrorCodes.INVALID_FIELD_TYPE,
          message: `vaultRoot must be a string, got ${typeof general.vaultRoot}`,
          path: 'general.vaultRoot',
          context: { value: general.vaultRoot, expectedType: 'string' },
        });
      } else if (general.vaultRoot.trim() === '') {
        errors.push({
          code: ConfigurationErrorCodes.INVALID_FIELD_TYPE,
          message: 'vaultRoot cannot be empty',
          path: 'general.vaultRoot',
        });
      }
    }
  }

  /**
   * Validate profiles configuration section
   */
  private validateProfiles(
    profiles: Record<string, ProfileConfig>,
    errors: ConfigurationError[],
    warnings: string[]
  ): void {
    if (Object.keys(profiles).length === 0) {
      errors.push({
        code: ConfigurationErrorCodes.MISSING_REQUIRED_FIELD,
        message: 'At least one profile must be defined',
        path: 'profiles',
      });
      return;
    }

    for (const [profileName, profile] of Object.entries(profiles)) {
      const profilePath = `profiles.${profileName}`;

      // Validate profile name
      if (!profile.name || typeof profile.name !== 'string') {
        errors.push({
          code: ConfigurationErrorCodes.MISSING_REQUIRED_FIELD,
          message: `Profile '${profileName}' missing required field 'name' or name is not a string`,
          path: `${profilePath}.name`,
          context: { profileName, value: profile.name },
        });
      }

      // Validate description
      if (typeof profile.description !== 'string') {
        errors.push({
          code: ConfigurationErrorCodes.INVALID_FIELD_TYPE,
          message: `Profile '${profileName}' description must be a string, got ${typeof profile.description}`,
          path: `${profilePath}.description`,
          context: {
            profileName,
            value: profile.description,
            expectedType: 'string',
          },
        });
      }

      // Validate rulesPath
      if (!profile.rulesPath || typeof profile.rulesPath !== 'string') {
        errors.push({
          code: ConfigurationErrorCodes.MISSING_REQUIRED_FIELD,
          message: `Profile '${profileName}' missing required field 'rulesPath' or rulesPath is not a string`,
          path: `${profilePath}.rulesPath`,
          context: { profileName, value: profile.rulesPath },
        });
      } else if (profile.rulesPath.trim() === '') {
        errors.push({
          code: ConfigurationErrorCodes.INVALID_FIELD_TYPE,
          message: `Profile '${profileName}' rulesPath cannot be empty`,
          path: `${profilePath}.rulesPath`,
          context: { profileName },
        });
      }

      // Validate enabledRules array
      if (!Array.isArray(profile.enabledRules)) {
        errors.push({
          code: ConfigurationErrorCodes.INVALID_FIELD_TYPE,
          message: `Profile '${profileName}' enabledRules must be an array, got ${typeof profile.enabledRules}`,
          path: `${profilePath}.enabledRules`,
          context: {
            profileName,
            value: profile.enabledRules,
            expectedType: 'array',
          },
        });
      }

      // Validate profile name format
      if (profile.name && !/^[a-zA-Z0-9\s\-_]+$/.test(profile.name)) {
        warnings.push(
          `Profile '${profileName}' name contains special characters that may cause issues`
        );
      }
    }
  }

  /**
   * Perform cross-validation checks between different config sections
   */
  private performCrossValidation(
    config: Configuration,
    errors: ConfigurationError[],
    warnings: string[]
  ): void {
    // Check if default profile exists
    if (!config.profiles[ConfigurationManager.DEFAULT_PROFILE]) {
      warnings.push(
        `Default profile '${ConfigurationManager.DEFAULT_PROFILE}' not found. This may cause issues if active profile is not available.`
      );
    }

    // Validate active profile is not empty
    if (!config.activeProfile || config.activeProfile.trim() === '') {
      errors.push({
        code: ConfigurationErrorCodes.MISSING_REQUIRED_FIELD,
        message: 'activeProfile cannot be empty',
        path: 'activeProfile',
      });
    }

    // Check for conflicting settings
    if (config.general.dryRun && config.general.fix) {
      warnings.push(
        'Both dryRun and fix are enabled. dryRun will take precedence and no changes will be applied.'
      );
    }

    // Check for performance-related settings
    if (!config.general.parallel && config.general.maxConcurrency > 1) {
      warnings.push(
        'Parallel processing is disabled but maxConcurrency > 1. Consider enabling parallel processing for better performance.'
      );
    }
  }

  /**
   * Get configuration file paths based on vault location
   */
  private getConfigurationPaths(vaultPath?: string): ConfigurationPaths {
    const filename = ConfigurationManager.DEFAULT_CONFIG_FILENAME;

    // XDG config path
    const xdgConfigHome =
      process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
    const xdgConfig = join(xdgConfigHome, 'obsidian-lint', filename);

    // Global config path
    const global = join(homedir(), '.config', 'obsidian-lint', filename);

    // Vault-specific config path
    const vault = vaultPath
      ? join(vaultPath, '.config', 'obsidian-lint', filename)
      : join(process.cwd(), '.config', 'obsidian-lint', filename);

    return { xdgConfig, global, vault };
  }

  /**
   * Create default configuration
   */
  private createDefaultConfiguration(): Configuration {
    return {
      general: {
        dryRun: false,
        verbose: false,
        fix: false,
        parallel: true,
        maxConcurrency: 4,
      },
      activeProfile: ConfigurationManager.DEFAULT_PROFILE,
      profiles: {
        [ConfigurationManager.DEFAULT_PROFILE]: {
          name: 'Default Profile',
          description: 'Standard Obsidian organization rules',
          rulesPath: 'rules/default',
          enabledRules: [],
        },
      },
    };
  }

  /**
   * Get the active profile configuration
   */
  getActiveProfile(config: Configuration): ProfileConfig {
    const profile = config.profiles[config.activeProfile];
    if (!profile) {
      throw new Error(`Active profile '${config.activeProfile}' not found`);
    }
    return profile;
  }

  /**
   * Resolve rules path relative to configuration location
   */
  resolveRulesPath(configPath: string, rulesPath: string): string {
    if (resolve(rulesPath) === rulesPath) {
      // Already absolute path
      return rulesPath;
    }

    // Resolve relative to config file directory
    const configDir = resolve(configPath, '..');
    return resolve(configDir, rulesPath);
  }
}
