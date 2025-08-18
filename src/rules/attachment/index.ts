/**
 * Attachment Rules Index
 * Exports all attachment rule implementations
 */

export {
  AttachmentOrganizationRule,
  AttachmentOrganizationCentralizedRule,
  AttachmentOrganizationKeepWithNoteRule,
  AttachmentOrganizationByTypeRule,
  createAttachmentOrganizationRule,
} from './attachment-organization.js';

export {
  AttachmentFormatPreferenceRule,
  AttachmentFormatPreferenceConvertToPngRule,
  AttachmentFormatPreferencePreserveOriginalRule,
  AttachmentFormatPreferenceOptimizeSizeRule,
  createAttachmentFormatPreferenceRule,
} from './attachment-format-preference.js';

export {
  AttachmentImageAltTextRule,
  AttachmentImageAltTextRequiredRule,
  AttachmentImageAltTextOptionalRule,
  AttachmentImageAltTextAutoGenerateRule,
  createAttachmentImageAltTextRule,
} from './attachment-image-alt-text.js';

import type { Rule, RuleConfig } from '../../types/rules.js';
import { createAttachmentOrganizationRule } from './attachment-organization.js';
import { createAttachmentFormatPreferenceRule } from './attachment-format-preference.js';
import { createAttachmentImageAltTextRule } from './attachment-image-alt-text.js';

/**
 * Factory function to create any attachment rule
 */
export function createAttachmentRule(ruleId: string, config: RuleConfig): Rule {
  // Attachment organization rules
  if (ruleId.startsWith('attachment-organization.')) {
    return createAttachmentOrganizationRule(ruleId, config);
  }

  // Attachment format preference rules
  if (ruleId.startsWith('attachment-format-preference.')) {
    return createAttachmentFormatPreferenceRule(ruleId, config);
  }

  // Attachment image alt-text rules
  if (ruleId.startsWith('attachment-image-alt-text.')) {
    return createAttachmentImageAltTextRule(ruleId, config);
  }

  throw new Error(`Unknown attachment rule: ${ruleId}`);
}
