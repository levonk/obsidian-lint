/**
 * Configuration Validator
 * Comprehensive validation for configuration files with detailed error messages
 */

import { existsSync, statSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import type {
  Configuration,
  ProfileConfig,
  GeneralConfig,
} from '../types/config.js';
import {
  ConfigurationError,
  ErrorCodes,
  ValidationResult,
  ErrorAggregator,
  ErrorContextBuilder,
} from '../types/errors.js';

export interface ConfigurationValidationOptions {
  validateRulesPaths?: boolean;
  validateFileSystem?: boolean;
  strictMode?: boolean;
}

export class ConfigurationValidator {
  private aggregator: ErrorAggregator;

  constructor() {
    this.aggregator = new ErrorAggregator();
  }

  /**
   * Validate a complete configuration object
   */
  validateConfiguration(
    config: Configuration,
    options: ConfigurationValidationOptions = {}
  ): ValidationResult {
    this.aggregator.clear();

    // Set default options
    const opts = {
      validateRulesPaths: true,
      validateFileSystem: true,
      strictMode: false,
      ...options,
    };

    try {
      // Validate general configuration
      this.validateGeneralConfig(config.general, opts);

      // Validate active profile exists
      this.validateActiveProfile(config, opts);

      // Validate all profiles
      this.validateProfiles(config.profiles, opts);

      // Cross-validation checks
      this.performCrossValidation(config, opts);
    } catch (error) {
      const contextBuilder = new ErrorContextBuilder()
        .addOperation('configuration_validation')
        .addOriginalError(
          error instanceof Error ? error : new Error(String(error))
        );

      this.aggregator.addError(
        new ConfigurationError(
          'Unexpected error during configuration validation',
          ErrorCodes.CONFIG_VALIDATION_FAILED,
          undefined,
          contextBuilder.build()
        )
      );
    }

    return this.aggregator.toValidationResult();
  }

  /**
   * Validate general configuration section
   */
  private validateGeneralConfig(
    general: GeneralConfig,
    options: ConfigurationValidationOptions
  ): void {
    // Validate vault root if provided
    if (general.vaultRoot !== undefined) {
      if (typeof general.vaultRoot !== 'string') {
        this.aggregator.addError(
          new ConfigurationError(
            'vaultRoot must be a string',
            ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
            'general.vaultRoot'
          )
        );
      } else if (general.vaultRoot.trim() === '') {
        this.aggregator.addError(
          new ConfigurationError(
            'vaultRoot cannot be empty',
            ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
            'general.vaultRoot'
          )
        );
      } else if (options.validateFileSystem && !existsSync(general.vaultRoot)) {
        this.aggregator.addError(
          new ConfigurationError(
            `Vault root directory does not exist: ${general.vaultRoot}`,
            ErrorCodes.CONFIG_RULES_PATH_NOT_FOUND,
            'general.vaultRoot',
            { path: general.vaultRoot }
          )
        );
      } else if (
        options.validateFileSystem &&
        !statSync(general.vaultRoot).isDirectory()
      ) {
        this.aggregator.addError(
          new ConfigurationError(
            `Vault root path is not a directory: ${general.vaultRoot}`,
            ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
            'general.vaultRoot',
            { path: general.vaultRoot }
          )
        );
      }
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
        this.aggregator.addError(
          new ConfigurationError(
            `${field} must be a boolean`,
            ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
            `general.${field}`
          )
        );
      }
    }

    // Validate maxConcurrency
    if (typeof general.maxConcurrency !== 'number') {
      this.aggregator.addError(
        new ConfigurationError(
          'maxConcurrency must be a number',
          ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
          'general.maxConcurrency'
        )
      );
    } else if (general.maxConcurrency < 1) {
      this.aggregator.addError(
        new ConfigurationError(
          'maxConcurrency must be at least 1',
          ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
          'general.maxConcurrency',
          { value: general.maxConcurrency }
        )
      );
    } else if (general.maxConcurrency > 32) {
      this.aggregator.addWarning(
        `High maxConcurrency value (${general.maxConcurrency}) may impact performance`
      );
    }

    // Additional strict mode validations
    if (options.strictMode) {
      if (general.maxConcurrency > 16) {
        this.aggregator.addError(
          new ConfigurationError(
            'maxConcurrency cannot exceed 16 in strict mode',
            ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
            'general.maxConcurrency',
            { value: general.maxConcurrency, strictMode: true }
          )
        );
      }
    }
  }

  /**
   * Validate active profile configuration
   */
  private validateActiveProfile(
    config: Configuration,
    options: ConfigurationValidationOptions
  ): void {
    if (typeof config.activeProfile !== 'string') {
      this.aggregator.addError(
        new ConfigurationError(
          'activeProfile must be a string',
          ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
          'activeProfile'
        )
      );
      return;
    }

    if (config.activeProfile.trim() === '') {
      this.aggregator.addError(
        new ConfigurationError(
          'activeProfile cannot be empty',
          ErrorCodes.CONFIG_MISSING_REQUIRED_FIELD,
          'activeProfile'
        )
      );
      return;
    }

    if (!config.profiles[config.activeProfile]) {
      this.aggregator.addError(
        new ConfigurationError(
          `Active profile '${config.activeProfile}' not found in profiles`,
          ErrorCodes.CONFIG_PROFILE_NOT_FOUND,
          'activeProfile',
          {
            activeProfile: config.activeProfile,
            availableProfiles: Object.keys(config.profiles),
          }
        )
      );
    }
  }

  /**
   * Validate all profile configurations
   */
  private validateProfiles(
    profiles: Record<string, ProfileConfig>,
    options: ConfigurationValidationOptions
  ): void {
    if (!profiles || typeof profiles !== 'object') {
      this.aggregator.addError(
        new ConfigurationError(
          'profiles must be an object',
          ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
          'profiles'
        )
      );
      return;
    }

    const profileNames = Object.keys(profiles);
    if (profileNames.length === 0) {
      this.aggregator.addError(
        new ConfigurationError(
          'At least one profile must be defined',
          ErrorCodes.CONFIG_MISSING_REQUIRED_FIELD,
          'profiles'
        )
      );
      return;
    }

    // Validate each profile
    for (const [profileName, profile] of Object.entries(profiles)) {
      this.validateProfile(profileName, profile, options);
    }

    // Check for default profile
    if (!profiles.default) {
      this.aggregator.addWarning(
        'No default profile found. Consider adding a default profile for better compatibility.'
      );
    }
  }

  /**
   * Validate a single profile configuration
   */
  private validateProfile(
    profileName: string,
    profile: ProfileConfig,
    options: ConfigurationValidationOptions
  ): void {
    const profilePath = `profiles.${profileName}`;

    // Validate profile name
    if (!profileName || typeof profileName !== 'string') {
      this.aggregator.addError(
        new ConfigurationError(
          'Profile name must be a non-empty string',
          ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
          profilePath
        )
      );
      return;
    }

    // Validate profile name format
    const validNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!validNameRegex.test(profileName)) {
      this.aggregator.addError(
        new ConfigurationError(
          `Profile name '${profileName}' contains invalid characters. Use only letters, numbers, hyphens, and underscores.`,
          ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
          profilePath,
          { profileName, validPattern: validNameRegex.source }
        )
      );
    }

    // Validate required fields
    if (!profile.name || typeof profile.name !== 'string') {
      this.aggregator.addError(
        new ConfigurationError(
          `Profile '${profileName}' missing required field 'name'`,
          ErrorCodes.CONFIG_MISSING_REQUIRED_FIELD,
          `${profilePath}.name`
        )
      );
    }

    if (!profile.rulesPath || typeof profile.rulesPath !== 'string') {
      this.aggregator.addError(
        new ConfigurationError(
          `Profile '${profileName}' missing required field 'rulesPath'`,
          ErrorCodes.CONFIG_MISSING_REQUIRED_FIELD,
          `${profilePath}.rulesPath`
        )
      );
    } else {
      // Validate rules path
      this.validateRulesPath(profileName, profile.rulesPath, options);
    }

    // Validate optional fields
    if (
      profile.description !== undefined &&
      typeof profile.description !== 'string'
    ) {
      this.aggregator.addError(
        new ConfigurationError(
          `Profile '${profileName}' description must be a string`,
          ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
          `${profilePath}.description`
        )
      );
    }

    if (!Array.isArray(profile.enabledRules)) {
      this.aggregator.addError(
        new ConfigurationError(
          `Profile '${profileName}' enabledRules must be an array`,
          ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
          `${profilePath}.enabledRules`
        )
      );
    } else {
      // Validate enabled rules array
      for (let i = 0; i < profile.enabledRules.length; i++) {
        if (typeof profile.enabledRules[i] !== 'string') {
          this.aggregator.addError(
            new ConfigurationError(
              `Profile '${profileName}' enabledRules[${i}] must be a string`,
              ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
              `${profilePath}.enabledRules[${i}]`
            )
          );
        }
      }
    }
  }

  /**
   * Validate rules path for a profile
   */
  private validateRulesPath(
    profileName: string,
    rulesPath: string,
    options: ConfigurationValidationOptions
  ): void {
    if (!options.validateRulesPaths) {
      return;
    }

    // Check if path is absolute or relative
    let resolvedPath: string;
    if (isAbsolute(rulesPath)) {
      resolvedPath = rulesPath;
    } else {
      // For relative paths, we'll assume they're relative to the config file
      // This will be resolved properly by the ConfigurationManager
      resolvedPath = resolve(process.cwd(), '.config/obsidian-lint', rulesPath);
    }

    if (options.validateFileSystem) {
      // Check if rules directory exists
      if (!existsSync(resolvedPath)) {
        this.aggregator.addError(
          new ConfigurationError(
            `Rules path for profile '${profileName}' does not exist: ${rulesPath}`,
            ErrorCodes.CONFIG_RULES_PATH_NOT_FOUND,
            `profiles.${profileName}.rulesPath`,
            { profileName, rulesPath, resolvedPath }
          )
        );
        return;
      }

      // Check if it's a directory
      if (!statSync(resolvedPath).isDirectory()) {
        this.aggregator.addError(
          new ConfigurationError(
            `Rules path for profile '${profileName}' is not a directory: ${rulesPath}`,
            ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
            `profiles.${profileName}.rulesPath`,
            { profileName, rulesPath, resolvedPath }
          )
        );
        return;
      }

      // Check for enabled directory
      const enabledPath = resolve(resolvedPath, 'enabled');
      if (!existsSync(enabledPath)) {
        this.aggregator.addWarning(
          `Rules enabled directory not found for profile '${profileName}': ${enabledPath}`
        );
      } else if (!statSync(enabledPath).isDirectory()) {
        this.aggregator.addError(
          new ConfigurationError(
            `Rules enabled path for profile '${profileName}' is not a directory: ${enabledPath}`,
            ErrorCodes.CONFIG_INVALID_FIELD_TYPE,
            `profiles.${profileName}.rulesPath`,
            { profileName, rulesPath, enabledPath }
          )
        );
      }
    }
  }

  /**
   * Perform cross-validation checks
   */
  private performCrossValidation(
    config: Configuration,
    options: ConfigurationValidationOptions
  ): void {
    // Check for duplicate profile names (case-insensitive)
    const profileNames = Object.keys(config.profiles);
    const lowerCaseNames = profileNames.map(name => name.toLowerCase());
    const duplicates = lowerCaseNames.filter(
      (name, index) => lowerCaseNames.indexOf(name) !== index
    );

    if (duplicates.length > 0) {
      this.aggregator.addError(
        new ConfigurationError(
          `Duplicate profile names found (case-insensitive): ${duplicates.join(', ')}`,
          ErrorCodes.CONFIG_INVALID_PROFILE,
          'profiles',
          { duplicates }
        )
      );
    }

    // Validate consistency between general config and profiles
    if (config.general.parallel && config.general.maxConcurrency === 1) {
      this.aggregator.addWarning(
        'Parallel processing is enabled but maxConcurrency is set to 1. Consider increasing maxConcurrency for better performance.'
      );
    }

    // Check for reasonable configuration combinations
    if (config.general.dryRun && config.general.fix) {
      this.aggregator.addWarning(
        'Both dryRun and fix are enabled. In dry-run mode, fixes will be shown but not applied.'
      );
    }
  }

  /**
   * Validate configuration file structure before parsing
   */
  validateConfigurationFileStructure(configContent: string): ValidationResult {
    this.aggregator.clear();

    try {
      // Basic structure validation
      if (!configContent || configContent.trim() === '') {
        this.aggregator.addError(
          new ConfigurationError(
            'Configuration file is empty',
            ErrorCodes.CONFIG_VALIDATION_FAILED
          )
        );
        return this.aggregator.toValidationResult();
      }

      // Check for required sections
      const requiredSections = ['[general]', '[profiles]'];
      for (const section of requiredSections) {
        if (!configContent.includes(section)) {
          this.aggregator.addWarning(
            `Configuration file missing recommended section: ${section}`
          );
        }
      }

      // Check for common TOML syntax issues
      const lines = configContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNumber = i + 1;

        // Skip empty lines and comments
        if (line === '' || line.startsWith('#')) {
          continue;
        }

        // Check for unquoted strings with spaces
        if (line.includes('=') && !line.includes('"') && line.includes(' ')) {
          const [key, value] = line.split('=').map(s => s.trim());
          if (
            value &&
            !value.startsWith('[') &&
            !value.match(/^(true|false|\d+)$/)
          ) {
            this.aggregator.addWarning(
              `Line ${lineNumber}: Consider quoting string value for '${key}': ${value}`
            );
          }
        }
      }
    } catch (error) {
      this.aggregator.addError(
        new ConfigurationError(
          `Error validating configuration file structure: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCodes.CONFIG_VALIDATION_FAILED,
          undefined,
          { originalError: error }
        )
      );
    }

    return this.aggregator.toValidationResult();
  }

  /**
   * Generate configuration validation report
   */
  generateValidationReport(result: ValidationResult): string {
    let report = '=== Configuration Validation Report ===\n\n';

    if (result.valid) {
      report += '✅ Configuration is valid\n';
    } else {
      report += '❌ Configuration validation failed\n';
    }

    if (result.errors.length > 0) {
      report += `\nErrors (${result.errors.length}):\n`;
      result.errors.forEach((error, index) => {
        report += `${index + 1}. [${error.code}] ${error.message}\n`;
        if (error instanceof ConfigurationError && error.path) {
          report += `   Path: ${error.path}\n`;
        }
        if (error.context) {
          const contextEntries = Object.entries(error.context)
            .filter(([key]) => key !== 'originalError')
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join(', ');
          if (contextEntries) {
            report += `   Context: ${contextEntries}\n`;
          }
        }
        report += '\n';
      });
    }

    if (result.warnings.length > 0) {
      report += `Warnings (${result.warnings.length}):\n`;
      result.warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning}\n`;
      });
      report += '\n';
    }

    report += '=== End Report ===\n';
    return report;
  }
}
