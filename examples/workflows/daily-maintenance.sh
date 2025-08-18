#!/bin/bash
# Daily Vault Maintenance Script
# Runs basic linting and organization tasks

set -e

VAULT_PATH="${1:-$HOME/ObsidianVault}"
CONFIG_PATH="${2:-$HOME/.config/obsidian-lint/obsidian-lint.toml}"
LOG_FILE="$HOME/.local/share/obsidian-lint/daily-$(date +%Y%m%d).log"

echo "Starting daily vault maintenance for: $VAULT_PATH"
echo "Using configuration: $CONFIG_PATH"
echo "Logging to: $LOG_FILE"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if vault exists
if [ ! -d "$VAULT_PATH" ]; then
    log "ERROR: Vault path does not exist: $VAULT_PATH"
    exit 1
fi

# Check if configuration exists
if [ ! -f "$CONFIG_PATH" ]; then
    log "ERROR: Configuration file does not exist: $CONFIG_PATH"
    exit 1
fi

log "Starting daily maintenance tasks..."

# 1. Validate configuration
log "Validating configuration..."
if obsidian-lint check --config "$CONFIG_PATH" "$VAULT_PATH" >> "$LOG_FILE" 2>&1; then
    log "Configuration validation: PASSED"
else
    log "Configuration validation: FAILED"
    exit 1
fi

# 2. Run linting in dry-run mode first
log "Running lint check (dry-run)..."
LINT_OUTPUT=$(obsidian-lint lint --config "$CONFIG_PATH" --dry-run --json "$VAULT_PATH" 2>&1)
ISSUE_COUNT=$(echo "$LINT_OUTPUT" | jq -r '.issuesFound | length' 2>/dev/null || echo "0")

log "Found $ISSUE_COUNT issues"

# 3. If issues found, create backup and fix
if [ "$ISSUE_COUNT" -gt "0" ]; then
    log "Creating backup before applying fixes..."
    BACKUP_DIR="$HOME/.local/share/obsidian-lint/backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$VAULT_PATH" "$BACKUP_DIR/"
    log "Backup created at: $BACKUP_DIR"

    log "Applying fixes..."
    if obsidian-lint fix --config "$CONFIG_PATH" "$VAULT_PATH" >> "$LOG_FILE" 2>&1; then
        log "Fixes applied successfully"
    else
        log "ERROR: Failed to apply fixes"
        exit 1
    fi
else
    log "No issues found, skipping fixes"
fi

# 4. Generate daily report
log "Generating daily report..."
REPORT_FILE="$HOME/.local/share/obsidian-lint/reports/daily-$(date +%Y%m%d).json"
mkdir -p "$(dirname "$REPORT_FILE")"
obsidian-lint lint --config "$CONFIG_PATH" --json "$VAULT_PATH" > "$REPORT_FILE" 2>&1

# 5. Update statistics
STATS_FILE="$HOME/.local/share/obsidian-lint/stats.json"
if [ -f "$STATS_FILE" ]; then
    PREV_STATS=$(cat "$STATS_FILE")
else
    PREV_STATS="{}"
fi

# Create updated stats
NEW_STATS=$(jq -n \
    --arg date "$(date +%Y-%m-%d)" \
    --argjson issues "$ISSUE_COUNT" \
    --argjson prev "$PREV_STATS" \
    '$prev + {($date): {issues: $issues, timestamp: now}}')

echo "$NEW_STATS" > "$STATS_FILE"

log "Daily maintenance completed successfully"
log "Issues processed: $ISSUE_COUNT"
log "Report saved to: $REPORT_FILE"
log "Stats updated in: $STATS_FILE"

# Optional: Send notification (uncomment if desired)
# notify-send "Obsidian Lint" "Daily maintenance completed. $ISSUE_COUNT issues processed."

exit 0
