---
date_created: 2025-08-06
date_updated: 2025-08-06
title: 'Obsidian Lint Tool Requirements'
aliases: ['Obsidian Lint Requirements']
tags: [obsidian, linting, requirements, tool, npm]
status: 'active'
---

# Obsidian Lint Tool Requirements

## Overview

This document outlines the requirements for a `npx` shebang runnable tool designed to analyze and fix Obsidian notes to ensure they conform to established organizational standards. The tool will help bring notes into compliance with the rules defined in the Obsidian Vault Organization Checklist.

## Configuration

### Configuration File Structure

1. **Primary Configuration File:**
   - Location: `$XDG_CONFIG_HOME/obsidian-lint/obsidian-lint.toml` or `~/.config/obsidian-lint/obsidian-lint.toml`
   - Fallback location (project-specific): `.config/obsidian-lint/obsidian-lint.toml` in vault root

2. **Rules Directory:**
   - Location: `$XDG_CONFIG_HOME/obsidian-lint/rules/` or `~/.config/obsidian-lint/rules/`
   - Fallback location (project-specific): `.config/obsidian-lint/rules/` in vault root

### Configuration Parameters

```toml
# Sample configuration
[general]
vault_root = "/path/to/vault"
dry_run = false
verbose = true
fix = true  # Automatically fix issues when possible

[moc] (maybe this belongs in the moc rules)
generate = true
parallel_path = "Meta/MOC - Map Of Content"  # Optional alternative path for generated MOCs
template_path = "Meta/Templates/99 MOC Template"

[attachments] (maybe this belongs in the attachments rules)
move_to = "Meta/Attachments"
create_subdirectories = true

[frontmatter] (maybe this belongs in the frontmatter rules)
enforce_required = true
date_format = "YYYY-MM-DD"
fields = [
  "created-date",
  "updated-date",
  "title",
  "aliases",
  "tags",
  "note-status"
]

[rules]
enabled = [
  "frontmatter-required-fields",
  "headings-proper",
  "tag-from-folders",
  "tag-from-context",
  "tag-based-paths",
  "attachment-organization",
  "attachment-format-preference",
  "attachment-image-alt-text",
  "moc-linking",
  "spell-correction",
  "template-correction",
  "file-naming",
  "file-path-organization",
  "linking-internal",
  "linking-external"
]
disabled = []
```

## Functional Requirements

### Core Functionality

1. **Vault Analysis**
   - Scan the entire Obsidian vault or specific directories
   - Identify notes that don't comply with defined rules
   - Generate a comprehensive report of issues found

2. **Rule-Based Linting**
   - Implement a pluggable rule system loaded from the rules directory
   - Each rule should be capable of both detecting and fixing issues
   - Rules should be toggleable via configuration
   - Rules should have smart format "path-allowlist" and "path-denylist" that uses `git` like file globbing to support `**/*foo.md`
   - rules should have a unique ID
   - rules shoudl have general settings and it's own sub-settings, but it should also support setting blocks that include or exclude glob file formats or title formats

3. **Automated Fixing**
   - Option to automatically fix identified issues (`--fix` flag)
   - Preview changes before applying (`--dry-run` flag)
   - Generate a log of all changes made

4. **MOC Generation**
   - Create or update Maps of Content (MOCs) based on directory structure
   - Use configurable templates for MOC generation
   - Option to place MOCs in a parallel directory structure

### Required Rules Implementation

#### 1. Frontmatter Rules

- Ensure every note has required frontmatter fields:
  - `title`: Clear, descriptive title
  - `aliases`: Alternative names for the note (YAML array)
  - `tags`: Relevant tags (YAML array)
  - `status`: Current status (draft/in-progress/active/on-hold/archived)
  - `date_created`: ISO format (YYYY-MM-DD) for date strings
  - `date_updated`: ISO format (YYYY-MM-DD) for date strings
- Verify frontmatter format and validate values

#### 2. Note Structure Rules

- Verify notes have level 1 heading matching the title
- Ensure proper section headings are used
- Check for missing required sections based on note type

#### 3. Linking Strategy Rules

- Validate internal links using `[[double brackets]]`
- Check and fix broken links
- Ensure proper MOC linking based on note location in directory tree
- Verify external links are properly formatted

#### 4. File Management Rules

- Check file naming conventions
- Suggest appropriate directory locations for misplaced files
- Identify duplicate or empty files
- Move attachments to the designated attachments directory

#### 5. Tag Rules

- Enforce consistent tag formatting
- Generate appropriate tags based on directory path
- Remove redundant or unused tags
- Apply hierarchical tagging when appropriate

## Technical Requirements

1. **Implementation**
   - Node.js based tool, installable via npm
   - Runnable via `npx` command
   - Cross-platform compatibility (Windows, macOS, Linux)

2. **Performance**
   - Efficient handling of large vaults (1000+ notes)
   - Parallel processing of files when possible
   - Progress indicators for long-running operations

3. **User Experience**
   - Clear, colorized console output
   - Machine-readable output option (JSON) for integration with other tools
   - Interactive mode for approving changes
   - Detailed help and documentation

4. **Extensibility**
   - Plugin system for custom rules
   - API for integration with other tools
   - Customizable templates for generated content
   - Integration with Obsidian as a plugin

## Obsidian Plugin Interface

The tool should also function as an Obsidian plugin, providing the following features:

1. **In-Editor Linting**
   - Real-time linting and suggestions as users edit notes
   - Visual indicators for rule violations within the editor
   - Quick-fix options for common issues

2. **Control Panel**
   - Settings interface within Obsidian to configure the linter
   - Enable/disable specific rules
   - Customize rule parameters
   - Define vault-specific configurations

3. **Bulk Operations**
   - Run lint checks on selected files, folders, or the entire vault
   - Apply fixes to multiple files at once
   - Generate reports within Obsidian

4. **Integration with Obsidian Features**
   - Use Obsidian's internal APIs for improved performance
   - Integration with Obsidian's file explorer and search
   - Support for other Obsidian plugins

5. **User Interface**
   - Dedicated sidebar for lint results
   - Status indicators in the file explorer
   - Command palette integration
   - Context menu options for lint operations

## Command Line Interface

```bash
# Basic usage
npx obsidian-lint [options] [vault-path]

# Options
--config, -c        Path to config file
--fix, -f           Automatically fix issues
--dry-run, -d       Show what would be changed without making changes
--verbose, -v       Verbose output
--rules, -r         Comma-separated list of rules to run
--ignore, -i        Comma-separated list of rules to ignore
--generate-moc, -m  Generate MOCs for directories
--report            Generate a Markdown report of issues
--help, -h          Show help
```

## Development Phases

### Phase 1: Core Infrastructure

- Configuration management
- Rule system architecture
- Basic CLI interface
- File scanning and parsing

### Phase 2: Basic Rules Implementation

- Frontmatter validation
- Basic structure validation
- Link checking
- Tag consistency

### Phase 3: Advanced Features

- Automatic fixing capabilities
- MOC generation
- Reporting and visualization
- Advanced rules

### Phase 4: Optimization and Extensions

- Performance improvements
- Plugin system
- Integration with Obsidian as a plugin
- User documentation

### Phase 5: Obsidian Plugin Development

- Develop native Obsidian plugin interface
- Create settings UI within Obsidian
- Integrate with Obsidian's editor and file system
- Test and optimize for Obsidian environment

## Deliverables

1. Source code repository
2. NPM package
3. Obsidian plugin package
4. Documentation:
   - User guide
   - Configuration reference
   - Rule documentation
   - Developer guide for extending
   - Plugin installation and usage guide
5. Example configuration files

## Success Criteria

1. Tool can analyze an entire Obsidian vault and produce accurate reports
2. Automatic fixes correctly implement the rules from the Obsidian Vault Organization Checklist
3. MOC generation creates valid, well-linked Maps of Content
4. Configuration system allows for flexible customization of rules
5. Tool is performant with large vaults
6. Obsidian plugin provides seamless integration with the editor
7. Users can easily switch between CLI and plugin interfaces
8. Documentation is comprehensive and clear

---

_This requirements document is subject to revision as the project progresses._
