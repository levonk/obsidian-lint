/**
 * TypeScript Type Definitions
 */

export * from "./config.js";
export * from "./rules.js";
export * from "./common.js";

// Re-export commonly used types for convenience
export type {
  Configuration,
  GeneralConfig,
  ProfileConfig,
  ConfigurationPaths,
  ConfigurationLoadResult,
  ConfigurationValidationResult,
  ConfigurationError,
  ConfigurationErrorCodes,
  RawTomlConfig,
} from "./config.js";

export type {
  Rule,
  RuleId,
  RuleConfig,
  BaseRule,
  RuleDefinition,
  RuleLoader,
  RuleExecutor,
} from "./rules.js";

export type {
  ProcessOptions,
  LintResult,
  Issue,
  Fix,
  MarkdownFile,
  FileChange,
  Heading,
  Link,
  Attachment,
  MarkdownAST,
  MarkdownNode,
} from "./common.js";
