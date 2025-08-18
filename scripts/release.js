#!/usr/bin/env bun
/**
 * Release script for obsidian-lint
 * Handles version bumping, changelog updates, and release preparation
 */

import { $ } from 'bun';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const VALID_TYPES = ['patch', 'minor', 'major'];

async function getCurrentVersion() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  return packageJson.version;
}

async function updateVersion(type) {
  console.log(`📈 Bumping ${type} version...`);

  // Use npm version to update package.json and create git tag
  const result = await $`npm version ${type} --no-git-tag-version`.text();
  const newVersion = result.trim().replace('v', '');

  // Update manifest.json to match
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  manifest.version = newVersion;
  writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

  console.log(`✅ Version updated to ${newVersion}`);
  return newVersion;
}

async function updateChangelog(version) {
  console.log('📝 Updating CHANGELOG.md...');

  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const date = new Date().toISOString().split('T')[0];

  // Replace [Unreleased] with the new version
  const updatedChangelog = changelog.replace(
    '## [Unreleased]',
    `## [Unreleased]

### Added
### Changed
### Fixed

## [${version}] - ${date}`
  );

  writeFileSync('CHANGELOG.md', updatedChangelog);
  console.log('✅ CHANGELOG.md updated');
}

async function runPreReleaseChecks() {
  console.log('🔍 Running pre-release checks...');

  // Type checking
  console.log('  - Type checking...');
  await $`bun run typecheck`;

  // Linting
  console.log('  - Linting...');
  await $`bun run lint`;

  // Formatting check
  console.log('  - Format checking...');
  await $`bun run format:check`;

  // Tests
  console.log('  - Running tests...');
  await $`bun run test:ci`;

  // Build
  console.log('  - Building project...');
  await $`bun run build`;

  // Plugin validation
  console.log('  - Validating plugin...');
  await $`bun run package:plugin`;

  console.log('✅ All pre-release checks passed');
}

async function commitAndTag(version) {
  console.log('📦 Creating git commit and tag...');

  // Stage changes
  await $`git add package.json manifest.json CHANGELOG.md`;

  // Commit changes
  await $`git commit -m "chore: release v${version}"`;

  // Create tag
  await $`git tag v${version}`;

  console.log(`✅ Created commit and tag v${version}`);
}

async function showReleaseInstructions(version) {
  console.log('\n🎉 Release preparation complete!');
  console.log('\nNext steps:');
  console.log(`1. Review the changes: git show v${version}`);
  console.log('2. Push the changes: git push origin main');
  console.log(`3. Push the tag: git push origin v${version}`);
  console.log('4. GitHub Actions will automatically:');
  console.log('   - Run tests');
  console.log('   - Build and publish to npm');
  console.log('   - Create GitHub release');
  console.log('   - Package and upload plugin');
  console.log('\nOr push both at once: git push origin main --tags');
}

async function main() {
  const args = process.argv.slice(2);
  const releaseType = args[0];

  if (!releaseType || !VALID_TYPES.includes(releaseType)) {
    console.error('❌ Invalid release type. Use: patch, minor, or major');
    console.error('Usage: bun run scripts/release.js <patch|minor|major>');
    process.exit(1);
  }

  try {
    const currentVersion = await getCurrentVersion();
    console.log(`📋 Current version: ${currentVersion}`);

    // Check if working directory is clean
    const status = await $`git status --porcelain`.text();
    if (status.trim()) {
      console.error(
        '❌ Working directory is not clean. Please commit or stash changes.'
      );
      process.exit(1);
    }

    // Check if on main branch
    const branch = await $`git branch --show-current`.text();
    if (branch.trim() !== 'main') {
      console.error('❌ Not on main branch. Please switch to main branch.');
      process.exit(1);
    }

    // Pull latest changes
    console.log('🔄 Pulling latest changes...');
    await $`git pull origin main`;

    // Run pre-release checks
    await runPreReleaseChecks();

    // Update version
    const newVersion = await updateVersion(releaseType);

    // Update changelog
    await updateChangelog(newVersion);

    // Commit and tag
    await commitAndTag(newVersion);

    // Show instructions
    await showReleaseInstructions(newVersion);
  } catch (error) {
    console.error('❌ Release preparation failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
