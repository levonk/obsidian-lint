/**
 * Integration tests for rule loading with real rule files
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { join } from 'path';
import { RuleEngine } from '../../src/core/rules.js';

describe('Rule Loading Integration', () => {
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });

  describe('loadRulesForProfile', () => {
    it('should load rules from the default profile configuration', async () => {
      const rulesPath = join(process.cwd(), 'config', 'rules', 'default');

      const rules = await ruleEngine.loadRulesForProfile(rulesPath);

      // Should load all enabled rules
      expect(rules.length).toBeGreaterThan(0);

      // Check that we have the expected rules
      const ruleIds = rules.map(rule => rule.id.full);
      expect(ruleIds).toContain('attachment-organization.centralized');
      expect(ruleIds).toContain('frontmatter-required-fields.strict');
      expect(ruleIds).toContain('file-naming.kebab-case');

      // Should not contain disabled rules
      expect(ruleIds).not.toContain('attachment-organization.keep-with-note');

      // Verify rule structure
      const attachmentRule = rules.find(
        r => r.id.full === 'attachment-organization.centralized'
      );
      expect(attachmentRule).toBeDefined();
      expect(attachmentRule!.name).toBe('Centralized Attachment Organization');
      expect(attachmentRule!.category).toBe('attachment');
      expect(attachmentRule!.config.settings.attachment_directory).toBe(
        'Meta/Attachments'
      );

      const frontmatterRule = rules.find(
        r => r.id.full === 'frontmatter-required-fields.strict'
      );
      expect(frontmatterRule).toBeDefined();
      expect(frontmatterRule!.config.settings.required_fields).toEqual([
        'title',
        'aliases',
        'tags',
        'status',
        'date_created',
        'date_updated',
      ]);
    });

    it('should validate that no rule conflicts exist in default profile', async () => {
      const rulesPath = join(process.cwd(), 'config', 'rules', 'default');

      const rules = await ruleEngine.loadRulesForProfile(rulesPath);
      const conflictResult = ruleEngine.validateRuleConflicts(rules);

      expect(conflictResult.valid).toBe(true);
      expect(conflictResult.conflicts).toHaveLength(0);
    });

    it('should handle rule files in subdirectories', async () => {
      const rulesPath = join(process.cwd(), 'config', 'rules', 'default');

      const rules = await ruleEngine.loadRulesForProfile(rulesPath);

      // Rules should be loaded from subdirectories like attachment-organization/
      const attachmentRules = rules.filter(
        r => r.id.major === 'attachment-organization'
      );
      expect(attachmentRules.length).toBeGreaterThan(0);

      const frontmatterRules = rules.filter(
        r => r.id.major === 'frontmatter-required-fields'
      );
      expect(frontmatterRules.length).toBeGreaterThan(0);

      const fileNamingRules = rules.filter(r => r.id.major === 'file-naming');
      expect(fileNamingRules.length).toBeGreaterThan(0);
    });
  });
});
