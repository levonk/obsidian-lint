# Obsidian Lint Tool

[![CI](https://github.com/obsidian-lint/obsidian-lint/workflows/CI/badge.svg)](https://github.com/obsidian-lint/obsidian-lint/actions)
[![npm version](https://badge.fury.io/js/obsidian-lint.svg)](https://www.npmjs.com/package/obsidian-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive linting and fixing solution for Obsidian vaults that ensures notes conform to established organizational standards. Available as both a CLI tool and Obsidian plugin.

## ✨ Features

- **🔧 Dual Interface**: CLI tool and Obsidian plugin
- **📋 Comprehensive Rules**: Frontmatter validation, file organization, linking, and more
- **⚙️ Configurable**: Profile-based rule configuration with TOML files
- **🚀 Fast**: Built with TypeScript and Bun for optimal performance
- **🔄 Auto-fix**: Automatically fix common issues
- **📊 Progress Tracking**: Visual progress bars and detailed reporting
- **🎯 Parallel Processing**: Handle large vaults efficiently

## 📦 Installation

### CLI Tool

```bash
# Install globally
npm install -g obsidian-lint

# Or run without installing
npx obsidian-lint /path/to/vault --dry-run
```

### Obsidian Plugin

1. Open Obsidian → Settings → Community Plugins
2. Search for "Obsidian Lint" and install
3. Enable the plugin

Or install manually from [GitHub Releases](https://github.com/obsidian-lint/obsidian-lint/releases).

## 🚀 Quick Start

### CLI Usage

```bash
# Check what would be fixed (dry-run)
obsidian-lint /path/to/vault --dry-run

# Fix issues automatically
obsidian-lint /path/to/vault --fix

# Verbose output with progress
obsidian-lint /path/to/vault --fix --verbose

# Use specific configuration profile
obsidian-lint /path/to/vault --profile work
```

### Plugin Usage

1. Open Command Palette (`Ctrl/Cmd + P`)
2. Run "Obsidian Lint: Lint Current File"
3. Or use "Obsidian Lint: Lint Entire Vault"
4. View results in the plugin panel

## 📖 Documentation

- **[Installation Guide](docs/installation.md)** - Detailed installation instructions
- **[User Guide](docs/user-guide.md)** - Comprehensive usage guide
- **[CLI Reference](docs/cli-usage.md)** - Command-line interface documentation
- **[Developer Guide](docs/developer-guide.md)** - Development and customization
- **[Deployment Guide](docs/deployment.md)** - Release and deployment processes

## ⚙️ Configuration

The tool uses TOML configuration files with a profile-based approach:

```toml
[general]
vault_root = "/path/to/vault"
dry_run = false
verbose = true
fix = true

[profiles]
active = "default"

[profiles.default]
name = "Default Profile"
rules_path = "rules/default"
```

See the [`config/`](config/) directory for complete examples.

## 🛠️ Development

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Run in development mode
bun run dev

# Run tests
bun test

# Run tests with coverage
bun run test:ci

# Lint and format
bun run lint
bun run format
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📋 Requirements

- **Node.js**: 18.0.0 or higher
- **Bun**: 1.0.0 or higher (for development)
- **Obsidian**: 1.0.0 or higher (for plugin)

## 🐛 Support

- **Bug Reports**: [GitHub Issues](https://github.com/obsidian-lint/obsidian-lint/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/obsidian-lint/obsidian-lint/discussions)
- **Documentation**: [Online Docs](https://obsidian-lint.github.io/obsidian-lint/)

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md/) - The knowledge management app this tool supports
- [Bun](https://bun.sh/) - Fast JavaScript runtime and toolkit
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
