#!/usr/bin/env bun
/**
 * Package Obsidian plugin for distribution
 * Creates a zip file ready for manual installation or community plugin submission
 */

import { $ } from 'bun';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const PLUGIN_BUILD_DIR = 'dist/plugin';
const PLUGIN_PACKAGE_DIR = 'dist/plugin-package';
const PLUGIN_ZIP = 'obsidian-lint-plugin.zip';

async function preparePluginPackage() {
  console.log('📦 Preparing plugin package...');

  // Ensure plugin is built
  if (!existsSync(PLUGIN_BUILD_DIR)) {
    console.log('Building plugin first...');
    await $`bun run build:plugin`;
  }

  // Create package directory
  if (existsSync(PLUGIN_PACKAGE_DIR)) {
    rmSync(PLUGIN_PACKAGE_DIR, { recursive: true, force: true });
  }
  mkdirSync(PLUGIN_PACKAGE_DIR, { recursive: true });

  // Copy essential plugin files
  copyFileSync('manifest.json', join(PLUGIN_PACKAGE_DIR, 'manifest.json'));

  // Copy main plugin file if it exists
  const pluginMainPath = join(PLUGIN_BUILD_DIR, 'index.js');
  if (existsSync(pluginMainPath)) {
    copyFileSync(pluginMainPath, join(PLUGIN_PACKAGE_DIR, 'main.js'));
  } else {
    console.warn('⚠️ Plugin main file not found, creating placeholder');
    writeFileSync(
      join(PLUGIN_PACKAGE_DIR, 'main.js'),
      '// Plugin placeholder - build incomplete'
    );
  }

  // Copy styles if they exist
  const stylesPath = join(PLUGIN_BUILD_DIR, 'styles.css');
  if (existsSync(stylesPath)) {
    copyFileSync(stylesPath, join(PLUGIN_PACKAGE_DIR, 'styles.css'));
  }

  // Create versions.json for community plugin
  const manifest = JSON.parse(await Bun.file('manifest.json').text());
  const versions = {
    [manifest.version]: manifest.minAppVersion,
  };
  writeFileSync(
    join(PLUGIN_PACKAGE_DIR, 'versions.json'),
    JSON.stringify(versions, null, 2)
  );

  console.log('✅ Plugin package prepared');
}

async function createPluginZip() {
  console.log('🗜️ Creating plugin zip...');

  // Remove existing zip
  if (existsSync(PLUGIN_ZIP)) {
    rmSync(PLUGIN_ZIP, { force: true });
  }

  // Create zip from package directory using PowerShell on Windows
  try {
    await $`powershell -Command "Compress-Archive -Path '${PLUGIN_PACKAGE_DIR}/*' -DestinationPath '${PLUGIN_ZIP}' -Force"`;
    console.log(`✅ Plugin zip created: ${PLUGIN_ZIP}`);
  } catch (error) {
    console.warn('⚠️ PowerShell zip failed, trying alternative method');
    try {
      // Fallback to zip command for Unix systems
      await $`cd ${PLUGIN_PACKAGE_DIR} && zip -r ../../${PLUGIN_ZIP} . && cd ../..`;
      console.log(`✅ Plugin zip created: ${PLUGIN_ZIP}`);
    } catch (zipError) {
      console.error(
        '❌ Failed to create zip file. Please install zip utility or use PowerShell on Windows'
      );
      throw zipError;
    }
  }
}

async function validatePlugin() {
  console.log('🔍 Validating plugin package...');

  const requiredFiles = ['manifest.json', 'main.js'];
  const missingFiles = [];

  for (const file of requiredFiles) {
    if (!existsSync(join(PLUGIN_PACKAGE_DIR, file))) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing required plugin files: ${missingFiles.join(', ')}`
    );
  }

  // Validate manifest
  const manifest = JSON.parse(
    await Bun.file(join(PLUGIN_PACKAGE_DIR, 'manifest.json')).text()
  );
  const requiredFields = [
    'id',
    'name',
    'version',
    'minAppVersion',
    'description',
  ];
  const missingFields = requiredFields.filter(field => !manifest[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required manifest fields: ${missingFields.join(', ')}`
    );
  }

  console.log('✅ Plugin package validation passed');
}

async function main() {
  const startTime = Date.now();

  try {
    await preparePluginPackage();
    await validatePlugin();
    await createPluginZip();

    const duration = Date.now() - startTime;
    console.log(`🎉 Plugin packaging completed successfully in ${duration}ms`);
    console.log(`📁 Package location: ${PLUGIN_ZIP}`);
    console.log(`📋 Installation: Extract to .obsidian/plugins/obsidian-lint/`);
  } catch (error) {
    console.error('❌ Plugin packaging failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
