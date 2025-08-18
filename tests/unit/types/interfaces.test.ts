/**
 * Test for core type definitions and interfaces
 */

import { describe, test, expect } from "bun:test";
import type {
  Configuration,
  GeneralConfig,
  ProfileConfig,
  Rule,
  RuleId,
  RuleConfig,
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
  ValidationResult,
  ConflictResult,
  ConflictGroup,
  BaseRule,
  RuleDefinition,
  RuleLoader,
  RuleExecutor,
} from "../../../src/types/index.js";

describe("Type Definitions", () => {
  test("should define RuleId interface with major/minor structure", () => {
    const ruleId: RuleId = {
      major: "attachment-organization",
      minor: "centralized",
      full: "attachment-organization.centralized",
    };

    expect(ruleId.major).toBe("attachment-organization");
    expect(ruleId.minor).toBe("centralized");
    expect(ruleId.full).toBe("attachment-organization.centralized");
  });

  test("should define ProcessOptions interface", () => {
    const options: ProcessOptions = {
      dryRun: false,
      fix: true,
      verbose: false,
      rules: ["rule1", "rule2"],
      ignore: ["ignore1"],
      generateMoc: true,
      parallel: true,
    };

    expect(options.dryRun).toBe(false);
    expect(options.fix).toBe(true);
    expect(options.parallel).toBe(true);
  });

  test("should define Issue interface", () => {
    const issue: Issue = {
      ruleId: "test-rule",
      severity: "error",
      message: "Test issue",
      file: "test.md",
      line: 1,
      column: 1,
      fixable: true,
    };

    expect(issue.ruleId).toBe("test-rule");
    expect(issue.severity).toBe("error");
    expect(issue.fixable).toBe(true);
  });

  test("should define Fix interface", () => {
    const fix: Fix = {
      ruleId: "test-rule",
      file: "test.md",
      description: "Test fix",
      changes: [],
    };

    expect(fix.ruleId).toBe("test-rule");
    expect(fix.file).toBe("test.md");
    expect(Array.isArray(fix.changes)).toBe(true);
  });

  test("should define MarkdownFile interface", () => {
    const markdownFile: MarkdownFile = {
      path: "test.md",
      content: "# Test",
      frontmatter: { title: "Test" },
      headings: [],
      links: [],
      attachments: [],
      ast: { type: "root", children: [] },
    };

    expect(markdownFile.path).toBe("test.md");
    expect(markdownFile.frontmatter.title).toBe("Test");
    expect(markdownFile.ast.type).toBe("root");
  });

  test("should define Configuration interface", () => {
    const config: Configuration = {
      general: {
        vaultRoot: "/path/to/vault",
        dryRun: false,
        verbose: true,
        fix: false,
        parallel: true,
        maxConcurrency: 4,
      },
      activeProfile: "default",
      profiles: {
        default: {
          name: "Default",
          description: "Default profile",
          rulesPath: "rules/default",
          enabledRules: [],
        },
      },
    };

    expect(config.activeProfile).toBe("default");
    expect(config.general.maxConcurrency).toBe(4);
    expect(config.profiles.default.name).toBe("Default");
  });

  test("should define LintResult interface", () => {
    const result: LintResult = {
      filesProcessed: 10,
      issuesFound: [],
      fixesApplied: [],
      errors: [],
      duration: 1000,
    };

    expect(result.filesProcessed).toBe(10);
    expect(result.duration).toBe(1000);
    expect(Array.isArray(result.issuesFound)).toBe(true);
  });
});
