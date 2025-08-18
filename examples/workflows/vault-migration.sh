#!/bin/bash
# Vault Migration Script
# Migrates an existing vault to use obsidian-lint standards

set -e

SOURCE_VAULT="${1}"
TARGET_VAULT="${2}"
PROFILE="${3:-default}"

if [ -z "$SOURCE_VAULT" ] || [ -z "$TARGET_VAULT" ]; then
    echo "Usage: $0 <source-vault> <target-vault> [profile]"
    echo "Example: $0 /path/to/old-vault /path/to/new-vault academic"
    exit 1
fi

echo "Migrating vault from $SOURCE_VAULT to $TARGET_VAULT"
echo "Using profile: $PROFILE"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check source vault exists
if [ ! -d "$SOURCE_VAULT" ]; then
    log "ERROR: Source vault does not exist: $SOURCE_VAULT"
    exit 1
fi

# Create target vault directory
log "Creating target vault directory..."
mkdir -p "$TARGET_VAULT"

# Copy source vault to target
log "Copying source vault to target..."
cp -r "$SOURCE_VAULT"/* "$TARGET_VAULT/"

# Create obsidian-lint configuration
log "Setting up obsidian-lint configuration..."
CONFIG_DIR="$TARGET_VAULT/.config/obsidian-lint"
mkdir -p "$CONFIG_DIR"

# Create basic configuration
cat > "$CONFIG_DIR/obsidian-lint.toml" << EOF
[general]
vault_root = "$TARGET_VAULT"
dry_run = false
verbose = true
fix = true
parallel = true
max_concurrency = 4

[profiles]
active = "$PROFILE"

[profiles.$PROFILE]
name = "$(echo $PROFILE | sed 's/.*/\u&/') Profile"
description = "Migrated vault configuration"
rules_path = "rules/$PROFILE"
EOF

# Set up basic rules directory
RULES_DIR="$CONFIG_DIR/rules/$PROFILE/enabled"
mkdir -p "$RULES_DIR"

# Create basic frontmatter rule
cat > "$RULES_DIR/frontmatter-basic.toml" << EOF
[rule]
id = "frontmatter-required-fields.basic"
name = "Basic Frontmatter"
description = "Basic frontmatter for migrated vault"
category = "frontmatter"

[config]
path_allowlist = ["**/*.md"]
path_denylist = ["Templates/**", "Archive/**"]

[settings]
required_fields = ["title", "date_created", "tags"]
date_format = "YYYY-MM-DD"
preserve_existing_fields = true
EOF

# Create basic file organization rule
cat > "$RULES_DIR/file-organization-basic.toml" << EOF
[rule]
id = "file-organization.preserve"
name = "Preserve Organization"
description = "Preserve existing file organization during migration"
category = "organization"

[config]
path_allowlist = ["**/*.md"]

[settings]
preserve_structure = true
only_fix_naming = true
naming_convention = "preserve"
EOF

# Run initial analysis
log "Running initial analysis..."
ANALYSIS_FILE="$TARGET_VAULT/.config/obsidian-lint/migration-analysis.json"
obsidian-lint lint --config "$CONFIG_DIR/obsidian-lint.toml" --json "$TARGET_VAULT" > "$ANALYSIS_FILE"

ISSUE_COUNT=$(jq -r '.issuesFound | length' "$ANALYSIS_FILE")
log "Found $ISSUE_COUNT issues in source vault"

# Create migration report
REPORT_FILE="$TARGET_VAULT/.config/obsidian-lint/migration-report.md"
cat > "$REPORT_FILE" << EOF
# Vault Migration Report

**Migration Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Source Vault:** $SOURCE_VAULT
**Target Vault:** $TARGET_VAULT
**Profile:** $PROFILE

## Analysis Results

- **Total Issues Found:** $ISSUE_COUNT
- **Configuration Created:** $CONFIG_DIR/obsidian-lint.toml
- **Rules Directory:** $RULES_DIR

## Next Steps

1. Review the analysis results in: \`migration-analysis.json\`
2. Customize the configuration in: \`obsidian-lint.toml\`
3. Add or modify rules in: \`rules/$PROFILE/enabled/\`
4. Run fixes: \`obsidian-lint fix "$TARGET_VAULT"\`

## Recommended Actions

### Phase 1: Basic Cleanup
\`\`\`bash
# Run in dry-run mode first
obsidian-lint fix --dry-run "$TARGET_VAULT"

# Apply basic fixes
obsidian-lint fix "$TARGET_VAULT"
\`\`\`

### Phase 2: Enhanced Rules
Consider adding these rules based on your needs:
- Attachment organization
- Link validation
- Tag management
- MOC generation

### Phase 3: Optimization
- Enable parallel processing
- Set up automated maintenance
- Configure incremental processing

## Configuration Files Created

- \`$CONFIG_DIR/obsidian-lint.toml\` - Main configuration
- \`$RULES_DIR/frontmatter-basic.toml\` - Basic frontmatter rule
- \`$RULES_DIR/file-organization-basic.toml\` - File organization rule

EOF

log "Migration setup completed!"
log "Target vault: $TARGET_VAULT"
log "Configuration: $CONFIG_DIR/obsidian-lint.toml"
log "Migration report: $REPORT_FILE"
log ""
log "Next steps:"
log "1. Review the migration report: $REPORT_FILE"
log "2. Test with dry-run: obsidian-lint fix --dry-run \"$TARGET_VAULT\""
log "3. Apply fixes: obsidian-lint fix \"$TARGET_VAULT\""

exit 0
