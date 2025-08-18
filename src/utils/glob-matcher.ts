/**
 * Simple glob pattern matching utility
 */

/**
 * Convert a glob pattern to a regular expression
 */
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and ?
  let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Handle ** (matches zero or more path segments including /)
  // Replace ** with a placeholder first to avoid conflicts with *
  regexPattern = regexPattern.replace(/\*\*/g, '__DOUBLE_STAR__');

  // Handle * (matches any filename chars except /)
  regexPattern = regexPattern.replace(/\*/g, '[^/]*');

  // Replace placeholder with correct regex for **
  // ** should match zero or more path segments
  // This allows "notes/**" to match "notes/file.md" and "notes/sub/file.md"
  // And "notes/**/*.md" to match "notes/file.md" and "notes/sub/file.md"
  regexPattern = regexPattern.replace(/__DOUBLE_STAR__/g, '.*');

  // Handle ? (matches single char)
  regexPattern = regexPattern.replace(/\?/g, '.');

  return new RegExp(`^${regexPattern}$`);
}

/**
 * Test if a file path matches a glob pattern
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filePath);
}

/**
 * Test if a file path matches any of the given glob patterns
 */
export function matchesAnyGlob(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchesGlob(filePath, pattern));
}
