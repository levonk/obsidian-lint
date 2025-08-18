# Installation Guide

This guide covers installation methods for both the CLI tool and Obsidian plugin versions of Obsidian Lint.

## CLI Tool Installation

### Method 1: Global Installation via npm

```bash
# Install globally
npm install -g obsidian-lint

# Verify installation
obsidian-lint --version

# Get help
obsidian-lint --help
```

### Method 2: Run without Installation (npx)

```bash
# Run directly without installing
npx obsidian-lint /path/to/your/vault --dry-run

# Run with specific options
npx obsidian-lint /path/to/vault --fix --verbose
```

### Method 3: Local Project Installation

```bash
# Install in your project
npm install obsidian-lint

# Run via npm scripts
npx obsidian-lint ./vault
```

### Method 4: Using Bun (Alternative Runtime)

```bash
# Install with Bun
bun install -g obsidian-lint

# Or run directly
bunx obsidian-lint /path/to/vault
```

## Obsidian Plugin Installation

### Method 1: Community Plugin Store (Recommended)

1. Open Obsidian
2. Go to Settings → Community Plugins
3. Click "Browse" and search for "Obsidian Lint"
4. Click "Install" then "Enable"

### Method 2: Manual Installation

1. Download the latest `obsidian-lint-plugin.zip` from [GitHub Releases](https://github.com/obsidian-lint/obsidian-lint/releases)
2. Extract the zip file
3. Copy the extracted folder to `.obsidian/plugins/obsidian-lint/` in your vault
4. Restart Obsidian
5. Go to Settings → Community Plugins and enable "Obsidian Lint"

### Method 3: BRAT Plugin (Beta Testing)

1. Install the BRAT plugin from the Community Plugin store
2. Add this repository: `obsidian-lint/obsidian-lint`
3. BRAT will automatically install and update the plugin

## System Requirements

### CLI Tool Requirements

- **Node.js**: Version 18.0.0 or higher
- **Operating System**: Windows, macOS, or Linux
- **Memory**: Minimum 512MB RAM (2GB+ recommended for large vaults)
- **Storage**: 50MB free space for installation

### Plugin Requirements

- **Obsidian**: Version 1.0.0 or higher
- **Operating System**: Any platform supported by Obsidian
- **Memory**: Additional 100MB RAM for plugin functionality

## Verification

### CLI Tool Verification

```bash
# Check version
obsidian-lint --version

# Test with help command
obsidian-lint --help

# Test with a sample vault (dry-run mode)
obsidian-lint /path/to/test/vault --dry-run --verbose
```

### Plugin Verification

1. Open Obsidian
2. Go to Settings → Community Plugins
3. Verify "Obsidian Lint" is listed and enabled
4. Check for the plugin commands in the Command Palette (Ctrl/Cmd + P)
5. Look for the plugin settings in Settings → Plugin Options

## Configuration Setup

### Initial Configuration

After installation, you'll need to set up configuration files:

```bash
# Create configuration directory
mkdir -p ~/.config/obsidian-lint

# Copy example configuration
cp node_modules/obsidian-lint/config/example-obsidian-lint.toml ~/.config/obsidian-lint/obsidian-lint.toml

# Or for vault-specific configuration
mkdir -p /path/to/vault/.config/obsidian-lint
cp node_modules/obsidian-lint/config/example-obsidian-lint.toml /path/to/vault/.config/obsidian-lint/obsidian-lint.toml
```

### Rule Configuration

```bash
# Copy example rules
cp -r node_modules/obsidian-lint/examples/rules ~/.config/obsidian-lint/

# Or for vault-specific rules
cp -r node_modules/obsidian-lint/examples/rules /path/to/vault/.config/obsidian-lint/
```

## Quick Start

### CLI Quick Start

```bash
# Install globally
npm install -g obsidian-lint

# Run on your vault (dry-run first)
obsidian-lint /path/to/your/vault --dry-run

# If results look good, run with fixes
obsidian-lint /path/to/your/vault --fix
```

### Plugin Quick Start

1. Install plugin via Community Plugin store
2. Enable the plugin in settings
3. Open Command Palette (Ctrl/Cmd + P)
4. Run "Obsidian Lint: Lint Current File"
5. Check the results in the plugin panel

## Troubleshooting

### Common CLI Issues

**Issue**: `command not found: obsidian-lint`

```bash
# Solution: Check if npm global bin is in PATH
npm config get prefix
# Add the bin directory to your PATH
```

**Issue**: `Permission denied` on macOS/Linux

```bash
# Solution: Fix npm permissions or use npx
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

**Issue**: `Module not found` errors

```bash
# Solution: Clear npm cache and reinstall
npm cache clean --force
npm uninstall -g obsidian-lint
npm install -g obsidian-lint
```

### Common Plugin Issues

**Issue**: Plugin not appearing in Community Plugins

- Solution: Restart Obsidian and check if Community Plugins are enabled

**Issue**: Plugin fails to load

- Solution: Check the Developer Console (Ctrl/Cmd + Shift + I) for error messages

**Issue**: Plugin commands not working

- Solution: Disable and re-enable the plugin, then restart Obsidian

### Performance Issues

**Large Vault Performance**:

```bash
# Use parallel processing
obsidian-lint /path/to/vault --parallel

# Process specific directories only
obsidian-lint /path/to/vault --include "Daily Notes/**"

# Exclude large directories
obsidian-lint /path/to/vault --exclude "Archive/**"
```

## Getting Help

### Documentation

- [User Guide](./user-guide.md) - Comprehensive usage guide
- [CLI Usage](./cli-usage.md) - Command-line interface reference
- [Developer Guide](./developer-guide.md) - Development and customization

### Support Channels

- **GitHub Issues**: [Report bugs and request features](https://github.com/obsidian-lint/obsidian-lint/issues)
- **GitHub Discussions**: [Community support and questions](https://github.com/obsidian-lint/obsidian-lint/discussions)
- **Documentation**: [Online documentation](https://obsidian-lint.github.io/obsidian-lint/)

### Version Information

```bash
# Check CLI version
obsidian-lint --version

# Check detailed version info
obsidian-lint --version --verbose
```

For plugin version, check Settings → Community Plugins → Obsidian Lint.

## Next Steps

After successful installation:

1. **Configure Rules**: Set up your preferred linting rules
2. **Test on Sample**: Run on a backup or test vault first
3. **Customize Settings**: Adjust configuration for your workflow
4. **Automate**: Set up scripts or hooks for regular maintenance
5. **Explore Features**: Try advanced features like MOC generation

See the [User Guide](./user-guide.md) for detailed usage instructions.
