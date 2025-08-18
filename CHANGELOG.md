# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Complete package and distribution setup
- Automated CI/CD pipeline with GitHub Actions
- NPM package configuration for global CLI installation
- Obsidian plugin packaging and distribution
- Comprehensive installation and deployment documentation
- Security audit integration in CI pipeline
- Plugin validation workflow
- Automated release process with version management

### Changed

- Enhanced build pipeline with Bun-based build scripts
- Improved package.json with proper distribution configuration
- Updated README with installation badges and comprehensive documentation

### Fixed

- Build script permissions and executable configuration
- Plugin packaging with proper manifest validation

## [1.0.0] - 2024-01-XX

### Added

- Initial release of Obsidian Lint Tool
- CLI tool with comprehensive linting capabilities
- Obsidian plugin with real-time linting
- TOML-based configuration system with profiles
- Rule-based linting system with hierarchical IDs
- Frontmatter validation and management
- File organization and naming rules
- Linking strategy validation
- Tag management and consistency
- MOC generation and management
- Performance optimizations with parallel processing
- Progress tracking and user feedback
- Comprehensive test suite
- TypeScript implementation with ECM modules
- Bun runtime support

### Features

- **Configuration Management**: Profile-based TOML configuration
- **Rule System**: Pluggable rules with conflict detection
- **File Processing**: Markdown parsing and manipulation
- **CLI Interface**: Full-featured command-line tool
- **Plugin Integration**: Native Obsidian plugin
- **Performance**: Parallel processing for large vaults
- **Error Handling**: Comprehensive error reporting
- **Testing**: Unit, integration, and E2E tests

### Supported Rules

- Frontmatter validation (required fields, format validation)
- File organization (naming conventions, directory structure)
- Attachment management (organization, format preferences)
- Linking validation (internal/external links, broken link detection)
- Tag management (consistency, generation, cleanup)
- Content quality (headings, spell-checking, templates)
- MOC generation (automatic Maps of Content creation)

### Technical Details

- **Language**: TypeScript with strict mode
- **Runtime**: Node.js 18+ and Bun 1.0+
- **Module System**: ECM (ES Modules)
- **Build Tool**: Bun with custom build scripts
- **Testing**: Bun test runner with comprehensive coverage
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier with consistent code style

## [0.1.0] - Development

### Added

- Project initialization
- Basic project structure
- Core type definitions
- Initial configuration system
- Basic rule framework
- CLI foundation
- Plugin foundation

---

## Release Notes Format

Each release includes:

### Added

- New features and capabilities

### Changed

- Changes to existing functionality

### Deprecated

- Features that will be removed in future versions

### Removed

- Features removed in this version

### Fixed

- Bug fixes and corrections

### Security

- Security-related changes and fixes

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backward-compatible functionality additions
- **PATCH** version for backward-compatible bug fixes

## Release Process

1. Update version in `package.json` and `manifest.json`
2. Update this CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions automatically creates release and publishes packages

## Links

- [GitHub Releases](https://github.com/obsidian-lint/obsidian-lint/releases)
- [NPM Package](https://www.npmjs.com/package/obsidian-lint)
- [Obsidian Community Plugin](https://obsidian.md/plugins?id=obsidian-lint)
