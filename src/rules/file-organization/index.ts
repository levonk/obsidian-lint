/**
 * File Organization Rules Index
 * Exports all file organization rule implementations
 */

export {
  FileNamingRule,
  FileNamingKebabCaseRule,
  FileNamingCamelCaseRule,
  FileNamingSpaceSeparatedRule,
  FileNamingMixedCaseRule,
  createFileNamingRule,
} from './file-naming.js';

export {
  FilePathOrganizationRule,
  FilePathOrganizationByDateRule,
  FilePathOrganizationByTopicRule,
  FilePathOrganizationByTypeRule,
  FilePathOrganizationFlatRule,
  createFilePathOrganizationRule,
} from './file-path-organization.js';

export {
  DuplicateFileDetectionRule,
  createDuplicateFileDetectionRule,
} from './duplicate-file-detection.js';

import type { Rule, RuleConfig } from '../../types/rules.js';
import { createFileNamingRule } from './file-naming.js';
import { createFilePathOrganizationRule } from './file-path-organization.js';
import { createDuplicateFileDetectionRule } from './duplicate-file-detection.js';

/**
 * Factory function to create any file organization rule
 */
export function createFileOrganizationRule(
  ruleId: string,
  config: RuleConfig
): Rule {
  // File naming rules
  if (ruleId.startsWith('file-naming.')) {
    return createFileNamingRule(ruleId, config);
  }

  // File path organization rules
  if (ruleId.startsWith('file-path-organization.')) {
    return createFilePathOrganizationRule(ruleId, config);
  }

  // Duplicate file detection rules
  if (ruleId.startsWith('duplicate-file-detection.')) {
    return createDuplicateFileDetectionRule(ruleId, config);
  }

  throw new Error(`Unknown file organization rule: ${ruleId}`);
}
