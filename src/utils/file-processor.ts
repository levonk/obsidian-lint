/**
 * File processing utilities with glob pattern support and safe operations
 */

import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { glob } from 'glob';
import type { MarkdownFile } from '../types/index.js';
import { MarkdownParser } from './markdown.js';
import {
  FileSystemError,
  ErrorCodes,
  ErrorRecoveryOptions,
  ErrorContextBuilder,
} from '../types/errors.js';

/**
 * File processor with scanning and safe operations
 */
export class FileProcessor {
  private parser = new MarkdownParser();

  /**
   * Scan vault for markdown files using glob patterns with enhanced error handling
   */
  async scanVault(
    vaultPath: string,
    patterns: string[] = ['**/*.md'],
    recoveryOptions?: ErrorRecoveryOptions
  ): Promise<string[]> {
    const allFiles: string[] = [];
    const retryCount = recoveryOptions?.retryCount ?? 0;
    const retryDelay = recoveryOptions?.retryDelay ?? 1000;

    // Validate vault path exists
    try {
      await fs.access(vaultPath);
    } catch (error) {
      const context = new ErrorContextBuilder()
        .addFile(vaultPath)
        .addOperation('scanVault')
        .addOriginalError(error as Error)
        .build();

      throw new FileSystemError(
        `Vault path does not exist or is not accessible: ${vaultPath}`,
        ErrorCodes.FILE_NOT_FOUND,
        vaultPath,
        context
      );
    }

    for (const pattern of patterns) {
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt <= retryCount) {
        try {
          const files = await glob(pattern, {
            cwd: vaultPath,
            absolute: true,
            ignore: [
              '**/node_modules/**',
              '**/.git/**',
              '**/.obsidian/**',
              '**/dist/**',
              '**/build/**',
              '**/.tmp/**',
              '**/*.tmp',
            ],
          });
          allFiles.push(...files);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error as Error;
          attempt++;

          if (attempt <= retryCount) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          } else {
            // All retries exhausted
            const context = new ErrorContextBuilder()
              .addFile(vaultPath)
              .addOperation('scanVault')
              .addCustom('pattern', pattern)
              .addCustom('attempts', attempt)
              .addOriginalError(lastError)
              .build();

            if (recoveryOptions?.skipOnError) {
              console.warn(
                `Skipping pattern "${pattern}" due to error: ${lastError.message}`
              );
              continue;
            }

            throw new FileSystemError(
              `Failed to scan files with pattern "${pattern}" after ${attempt} attempts`,
              ErrorCodes.VAULT_SCAN_ERROR,
              vaultPath,
              context
            );
          }
        }
      }
    }

    // Remove duplicates and sort
    const uniqueFiles = [...new Set(allFiles)].sort();

    // Validate that we found some files (unless explicitly allowed to be empty)
    if (uniqueFiles.length === 0 && !recoveryOptions?.continueOnError) {
      console.warn(`No markdown files found in vault: ${vaultPath}`);
    }

    return uniqueFiles;
  }

  /**
   * Parse a markdown file from disk with enhanced error handling
   */
  async parseMarkdownFile(
    filePath: string,
    recoveryOptions?: ErrorRecoveryOptions
  ): Promise<MarkdownFile> {
    const retryCount = recoveryOptions?.retryCount ?? 0;
    const retryDelay = recoveryOptions?.retryDelay ?? 500;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= retryCount) {
      try {
        // Check if file exists and is readable
        await fs.access(filePath, fs.constants.R_OK);

        const content = await fs.readFile(filePath, 'utf-8');

        // Validate content is not empty (unless allowed)
        if (content.trim() === '' && !recoveryOptions?.continueOnError) {
          throw new Error('File is empty');
        }

        return await this.parser.parseMarkdown(filePath, content);
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt <= retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // Execute fallback action if provided
          if (recoveryOptions?.fallbackAction) {
            try {
              await recoveryOptions.fallbackAction();
            } catch (fallbackError) {
              console.warn('Fallback action failed:', fallbackError);
            }
          }

          // Determine appropriate error code
          let errorCode = ErrorCodes.FILE_PARSING_ERROR;
          if (
            lastError.message.includes('ENOENT') ||
            lastError.message.includes('not found')
          ) {
            errorCode = ErrorCodes.FILE_NOT_FOUND;
          } else if (
            lastError.message.includes('EACCES') ||
            lastError.message.includes('permission')
          ) {
            errorCode = ErrorCodes.FILE_ACCESS_DENIED;
          } else if (
            lastError.message.includes('EMFILE') ||
            lastError.message.includes('too many open files')
          ) {
            errorCode = ErrorCodes.FILE_READ_ERROR;
          }

          const context = new ErrorContextBuilder()
            .addFile(filePath)
            .addOperation('parseMarkdownFile')
            .addCustom('attempts', attempt)
            .addOriginalError(lastError)
            .build();

          throw new FileSystemError(
            `Failed to parse markdown file "${filePath}" after ${attempt} attempts: ${lastError.message}`,
            errorCode,
            filePath,
            context
          );
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected error in parseMarkdownFile');
  }

  /**
   * Write file content safely using atomic operations with enhanced error handling
   */
  async writeFile(
    filePath: string,
    content: string,
    recoveryOptions?: ErrorRecoveryOptions
  ): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    const retryCount = recoveryOptions?.retryCount ?? 2;
    const retryDelay = recoveryOptions?.retryDelay ?? 500;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= retryCount) {
      try {
        // Ensure directory exists
        await this.ensureDirectoryWithRecovery(
          dirname(filePath),
          recoveryOptions
        );

        // Check available disk space (basic check)
        const stats = await fs.stat(dirname(filePath));
        if (content.length > 1024 * 1024 * 100) {
          // 100MB
          console.warn(
            `Writing large file (${Math.round(content.length / 1024 / 1024)}MB): ${filePath}`
          );
        }

        // Write to temporary file first
        await fs.writeFile(tempPath, content, 'utf-8');

        // Verify the temp file was written correctly
        const writtenContent = await fs.readFile(tempPath, 'utf-8');
        if (writtenContent !== content) {
          throw new Error('Content verification failed after write');
        }

        // Atomically move temp file to final location
        await fs.rename(tempPath, filePath);

        // Success, exit retry loop
        break;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }

        if (attempt <= retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // Determine appropriate error code
          let errorCode = ErrorCodes.FILE_WRITE_ERROR;
          if (lastError.message.includes('ENOSPC')) {
            errorCode = ErrorCodes.FILE_WRITE_ERROR;
          } else if (
            lastError.message.includes('EACCES') ||
            lastError.message.includes('permission')
          ) {
            errorCode = ErrorCodes.FILE_ACCESS_DENIED;
          }

          const context = new ErrorContextBuilder()
            .addFile(filePath)
            .addOperation('writeFile')
            .addCustom('attempts', attempt)
            .addCustom('contentLength', content.length)
            .addCustom('tempPath', tempPath)
            .addOriginalError(lastError)
            .build();

          throw new FileSystemError(
            `Failed to write file "${filePath}" after ${attempt} attempts: ${lastError.message}`,
            errorCode,
            filePath,
            context
          );
        }
      }
    }
  }

  /**
   * Move file safely with atomic operations and enhanced error handling
   */
  async moveFile(
    oldPath: string,
    newPath: string,
    recoveryOptions?: ErrorRecoveryOptions
  ): Promise<void> {
    const retryCount = recoveryOptions?.retryCount ?? 1;
    const retryDelay = recoveryOptions?.retryDelay ?? 500;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= retryCount) {
      try {
        // Check if source file exists
        await fs.access(oldPath, fs.constants.R_OK);

        // Ensure destination directory exists
        await this.ensureDirectoryWithRecovery(
          dirname(newPath),
          recoveryOptions
        );

        // Check if destination already exists
        try {
          await fs.access(newPath);

          if (recoveryOptions?.continueOnError) {
            console.warn(
              `Destination file already exists, skipping: ${newPath}`
            );
            return;
          }

          throw new Error(`Destination file already exists: ${newPath}`);
        } catch (error) {
          // File doesn't exist, which is what we want
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }

        // Create backup of source file if it's important
        let backupPath: string | null = null;
        if (recoveryOptions?.fallbackAction) {
          backupPath = await this.createBackup(oldPath);
        }

        try {
          // Move the file
          await fs.rename(oldPath, newPath);

          // Clean up backup if move was successful
          if (backupPath) {
            await fs.unlink(backupPath);
          }

          break; // Success
        } catch (moveError) {
          // Restore from backup if move failed
          if (backupPath) {
            try {
              await fs.rename(backupPath, oldPath);
            } catch (restoreError) {
              console.error(`Failed to restore backup: ${restoreError}`);
            }
          }
          throw moveError;
        }
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt <= retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // Determine appropriate error code
          let errorCode = ErrorCodes.FILE_MOVE_ERROR;
          if (lastError.message.includes('ENOENT')) {
            errorCode = ErrorCodes.FILE_NOT_FOUND;
          } else if (
            lastError.message.includes('EACCES') ||
            lastError.message.includes('permission')
          ) {
            errorCode = ErrorCodes.FILE_ACCESS_DENIED;
          } else if (lastError.message.includes('already exists')) {
            errorCode = ErrorCodes.FILE_MOVE_ERROR;
          }

          const context = new ErrorContextBuilder()
            .addFile(oldPath)
            .addOperation('moveFile')
            .addCustom('newPath', newPath)
            .addCustom('attempts', attempt)
            .addOriginalError(lastError)
            .build();

          throw new FileSystemError(
            `Failed to move file from "${oldPath}" to "${newPath}" after ${attempt} attempts: ${lastError.message}`,
            errorCode,
            oldPath,
            context
          );
        }
      }
    }
  }

  /**
   * Copy file safely with enhanced error handling
   */
  async copyFile(
    sourcePath: string,
    destPath: string,
    recoveryOptions?: ErrorRecoveryOptions
  ): Promise<void> {
    const retryCount = recoveryOptions?.retryCount ?? 1;
    const retryDelay = recoveryOptions?.retryDelay ?? 500;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= retryCount) {
      try {
        // Check source file exists and is readable
        await fs.access(sourcePath, fs.constants.R_OK);

        // Ensure destination directory exists
        await this.ensureDirectoryWithRecovery(
          dirname(destPath),
          recoveryOptions
        );

        // Copy the file
        await fs.copyFile(sourcePath, destPath);

        // Verify the copy was successful
        const sourceStats = await fs.stat(sourcePath);
        const destStats = await fs.stat(destPath);

        if (sourceStats.size !== destStats.size) {
          throw new Error('File size mismatch after copy');
        }

        break; // Success
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt <= retryCount) {
          // Clean up partial copy if it exists
          try {
            await fs.unlink(destPath);
          } catch {
            // Ignore cleanup errors
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // Determine appropriate error code
          let errorCode = ErrorCodes.FILE_WRITE_ERROR;
          if (lastError.message.includes('ENOENT')) {
            errorCode = ErrorCodes.FILE_NOT_FOUND;
          } else if (
            lastError.message.includes('EACCES') ||
            lastError.message.includes('permission')
          ) {
            errorCode = ErrorCodes.FILE_ACCESS_DENIED;
          }

          const context = new ErrorContextBuilder()
            .addFile(sourcePath)
            .addOperation('copyFile')
            .addCustom('destPath', destPath)
            .addCustom('attempts', attempt)
            .addOriginalError(lastError)
            .build();

          throw new FileSystemError(
            `Failed to copy file from "${sourcePath}" to "${destPath}" after ${attempt} attempts: ${lastError.message}`,
            errorCode,
            sourcePath,
            context
          );
        }
      }
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath: string): Promise<{ size: number; mtime: Date }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
      };
    } catch (error) {
      throw new Error(`Failed to get file stats for "${filePath}": ${error}`);
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file "${filePath}": ${error}`);
    }
  }

  /**
   * Delete file safely
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to delete file "${filePath}": ${error}`);
      }
    }
  }

  /**
   * Create backup of file with enhanced error handling
   */
  async createBackup(
    filePath: string,
    recoveryOptions?: ErrorRecoveryOptions
  ): Promise<string> {
    const timestamp = Date.now();
    const backupPath = `${filePath}.backup.${timestamp}`;

    try {
      await this.copyFile(filePath, backupPath, recoveryOptions);
      return backupPath;
    } catch (error) {
      const context = new ErrorContextBuilder()
        .addFile(filePath)
        .addOperation('createBackup')
        .addCustom('backupPath', backupPath)
        .addOriginalError(error as Error)
        .build();

      throw new FileSystemError(
        `Failed to create backup of "${filePath}": ${(error as Error).message}`,
        ErrorCodes.FILE_BACKUP_ERROR,
        filePath,
        context
      );
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory "${dirPath}": ${error}`);
    }
  }

  /**
   * Ensure directory exists with enhanced error handling and recovery
   */
  private async ensureDirectoryWithRecovery(
    dirPath: string,
    recoveryOptions?: ErrorRecoveryOptions
  ): Promise<void> {
    const retryCount = recoveryOptions?.retryCount ?? 1;
    const retryDelay = recoveryOptions?.retryDelay ?? 500;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= retryCount) {
      try {
        await fs.mkdir(dirPath, { recursive: true });

        // Verify directory was created and is writable
        await fs.access(dirPath, fs.constants.W_OK);

        break; // Success
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt <= retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          const context = new ErrorContextBuilder()
            .addFile(dirPath)
            .addOperation('ensureDirectory')
            .addCustom('attempts', attempt)
            .addOriginalError(lastError)
            .build();

          throw new FileSystemError(
            `Failed to create directory "${dirPath}" after ${attempt} attempts: ${lastError.message}`,
            ErrorCodes.FILE_WRITE_ERROR,
            dirPath,
            context
          );
        }
      }
    }
  }

  /**
   * Filter files by patterns
   */
  filterFilesByPatterns(
    files: string[],
    includePatterns: string[] = ['**/*'],
    excludePatterns: string[] = []
  ): string[] {
    return files.filter(file => {
      // Check include patterns
      const included = includePatterns.some(pattern =>
        this.matchesPattern(file, pattern)
      );

      if (!included) {
        return false;
      }

      // Check exclude patterns
      const excluded = excludePatterns.some(pattern =>
        this.matchesPattern(file, pattern)
      );

      return !excluded;
    });
  }

  /**
   * Simple pattern matching (supports * wildcards)
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any filename chars
      .replace(/\?/g, '.'); // ? matches single char

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}
