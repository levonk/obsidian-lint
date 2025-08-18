/**
 * Plugin settings interface and default values
 * Manages configuration for the Obsidian plugin integration
 */

export interface PluginSettings {
  /** Path to the configuration file */
  configPath: string;

  /** Active configuration profile */
  activeProfile: string;

  /** Enable real-time linting as user types */
  realTimeLinting: boolean;

  /** Show inline error indicators in the editor */
  showInlineErrors: boolean;

  /** Automatically apply fixes when possible */
  autoFix: boolean;

  /** Enable verbose logging */
  verbose: boolean;

  /** Enable parallel processing for better performance */
  enableParallelProcessing: boolean;

  /** Maximum number of concurrent operations */
  maxConcurrency: number;

  /** List of enabled rule IDs */
  enabledRules: string[];

  /** List of disabled rule IDs */
  disabledRules: string[];

  /** Show progress notifications for long operations */
  showProgressNotifications: boolean;

  /** Automatically save files after fixing */
  autoSaveAfterFix: boolean;

  /** Debounce delay for real-time linting (in milliseconds) */
  realTimeLintingDelay: number;

  /** Enable dry run mode for bulk operations */
  dryRun: boolean;
}

/**
 * Default plugin settings
 */
export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
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
};

/**
 * Validates plugin settings and returns corrected settings
 */
export function validatePluginSettings(
  settings: Partial<PluginSettings>
): PluginSettings {
  const validated: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };

  // Validate and assign each setting
  if (typeof settings.configPath === 'string') {
    validated.configPath = settings.configPath;
  }

  if (
    typeof settings.activeProfile === 'string' &&
    settings.activeProfile.trim()
  ) {
    validated.activeProfile = settings.activeProfile.trim();
  }

  if (typeof settings.realTimeLinting === 'boolean') {
    validated.realTimeLinting = settings.realTimeLinting;
  }

  if (typeof settings.showInlineErrors === 'boolean') {
    validated.showInlineErrors = settings.showInlineErrors;
  }

  if (typeof settings.autoFix === 'boolean') {
    validated.autoFix = settings.autoFix;
  }

  if (typeof settings.verbose === 'boolean') {
    validated.verbose = settings.verbose;
  }

  if (typeof settings.enableParallelProcessing === 'boolean') {
    validated.enableParallelProcessing = settings.enableParallelProcessing;
  }

  if (typeof settings.maxConcurrency === 'number') {
    validated.maxConcurrency = Math.max(
      1,
      Math.min(16, Math.floor(settings.maxConcurrency))
    );
  }

  if (Array.isArray(settings.enabledRules)) {
    validated.enabledRules = settings.enabledRules.filter(
      rule => typeof rule === 'string' && rule.trim().length > 0
    );
  }

  if (Array.isArray(settings.disabledRules)) {
    validated.disabledRules = settings.disabledRules.filter(
      rule => typeof rule === 'string' && rule.trim().length > 0
    );
  }

  if (typeof settings.showProgressNotifications === 'boolean') {
    validated.showProgressNotifications = settings.showProgressNotifications;
  }

  if (typeof settings.autoSaveAfterFix === 'boolean') {
    validated.autoSaveAfterFix = settings.autoSaveAfterFix;
  }

  if (typeof settings.realTimeLintingDelay === 'number') {
    validated.realTimeLintingDelay = Math.max(
      100,
      Math.min(5000, Math.floor(settings.realTimeLintingDelay))
    );
  }

  if (typeof settings.dryRun === 'boolean') {
    validated.dryRun = settings.dryRun;
  }

  return validated;
}

/**
 * Converts plugin settings to a serializable format
 */
export function serializePluginSettings(
  settings: PluginSettings
): Record<string, any> {
  return {
    configPath: settings.configPath,
    activeProfile: settings.activeProfile,
    realTimeLinting: settings.realTimeLinting,
    showInlineErrors: settings.showInlineErrors,
    autoFix: settings.autoFix,
    verbose: settings.verbose,
    enableParallelProcessing: settings.enableParallelProcessing,
    maxConcurrency: settings.maxConcurrency,
    enabledRules: [...settings.enabledRules],
    disabledRules: [...settings.disabledRules],
    showProgressNotifications: settings.showProgressNotifications,
    autoSaveAfterFix: settings.autoSaveAfterFix,
    realTimeLintingDelay: settings.realTimeLintingDelay,
    dryRun: settings.dryRun,
  };
}

/**
 * Deserializes plugin settings from stored data
 */
export function deserializePluginSettings(data: any): PluginSettings {
  if (!data || typeof data !== 'object') {
    return DEFAULT_PLUGIN_SETTINGS;
  }

  return validatePluginSettings(data);
}
