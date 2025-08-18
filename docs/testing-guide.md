# Testing Guide - Obsidian Lint Tool

## Overview

This guide covers the comprehensive testing strategy for the Obsidian Lint Tool, including unit tests, integration tests, performance tests, and end-to-end workflow tests.

## Test Structure

```
tests/
├── unit/                   # Unit tests for individual components
│   ├── core/              # Core engine components
│   ├── rules/             # Individual rule implementations
│   ├── utils/             # Utility functions
│   ├── cli/               # CLI components
│   └── plugin/            # Obsidian plugin components
├── integration/           # Integration tests
│   ├── engine-*.test.ts   # Engine integration tests
│   ├── *-rules.test.ts    # Rule integration tests
│   └── cli.test.ts        # CLI integration tests
├── performance/           # Performance and scalability tests
│   ├── benchmarks.test.ts     # Performance benchmarks
│   ├── large-vault.test.ts    # Large vault performance
│   ├── memory-manager.test.ts # Memory management tests
│   └── worker-pool.test.ts    # Parallel processing tests
├── e2e/                   # End-to-end workflow tests
│   └── complete-workflows.test.ts # Complete user workflows
└── fixtures/              # Test data and mock files
    ├── vaults/            # Sample vault structures
    ├── configs/           # Test configurations
    └── rules/             # Test rule files
```

## Running Tests

### All Tests

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Run tests in watch mode
bun test --watch
```

### Specific Test Suites

```bash
# Unit tests only
bun test tests/unit/

# Integration tests only
bun test tests/integration/

# Performance tests only
bun test tests/performance/

# End-to-end tests only
bun test tests/e2e/
```

### Individual Test Files

```bash
# Specific test file
bun test tests/unit/core/engine.test.ts

# With verbose output
bun test --verbose tests/unit/core/engine.test.ts

# Run once (no watch mode)
bun test --run tests/unit/core/engine.test.ts
```

### Comprehensive Test Runner

```bash
# Run comprehensive test suite with reporting
./scripts/test-comprehensive.sh
```

## Test Categories

### Unit Tests

Unit tests focus on individual components in isolation.

#### Core Engine Tests

- Configuration loading and validation
- Rule discovery and loading
- File processing pipeline
- Error handling and recovery

#### Rule Tests

- Individual rule logic
- Rule configuration parsing
- Issue detection accuracy
- Fix application correctness

#### Utility Tests

- Markdown parsing
- File system operations
- TOML configuration parsing
- Logging and progress reporting

### Integration Tests

Integration tests verify component interactions.

#### Engine Integration

- Complete linting workflows
- Rule execution coordination
- Configuration and rule integration
- Error propagation and handling

#### Rule Integration

- Rule conflict detection
- Profile switching
- Rule variant management
- Cross-rule dependencies

#### CLI Integration

- Command-line argument processing
- Configuration file handling
- Output formatting
- Exit code handling

### Performance Tests

Performance tests ensure scalability and efficiency.

#### Benchmarks

- Core operation timing
- Memory usage patterns
- Cache effectiveness
- Parallel processing efficiency

#### Large Vault Tests

- 1000+ note processing
- Memory management under load
- Parallel processing scaling
- Resource usage optimization

#### Stress Tests

- Extremely large files
- Deep directory structures
- High link density
- Concurrent operations

### End-to-End Tests

E2E tests verify complete user workflows.

#### Complete Workflows

- New vault setup and processing
- Complex vault with multiple rules
- Dry-run mode validation
- Error recovery scenarios

#### Profile Management

- Profile switching
- Configuration validation
- Rule conflict detection
- Multi-profile workflows

#### CLI Workflows

- JSON output formatting
- Incremental processing
- Batch operations
- Integration with scripts

## Writing Tests

### Test File Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YourComponent } from '../../../src/path/to/component.js';

describe('YourComponent', () => {
  let component: YourComponent;

  beforeEach(() => {
    // Setup before each test
    component = new YourComponent();
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
      const result = component.methodName('input');
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      // Edge case testing
      const result = component.methodName('');
      expect(result).toBe('default');
    });

    it('should throw error for invalid input', () => {
      // Error case testing
      expect(() => component.methodName(null)).toThrow();
    });
  });
});
```

### Test Helpers

#### Vault Creation Helper

```typescript
// tests/helpers/vault-helper.ts
export async function createTestVault(
  vaultPath: string,
  structure: {
    notes: Array<{ path: string; content: string }>;
    attachments?: Array<{ path: string; content: string }>;
    config?: any;
  }
) {
  // Implementation for creating test vaults
}
```

#### Configuration Helper

```typescript
// tests/helpers/config-helper.ts
export function createTestConfiguration(options: {
  profile?: string;
  rules?: string[];
  settings?: Record<string, any>;
}) {
  // Implementation for creating test configurations
}
```

### Mocking

#### File System Mocking

```typescript
import { vi } from 'vitest';
import { promises as fs } from 'fs';

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    // ... other fs methods
  },
}));
```

#### Obsidian API Mocking

```typescript
// tests/__mocks__/obsidian.ts
export class Plugin {
  app: any;
  manifest: any;

  constructor() {
    this.app = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        // ... other vault methods
      },
    };
  }
}
```

## Performance Testing

### Benchmarking

```typescript
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('should complete operation within time limit', async () => {
    const start = performance.now();

    await performOperation();

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1000); // 1 second limit
  });
});
```

### Memory Testing

```typescript
describe('Memory Tests', () => {
  it('should not leak memory', async () => {
    const initialMemory = process.memoryUsage();

    // Perform operations
    for (let i = 0; i < 1000; i++) {
      await performOperation();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB limit
  });
});
```

## Test Data Management

### Fixtures

Test fixtures provide consistent test data:

```
tests/fixtures/
├── vaults/
│   ├── minimal-vault/         # Basic vault structure
│   ├── complex-vault/         # Complex vault with all features
│   └── corrupted-vault/       # Vault with various issues
├── configs/
│   ├── basic-config.toml      # Basic configuration
│   ├── comprehensive-config.toml # Full configuration
│   └── invalid-config.toml    # Invalid configuration for error testing
└── rules/
    ├── valid-rule.toml        # Valid rule configuration
    ├── invalid-rule.toml      # Invalid rule for error testing
    └── conflicting-rules/     # Rules that conflict with each other
```

### Dynamic Test Data

```typescript
// Generate test data dynamically
function generateTestVault(
  noteCount: number,
  complexity: 'simple' | 'complex'
) {
  const notes = [];

  for (let i = 0; i < noteCount; i++) {
    notes.push({
      path: `note-${i}.md`,
      content: generateNoteContent(i, complexity),
    });
  }

  return { notes };
}
```

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run unit tests
        run: bun test tests/unit/

      - name: Run integration tests
        run: bun test tests/integration/

      - name: Run performance tests
        run: timeout 300 bun test tests/performance/

      - name: Generate coverage report
        run: bun test --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Run tests before commit
bun test tests/unit/ tests/integration/

if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi

# Run linting
bun run lint

if [ $? -ne 0 ]; then
  echo "Linting failed. Commit aborted."
  exit 1
fi
```

## Test Coverage

### Coverage Goals

- **Unit Tests**: 90%+ coverage for core components
- **Integration Tests**: 80%+ coverage for component interactions
- **E2E Tests**: 70%+ coverage for user workflows

### Coverage Reporting

```bash
# Generate coverage report
bun test --coverage

# View coverage in browser
bun test --coverage --reporter=html
open coverage/index.html
```

### Coverage Analysis

```typescript
// Example of comprehensive test coverage
describe('RuleEngine', () => {
  // Test all public methods
  describe('loadRules', () => {
    /* tests */
  });
  describe('executeRules', () => {
    /* tests */
  });
  describe('validateRules', () => {
    /* tests */
  });

  // Test error conditions
  describe('error handling', () => {
    /* tests */
  });

  // Test edge cases
  describe('edge cases', () => {
    /* tests */
  });

  // Test performance characteristics
  describe('performance', () => {
    /* tests */
  });
});
```

## Debugging Tests

### Debug Mode

```bash
# Run tests with debug output
DEBUG=obsidian-lint:* bun test

# Run specific test with debugging
bun test --verbose tests/unit/core/engine.test.ts
```

### Test Isolation

```typescript
describe.only('Specific Test', () => {
  // Only this test will run
  it('should debug specific issue', () => {
    // Debug implementation
  });
});
```

### Snapshot Testing

```typescript
import { expect } from 'vitest';

it('should match snapshot', () => {
  const result = generateOutput();
  expect(result).toMatchSnapshot();
});
```

## Best Practices

### Test Organization

1. **Group Related Tests**: Use `describe` blocks to group related functionality
2. **Clear Test Names**: Use descriptive test names that explain the expected behavior
3. **Single Responsibility**: Each test should verify one specific behavior
4. **Independent Tests**: Tests should not depend on each other

### Test Data

1. **Use Fixtures**: Create reusable test data in fixtures
2. **Generate Dynamically**: Use factories for dynamic test data generation
3. **Clean Up**: Always clean up test data after tests complete
4. **Isolate Data**: Each test should use its own test data

### Performance

1. **Parallel Execution**: Use parallel test execution where possible
2. **Mock External Dependencies**: Mock file system, network, and other external dependencies
3. **Optimize Setup**: Minimize expensive setup operations
4. **Profile Tests**: Identify and optimize slow tests

### Maintenance

1. **Regular Updates**: Keep tests updated with code changes
2. **Remove Obsolete Tests**: Remove tests for deprecated functionality
3. **Refactor Tests**: Refactor tests when code structure changes
4. **Document Complex Tests**: Add comments for complex test logic

This comprehensive testing guide ensures the Obsidian Lint Tool maintains high quality and reliability across all its features and use cases.
