# Obsidian Lint Plugin

This directory contains the Obsidian plugin integration for the Obsidian Lint Tool.

## Overview

The Obsidian Lint Plugin provides seamless integration between the core linting engine and Obsidian's interface, allowing users to lint and fix their vault directly within Obsidian.

## Features

- **Command Palette Integration**: Access linting operations through Obsidian's command palette
- **Real-time Linting**: Optional real-time linting as you type (configurable)
- **Settings Interface**: Comprehensive settings tab within Obsidian
- **Status Bar Integration**: Visual feedback in the status bar
- **Hotkey Support**: Keyboard shortcuts for common operations

## Commands

The plugin registers the following commands in Obsidian's command palette:

- **Lint current file** (`Mod+Shift+L`): Lint the currently active markdown file
- **Lint entire vault**: Run linting on all files in the vault
- **Fix current file**: Apply automatic fixes to the current file
- **Fix entire vault**: Apply automatic fixes to all files in the vault
- **Show lint results**: Display detailed linting results (future feature)

## Settings

The plugin provides a comprehensive settings interface with the following sections:

### General Settings

- Configuration file path
- Active profile selection
- Verbose logging toggle

### Linting Behavior

- Real-time linting toggle
- Real-time linting delay (100-5000ms)
- Inline error display
- Auto-fix toggle
- Auto-save after fix

### Performance Settings

- Parallel processing toggle
- Maximum concurrent operations (1-16)
- Progress notifications toggle

### Advanced Settings

- Enabled/disabled rules configuration
- Test configuration button
- Reset settings button

## Installation

### For Users

1. Download the plugin from the Obsidian Community Plugins directory
2. Enable the plugin in Obsidian's settings
3. Configure the plugin settings as needed

### For Developers

1. Clone this repository
2. Install dependencies: `bun install`
3. Build the plugin: `bun run build:plugin`
4. Copy the built files to your Obsidian plugins directory

## Development

### Building

```bash
# Build the plugin
bun run build:plugin

# Build everything including CLI
bun run build
```

### Testing

```bash
# Run plugin tests
bun test tests/unit/plugin/ tests/integration/plugin/

# Run all tests
bun test
```

### Plugin Structure

```
src/plugin/
├── main.ts           # Main plugin class
├── settings.ts       # Settings interface and validation
├── settings-tab.ts   # Obsidian settings UI
├── index.ts          # Plugin exports
└── README.md         # This file
```

## Configuration

The plugin uses the same configuration system as the CLI tool:

1. **Global Config**: `~/.config/obsidian-lint/obsidian-lint.toml`
2. **Vault Config**: `.config/obsidian-lint/obsidian-lint.toml` (in vault root)
3. **Plugin Settings**: Stored in Obsidian's plugin data

## Error Handling

The plugin includes comprehensive error handling:

- Configuration loading errors
- Rule conflict detection
- File processing errors
- Plugin lifecycle errors

All errors are logged to the console and displayed as notices to the user.

## API Integration

The plugin integrates with Obsidian's API:

- **Plugin API**: Lifecycle management, settings storage
- **Workspace API**: File access, active file detection
- **Command API**: Command palette integration
- **UI API**: Status bar, settings tab, notices

## Future Features

- Real-time editor linting with inline error display
- Quick-fix suggestions in the editor
- Lint results panel with detailed issue information
- Integration with Obsidian's file explorer for bulk operations

## Contributing

See the main project README for contribution guidelines.

## License

MIT License - see the main project LICENSE file.
