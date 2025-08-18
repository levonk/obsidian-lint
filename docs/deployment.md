# Deployment Guide

This guide covers deployment processes for maintainers and contributors of Obsidian Lint.

## Release Process

### Semantic Versioning

We follow [Semantic Versioning](https://semver.org/) (SemVer):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

### Pre-Release Checklist

Before creating a release:

- [ ] All tests pass locally and in CI
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Version numbers are consistent across files
- [ ] Plugin manifest is validated
- [ ] Security audit passes

### Release Steps

#### 1. Prepare Release

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Run full test suite
bun run test:ci
bun run lint
bun run typecheck

# Build and test
bun run build
```

#### 2. Update Version

```bash
# Update version in package.json and manifest.json
npm version patch  # or minor/major
# This automatically creates a git tag
```

#### 3. Push Release

```bash
# Push changes and tags
git push origin main --tags
```

#### 4. Automated Release

The GitHub Actions workflow will automatically:

- Run tests
- Build the project
- Publish to npm
- Create GitHub release
- Package Obsidian plugin
- Upload release assets

## CI/CD Pipeline

### Continuous Integration

**Triggers**: Push to main/develop, Pull Requests

**Jobs**:

- **Test Matrix**: Tests on Ubuntu, Windows, macOS
- **Build Validation**: Ensures project builds successfully
- **Plugin Validation**: Validates Obsidian plugin structure
- **Security Audit**: Checks for vulnerabilities

### Continuous Deployment

**Triggers**: Git tags (v\*)

**Jobs**:

- **NPM Release**: Publishes CLI tool to npm registry
- **Plugin Release**: Creates GitHub release with plugin zip
- **Documentation**: Updates documentation site

### Workflow Files

```
.github/workflows/
├── ci.yml                 # Main CI pipeline
├── release.yml            # Release automation
└── plugin-validation.yml  # Plugin-specific validation
```

## NPM Package Deployment

### Package Configuration

The package is configured for dual distribution:

```json
{
  "type": "module",
  "main": "./dist/cli/index.js",
  "bin": {
    "obsidian-lint": "./dist/cli/index.js"
  },
  "exports": {
    ".": "./dist/cli/index.js",
    "./core": "./dist/core/index.js",
    "./plugin": "./dist/plugin/index.js"
  }
}
```

### Build Process

```bash
# Production build
bun run build

# Verify package contents
npm pack --dry-run

# Test installation locally
npm install -g ./obsidian-lint-*.tgz
```

### Publishing

```bash
# Manual publish (if needed)
npm publish

# Beta release
npm publish --tag beta

# Check published package
npm view obsidian-lint
```

## Obsidian Plugin Deployment

### Plugin Structure

```
dist/plugin-package/
├── manifest.json     # Plugin metadata
├── main.js          # Plugin code
├── styles.css       # Plugin styles (optional)
└── versions.json    # Version compatibility
```

### Community Plugin Submission

1. **Initial Submission**:
   - Fork [obsidian-releases](https://github.com/obsidianmd/obsidian-releases)
   - Add plugin to `community-plugins.json`
   - Submit pull request

2. **Plugin Requirements**:
   - Valid `manifest.json`
   - Working `main.js`
   - Proper versioning
   - No security issues

3. **Review Process**:
   - Automated validation
   - Manual code review
   - Community feedback
   - Approval and merge

### Manual Plugin Distribution

```bash
# Build and package plugin
bun run build:plugin
bun run package:plugin

# Upload to GitHub releases
# Users download obsidian-lint-plugin.zip
# Extract to .obsidian/plugins/obsidian-lint/
```

## Environment Configuration

### Development Environment

```bash
# Clone repository
git clone https://github.com/obsidian-lint/obsidian-lint.git
cd obsidian-lint

# Install dependencies
bun install

# Set up development environment
cp config/example-obsidian-lint.toml config/obsidian-lint.toml

# Start development
bun run dev
```

### Production Environment

```bash
# Install from npm
npm install -g obsidian-lint

# Or use in project
npm install obsidian-lint
```

### Testing Environment

```bash
# Run all tests
bun test

# Run with coverage
bun run test:ci

# Run specific test suites
bun test tests/unit/
bun test tests/integration/
bun test tests/e2e/
```

## Security Considerations

### Dependency Management

```bash
# Regular security audits
bun audit

# Update dependencies
bun update

# Check for outdated packages
bun outdated
```

### Code Security

- **Input Validation**: All user inputs are validated
- **File System Access**: Restricted to vault directories
- **Configuration**: TOML parsing with schema validation
- **Plugin Security**: Follows Obsidian security guidelines

### Release Security

- **Signed Releases**: All releases are signed
- **Checksum Verification**: SHA256 checksums provided
- **Vulnerability Scanning**: Automated security scanning
- **Access Control**: Limited maintainer access

## Monitoring and Maintenance

### Health Checks

```bash
# Check CLI functionality
obsidian-lint --version
obsidian-lint --help

# Test with sample vault
obsidian-lint tests/fixtures/sample-vault --dry-run
```

### Performance Monitoring

- **Build Times**: Track CI/CD pipeline performance
- **Package Size**: Monitor npm package size
- **Plugin Size**: Monitor Obsidian plugin size
- **Test Coverage**: Maintain >90% test coverage

### Maintenance Tasks

#### Weekly

- [ ] Review and merge dependabot PRs
- [ ] Check CI/CD pipeline health
- [ ] Review GitHub issues and discussions

#### Monthly

- [ ] Update dependencies
- [ ] Review and update documentation
- [ ] Performance analysis
- [ ] Security audit

#### Quarterly

- [ ] Major dependency updates
- [ ] Architecture review
- [ ] User feedback analysis
- [ ] Roadmap planning

## Rollback Procedures

### NPM Package Rollback

```bash
# Unpublish specific version (within 24 hours)
npm unpublish obsidian-lint@1.2.3

# Deprecate version
npm deprecate obsidian-lint@1.2.3 "Version deprecated due to critical bug"
```

### Plugin Rollback

1. **GitHub Release**: Delete problematic release
2. **Community Plugin**: Submit PR to revert version
3. **User Communication**: Notify users via GitHub issues

### Emergency Procedures

1. **Critical Security Issue**:
   - Immediately unpublish affected versions
   - Create security advisory
   - Release patched version
   - Notify users

2. **Breaking Bug**:
   - Deprecate affected version
   - Release hotfix
   - Update documentation

## Documentation Deployment

### Documentation Site

- **Platform**: GitHub Pages
- **Generator**: Static site generator
- **Source**: `docs/` directory
- **URL**: https://obsidian-lint.github.io/obsidian-lint/

### Update Process

```bash
# Update documentation
git add docs/
git commit -m "docs: update documentation"
git push origin main

# Documentation automatically deploys via GitHub Actions
```

## Support and Communication

### Release Communication

- **GitHub Releases**: Detailed changelog
- **NPM**: Version update notifications
- **Community**: Discord/Forum announcements
- **Documentation**: Updated guides and examples

### Issue Management

- **Bug Reports**: GitHub Issues with templates
- **Feature Requests**: GitHub Discussions
- **Security Issues**: Private security advisories
- **Community Support**: GitHub Discussions

This deployment guide ensures consistent, secure, and reliable releases of both the CLI tool and Obsidian plugin.
