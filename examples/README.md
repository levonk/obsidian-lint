# Obsidian Lint Tool - Examples

This directory contains comprehensive examples and templates for using the Obsidian Lint Tool effectively across different scenarios and use cases.

## Directory Structure

```
examples/
├── configurations/          # Example configuration files
│   ├── academic-vault.toml  # Academic research setup
│   ├── work-vault.toml      # Professional/work setup
│   └── personal-pkm.toml    # Personal knowledge management
├── rules/                   # Example rule configurations
│   ├── academic/           # Academic-specific rules
│   ├── work/               # Work/professional rules
│   └── personal/           # Personal productivity rules
├── workflows/              # Automation scripts and workflows
│   ├── daily-maintenance.sh    # Daily vault maintenance
│   ├── vault-migration.sh     # Vault migration helper
│   └── multi-vault-sync.py    # Multi-vault management
└── README.md               # This file
```

## Configuration Examples

### Academic Vault Configuration

**File:** `configurations/academic-vault.toml`

Optimized for academic research with comprehensive citation management, literature review support, and research-specific metadata tracking.

**Key Features:**

- Multiple profiles for different research phases
- Citation and bibliography management
- Research metadata tracking
- Literature review organization

**Usage:**

```bash
# Copy to your configuration directory
cp examples/configurations/academic-vault.toml ~/.config/obsidian-lint/obsidian-lint.toml

# Copy academic rules
cp -r examples/rules/academic ~/.config/obsidian-lint/rules/

# Run with academic profile
obsidian-lint --profile academic /path/to/research-vault
```

### Work Vault Configuration

**File:** `configurations/work-vault.toml`

Conservative settings for professional environments with minimal disruption and manual review processes.

**Key Features:**

- Conservative dry-run defaults
- Minimal frontmatter requirements
- Professional naming conventions
- Team collaboration support

**Usage:**

```bash
# Copy configuration
cp examples/configurations/work-vault.toml ~/.config/obsidian-lint/obsidian-lint.toml

# Copy work rules
cp -r examples/rules/work ~/.config/obsidian-lint/rules/

# Run with work profile (dry-run by default)
obsidian-lint --profile work /path/to/work-vault
```

### Personal PKM Configuration

**File:** `configurations/personal-pkm.toml`

Comprehensive setup for personal knowledge management with full automation and creative features.

**Key Features:**

- Multiple profiles for different contexts
- Comprehensive frontmatter tracking
- Intelligent tag automation
- Creative and productivity features

**Usage:**

```bash
# Copy configuration
cp examples/configurations/personal-pkm.toml ~/.config/obsidian-lint/obsidian-lint.toml

# Copy personal rules
cp -r examples/rules/personal ~/.config/obsidian-lint/rules/

# Run with personal profile
obsidian-lint --profile personal /path/to/personal-vault
```

## Rule Examples

### Academic Rules

#### Frontmatter for Academic Research

**File:** `rules/academic/frontmatter-academic.toml`

Comprehensive frontmatter for academic notes including:

- Citation metadata (DOI, author, year)
- Research categorization
- Methodology tracking
- Key findings documentation

#### Citation Management

**File:** `rules/academic/citation-management.toml`

Advanced citation handling with:

- APA/MLA format enforcement
- Bibliography generation
- DOI validation
- Zotero integration

### Work Rules

#### Minimal Professional Frontmatter

**File:** `rules/work/frontmatter-minimal.toml`

Basic frontmatter for professional environments:

- Essential fields only
- Project association
- Approval workflow tracking
- Conservative auto-generation

#### Professional File Naming

**File:** `rules/work/file-naming-professional.toml`

Enforces professional naming standards:

- Consistent naming conventions
- Project prefix requirements
- Abbreviation standardization
- Length and character restrictions

### Personal Rules

#### Comprehensive Personal Frontmatter

**File:** `rules/personal/frontmatter-comprehensive.toml`

Full frontmatter for personal productivity:

- Productivity tracking (priority, energy, time)
- Mood and context tracking
- Relationship mapping
- Creative metadata

#### Intelligent Tag Automation

**File:** `rules/personal/tag-automation.toml`

Smart tagging system with:

- Content-based tag generation
- Hierarchical tag structures
- Context-aware tagging
- Tag cleanup and normalization

## Workflow Scripts

### Daily Maintenance Script

**File:** `workflows/daily-maintenance.sh`

Automated daily vault maintenance including:

- Configuration validation
- Issue detection and fixing
- Backup creation
- Report generation
- Statistics tracking

**Usage:**

```bash
# Make executable
chmod +x examples/workflows/daily-maintenance.sh

# Run daily maintenance
./examples/workflows/daily-maintenance.sh /path/to/vault

# Set up as cron job (daily at 9 AM)
echo "0 9 * * * /path/to/examples/workflows/daily-maintenance.sh /path/to/vault" | crontab -
```

### Vault Migration Script

**File:** `workflows/vault-migration.sh`

Helps migrate existing vaults to obsidian-lint standards:

- Copies and analyzes existing vault
- Creates appropriate configuration
- Sets up basic rules
- Generates migration report

**Usage:**

```bash
# Make executable
chmod +x examples/workflows/vault-migration.sh

# Migrate vault
./examples/workflows/vault-migration.sh /path/to/old-vault /path/to/new-vault academic

# Follow the generated migration report
cat /path/to/new-vault/.config/obsidian-lint/migration-report.md
```

### Multi-Vault Synchronization

**File:** `workflows/multi-vault-sync.py`

Python script for managing multiple vaults:

- Synchronizes configurations across vaults
- Runs linting on multiple vaults
- Generates comprehensive reports
- Manages backups and profiles

**Setup:**

```bash
# Make executable
chmod +x examples/workflows/multi-vault-sync.py

# Create initial configuration
./examples/workflows/multi-vault-sync.py config

# Edit configuration
nano ~/.config/obsidian-lint/multi-vault.json
```

**Usage:**

```bash
# Sync configurations across all vaults
./examples/workflows/multi-vault-sync.py sync

# Run linting on all vaults
./examples/workflows/multi-vault-sync.py lint

# Run linting on specific vaults
./examples/workflows/multi-vault-sync.py lint personal work

# Check status of all vaults
./examples/workflows/multi-vault-sync.py status
```

## Getting Started

### 1. Choose Your Use Case

Select the configuration that best matches your needs:

- **Academic**: Research, citations, literature review
- **Work**: Professional, conservative, team-friendly
- **Personal**: Comprehensive, creative, productivity-focused

### 2. Copy Configuration

```bash
# Create configuration directory
mkdir -p ~/.config/obsidian-lint

# Copy chosen configuration
cp examples/configurations/[your-choice].toml ~/.config/obsidian-lint/obsidian-lint.toml

# Copy corresponding rules
cp -r examples/rules/[your-choice] ~/.config/obsidian-lint/rules/
```

### 3. Customize Settings

Edit the configuration file to match your specific needs:

```bash
nano ~/.config/obsidian-lint/obsidian-lint.toml
```

Key settings to customize:

- `vault_root`: Path to your Obsidian vault
- `active`: Profile to use by default
- Rule-specific settings in individual rule files

### 4. Test Configuration

Always test with dry-run first:

```bash
obsidian-lint --dry-run /path/to/your/vault
```

### 5. Apply Changes

Once satisfied with the preview:

```bash
obsidian-lint fix /path/to/your/vault
```

## Advanced Usage

### Custom Rule Creation

Create custom rules by copying and modifying existing examples:

```bash
# Copy an existing rule as template
cp examples/rules/personal/frontmatter-comprehensive.toml ~/.config/obsidian-lint/rules/default/enabled/my-custom-rule.toml

# Edit the rule
nano ~/.config/obsidian-lint/rules/default/enabled/my-custom-rule.toml
```

Key sections to modify:

- `[rule]`: Change ID, name, and description
- `[config]`: Adjust path filters
- `[settings]`: Customize rule behavior

### Profile Management

Create multiple profiles for different contexts:

```bash
# Create new profile directory
mkdir -p ~/.config/obsidian-lint/rules/my-profile/enabled

# Copy rules from existing profile
cp ~/.config/obsidian-lint/rules/default/enabled/*.toml ~/.config/obsidian-lint/rules/my-profile/enabled/

# Add profile to configuration
nano ~/.config/obsidian-lint/obsidian-lint.toml
```

### Automation Setup

Set up automated maintenance:

```bash
# Copy maintenance script
cp examples/workflows/daily-maintenance.sh ~/bin/obsidian-maintenance
chmod +x ~/bin/obsidian-maintenance

# Add to crontab for daily execution
echo "0 9 * * * ~/bin/obsidian-maintenance /path/to/vault" | crontab -
```

## Troubleshooting

### Common Issues

1. **Configuration Not Found**
   - Ensure configuration file is in the correct location
   - Check file permissions
   - Verify TOML syntax

2. **Rule Conflicts**
   - Only one variant per major rule ID can be enabled
   - Move conflicting rules to `disabled/` directory
   - Check rule IDs for duplicates

3. **Performance Issues**
   - Reduce `max_concurrency` for large vaults
   - Use path filters to exclude unnecessary directories
   - Enable incremental processing

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
obsidian-lint --verbose --dry-run /path/to/vault
```

### Getting Help

- Check the main documentation: `docs/user-guide.md`
- Review developer guide: `docs/developer-guide.md`
- Examine test files for usage examples: `tests/`

## Contributing Examples

To contribute new examples:

1. Create your configuration/rule/workflow
2. Test thoroughly with different vault types
3. Document usage and customization options
4. Add to appropriate directory with descriptive naming
5. Update this README with your addition

### Example Contribution Template

When adding new examples, include:

- Clear description of use case
- Key features and benefits
- Installation/usage instructions
- Customization guidelines
- Troubleshooting tips

This ensures examples are accessible and useful for all users.
