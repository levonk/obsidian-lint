/**
 * Configuration Manager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { ConfigurationManager } from "../../../src/core/config.js";
import { ConfigurationErrorCodes } from "../../../src/types/config.js";

describe("ConfigurationManager", () => {
  let tempDir: string;
  let configManager: ConfigurationManager;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), `obsidian-lint-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    configManager = new ConfigurationManager();
  });

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("loadConfiguration", () => {
    it("should load valid TOML configuration", async () => {
      const configPath = join(tempDir, "obsidian-lint.toml");
      const configContent = `
[general]
vault_root = "/test/vault"
dry_run = true
verbose = true
fix = false
parallel = true
max_concurrency = 2

[profiles]
active = "test"

[profiles.test]
name = "Test Profile"
description = "Test configuration"
rules_path = "rules/test"
`;

      writeFileSync(configPath, configContent);

      const result = await configManager.loadConfiguration(
        undefined,
        configPath,
      );

      expect(result.config.general.vaultRoot).toBe("/test/vault");
      expect(result.config.general.dryRun).toBe(true);
      expect(result.config.general.verbose).toBe(true);
      expect(result.config.general.fix).toBe(false);
      expect(result.config.general.parallel).toBe(true);
      expect(result.config.general.maxConcurrency).toBe(2);
      expect(result.config.activeProfile).toBe("test");
      expect(result.config.profiles.test.name).toBe("Test Profile");
      expect(result.config.profiles.test.description).toBe(
        "Test configuration",
      );
      expect(result.config.profiles.test.rulesPath).toBe("rules/test");
      expect(result.source).toBe("vault");
      expect(result.path).toBe(configPath);
    });

    it("should return default configuration when no config file exists", async () => {
      const result = await configManager.loadConfiguration();

      expect(result.config.general.dryRun).toBe(false);
      expect(result.config.general.verbose).toBe(false);
      expect(result.config.general.fix).toBe(false);
      expect(result.config.general.parallel).toBe(true);
      expect(result.config.general.maxConcurrency).toBe(4);
      expect(result.config.activeProfile).toBe("default");
      expect(result.config.profiles.default).toBeDefined();
      expect(result.config.profiles.default.name).toBe("Default Profile");
      expect(result.source).toBe("default");
      expect(result.path).toBeUndefined();
    });

    it("should handle minimal configuration with defaults", async () => {
      const configPath = join(tempDir, "obsidian-lint.toml");
      const configContent = `
[general]
vault_root = "/minimal/vault"
`;

      writeFileSync(configPath, configContent);

      const result = await configManager.loadConfiguration(
        undefined,
        configPath,
      );

      expect(result.config.general.vaultRoot).toBe("/minimal/vault");
      expect(result.config.general.dryRun).toBe(false); // default
      expect(result.config.general.verbose).toBe(false); // default
      expect(result.config.general.fix).toBe(false); // default
      expect(result.config.general.parallel).toBe(true); // default
      expect(result.config.general.maxConcurrency).toBe(4); // default
      expect(result.config.activeProfile).toBe("default"); // default
      expect(result.config.profiles.default).toBeDefined(); // auto-created
    });

    it("should throw error for non-existent explicit config path", async () => {
      const nonExistentPath = join(tempDir, "non-existent.toml");

      await expect(
        configManager.loadConfiguration(undefined, nonExistentPath),
      ).rejects.toThrow(`Configuration file not found: ${nonExistentPath}`);
    });

    it("should throw error for invalid TOML syntax", async () => {
      const configPath = join(tempDir, "invalid.toml");
      const invalidContent = `
[general
vault_root = "/test"
invalid syntax here
`;

      writeFileSync(configPath, invalidContent);

      await expect(
        configManager.loadConfiguration(undefined, configPath),
      ).rejects.toThrow("Failed to parse configuration file");
    });
  });

  describe("validateConfiguration", () => {
    it("should validate correct configuration", () => {
      const config = {
        general: {
          dryRun: false,
          verbose: true,
          fix: false,
          parallel: true,
          maxConcurrency: 4,
        },
        activeProfile: "default",
        profiles: {
          default: {
            name: "Default Profile",
            description: "Test profile",
            rulesPath: "rules/default",
            enabledRules: [],
          },
        },
      };

      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid maxConcurrency", () => {
      const config = {
        general: {
          dryRun: false,
          verbose: true,
          fix: false,
          parallel: true,
          maxConcurrency: 0, // Invalid
        },
        activeProfile: "default",
        profiles: {
          default: {
            name: "Default Profile",
            description: "Test profile",
            rulesPath: "rules/default",
            enabledRules: [],
          },
        },
      };

      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(
        ConfigurationErrorCodes.INVALID_FIELD_TYPE,
      );
      expect(result.errors[0].message).toContain(
        "maxConcurrency must be at least 1",
      );
    });

    it("should detect missing active profile", () => {
      const config = {
        general: {
          dryRun: false,
          verbose: true,
          fix: false,
          parallel: true,
          maxConcurrency: 4,
        },
        activeProfile: "nonexistent",
        profiles: {
          default: {
            name: "Default Profile",
            description: "Test profile",
            rulesPath: "rules/default",
            enabledRules: [],
          },
        },
      };

      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(
        ConfigurationErrorCodes.PROFILE_NOT_FOUND,
      );
      expect(result.errors[0].message).toContain(
        "Active profile 'nonexistent' not found",
      );
    });

    it("should detect missing required profile fields", () => {
      const config = {
        general: {
          dryRun: false,
          verbose: true,
          fix: false,
          parallel: true,
          maxConcurrency: 4,
        },
        activeProfile: "test",
        profiles: {
          test: {
            name: "", // Missing name
            description: "Test profile",
            rulesPath: "", // Missing rulesPath
            enabledRules: [],
          },
        },
      };

      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(
        result.errors.some(
          (e) => e.code === ConfigurationErrorCodes.MISSING_REQUIRED_FIELD,
        ),
      ).toBe(true);
    });

    it("should generate warnings for unusual configurations", () => {
      const config = {
        general: {
          dryRun: false,
          verbose: true,
          fix: false,
          parallel: true,
          maxConcurrency: 16, // High concurrency
        },
        activeProfile: "default",
        profiles: {
          default: {
            name: "Default Profile",
            description: "Test profile",
            rulesPath: "rules/default",
            enabledRules: [],
          },
        },
      };

      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(
        "High concurrency setting may impact performance",
      );
    });
  });

  describe("getActiveProfile", () => {
    it("should return active profile configuration", () => {
      const config = {
        general: {
          dryRun: false,
          verbose: true,
          fix: false,
          parallel: true,
          maxConcurrency: 4,
        },
        activeProfile: "test",
        profiles: {
          test: {
            name: "Test Profile",
            description: "Test profile",
            rulesPath: "rules/test",
            enabledRules: [],
          },
        },
      };

      const activeProfile = configManager.getActiveProfile(config);

      expect(activeProfile.name).toBe("Test Profile");
      expect(activeProfile.description).toBe("Test profile");
      expect(activeProfile.rulesPath).toBe("rules/test");
    });

    it("should throw error for missing active profile", () => {
      const config = {
        general: {
          dryRun: false,
          verbose: true,
          fix: false,
          parallel: true,
          maxConcurrency: 4,
        },
        activeProfile: "nonexistent",
        profiles: {
          default: {
            name: "Default Profile",
            description: "Test profile",
            rulesPath: "rules/default",
            enabledRules: [],
          },
        },
      };

      expect(() => configManager.getActiveProfile(config)).toThrow(
        "Active profile 'nonexistent' not found",
      );
    });
  });

  describe("resolveRulesPath", () => {
    it("should resolve relative rules path", () => {
      const configPath = "/path/to/config/obsidian-lint.toml";
      const rulesPath = "rules/default";

      const resolved = configManager.resolveRulesPath(configPath, rulesPath);

      expect(resolved).toBe(resolve("/path/to/config", "rules/default"));
    });

    it("should return absolute rules path unchanged", () => {
      const configPath = "/path/to/config/obsidian-lint.toml";
      const rulesPath = "/absolute/path/to/rules";

      const resolved = configManager.resolveRulesPath(configPath, rulesPath);

      expect(resolved).toBe(resolve("/absolute/path/to/rules"));
    });
  });

  describe("fallback configuration loading", () => {
    it("should prefer XDG config over global config", async () => {
      // Create XDG config directory structure
      const xdgConfigDir = join(tempDir, ".config", "obsidian-lint");
      mkdirSync(xdgConfigDir, { recursive: true });

      const xdgConfigPath = join(xdgConfigDir, "obsidian-lint.toml");
      const xdgContent = `
[general]
vault_root = "/xdg/vault"
`;

      // Create global config directory structure
      const globalConfigDir = join(
        tempDir,
        "global",
        ".config",
        "obsidian-lint",
      );
      mkdirSync(globalConfigDir, { recursive: true });

      const globalConfigPath = join(globalConfigDir, "obsidian-lint.toml");
      const globalContent = `
[general]
vault_root = "/global/vault"
`;

      writeFileSync(xdgConfigPath, xdgContent);
      writeFileSync(globalConfigPath, globalContent);

      // Mock environment to use our temp directory
      const originalXDG = process.env.XDG_CONFIG_HOME;
      const originalHome = process.env.HOME;

      process.env.XDG_CONFIG_HOME = join(tempDir, ".config");
      process.env.HOME = join(tempDir, "global");

      try {
        const result = await configManager.loadConfiguration();

        expect(result.config.general.vaultRoot).toBe("/xdg/vault");
        expect(result.source).toBe("xdg");
      } finally {
        // Restore environment
        if (originalXDG !== undefined) {
          process.env.XDG_CONFIG_HOME = originalXDG;
        } else {
          delete process.env.XDG_CONFIG_HOME;
        }
        if (originalHome !== undefined) {
          process.env.HOME = originalHome;
        } else {
          delete process.env.HOME;
        }
      }
    });
  });
});
