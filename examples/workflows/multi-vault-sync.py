#!/usr/bin/env python3
"""
Multi-Vault Synchronization Script
Synchronizes linting rules and configurations across multiple vaults
"""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


class VaultManager:
    def __init__(self, config_file: str):
        self.config_file = Path(config_file)
        self.config = self.load_config()
        self.log_file = Path.home() / ".local/share/obsidian-lint/multi-vault.log"
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

    def load_config(self) -> Dict:
        """Load multi-vault configuration"""
        if not self.config_file.exists():
            self.create_default_config()

        with open(self.config_file, 'r') as f:
            return json.load(f)

    def create_default_config(self):
        """Create default multi-vault configuration"""
        default_config = {
            "vaults": {
                "personal": {
                    "path": str(Path.home() / "PersonalVault"),
                    "profile": "personal",
                    "sync_rules": True,
                    "auto_fix": True,
                    "backup": True
                },
                "work": {
                    "path": str(Path.home() / "WorkVault"),
                    "profile": "work",
                    "sync_rules": True,
                    "auto_fix": False,
                    "backup": True
                }
            },
            "master_config": str(Path.home() / ".config/obsidian-lint"),
            "sync_settings": {
                "sync_profiles": True,
                "sync_rules": True,
                "create_backups": True,
                "parallel_processing": True
            }
        }

        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_file, 'w') as f:
            json.dump(default_config, f, indent=2)

        print(f"Created default configuration at: {self.config_file}")

    def log(self, message: str):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)

        with open(self.log_file, 'a') as f:
            f.write(log_entry + "\n")

    def sync_configurations(self):
        """Sync configurations across all vaults"""
        self.log("Starting configuration synchronization...")

        master_config = Path(self.config["master_config"])
        if not master_config.exists():
            self.log(f"ERROR: Master configuration not found: {master_config}")
            return False

        for vault_name, vault_config in self.config["vaults"].items():
            vault_path = Path(vault_config["path"])
            if not vault_path.exists():
                self.log(f"WARNING: Vault not found: {vault_path}")
                continue

            self.log(f"Syncing configuration for vault: {vault_name}")

            # Create vault config directory
            vault_config_dir = vault_path / ".config/obsidian-lint"
            vault_config_dir.mkdir(parents=True, exist_ok=True)

            # Sync main configuration
            if self.config["sync_settings"]["sync_profiles"]:
                self.sync_main_config(master_config, vault_config_dir, vault_config)

            # Sync rules
            if self.config["sync_settings"]["sync_rules"] and vault_config.get("sync_rules", True):
                self.sync_rules(master_config, vault_config_dir, vault_config["profile"])

        self.log("Configuration synchronization completed")
        return True

    def sync_main_config(self, master_config: Path, vault_config_dir: Path, vault_config: Dict):
        """Sync main configuration file"""
        master_toml = master_config / "obsidian-lint.toml"
        vault_toml = vault_config_dir / "obsidian-lint.toml"

        if master_toml.exists():
            # Read master config and customize for vault
            with open(master_toml, 'r') as f:
                config_content = f.read()

            # Replace vault-specific settings
            config_content = config_content.replace(
                'vault_root = "/path/to/vault"',
                f'vault_root = "{vault_config["path"]}"'
            )
            config_content = config_content.replace(
                'active = "default"',
                f'active = "{vault_config["profile"]}"'
            )

            with open(vault_toml, 'w') as f:
                f.write(config_content)

    def sync_rules(self, master_config: Path, vault_config_dir: Path, profile: str):
        """Sync rules for specific profile"""
        master_rules = master_config / "rules" / profile
        vault_rules = vault_config_dir / "rules" / profile

        if master_rules.exists():
            if vault_rules.exists():
                shutil.rmtree(vault_rules)
            shutil.copytree(master_rules, vault_rules)

    def run_linting(self, vault_names: Optional[List[str]] = None):
        """Run linting on specified vaults or all vaults"""
        if vault_names is None:
            vault_names = list(self.config["vaults"].keys())

        results = {}

        for vault_name in vault_names:
            if vault_name not in self.config["vaults"]:
                self.log(f"WARNING: Unknown vault: {vault_name}")
                continue

            vault_config = self.config["vaults"][vault_name]
            vault_path = Path(vault_config["path"])

            if not vault_path.exists():
                self.log(f"WARNING: Vault not found: {vault_path}")
                continue

            self.log(f"Running linting for vault: {vault_name}")

            # Create backup if enabled
            if vault_config.get("backup", False) and self.config["sync_settings"]["create_backups"]:
                self.create_backup(vault_path, vault_name)

            # Run linting
            config_file = vault_path / ".config/obsidian-lint/obsidian-lint.toml"
            cmd = [
                "obsidian-lint",
                "lint" if not vault_config.get("auto_fix", False) else "fix",
                "--config", str(config_file),
                "--json",
                str(vault_path)
            ]

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                lint_result = json.loads(result.stdout)
                results[vault_name] = lint_result

                issue_count = len(lint_result.get("issuesFound", []))
                fix_count = len(lint_result.get("fixesApplied", []))

                self.log(f"Vault {vault_name}: {issue_count} issues, {fix_count} fixes")

            except subprocess.CalledProcessError as e:
                self.log(f"ERROR: Linting failed for vault {vault_name}: {e}")
                results[vault_name] = {"error": str(e)}

        return results

    def create_backup(self, vault_path: Path, vault_name: str):
        """Create backup of vault before processing"""
        backup_dir = Path.home() / ".local/share/obsidian-lint/backups"
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_path = backup_dir / f"{vault_name}-{timestamp}"

        self.log(f"Creating backup: {backup_path}")
        shutil.copytree(vault_path, backup_path)

    def generate_report(self, results: Dict):
        """Generate comprehensive report"""
        report_dir = Path.home() / ".local/share/obsidian-lint/reports"
        report_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        report_file = report_dir / f"multi-vault-report-{timestamp}.json"

        report = {
            "timestamp": datetime.now().isoformat(),
            "vaults": results,
            "summary": {
                "total_vaults": len(results),
                "successful": len([r for r in results.values() if "error" not in r]),
                "failed": len([r for r in results.values() if "error" in r]),
                "total_issues": sum(len(r.get("issuesFound", [])) for r in results.values() if "error" not in r),
                "total_fixes": sum(len(r.get("fixesApplied", [])) for r in results.values() if "error" not in r)
            }
        }

        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        self.log(f"Report generated: {report_file}")
        return report_file

    def status(self):
        """Show status of all vaults"""
        print("\nMulti-Vault Status:")
        print("=" * 50)

        for vault_name, vault_config in self.config["vaults"].items():
            vault_path = Path(vault_config["path"])
            config_path = vault_path / ".config/obsidian-lint/obsidian-lint.toml"

            status = "✓" if vault_path.exists() else "✗"
            config_status = "✓" if config_path.exists() else "✗"

            print(f"Vault: {vault_name}")
            print(f"  Path: {vault_path} {status}")
            print(f"  Config: {config_path} {config_status}")
            print(f"  Profile: {vault_config['profile']}")
            print(f"  Auto-fix: {vault_config.get('auto_fix', False)}")
            print()


def main():
    if len(sys.argv) < 2:
        print("Usage: multi-vault-sync.py <command> [options]")
        print("Commands:")
        print("  sync                 - Sync configurations across all vaults")
        print("  lint [vault...]      - Run linting on specified vaults (or all)")
        print("  status               - Show status of all vaults")
        print("  config               - Show configuration file location")
        sys.exit(1)

    config_file = Path.home() / ".config/obsidian-lint/multi-vault.json"
    manager = VaultManager(str(config_file))

    command = sys.argv[1]

    if command == "sync":
        manager.sync_configurations()

    elif command == "lint":
        vault_names = sys.argv[2:] if len(sys.argv) > 2 else None
        results = manager.run_linting(vault_names)
        report_file = manager.generate_report(results)
        print(f"\nReport generated: {report_file}")

    elif command == "status":
        manager.status()

    elif command == "config":
        print(f"Configuration file: {config_file}")
        if config_file.exists():
            print("Configuration exists ✓")
        else:
            print("Configuration not found ✗")
            print("Run 'sync' command to create default configuration")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
