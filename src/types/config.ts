/**
 * Configuration Type Definitions
 */

export interface Configuration {
  general: GeneralConfig;
  activeProfile: string;
  profiles: Record<string, ProfileConfig>;
}

export interface GeneralConfig {
  vaultRoot?: string | undefined;
  dryRun: boolean;
  verbose: boolean;
  fix: boolean;
  parallel: boolean;
  maxConcurrency: number;
}

export interface ProfileConfig {
  name: string;
  description: string;
  rulesPath: string;
  enabledRules: string[]; // Auto-discovered from enabled/ directory
}

export interface ConfigurationPaths {
  global: string;
  vault: string;
  xdgConfig: string;
}

export interface ConfigurationLoadResult {
  config: Configuration;
  source: "global" | "vault" | "xdg" | "default";
  path?: string;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errors: ConfigurationError[];
  warnings: string[];
}

export interface ConfigurationError {
  code: string;
  message: string;
  path?: string;
  context?: Record<string, any>;
}

export enum ConfigurationErrorCodes {
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  INVALID_TOML = "INVALID_TOML",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FIELD_TYPE = "INVALID_FIELD_TYPE",
  INVALID_PROFILE = "INVALID_PROFILE",
  PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND",
  RULES_PATH_NOT_FOUND = "RULES_PATH_NOT_FOUND",
}

// Raw TOML structure interfaces for parsing
export interface RawTomlConfig {
  general?: {
    vault_root?: string;
    dry_run?: boolean;
    verbose?: boolean;
    fix?: boolean;
    parallel?: boolean;
    max_concurrency?: number;
  };
  profiles?: {
    active?: string;
    [profileName: string]: any;
  };
}
