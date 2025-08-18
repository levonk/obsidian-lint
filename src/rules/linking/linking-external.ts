/**
 * External Linking Rules Implementation
 * Validates and manages external link formatting and validation
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange, Link } from '../../types/common.js';

/**
 * Interface for external linking settings
 */
interface ExternalLinkingSettings {
  validate_urls: boolean;
  check_accessibility: boolean;
  preferred_format: 'markdown' | 'wikilink' | 'preserve';
  auto_convert: boolean;
  timeout_ms: number;
  follow_redirects: boolean;
  check_https: boolean;
  suggest_https: boolean;
  allowed_domains?: string[];
  blocked_domains?: string[];
}

/**
 * Base class for external linking rules
 */
export abstract class LinkingExternalRule extends BaseRule {
  protected settings: ExternalLinkingSettings;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'linking', config);
    this.settings = this.parseSettings(config.settings);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(
    settings: Record<string, any>
  ): ExternalLinkingSettings {
    const defaultSettings: ExternalLinkingSettings = {
      validate_urls: true,
      check_accessibility: false,
      preferred_format: 'markdown',
      auto_convert: true,
      timeout_ms: 5000,
      follow_redirects: true,
      check_https: true,
      suggest_https: true,
    };

    return {
      ...defaultSettings,
      ...settings,
      validate_urls: settings['validate_urls'] ?? defaultSettings.validate_urls,
      check_accessibility:
        settings['check_accessibility'] ?? defaultSettings.check_accessibility,
      preferred_format:
        settings['preferred_format'] ?? defaultSettings.preferred_format,
      auto_convert: settings['auto_convert'] ?? defaultSettings.auto_convert,
      timeout_ms: settings['timeout_ms'] ?? defaultSettings.timeout_ms,
      follow_redirects:
        settings['follow_redirects'] ?? defaultSettings.follow_redirects,
      check_https: settings['check_https'] ?? defaultSettings.check_https,
      suggest_https: settings['suggest_https'] ?? defaultSettings.suggest_https,
      allowed_domains: settings['allowed_domains'],
      blocked_domains: settings['blocked_domains'],
    };
  }

  /**
   * Lint implementation - check for external linking issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    // Check each external link in the file
    for (const link of file.links) {
      if (link.type === 'external') {
        const linkIssues = await this.validateExternalLink(link, file.path);
        issues.push(...linkIssues);
      }
    }

    // Check for format consistency issues
    const formatIssues = await this.checkFormatConsistency(
      file.content,
      file.path
    );
    issues.push(...formatIssues);

    return issues;
  }

  /**
   * Fix implementation - fix external link issues
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_convert) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file } = context;
    const changes: FileChange[] = [];

    // Convert link formats if needed
    if (this.settings.preferred_format !== 'preserve') {
      const formatChanges = await this.convertLinkFormats(file.content);
      changes.push(...formatChanges);
    }

    // Fix HTTPS issues
    if (this.settings.suggest_https) {
      const httpsChanges = await this.convertToHttps(file.content);
      changes.push(...httpsChanges);
    }

    if (changes.length > 0) {
      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Fixed external link formatting and security issues',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Validate a single external link
   */
  protected async validateExternalLink(
    link: Link,
    filePath: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Validate URL format
    if (!this.isValidUrl(link.target)) {
      issues.push({
        ruleId: this.id.full,
        severity: 'error',
        message: `Invalid URL format: ${link.target}`,
        file: filePath,
        line: link.line,
        column: link.column,
        fixable: false,
      });
      return issues;
    }

    // Check domain restrictions
    if (this.settings.blocked_domains) {
      const domain = this.extractDomain(link.target);
      if (domain && this.settings.blocked_domains.includes(domain)) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `Link to blocked domain: ${domain}`,
          file: filePath,
          line: link.line,
          column: link.column,
          fixable: false,
        });
      }
    }

    if (this.settings.allowed_domains) {
      const domain = this.extractDomain(link.target);
      if (domain && !this.settings.allowed_domains.includes(domain)) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `Link to non-allowed domain: ${domain}`,
          file: filePath,
          line: link.line,
          column: link.column,
          fixable: false,
        });
      }
    }

    // Check HTTPS
    if (this.settings.check_https && link.target.startsWith('http://')) {
      issues.push({
        ruleId: this.id.full,
        severity: 'warning',
        message: `Consider using HTTPS: ${link.target}`,
        file: filePath,
        line: link.line,
        column: link.column,
        fixable: this.settings.suggest_https,
      });
    }

    // Check URL accessibility (if enabled)
    if (this.settings.check_accessibility) {
      const isAccessible = await this.checkUrlAccessibility(link.target);
      if (!isAccessible) {
        issues.push({
          ruleId: this.id.full,
          severity: 'warning',
          message: `URL may not be accessible: ${link.target}`,
          file: filePath,
          line: link.line,
          column: link.column,
          fixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Check for format consistency issues
   */
  protected async checkFormatConsistency(
    content: string,
    filePath: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    if (this.settings.preferred_format === 'preserve') {
      return issues;
    }

    const lines = content.split('\n');
    const externalLinks = this.extractAllExternalLinks(content);

    for (const link of externalLinks) {
      const expectedFormat = this.settings.preferred_format;
      const currentFormat = this.detectLinkFormat(link.originalText);

      if (currentFormat !== expectedFormat) {
        const formatName =
          expectedFormat === 'markdown'
            ? 'markdown [text](url)'
            : 'wikilink [[url|text]]';
        issues.push({
          ruleId: this.id.full,
          severity: 'info',
          message: `External link should use ${formatName} format`,
          file: filePath,
          line: link.line,
          column: link.column,
          fixable: this.settings.auto_convert,
        });
      }
    }

    return issues;
  }

  /**
   * Convert link formats according to preferred format
   */
  protected async convertLinkFormats(content: string): Promise<FileChange[]> {
    const changes: FileChange[] = [];
    const externalLinks = this.extractAllExternalLinks(content);

    for (const link of externalLinks) {
      const currentFormat = this.detectLinkFormat(link.originalText);
      const expectedFormat = this.settings.preferred_format;

      if (currentFormat !== expectedFormat && expectedFormat !== 'preserve') {
        let newText: string;

        if (expectedFormat === 'markdown') {
          newText = `[${link.text}](${link.target})`;
        } else {
          // wikilink format
          newText =
            link.text === link.target
              ? `[[${link.target}]]`
              : `[[${link.target}|${link.text}]]`;
        }

        changes.push({
          type: 'replace',
          line: link.line,
          oldText: link.originalText,
          newText,
        });
      }
    }

    return changes;
  }

  /**
   * Convert HTTP links to HTTPS where appropriate
   */
  protected async convertToHttps(content: string): Promise<FileChange[]> {
    const changes: FileChange[] = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let modifiedLine = line;
      let hasChanges = false;

      // Find HTTP URLs and try to convert to HTTPS
      const httpRegex = /http:\/\/([^\s\)]+)/g;
      let match;

      while ((match = httpRegex.exec(line)) !== null) {
        const httpUrl = match[0];
        const httpsUrl = httpUrl.replace('http://', 'https://');

        // Check if HTTPS version is accessible (simplified check)
        if (await this.checkUrlAccessibility(httpsUrl)) {
          modifiedLine = modifiedLine.replace(httpUrl, httpsUrl);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        changes.push({
          type: 'replace',
          line: lineIndex + 1,
          oldText: line,
          newText: modifiedLine,
        });
      }
    }

    return changes;
  }

  /**
   * Extract all external links from content with their original text
   */
  protected extractAllExternalLinks(content: string): Array<{
    text: string;
    target: string;
    line: number;
    column: number;
    originalText: string;
  }> {
    const links: Array<{
      text: string;
      target: string;
      line: number;
      column: number;
      originalText: string;
    }> = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Extract markdown links [text](url)
      const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      while ((match = markdownLinkRegex.exec(line)) !== null) {
        const text = match[1];
        const target = match[2];
        const column = match.index;

        if (this.isExternalUrl(target)) {
          links.push({
            text,
            target,
            line: lineIndex + 1,
            column: column + 1,
            originalText: match[0],
          });
        }
      }

      // Extract wikilinks [[url|text]] or [[url]]
      const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
      while ((match = wikilinkRegex.exec(line)) !== null) {
        const fullMatch = match[0];
        const content = match[1];
        const column = match.index;

        // Handle display text: [[url|text]]
        const [target, text] = content.includes('|')
          ? content.split('|').map(s => s.trim())
          : [content.trim(), content.trim()];

        if (this.isExternalUrl(target)) {
          links.push({
            text,
            target,
            line: lineIndex + 1,
            column: column + 1,
            originalText: fullMatch,
          });
        }
      }
    }

    return links;
  }

  /**
   * Detect the format of a link
   */
  protected detectLinkFormat(linkText: string): 'markdown' | 'wikilink' {
    if (linkText.startsWith('[[') && linkText.endsWith(']]')) {
      return 'wikilink';
    } else if (linkText.match(/\[([^\]]+)\]\(([^)]+)\)/)) {
      return 'markdown';
    }
    return 'markdown'; // default
  }

  /**
   * Check if a URL is valid
   */
  protected isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a URL is external
   */
  protected isExternalUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Extract domain from URL
   */
  protected extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Check URL accessibility
   */
  protected async checkUrlAccessibility(url: string): Promise<boolean> {
    try {
      // Simple fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.settings.timeout_ms
      );

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: this.settings.follow_redirects ? 'follow' : 'manual',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Validate URLs variant - validates external URLs for accessibility and format
 */
export class LinkingExternalValidateUrlsRule extends LinkingExternalRule {
  constructor(config: RuleConfig) {
    const validateConfig = {
      ...config,
      settings: {
        ...config.settings,
        validate_urls: true,
        check_accessibility: true,
        preferred_format: 'markdown',
      },
    };

    super(
      {
        major: 'linking-external',
        minor: 'validate-urls',
        full: 'linking-external.validate-urls',
      },
      'Validate External URLs',
      'Validate external URLs for accessibility and proper formatting',
      validateConfig
    );
  }
}

/**
 * Preserve as-is variant - minimal validation, preserves existing formats
 */
export class LinkingExternalPreserveAsIsRule extends LinkingExternalRule {
  constructor(config: RuleConfig) {
    const preserveConfig = {
      ...config,
      settings: {
        ...config.settings,
        validate_urls: false,
        check_accessibility: false,
        preferred_format: 'preserve',
        auto_convert: false,
      },
    };

    super(
      {
        major: 'linking-external',
        minor: 'preserve-as-is',
        full: 'linking-external.preserve-as-is',
      },
      'Preserve External Links As-Is',
      'Minimal validation, preserve existing external link formats',
      preserveConfig
    );
  }
}

/**
 * Convert format variant - enforces consistent formatting for external links
 */
export class LinkingExternalConvertFormatRule extends LinkingExternalRule {
  constructor(config: RuleConfig) {
    const convertConfig = {
      ...config,
      settings: {
        ...config.settings,
        validate_urls: true,
        check_accessibility: false,
        preferred_format: 'markdown',
        auto_convert: true,
        suggest_https: true,
      },
    };

    super(
      {
        major: 'linking-external',
        minor: 'convert-format',
        full: 'linking-external.convert-format',
      },
      'Convert External Link Format',
      'Enforce consistent formatting and convert to preferred format',
      convertConfig
    );
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createLinkingExternalRule(
  ruleId: string,
  config: RuleConfig
): LinkingExternalRule {
  switch (ruleId) {
    case 'linking-external.validate-urls':
      return new LinkingExternalValidateUrlsRule(config);
    case 'linking-external.preserve-as-is':
      return new LinkingExternalPreserveAsIsRule(config);
    case 'linking-external.convert-format':
      return new LinkingExternalConvertFormatRule(config);
    default:
      throw new Error(`Unknown linking external rule variant: ${ruleId}`);
  }
}
