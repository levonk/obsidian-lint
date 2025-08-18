# Requirements Document

## Introduction

The Obsidian Lint Tool is a comprehensive linting and fixing solution for Obsidian vaults that ensures notes conform to established organizational standards. The tool operates both as a standalone CLI utility (installable via npm and runnable with npx) and as an Obsidian plugin, providing automated analysis, validation, and correction of notes based on configurable rules. The system helps maintain consistency across large vaults by enforcing frontmatter standards, proper linking strategies, file organization, and content structure.

## Requirements

### Requirement 1: Configuration Management

**User Story:** As a vault maintainer, I want to configure linting rules and behavior through configuration files, so that I can customize the tool to match my vault's specific organizational standards.

#### Acceptance Criteria

1. WHEN the tool starts THEN the system SHALL load configuration from `$XDG_CONFIG_HOME/obsidian-lint/obsidian-lint.toml` or `~/.config/obsidian-lint/obsidian-lint.toml`
2. IF the primary configuration file is not found THEN the system SHALL fallback to `.config/obsidian-lint/obsidian-lint.toml` in the vault root
3. WHEN configuration is loaded THEN the system SHALL support general settings including vault_root, dry_run, verbose, fix parameters, and active_profile in the main config file
4. WHEN rule discovery occurs THEN the system SHALL scan `.config/obsidian-lint/rules/{profile}/enabled/**/*.toml` for active rules using the configured profile (defaulting to "default")
5. WHEN rule files are loaded THEN the system SHALL recursively discover all `.toml` files in the enabled directory using glob pattern `**/*.toml`
6. WHEN documentation is present THEN the system SHALL ignore `README.md` and other non-`.toml` files in the rules directory structure
7. WHEN rule definitions are processed THEN each rule file SHALL contain rule logic, rule-specific settings, path-allowlist, path-denylist, and include/exclude patterns
8. WHEN rule organization is needed THEN users MAY organize rules in subdirectories within the enabled folder for better organization
9. WHEN rule profiles are used THEN different profiles SHALL allow different sets of enabled rules for different vault types or use cases

### Requirement 2: Rule-Based Linting System

**User Story:** As a content creator, I want the tool to identify and fix issues in my notes based on configurable rules, so that my vault maintains consistent organization and formatting.

#### Acceptance Criteria

1. WHEN the tool analyzes files THEN the system SHALL implement a pluggable rule system loaded from individual rule files in the profile's enabled directory
2. WHEN a rule is executed THEN each rule SHALL be capable of both detecting and fixing issues
3. WHEN rules are discovered THEN the system SHALL automatically load all `.toml` files from the active profile's enabled directory without requiring explicit enablement lists
4. WHEN rule files are loaded THEN each rule file SHALL contain its own configuration including hierarchical rule ID (major.minor), path-allowlist, path-denylist, include/exclude glob patterns, and rule-specific settings
5. WHEN rule isolation is maintained THEN rule-specific configuration SHALL be entirely contained within individual rule files
6. WHEN rule management is needed THEN users SHALL enable/disable rules by moving `.toml` files between enabled and disabled directories or by removing them entirely
7. WHEN linting is performed THEN the system SHALL generate a comprehensive report of all issues found
8. WHEN the --fix flag is used THEN the system SHALL automatically apply corrections for fixable issues

### Requirement 3: Frontmatter Validation and Management

**User Story:** As a knowledge worker, I want all my notes to have consistent and complete frontmatter, so that I can effectively organize and search my content.

#### Acceptance Criteria

1. WHEN a note is analyzed THEN the system SHALL verify the presence of required frontmatter fields: title, aliases, tags, status, date_created, and date_updated
2. WHEN frontmatter is validated THEN the system SHALL ensure title is a clear, descriptive string
3. WHEN frontmatter is checked THEN the system SHALL verify aliases and tags are properly formatted YAML arrays
4. WHEN status is validated THEN the system SHALL ensure status is one of: draft, in-progress, active, on-hold, or archived
5. WHEN dates are processed THEN the system SHALL validate date_created and date_updated are in ISO format (YYYY-MM-DD)
6. WHEN frontmatter issues are found AND fix mode is enabled THEN the system SHALL add missing fields with appropriate default values

### Requirement 4: File Organization and Management

**User Story:** As a vault organizer, I want files to be properly named and located in appropriate directories, so that my vault structure remains clean and navigable.

#### Acceptance Criteria

1. WHEN files are analyzed THEN the system SHALL check file naming conventions against configured patterns
2. WHEN file locations are evaluated THEN the system SHALL suggest appropriate directory locations for misplaced files
3. WHEN attachments are processed THEN the system SHALL move attachments to the designated attachments directory
4. WHEN attachment organization is enabled THEN the system SHALL create subdirectories within the attachments folder when configured
5. WHEN duplicate files are detected THEN the system SHALL identify and report duplicate or empty files
6. WHEN file organization fixes are applied THEN the system SHALL update all internal links that reference moved files

### Requirement 5: Linking Strategy Validation

**User Story:** As a note-taker, I want all my internal and external links to be properly formatted and functional, so that navigation between notes works reliably.

#### Acceptance Criteria

1. WHEN links are analyzed THEN the system SHALL validate internal links use double bracket format `[[link]]`
2. WHEN link validation occurs THEN the system SHALL check for and report broken internal links
3. WHEN MOC linking is evaluated THEN the system SHALL ensure proper MOC linking based on note location in directory tree
4. WHEN external links are processed THEN the system SHALL verify external links are properly formatted
5. WHEN link fixes are applied THEN the system SHALL automatically correct malformed internal link syntax
6. WHEN broken links are found AND fix mode is enabled THEN the system SHALL attempt to resolve broken links by searching for similar note titles

### Requirement 6: Tag Management and Consistency

**User Story:** As a content organizer, I want consistent and meaningful tags across my vault, so that I can effectively categorize and find related content.

#### Acceptance Criteria

1. WHEN tags are analyzed THEN the system SHALL enforce consistent tag formatting across all notes
2. WHEN directory-based tagging is enabled THEN the system SHALL generate appropriate tags based on directory path
3. WHEN tag cleanup is performed THEN the system SHALL remove redundant or unused tags
4. WHEN hierarchical tagging is configured THEN the system SHALL apply hierarchical tagging patterns when appropriate
5. WHEN tag validation occurs THEN the system SHALL ensure tags follow configured naming conventions
6. WHEN context-based tagging is enabled THEN the system SHALL suggest tags based on note content and context

### Requirement 7: MOC Generation and Management

**User Story:** As a vault navigator, I want automatically generated Maps of Content (MOCs) for my directory structure, so that I can easily discover and navigate related notes.

#### Acceptance Criteria

1. WHEN MOC generation is enabled THEN the system SHALL create or update MOCs based on directory structure
2. WHEN MOC templates are configured THEN the system SHALL use configurable templates for MOC generation
3. WHEN parallel MOC structure is enabled THEN the system SHALL place MOCs in a parallel directory structure at the configured path
4. WHEN MOCs are generated THEN the system SHALL include links to all relevant notes within each directory
5. WHEN MOC updates occur THEN the system SHALL preserve manual content while updating generated sections
6. WHEN MOC linking is processed THEN the system SHALL ensure bidirectional linking between MOCs and contained notes

### Requirement 8: CLI Interface and User Experience

**User Story:** As a command-line user, I want a comprehensive CLI interface with clear options and feedback, so that I can efficiently run linting operations from scripts and automation.

#### Acceptance Criteria

1. WHEN the tool is installed THEN the system SHALL be directly executable via `obsidian-lint [options] [vault-path]` using a proper shebang
2. WHEN the tool is distributed THEN the system SHALL include a shebang line that allows direct execution without requiring `npx` prefix
3. WHEN command options are used THEN the system SHALL support --config, --fix, --dry-run, --verbose, --rules, --ignore, --generate-moc, --report, and --help flags
4. WHEN operations are running THEN the system SHALL provide clear, colorized console output with a visual progress bar showing completion percentage and current operation status
5. WHEN dry-run mode is enabled THEN the system SHALL show what would be changed without making actual changes
6. WHEN verbose mode is enabled THEN the system SHALL provide detailed information about each operation performed
7. WHEN machine-readable output is requested THEN the system SHALL support JSON output format for integration with other tools
8. WHEN the project is built THEN the system SHALL use TypeScript with ECM modules for type safety and modern JavaScript features
9. WHEN build operations are performed THEN the system SHALL use Bun as the build tool and package manager

### Requirement 9: Obsidian Plugin Integration

**User Story:** As an Obsidian user, I want the linting functionality available directly within Obsidian, so that I can maintain my vault without switching to external tools.

#### Acceptance Criteria

1. WHEN the plugin is installed THEN the system SHALL provide real-time linting and suggestions as users edit notes
2. WHEN rule violations are detected THEN the system SHALL display visual indicators within the editor
3. WHEN quick fixes are available THEN the system SHALL provide quick-fix options for common issues
4. WHEN bulk operations are requested THEN the system SHALL support running lint checks on selected files, folders, or the entire vault
5. WHEN plugin settings are accessed THEN the system SHALL provide a settings interface within Obsidian to configure the linter
6. WHEN Obsidian integration is active THEN the system SHALL use Obsidian's internal APIs for improved performance

### Requirement 10: Performance and Scalability

**User Story:** As a user with a large vault, I want the tool to process my notes efficiently, so that linting operations complete in reasonable time even with thousands of notes.

#### Acceptance Criteria

1. WHEN large vaults are processed THEN the system SHALL efficiently handle vaults with 1000+ notes
2. WHEN file processing occurs THEN the system SHALL implement parallel processing of files when possible
3. WHEN long-running operations execute THEN the system SHALL display a progress bar with percentage completion, current file being processed, and estimated time remaining
4. WHEN memory usage is monitored THEN the system SHALL maintain reasonable memory consumption during processing
5. WHEN performance optimization is needed THEN the system SHALL implement caching mechanisms for repeated operations
6. WHEN incremental processing is available THEN the system SHALL support processing only changed files when possible

### Requirement 11: Specific Rule Implementation with Variants

**User Story:** As a vault maintainer, I want comprehensive rule coverage with multiple implementation variants for each rule category, so that I can choose the specific approach that matches my organizational preferences.

#### Acceptance Criteria

1. WHEN rule categories are implemented THEN the system SHALL support multiple rule variants within each category directory structure
2. WHEN attachment organization rules are provided THEN the system SHALL include variants such as "centralized" (move to Meta/Attachments) and "keep-with-note" (attachments stay near their referencing notes)
3. WHEN attachment format rules are provided THEN the system SHALL include variants for different format preferences such as "convert-to-png", "preserve-original", "pdf-to-markdown", etc.
4. WHEN file naming rules are provided THEN the system SHALL include variants such as "kebab-case", "camel-case", "space-separated", "mixed-case", and "lowercase" naming conventions
5. WHEN rule variants are organized THEN each variant SHALL be stored in subdirectories like `rules/default/enabled/attachment-organization/centralized.toml` and `rules/default/disabled/attachment-organization/keep-with-note.toml`
6. WHEN rule IDs are assigned THEN each rule SHALL use a hierarchical ID format with major.minor structure (e.g., "attachment-organization.centralized", "attachment-organization.keep-with-note")
7. WHEN rule conflicts are detected THEN the system SHALL raise an error if multiple enabled rules share the same major ID to prevent conflicting behaviors
8. WHEN rule variants are loaded THEN the system SHALL allow only one minor variant per major ID to be enabled simultaneously
9. WHEN rule categories are implemented THEN the system SHALL include the following major IDs with multiple minor variants:
   - frontmatter-required-fields.strict, frontmatter-required-fields.minimal, frontmatter-required-fields.custom
   - headings-proper.title-match, headings-proper.hierarchy-enforced, headings-proper.flexible
   - tag-from-folders.hierarchical, tag-from-folders.flat, tag-from-folders.custom
   - tag-from-context.automatic, tag-from-context.manual, tag-from-context.hybrid
   - tag-based-paths.enforce, tag-based-paths.suggest, tag-based-paths.ignore
   - attachment-organization.centralized, attachment-organization.keep-with-note, attachment-organization.by-type
   - attachment-format-preference.convert-to-png, attachment-format-preference.preserve-original, attachment-format-preference.optimize-size
   - attachment-image-alt-text.required, attachment-image-alt-text.optional, attachment-image-alt-text.auto-generate
   - moc-linking.automatic, moc-linking.manual, moc-linking.hybrid
   - spell-correction.auto-fix, spell-correction.suggest-only, spell-correction.ignore
   - template-correction.enforce-templates, template-correction.suggest-templates, template-correction.flexible
   - file-naming.kebab-case, file-naming.camel-case, file-naming.space-separated, file-naming.mixed-case
   - file-path-organization.by-date, file-path-organization.by-topic, file-path-organization.by-type, file-path-organization.flat
   - linking-internal.strict-brackets, linking-internal.flexible, linking-internal.auto-convert
   - linking-external.validate-urls, linking-external.preserve-as-is, linking-external.convert-format
10. WHEN rule variants are documented THEN each variant SHALL include clear documentation explaining its approach, major/minor ID, and when to use it
11. WHEN rule selection is needed THEN users SHALL choose variants by moving the desired .toml file to the enabled directory and ensuring conflicting major ID variants remain in disabled
12. WHEN rule validation occurs THEN the system SHALL validate that no two enabled rules share the same major ID and report conflicts with specific rule IDs

### Requirement 12: Technical Implementation Standards

**User Story:** As a developer, I want the codebase to use modern TypeScript and tooling standards, so that the project is maintainable and follows current best practices.

#### Acceptance Criteria

1. WHEN the project is implemented THEN the system SHALL be written in TypeScript with strict type checking enabled
2. WHEN modules are structured THEN the system SHALL use ECM (ES Modules) for all imports and exports
3. WHEN dependencies are managed THEN the system SHALL use Bun as the package manager and runtime
4. WHEN the project is built THEN the system SHALL use Bun for build operations and bundling
5. WHEN code quality is maintained THEN the system SHALL include TypeScript configuration for strict mode and modern target
6. WHEN the package is distributed THEN the system SHALL be publishable to npm with proper ECM module exports
