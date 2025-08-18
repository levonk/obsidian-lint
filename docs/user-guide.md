# Obsidian Lint Tool - User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Rules and Profiles](#rules-and-profiles)
6. [Rule Categories](#rule-categories)
7. [Advanced Usage](#advanced-usage)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [Examples](#examples)

## Introduction

The Obsidian Lint Tool is a comprehensive linting and fixing solution for Obsidian vaults that ensures notes conform to established organizational standards. It operates both as a standalone CLI utility and as an Obsidian plugin, providing automated analysis, validation, and correction of notes based on configurable rules.

### Key Features

- **Dual Interface**: Works as both CLI tool and Obsidian plugin
- **Configurable Rules**: Extensive rule system with multiple variants
- **Profile-Based Configuration**: Different rule sets for different vault types
- **Parallel Processing**: Efficient handling of large vaults
- **Comprehensive Reporting**: Detailed analysis and fix reporting
- **Real-time Linting**: Live feedback in Obsidian editor (plugin mode)

## Installation

### CLI Installation

```bash
# Install globally via npm
npm install -g obsidian-lint

# Or use with npx (no installation required)
npx obsidian-lint [options] [vault-path]

# Direct execution (after making executable)
chmod +x obsidian-lint
./obsidian-lint [options] [vault-path]
```

### Obsidian Plugin Installation

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Obsidian Lint"
4. Install and enable the plugin

## Quick Start

### Basic CLI Usage

```bash
# Lint current directory (dry-run mode)
obsidian-lint

# Fix issues in current directory
obsidian-lint fix

# Lint specific vault
obsidian-lint /path/to/vault

# Preview changes without applying
obsidian-lint fix --dry-run
```

### Basic Plugin Usage

1. Open Command Palette (Ctrl/Cmd + P)
2. Search for "Obsidian Lint"
3. Choose desired action:
   - "Lint Current File"
   - "Lint Entire Vault"
   - "Fix Current File"
   - "Fix Entire Vault"

## Configuration

### Configuration File Location

The tool looks for configuration files in the following order:

1. `$XDG_CONFIG_HOME/obsidian-lint/obsidian-lint.toml`
2. `~/.config/obsidian-lint/obsidian-lint.toml`
3. `.config/obsidian-lint/obsidian-lint.toml` (in vault root)

### Basic Configuration Structure

```toml
[general]
vault_root = "/path/to/your/vault"
dry_run = false
verbose = true
fix = true
parallel = true
max_concurrency = 4

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
description = "Standard Obsidian organization rules"
rules_path = "rules/default"
```

### Configuration Options

#### General Settings

- `vault_root`: Path to Obsidian vault (optional, defaults to current directory)
- `dry_run`: Show changes without applying them (default: false)
- `verbose`: Enable detailed logging (default: false)
- `fix`: Enable automatic fixing of issues (default: false)
- `parallel`: Enable parallel processing (default: true)
- `max_concurrency`: Maximum concurrent operations (default: 4)

#### Profile Settings

- `active`: Name of the active profile to use
- `[profiles.{name}]`: Profile-specific configuration
  - `name`: Display name for the profile
  - `description`: Profile description
  - `rules_path`: Path to rules directory relative to config

## Rules and Profiles

### Understanding Profiles

Profiles allow you to have different sets of rules for different types of vaults or use cases:

- **Default**: Standard rules for general use
- **Work**: Minimal rules for professional vaults
- **Personal**: Comprehensive rules for personal knowledge management
- **Academic**: Rules optimized for research and academic writing

### Rule Organization

Rules are organized in a hierarchical directory structure:

```
.config/obsidian-lint/
├── obsidian-lint.toml
└── rules/
    ├── default/
    │   ├── enabled/
    │   │   ├── frontmatter-required-fields.strict.toml
    │   │   ├── attachment-organization.centralized.toml
    │   │   └── linking-internal.strict-brackets.toml
    │   └── disabled/
    │       ├── frontmatter-required-fields.minimal.toml
    │       └── attachment-organization.keep-with-note.toml
    ├── work/
    │   └── enabled/
    │       └── frontmatter-required-fields.minimal.toml
    └── personal/
        └── enabled/
            ├── frontmatter-required-fields.strict.toml
            ├── attachment-organization.centralized.toml
            ├── tag-from-folders.hierarchical.toml
            └── moc-linking.automatic.toml
```

### Rule Variants and Conflicts

Each rule category has multiple variants, but only one variant per major ID can be enabled:

- ✅ `frontmatter-required-fields.strict` (enabled)
- ❌ `frontmatter-required-fields.minimal` (conflicts with strict)
- ✅ `attachment-organization.centralized` (enabled)
- ❌ `attachment-organization.keep-with-note` (conflicts with centralized)

### Enabling/Disabling Rules

To enable a rule: Move the `.toml` file to the `enabled/` directory
To disable a rule: Move the `.toml` file to the `disabled/` directory or delete it

## Rule Categories

### Frontmatter Rules

Ensure consistent frontmatter across all notes.

**Available Variants:**

- `frontmatter-required-fields.strict`: All fields required
- `frontmatter-required-fields.minimal`: Only essential fields
- `frontmatter-required-fields.custom`: User-defined field set

**Example Configuration:**

```toml
[rule]
id = "frontmatter-required-fields.strict"
name = "Strict Frontmatter Validation"
description = "Ensures all notes have complete frontmatter"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = ["Templates/**", "Archive/**"]

[settings]
required_fields = ["title", "aliases", "tags", "status", "date_created", "date_updated"]
date_format = "YYYY-MM-DD"
status_values = ["draft", "in-progress", "active", "on-hold", "archived"]
```

### File Organization Rules

Manage file naming and directory structure.

**Available Variants:**

- `file-naming.kebab-case`: Use kebab-case naming
- `file-naming.camel-case`: Use camelCase naming
- `file-naming.space-separated`: Use spaces in names
- `file-path-organization.by-date`: Organize by creation date
- `file-path-organization.by-topic`: Organize by topic/category
- `file-path-organization.flat`: Keep flat structure

### Attachment Management Rules

Handle images, PDFs, and other attachments.

**Available Variants:**

- `attachment-organization.centralized`: Move to Meta/Attachments
- `attachment-organization.keep-with-note`: Keep near referencing notes
- `attachment-organization.by-type`: Organize by file type
- `attachment-format-preference.convert-to-png`: Convert images to PNG
- `attachment-format-preference.preserve-original`: Keep original formats

### Linking Rules

Manage internal and external links.

**Available Variants:**

- `linking-internal.strict-brackets`: Enforce [[]] format
- `linking-internal.flexible`: Allow multiple formats
- `linking-external.validate-urls`: Check external link validity
- `linking-external.preserve-as-is`: Don't modify external links

### Tag Management Rules

Ensure consistent tagging across the vault.

**Available Variants:**

- `tag-from-folders.hierarchical`: Create hierarchical tags from folders
- `tag-from-folders.flat`: Create flat tags from folders
- `tag-from-context.automatic`: Auto-generate tags from content
- `tag-based-paths.enforce`: Enforce folder structure based on tags

### MOC (Map of Content) Rules

Generate and maintain Maps of Content.

**Available Variants:**

- `moc-linking.automatic`: Automatically create MOCs
- `moc-linking.manual`: Manual MOC management
- `moc-linking.hybrid`: Combination of automatic and manual

## Advanced Usage

### Custom Rule Creation

Create custom rules by adding new `.toml` files:

```toml
[rule]
id = "custom-rule.my-variant"
name = "My Custom Rule"
description = "Custom rule for specific needs"
category = "custom"

[config]
path_allowlist = ["**/*.md"]
path_denylist = ["Templates/**"]
include_patterns = ["**/*"]
exclude_patterns = [".*", "node_modules/**"]

[settings]
# Custom settings for your rule
custom_setting = "value"
another_setting = true
```

### Batch Operations

Process multiple vaults or perform bulk operations:

```bash
# Process multiple vaults
for vault in /path/to/vaults/*; do
  obsidian-lint fix "$vault"
done

# Generate reports for all vaults
obsidian-lint lint --json /path/to/vault1 > report1.json
obsidian-lint lint --json /path/to/vault2 > report2.json
```

### Integration with Scripts

Use the tool in automation scripts:

```bash
#!/bin/bash

# Pre-commit hook example
if ! obsidian-lint check --quiet; then
  echo "Vault has linting issues. Run 'obsidian-lint fix' to resolve."
  exit 1
fi

# Backup before fixing
cp -r vault vault-backup
obsidian-lint fix vault

# Generate report
obsidian-lint lint --json vault > lint-report.json
```

## Troubleshooting

### Common Issues

#### Configuration Not Found

```
Error: Configuration file not found
```

**Solution**: Create a configuration file in one of the expected locations or use `--config` to specify the path.

#### Rule Conflicts

```
Error: Rule conflict detected: frontmatter-required-fields
```

**Solution**: Ensure only one variant per major rule ID is enabled. Move conflicting rules to the `disabled/` directory.

#### Permission Errors

```
Error: EACCES: permission denied
```

**Solution**: Check file permissions and ensure the tool has write access to the vault directory.

#### Memory Issues with Large Vaults

```
Error: JavaScript heap out of memory
```

**Solution**: Reduce `max_concurrency` in configuration or process the vault in smaller batches.

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
obsidian-lint --verbose --dry-run /path/to/vault
```

### Performance Issues

For large vaults, optimize performance:

```toml
[general]
parallel = true
max_concurrency = 8  # Adjust based on your system
```

## Best Practices

### Vault Organization

1. **Start with Minimal Rules**: Begin with basic rules and gradually add more
2. **Use Profiles**: Create different profiles for different vault types
3. **Regular Maintenance**: Run linting regularly to catch issues early
4. **Backup Before Fixing**: Always backup your vault before running fixes

### Rule Configuration

1. **Test in Dry-Run Mode**: Always test rules with `--dry-run` first
2. **Gradual Implementation**: Enable rules incrementally
3. **Document Custom Rules**: Add clear descriptions to custom rules
4. **Version Control**: Keep your configuration in version control

### Performance Optimization

1. **Use Path Filters**: Exclude unnecessary directories with `path_denylist`
2. **Parallel Processing**: Enable parallel processing for large vaults
3. **Incremental Processing**: Use incremental mode for regular maintenance
4. **Monitor Resources**: Watch memory and CPU usage during processing

## Examples

### Example 1: Academic Vault Setup

```toml
[general]
vault_root = "/Users/researcher/ObsidianVault"
fix = true
parallel = true

[profiles]
active = "academic"

[profiles.academic]
name = "Academic Research Profile"
description = "Rules optimized for academic research"
rules_path = "rules/academic"
```

Rules for academic profile:

- Strict frontmatter with citation fields
- Hierarchical tagging by research area
- Centralized attachment organization
- Automatic MOC generation for literature reviews

### Example 2: Work Vault Setup

```toml
[general]
vault_root = "/Users/employee/WorkVault"
fix = false  # Be conservative in work environment
dry_run = true

[profiles]
active = "work"

[profiles.work]
name = "Work Profile"
description = "Minimal rules for professional use"
rules_path = "rules/work"
```

Rules for work profile:

- Minimal frontmatter requirements
- Flexible file naming
- Preserve existing organization
- No automatic MOC generation

### Example 3: Personal Knowledge Management

```toml
[general]
vault_root = "/Users/person/PersonalVault"
fix = true
parallel = true
verbose = true

[profiles]
active = "personal"

[profiles.personal]
name = "Personal PKM Profile"
description = "Comprehensive personal knowledge management"
rules_path = "rules/personal"
```

Rules for personal profile:

- Comprehensive frontmatter
- Hierarchical tagging from folders
- Centralized attachments with optimization
- Automatic MOC generation
- Link validation and fixing
- Content quality checks

### Example 4: Multi-Vault Management

```bash
#!/bin/bash
# Script to manage multiple vaults with different profiles

VAULTS=(
  "/path/to/work-vault:work"
  "/path/to/personal-vault:personal"
  "/path/to/research-vault:academic"
)

for vault_config in "${VAULTS[@]}"; do
  IFS=':' read -r vault_path profile <<< "$vault_config"
  echo "Processing $vault_path with $profile profile..."

  obsidian-lint fix \
    --profile "$profile" \
    --verbose \
    "$vault_path"
done
```

This comprehensive user guide provides everything users need to effectively use the Obsidian Lint Tool, from basic setup to advanced configuration and troubleshooting.
