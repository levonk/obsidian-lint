# Contributing to Obsidian Lint

Thank you for your interest in contributing to Obsidian Lint! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **Bun**: 1.0.0 or higher
- **Git**: For version control
- **Code Editor**: VS Code recommended with TypeScript support

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/obsidian-lint.git
   cd obsidian-lint
   ```

2. **Install Dependencies**

   ```bash
   bun install
   ```

3. **Set Up Configuration**

   ```bash
   cp config/example-obsidian-lint.toml config/obsidian-lint.toml
   ```

4. **Build and Test**

   ```bash
   bun run build
   bun test
   ```

5. **Start Development**
   ```bash
   bun run dev
   ```

## 📋 Development Workflow

### Branch Strategy

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Feature development branches
- **fix/**: Bug fix branches
- **docs/**: Documentation updates

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(cli): add new command for rule validation
fix(plugin): resolve memory leak in file processing
docs(readme): update installation instructions
test(rules): add tests for frontmatter validation
chore(deps): update dependencies
```

**Types**:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `test`: Test additions/changes
- `chore`: Maintenance tasks
- `refactor`: Code refactoring
- `perf`: Performance improvements

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun run test:ci

# Run specific test files
bun test tests/unit/rules/
bun test tests/integration/

# Watch mode for development
bun test --watch
```

### Test Structure

```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests for workflows
├── e2e/           # End-to-end tests
├── performance/   # Performance benchmarks
├── fixtures/      # Test data and sample vaults
└── __mocks__/     # Mock implementations
```

### Writing Tests

```typescript
import { describe, it, expect } from 'bun:test';
import { MyRule } from '../src/rules/my-rule';

describe('MyRule', () => {
  it('should detect violations correctly', () => {
    const rule = new MyRule();
    const result = rule.lint(mockFile);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toBe('Expected message');
  });
});
```

## 🔧 Code Style

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use explicit return types for public methods
- Avoid `any` type - use proper typing

### Code Formatting

```bash
# Format code
bun run format

# Check formatting
bun run format:check

# Lint code
bun run lint

# Fix linting issues
bun run lint:fix
```

### File Organization

```
src/
├── cli/           # CLI interface
├── plugin/        # Obsidian plugin
├── core/          # Core engine
├── rules/         # Rule implementations
├── utils/         # Utility functions
└── types/         # TypeScript definitions
```

## 📝 Documentation

### Code Documentation

- Use JSDoc comments for public APIs
- Include examples in documentation
- Document complex algorithms and business logic

````typescript
/**
 * Validates frontmatter fields according to rule configuration
 * @param file - The markdown file to validate
 * @param config - Rule configuration options
 * @returns Array of validation issues found
 * @example
 * ```typescript
 * const issues = validateFrontmatter(file, { requiredFields: ['title'] });
 * ```
 */
export function validateFrontmatter(
  file: MarkdownFile,
  config: FrontmatterConfig
): Issue[] {
  // Implementation
}
````

### Documentation Updates

- Update relevant documentation for new features
- Include examples and usage instructions
- Update CLI help text and command descriptions

## 🐛 Bug Reports

### Before Reporting

1. Check existing issues
2. Test with latest version
3. Reproduce with minimal example
4. Check documentation

### Bug Report Template

```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**

1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**

- OS: [e.g., Windows 10, macOS 12, Ubuntu 20.04]
- Node.js version: [e.g., 18.17.0]
- Obsidian Lint version: [e.g., 1.0.0]
- Obsidian version: [e.g., 1.4.13] (if using plugin)

**Additional Context**
Any other relevant information
```

## ✨ Feature Requests

### Feature Request Template

```markdown
**Feature Description**
Clear description of the proposed feature

**Use Case**
Why is this feature needed? What problem does it solve?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other approaches you've considered

**Additional Context**
Any other relevant information
```

## 🔄 Pull Request Process

### Before Submitting

1. **Create Issue**: Discuss the change first
2. **Fork Repository**: Work in your own fork
3. **Create Branch**: Use descriptive branch name
4. **Write Tests**: Include appropriate tests
5. **Update Documentation**: Update relevant docs
6. **Test Locally**: Ensure all tests pass

### Pull Request Template

```markdown
**Description**
Brief description of changes

**Related Issue**
Fixes #123

**Type of Change**

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

**Testing**

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

**Checklist**

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
```

### Review Process

1. **Automated Checks**: CI pipeline must pass
2. **Code Review**: Maintainer review required
3. **Testing**: Verify functionality works
4. **Documentation**: Check docs are updated
5. **Merge**: Squash and merge when approved

## 🏗️ Architecture Guidelines

### Rule Development

When creating new rules:

1. **Extend BaseRule**: Use the base rule interface
2. **Hierarchical ID**: Use major.minor format
3. **Configuration**: Support rule-specific config
4. **Path Filtering**: Implement allowlist/denylist
5. **Auto-fix**: Implement fix method when possible

```typescript
export class MyRule extends BaseRule {
  id = 'my-category.my-variant';
  name = 'My Rule';
  description = 'Description of what this rule does';

  async lint(file: MarkdownFile): Promise<Issue[]> {
    // Implementation
  }

  async fix(file: MarkdownFile, issues: Issue[]): Promise<Fix[]> {
    // Implementation
  }
}
```

### Plugin Development

For Obsidian plugin features:

1. **Use Obsidian APIs**: Leverage built-in functionality
2. **Error Handling**: Graceful degradation
3. **Performance**: Avoid blocking UI
4. **Settings**: Integrate with plugin settings

## 📦 Release Process

### Version Management

1. **Update Version**: In package.json and manifest.json
2. **Update Changelog**: Document changes
3. **Create Tag**: `git tag v1.0.0`
4. **Push Tag**: Triggers automated release

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version numbers consistent
- [ ] Security audit passes
- [ ] Plugin validation passes

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow project guidelines

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code contributions
- **Documentation**: Improvements and clarifications

## 📚 Resources

### Learning Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Bun Documentation](https://bun.sh/docs)
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Markdown Specification](https://spec.commonmark.org/)

### Project Resources

- [Architecture Documentation](docs/developer-guide.md)
- [API Reference](docs/api-reference.md)
- [Testing Guide](docs/testing-guide.md)
- [Deployment Guide](docs/deployment.md)

## 🙏 Recognition

Contributors are recognized in:

- GitHub contributors list
- Release notes
- Documentation acknowledgments
- Project README

Thank you for contributing to Obsidian Lint! 🎉
