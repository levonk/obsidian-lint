/**
 * File System Error Handler
 * Comprehensive error handling for file system operations with recovery options
 */

import { promises as fs, constants } from 'fs';
import { dirname, resolve, basename } from 'path';
import { createHash } from 'crypto';
import {
  FileSystemError,
  ErrorCodes,
  ErrorRecoveryOptions,
  ErrorContextBuilder,
  LintError,
} from '../types/errors.js';

export interface FileOperationResult<T = void> {
  success: boolean;
  result?: T;
  error?: FileSystemError;
  recoveryAttempted?: boolean;
  backupCreated?: boolean;
}

export interface BackupOptions {
  enabled: boolean;
  directory?: string;
  keepCount?: number;
  timestampFormat?: string;
}

export interface FileSystemErrorHandlerOptions {
  maxRetries: number;
  retryDelay: number;
  createBackups: boolean;
  backupOptions: BackupOptions;
  atomicWrites: boolean;
  validateChecksums: boolean;
}

export class FileSystemErrorHandler {
  private options: FileSystemErrorHandlerOptions;
  private backupDirectory: string;

  constructor(options: Partial<FileSystemErrorHandlerOptions> = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      createBackups: true,
      backupOptions: {
        enabled: true,
        keepCount: 5,
        timestampFormat: 'YYYY-MM-DD_HH-mm-ss',
      },
      atomicWrites: true,
      validateChecksums: false,
      ...options,
    };

    this.backupDirectory =
      this.options.backupOptions.directory || '.obsidian-lint-backups';
  }

  /**
   * Safely read a file with error handling and recovery
   */
  async readFile(filePath: string): Promise<FileOperationResult<string>> {
    const contextBuilder = new ErrorContextBuilder()
      .addFile(filePath)
      .addOperation('read_file');

    try {
      // Check if file exists and is readable
      await this.checkFileAccess(filePath, constants.R_OK);

      const content = await fs.readFile(filePath, 'utf-8');

      // Validate checksum if enabled
      if (this.options.validateChecksums) {
        await this.validateFileChecksum(filePath, content);
      }

      return {
        success: true,
        result: content,
      };
    } catch (error) {
      const fileSystemError = this.createFileSystemError(
        error,
        filePath,
        'read',
        contextBuilder
      );

      // Attempt recovery
      const recoveryResult = await this.attemptReadRecovery(
        filePath,
        fileSystemError
      );

      return {
        success: false,
        error: fileSystemError,
        recoveryAttempted: recoveryResult.attempted,
        result: recoveryResult.content,
      };
    }
  }

  /**
   * Safely write a file with error handling, backups, and atomic operations
   */
  async writeFile(
    filePath: string,
    content: string,
    options: { createBackup?: boolean; atomic?: boolean } = {}
  ): Promise<FileOperationResult> {
    const contextBuilder = new ErrorContextBuilder()
      .addFile(filePath)
      .addOperation('write_file')
      .addCustom('contentLength', content.length);

    const writeOptions = {
      createBackup: options.createBackup ?? this.options.createBackups,
      atomic: options.atomic ?? this.options.atomicWrites,
    };

    let backupCreated = false;
    let tempFilePath: string | undefined;

    try {
      // Create backup if requested and file exists
      if (writeOptions.createBackup && (await this.fileExists(filePath))) {
        await this.createBackup(filePath);
        backupCreated = true;
      }

      // Ensure directory exists
      await this.ensureDirectoryExists(dirname(filePath));

      if (writeOptions.atomic) {
        // Atomic write using temporary file
        tempFilePath = `${filePath}.tmp.${Date.now()}`;
        await fs.writeFile(tempFilePath, content, 'utf-8');

        // Validate written content
        if (this.options.validateChecksums) {
          const writtenContent = await fs.readFile(tempFilePath, 'utf-8');
          if (writtenContent !== content) {
            throw new Error('Content validation failed after write');
          }
        }

        // Atomic move
        await fs.rename(tempFilePath, filePath);
        tempFilePath = undefined;
      } else {
        // Direct write
        await fs.writeFile(filePath, content, 'utf-8');
      }

      return {
        success: true,
        backupCreated,
      };
    } catch (error) {
      // Clean up temporary file if it exists
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }

      const fileSystemError = this.createFileSystemError(
        error,
        filePath,
        'write',
        contextBuilder.addCustom('backupCreated', backupCreated)
      );

      // Attempt recovery
      const recoveryResult = await this.attemptWriteRecovery(
        filePath,
        content,
        fileSystemError,
        writeOptions
      );

      return {
        success: recoveryResult.success,
        error: fileSystemError,
        recoveryAttempted: true,
        backupCreated,
      };
    }
  }

  /**
   * Safely move a file with error handling and recovery
   */
  async moveFile(
    sourcePath: string,
    targetPath: string,
    options: { createBackup?: boolean; overwrite?: boolean } = {}
  ): Promise<FileOperationResult> {
    const contextBuilder = new ErrorContextBuilder()
      .addFile(sourcePath)
      .addOperation('move_file')
      .addCustom('targetPath', targetPath);

    const moveOptions = {
      createBackup: options.createBackup ?? this.options.createBackups,
      overwrite: options.overwrite ?? false,
    };

    let backupCreated = false;

    try {
      // Check source file exists
      await this.checkFileAccess(sourcePath, constants.R_OK);

      // Check if target exists and handle accordingly
      if (await this.fileExists(targetPath)) {
        if (!moveOptions.overwrite) {
          throw new Error(`Target file already exists: ${targetPath}`);
        }

        if (moveOptions.createBackup) {
          await this.createBackup(targetPath);
          backupCreated = true;
        }
      }

      // Ensure target directory exists
      await this.ensureDirectoryExists(dirname(targetPath));

      // Perform the move
      await fs.rename(sourcePath, targetPath);

      return {
        success: true,
        backupCreated,
      };
    } catch (error) {
      const fileSystemError = this.createFileSystemError(
        error,
        sourcePath,
        'move',
        contextBuilder.addCustom('backupCreated', backupCreated)
      );

      // Attempt recovery
      const recoveryResult = await this.attemptMoveRecovery(
        sourcePath,
        targetPath,
        fileSystemError,
        moveOptions
      );

      return {
        success: recoveryResult.success,
        error: fileSystemError,
        recoveryAttempted: true,
        backupCreated,
      };
    }
  }

  /**
   * Safely delete a file with error handling and backup
   */
  async deleteFile(
    filePath: string,
    options: { createBackup?: boolean } = {}
  ): Promise<FileOperationResult> {
    const contextBuilder = new ErrorContextBuilder()
      .addFile(filePath)
      .addOperation('delete_file');

    const deleteOptions = {
      createBackup: options.createBackup ?? this.options.createBackups,
    };

    let backupCreated = false;

    try {
      // Check if file exists
      if (!(await this.fileExists(filePath))) {
        return { success: true }; // Already deleted
      }

      // Create backup if requested
      if (deleteOptions.createBackup) {
        await this.createBackup(filePath);
        backupCreated = true;
      }

      // Delete the file
      await fs.unlink(filePath);

      return {
        success: true,
        backupCreated,
      };
    } catch (error) {
      const fileSystemError = this.createFileSystemError(
        error,
        filePath,
        'delete',
        contextBuilder.addCustom('backupCreated', backupCreated)
      );

      return {
        success: false,
        error: fileSystemError,
        recoveryAttempted: false,
        backupCreated,
      };
    }
  }

  /**
   * Create a backup of a file
   */
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = basename(filePath);
    const backupFileName = `${fileName}.backup.${timestamp}`;
    const backupPath = resolve(this.backupDirectory, backupFileName);

    // Ensure backup directory exists
    await this.ensureDirectoryExists(this.backupDirectory);

    // Copy file to backup location
    await fs.copyFile(filePath, backupPath);

    // Clean up old backups if needed
    await this.cleanupOldBackups(fileName);

    return backupPath;
  }

  /**
   * Clean up old backup files
   */
  private async cleanupOldBackups(fileName: string): Promise<void> {
    if (!this.options.backupOptions.keepCount) {
      return;
    }

    try {
      const files = await fs.readdir(this.backupDirectory);
      const backupFiles = files
        .filter(f => f.startsWith(`${fileName}.backup.`))
        .map(f => ({
          name: f,
          path: resolve(this.backupDirectory, f),
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by timestamp descending

      // Remove excess backups
      const toDelete = backupFiles.slice(this.options.backupOptions.keepCount);
      for (const file of toDelete) {
        await fs.unlink(file.path);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Attempt to recover from read errors
   */
  private async attemptReadRecovery(
    filePath: string,
    error: FileSystemError
  ): Promise<{ attempted: boolean; content?: string }> {
    // Try to read from backup if available
    try {
      const backupPath = await this.findLatestBackup(basename(filePath));
      if (backupPath) {
        const content = await fs.readFile(backupPath, 'utf-8');
        return { attempted: true, content };
      }
    } catch {
      // Backup recovery failed
    }

    return { attempted: true };
  }

  /**
   * Attempt to recover from write errors
   */
  private async attemptWriteRecovery(
    filePath: string,
    content: string,
    error: FileSystemError,
    options: { createBackup: boolean; atomic: boolean }
  ): Promise<{ success: boolean }> {
    // Retry with different options
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        await new Promise(resolve =>
          setTimeout(resolve, this.options.retryDelay * attempt)
        );

        // Try non-atomic write if atomic failed
        if (options.atomic && attempt > 1) {
          await fs.writeFile(filePath, content, 'utf-8');
          return { success: true };
        }

        // Try creating directory again
        await this.ensureDirectoryExists(dirname(filePath));
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
      } catch {
        // Continue to next attempt
      }
    }

    return { success: false };
  }

  /**
   * Attempt to recover from move errors
   */
  private async attemptMoveRecovery(
    sourcePath: string,
    targetPath: string,
    error: FileSystemError,
    options: { createBackup: boolean; overwrite: boolean }
  ): Promise<{ success: boolean }> {
    // Try copy + delete as fallback
    try {
      await fs.copyFile(sourcePath, targetPath);
      await fs.unlink(sourcePath);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Find the latest backup for a file
   */
  private async findLatestBackup(fileName: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.backupDirectory);
      const backupFiles = files
        .filter(f => f.startsWith(`${fileName}.backup.`))
        .sort()
        .reverse();

      if (backupFiles.length > 0) {
        return resolve(this.backupDirectory, backupFiles[0]);
      }
    } catch {
      // Directory doesn't exist or other error
    }

    return null;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check file access permissions
   */
  private async checkFileAccess(filePath: string, mode: number): Promise<void> {
    try {
      await fs.access(filePath, mode);
    } catch (error) {
      throw new Error(`File access denied: ${filePath}`);
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Validate file checksum
   */
  private async validateFileChecksum(
    filePath: string,
    content: string
  ): Promise<void> {
    const hash = createHash('sha256').update(content).digest('hex');
    const checksumPath = `${filePath}.checksum`;

    try {
      const storedChecksum = await fs.readFile(checksumPath, 'utf-8');
      if (storedChecksum.trim() !== hash) {
        throw new Error('File checksum validation failed');
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
      // No checksum file exists, create one
      await fs.writeFile(checksumPath, hash);
    }
  }

  /**
   * Create a FileSystemError from a generic error
   */
  private createFileSystemError(
    error: unknown,
    filePath: string,
    operation: string,
    contextBuilder: ErrorContextBuilder
  ): FileSystemError {
    const originalError =
      error instanceof Error ? error : new Error(String(error));
    const context = contextBuilder.addOriginalError(originalError).build();

    let code: string;
    let message: string;

    // Map common Node.js error codes to our error codes
    if ('code' in originalError) {
      switch ((originalError as any).code) {
        case 'ENOENT':
          code = ErrorCodes.FILE_NOT_FOUND;
          message = `File not found: ${filePath}`;
          break;
        case 'EACCES':
        case 'EPERM':
          code = ErrorCodes.FILE_ACCESS_DENIED;
          message = `Access denied: ${filePath}`;
          break;
        case 'ENOSPC':
          code = ErrorCodes.FILE_WRITE_ERROR;
          message = `No space left on device: ${filePath}`;
          break;
        case 'EMFILE':
        case 'ENFILE':
          code = ErrorCodes.FILE_READ_ERROR;
          message = `Too many open files: ${filePath}`;
          break;
        default:
          code = this.getErrorCodeForOperation(operation);
          message = `${operation} operation failed: ${originalError.message}`;
      }
    } else {
      code = this.getErrorCodeForOperation(operation);
      message = `${operation} operation failed: ${originalError.message}`;
    }

    return new FileSystemError(message, code, filePath, context);
  }

  /**
   * Get appropriate error code for operation type
   */
  private getErrorCodeForOperation(operation: string): string {
    switch (operation) {
      case 'read':
        return ErrorCodes.FILE_READ_ERROR;
      case 'write':
        return ErrorCodes.FILE_WRITE_ERROR;
      case 'move':
        return ErrorCodes.FILE_MOVE_ERROR;
      case 'delete':
        return ErrorCodes.FILE_ACCESS_DENIED;
      default:
        return ErrorCodes.FILE_PROCESSING_ERROR;
    }
  }

  /**
   * Execute a file operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    recoveryOptions: ErrorRecoveryOptions = {}
  ): Promise<T> {
    const options = {
      retryCount: this.options.maxRetries,
      retryDelay: this.options.retryDelay,
      skipOnError: false,
      continueOnError: false,
      ...recoveryOptions,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= options.retryCount; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === options.retryCount) {
          // Final attempt failed
          if (options.fallbackAction) {
            try {
              await options.fallbackAction();
            } catch {
              // Fallback failed, continue with original error
            }
          }

          if (options.skipOnError || options.continueOnError) {
            throw lastError;
          }

          throw lastError;
        }

        // Wait before retry
        if (options.retryDelay > 0) {
          await new Promise(resolve =>
            setTimeout(resolve, options.retryDelay * (attempt + 1))
          );
        }
      }
    }

    throw lastError || new Error('Operation failed with unknown error');
  }

  /**
   * Get backup directory path
   */
  getBackupDirectory(): string {
    return this.backupDirectory;
  }

  /**
   * Set backup directory path
   */
  setBackupDirectory(path: string): void {
    this.backupDirectory = path;
  }
}
