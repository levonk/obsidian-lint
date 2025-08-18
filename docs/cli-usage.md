# CLI Usage Documentation

## Installation

The Obsidian Lint Tool can be installed via npm and run directly:

```bash
# Install globally
npm install -g obsidian-lint

# Or run with npx
npx obsidian-lint [options] [vault-path]
```

## Direct Execution

The CLI includes a proper shebang (`#!/usr/bin/env bun`) and can be executed directly:

```bash
# Make executable (Unix/Linux/macOS)
chmod +x obsidian-lint

# Run directly
./obsidian-lint [options] [vault-path]
```

## Commands

### `lint` (default)

Run linting on an Obsidian vault without making changes.

```bash
obsidian-lint lint [options] [vault-path]
```

**Options:**

- `-d, --dry-run` - Show changes without applying them
- `--parallel` - Enable parallel processing (default: true)
- `--progress` - Show progress bar (default: true)
- `--rules <rules...>` - Specific rules to run
- `--ignore <patterns...>` - Patterns to ignore
- `--generate-moc` - Generate Maps of Content

**Examples:**

```bash
# Lint current directory
obsidian-lint lint

# Lint specific vault
obsidian-lint lint /path/to/vault

# Lint with dry-run mode
obsidian-lint lint --dry-run

# Lint with specific rules only
obsidian-lint lint --rules frontmatter-required-fields.strict
```

### `fix`

Run linting with auto-fix enabled to automatically correct issues.

```bash
obsidian-lint fix [options] [vault-path]
```

**Options:** Same as `lint` command

**Examples:**

```bash
# Fix issues in current directory
obsidian-lint fix

# Preview fixes without applying (dry-run)
obsidian-lint fix --dry-run

# Fix with verbose output
obsidian-lint fix --verbose
```

### `check`

Validate configuration and rules without processing files.

```bash
obsidian-lint check [vault-path]
```

**Examples:**

```bash
# Check configuration
obsidian-lint check

# Check with verbose output
obsidian-lint check --verbose
```

### `rules`

List available rules and their status.

```bash
obsidian-lint rules [options]
```

**Options:**

- `--enabled` - Show only enabled rules
- `--disabled` - Show only disabled rules
- `--category <category>` - Filter by rule category

**Examples:**

```bash
# List all rules
obsidian-lint rules

# List only enabled rules
obsidian-lint rules --enabled

# List rules in specific category
obsidian-lint rules --category frontmatter

# Get rules in JSON format
obsidian-lint rules --json
```

### `profiles`

Manage configuration profiles.

```bash
obsidian-lint profiles [options]
```

**Options:**

- `--list` - List available profiles (default)
- `--active` - Show active profile
- `--switch <profile>` - Switch to a different profile

**Examples:**

```bash
# List available profiles
obsidian-lint profiles

# Show active profile
obsidian-lint profiles --active

# Get profiles in JSON format
obsidian-lint profiles --json
```

## Global Options

These options can be used with any command:

- `-c, --config <path>` - Path to configuration file
- `-p, --profile <name>` - Configuration profile to use (default: "default")
- `-v, --verbose` - Enable verbose output
- `--json` - Output results in JSON format
- `-V, --version` - Output version number
- `-h, --help` - Display help information

## Examples

### Basic Usage

```bash
# Lint current directory with default settings
obsidian-lint

# Lint specific vault
obsidian-lint /path/to/my-vault

# Fix issues in vault
obsidian-lint fix /path/to/my-vault
```

### Configuration

```bash
# Use custom config file
obsidian-lint --config /path/to/config.toml

# Use specific profile
obsidian-lint --profile work

# Combine options
obsidian-lint --config custom.toml --profile strict --verbose
```

### Output Formats

```bash
# Human-readable output (default)
obsidian-lint lint

# JSON output for scripting
obsidian-lint lint --json

# Verbose output for debugging
obsidian-lint lint --verbose
```

### Dry Run Mode

```bash
# Preview what would be changed
obsidian-lint fix --dry-run

# See detailed changes
obsidian-lint fix --dry-run --verbose
```

## Exit Codes

- `0` - Success (no issues found or all issues fixed)
- `1` - Issues found or errors occurred

## Integration with Scripts

The CLI is designed to work well in automated environments:

```bash
#!/bin/bash

# Check if vault passes linting
if obsidian-lint check /path/to/vault --json > /dev/null; then
    echo "Vault configuration is valid"
else
    echo "Vault configuration has issues"
    exit 1
fi

# Get lint results in JSON for processing
RESULTS=$(obsidian-lint lint /path/to/vault --json)
ISSUE_COUNT=$(echo "$RESULTS" | jq '.issuesFound | length')

if [ "$ISSUE_COUNT" -gt 0 ]; then
    echo "Found $ISSUE_COUNT issues"
    # Apply fixes
    obsidian-lint fix /path/to/vault
fi
```

## Error Handling

The CLI provides clear error messages and appropriate exit codes:

- Configuration errors are reported with specific details
- Rule conflicts are identified and explained
- File processing errors include file paths and line numbers
- Network errors (for external link validation) are handled gracefully

For debugging, use the `--verbose` flag to get detailed information about the linting process.
