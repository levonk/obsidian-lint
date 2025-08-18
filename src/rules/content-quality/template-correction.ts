/**
 * Template Correction Rule Implementation
 * Validates and fixes template usage and structure in markdown content
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';

/**
 * Interface for template correction settings
 */
interface TemplateCorrectionSettings {
  enforce_templates: boolean;
  suggest_templates: boolean;
  auto_fix: boolean;
  template_directory: string;
  template_patterns: Record<string, string[]>;
  required_sections: string[];
  section_order: string[];
  allow_custom_sections: boolean;
  template_variables: Record<string, any>;
  check_frontmatter_template: boolean;
}

/**
 * Template definition interface
 */
interface Template {
  name: string;
  pattern: string;
  sections: string[];
  frontmatter: Record<string, any>;
  content: string;
  variables: string[];
}

/**
 * Section information interface
 */
interface Section {
  name: string;
  level: number;
  line: number;
  content: string;
  required: boolean;
}

/**
 * Base class for template correction rules
 */
export abstract class TemplateCorrectionRule extends BaseRule {
  protected settings: TemplateCorrectionSettings;
  protected templates: Map<string, Template>;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'content-quality', config);
    this.settings = this.parseSettings(config.settings);
    this.templates = this.loadTemplates();
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(
    settings: Record<string, any>
  ): TemplateCorrectionSettings {
    const defaultSettings: TemplateCorrectionSettings = {
      enforce_templates: false,
      suggest_templates: true,
      auto_fix: false,
      template_directory: 'Meta/Templates',
      template_patterns: {
        'meeting-notes': ['meeting', 'notes', 'agenda'],
        'project-plan': ['project', 'plan', 'planning'],
        'daily-note': ['daily', 'journal', 'log'],
        'book-review': ['book', 'review', 'reading'],
        'research-note': ['research', 'study', 'analysis'],
      },
      required_sections: [],
      section_order: [],
      allow_custom_sections: true,
      template_variables: {},
      check_frontmatter_template: true,
    };

    return {
      ...defaultSettings,
      ...settings,
      enforce_templates:
        typeof settings.enforce_templates === 'boolean'
          ? settings.enforce_templates
          : defaultSettings.enforce_templates,
      suggest_templates:
        typeof settings.suggest_templates === 'boolean'
          ? settings.suggest_templates
          : defaultSettings.suggest_templates,
      auto_fix:
        typeof settings.auto_fix === 'boolean'
          ? settings.auto_fix
          : defaultSettings.auto_fix,
      template_directory:
        typeof settings.template_directory === 'string'
          ? settings.template_directory
          : defaultSettings.template_directory,
      template_patterns:
        typeof settings.template_patterns === 'object' &&
        settings.template_patterns
          ? settings.template_patterns
          : defaultSettings.template_patterns,
      required_sections: Array.isArray(settings.required_sections)
        ? settings.required_sections
        : defaultSettings.required_sections,
      section_order: Array.isArray(settings.section_order)
        ? settings.section_order
        : defaultSettings.section_order,
      allow_custom_sections:
        typeof settings.allow_custom_sections === 'boolean'
          ? settings.allow_custom_sections
          : defaultSettings.allow_custom_sections,
      template_variables:
        typeof settings.template_variables === 'object' &&
        settings.template_variables
          ? settings.template_variables
          : defaultSettings.template_variables,
      check_frontmatter_template:
        typeof settings.check_frontmatter_template === 'boolean'
          ? settings.check_frontmatter_template
          : defaultSettings.check_frontmatter_template,
    };
  }

  /**
   * Load available templates (simplified implementation)
   */
  private loadTemplates(): Map<string, Template> {
    const templates = new Map<string, Template>();

    // Define some common templates (in production, these would be loaded from files)
    templates.set('meeting-notes', {
      name: 'Meeting Notes',
      pattern: 'meeting',
      sections: [
        'Attendees',
        'Agenda',
        'Discussion',
        'Action Items',
        'Next Steps',
      ],
      frontmatter: {
        template: 'meeting-notes',
        type: 'meeting',
        status: 'active',
      },
      content: `# {{title}}

## Attendees
-

## Agenda
-

## Discussion

## Action Items
- [ ]

## Next Steps
-
`,
      variables: ['title', 'date', 'attendees'],
    });

    templates.set('project-plan', {
      name: 'Project Plan',
      pattern: 'project',
      sections: [
        'Overview',
        'Objectives',
        'Timeline',
        'Resources',
        'Risks',
        'Success Criteria',
      ],
      frontmatter: {
        template: 'project-plan',
        type: 'project',
        status: 'draft',
      },
      content: `# {{title}}

## Overview

## Objectives
-

## Timeline

## Resources

## Risks

## Success Criteria
-
`,
      variables: ['title', 'start_date', 'end_date', 'owner'],
    });

    templates.set('daily-note', {
      name: 'Daily Note',
      pattern: 'daily',
      sections: ['Tasks', 'Notes', 'Reflection'],
      frontmatter: {
        template: 'daily-note',
        type: 'daily',
        date: '{{date}}',
      },
      content: `# {{date}}

## Tasks
- [ ]

## Notes

## Reflection

`,
      variables: ['date'],
    });

    templates.set('book-review', {
      name: 'Book Review',
      pattern: 'book',
      sections: ['Summary', 'Key Points', 'Quotes', 'Rating', 'Reflection'],
      frontmatter: {
        template: 'book-review',
        type: 'review',
        rating: null,
        author: '',
      },
      content: `# {{title}}

**Author:** {{author}}
**Rating:** {{rating}}/5

## Summary

## Key Points
-

## Quotes
>

## Rating

## Reflection

`,
      variables: ['title', 'author', 'rating'],
    });

    return templates;
  }

  /**
   * Lint implementation - check for template issues
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    // Detect template type
    const detectedTemplate = this.detectTemplate(file);
    const declaredTemplate = this.getDeclaredTemplate(file);

    // Check if template is declared in frontmatter
    if (this.settings.check_frontmatter_template && !declaredTemplate) {
      if (detectedTemplate) {
        issues.push({
          ruleId: this.id.full,
          severity: 'info',
          message: `Detected template type "${detectedTemplate.name}" but no template declared in frontmatter`,
          file: file.path,
          line: 1,
          fixable: this.settings.auto_fix,
        });
      }
    }

    // Suggest templates if enabled and no template is declared
    if (
      this.settings.suggest_templates &&
      !declaredTemplate &&
      !detectedTemplate
    ) {
      const suggestedTemplate = this.suggestTemplate(file);
      if (suggestedTemplate) {
        issues.push({
          ruleId: this.id.full,
          severity: 'info',
          message: `Consider using template "${suggestedTemplate.name}" for this content`,
          file: file.path,
          line: 1,
          fixable: this.settings.auto_fix,
        });
      }
    }

    // Use declared template or detected template for validation
    const templateToUse = declaredTemplate || detectedTemplate;

    if (templateToUse) {
      // Check required sections
      const fileSections = this.extractSections(file);
      const missingSections = this.findMissingSections(
        templateToUse,
        fileSections
      );

      for (const section of missingSections) {
        issues.push({
          ruleId: this.id.full,
          severity: this.settings.enforce_templates ? 'error' : 'warning',
          message: `Missing required section: "${section}"`,
          file: file.path,
          fixable: this.settings.auto_fix,
        });
      }

      // Check section order
      if (this.settings.section_order.length > 0) {
        const orderIssues = this.validateSectionOrder(
          fileSections,
          templateToUse
        );
        issues.push(...orderIssues);
      }

      // Check for unknown sections
      if (!this.settings.allow_custom_sections) {
        const unknownSections = this.findUnknownSections(
          templateToUse,
          fileSections
        );
        for (const section of unknownSections) {
          issues.push({
            ruleId: this.id.full,
            severity: 'warning',
            message: `Unknown section: "${section.name}" (not in template)`,
            file: file.path,
            line: section.line,
            fixable: false,
          });
        }
      }

      // Check template variables
      const variableIssues = this.validateTemplateVariables(
        file,
        templateToUse
      );
      issues.push(...variableIssues);
    }

    return issues;
  }

  /**
   * Fix implementation - fix template issues
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_fix) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file } = context;
    const changes: FileChange[] = [];

    // Detect or get declared template
    const declaredTemplate = this.getDeclaredTemplate(file);
    const detectedTemplate = this.detectTemplate(file);
    const templateToUse = declaredTemplate || detectedTemplate;

    // Process issues and generate fixes
    for (const issue of issues) {
      if (issue.message.includes('no template declared in frontmatter')) {
        // Add template declaration to frontmatter
        if (detectedTemplate) {
          const frontmatterFix = this.addTemplateToFrontmatter(
            file,
            detectedTemplate
          );
          if (frontmatterFix) {
            changes.push(frontmatterFix);
          }
        }
      } else if (issue.message.includes('Consider using template')) {
        // Apply suggested template
        const suggestedTemplate = this.suggestTemplate(file);
        if (suggestedTemplate) {
          const templateFixes = this.applyTemplate(file, suggestedTemplate);
          changes.push(...templateFixes);
        }
      } else if (issue.message.includes('Missing required section')) {
        // Add missing sections
        if (templateToUse) {
          const sectionName = issue.message.match(
            /Missing required section: "([^"]+)"/
          )?.[1];
          if (sectionName) {
            const sectionFix = this.addMissingSection(
              file,
              sectionName,
              templateToUse
            );
            if (sectionFix) {
              changes.push(sectionFix);
            }
          }
        }
      } else if (issue.message.includes('section order')) {
        // Fix section order
        if (templateToUse) {
          const orderFixes = this.fixSectionOrder(file, templateToUse);
          changes.push(...orderFixes);
        }
      }
    }

    if (changes.length > 0) {
      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Fixed template structure and content',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Detect template type based on content patterns
   */
  private detectTemplate(file: any): Template | null {
    const content = file.content.toLowerCase();
    const filename = file.path.toLowerCase();

    for (const [templateId, template] of this.templates) {
      const patterns = this.settings.template_patterns[templateId] || [
        template.pattern,
      ];

      for (const pattern of patterns) {
        if (content.includes(pattern) || filename.includes(pattern)) {
          return template;
        }
      }
    }

    return null;
  }

  /**
   * Get declared template from frontmatter
   */
  private getDeclaredTemplate(file: any): Template | null {
    if (file.frontmatter?.template) {
      return this.templates.get(file.frontmatter.template) || null;
    }
    return null;
  }

  /**
   * Suggest template based on content analysis
   */
  private suggestTemplate(file: any): Template | null {
    // Simple heuristics for template suggestion
    const content = file.content.toLowerCase();
    const headings = file.headings?.map((h: any) => h.text.toLowerCase()) || [];

    // Check for meeting-related content
    if (
      content.includes('agenda') ||
      content.includes('attendees') ||
      content.includes('action items')
    ) {
      return this.templates.get('meeting-notes') || null;
    }

    // Check for project-related content
    if (
      content.includes('timeline') ||
      content.includes('objectives') ||
      content.includes('resources')
    ) {
      return this.templates.get('project-plan') || null;
    }

    // Check for daily note patterns
    if (
      content.includes('tasks') ||
      content.includes('reflection') ||
      /\d{4}-\d{2}-\d{2}/.test(file.path)
    ) {
      return this.templates.get('daily-note') || null;
    }

    // Check for book review patterns
    if (
      content.includes('author') ||
      content.includes('rating') ||
      content.includes('summary')
    ) {
      return this.templates.get('book-review') || null;
    }

    return null;
  }

  /**
   * Extract sections from markdown file
   */
  private extractSections(file: any): Section[] {
    const sections: Section[] = [];

    if (file.headings) {
      for (const heading of file.headings) {
        sections.push({
          name: heading.text,
          level: heading.level,
          line: heading.line,
          content: '', // Would need to extract content between headings
          required: false,
        });
      }
    }

    return sections;
  }

  /**
   * Find missing required sections
   */
  private findMissingSections(
    template: Template,
    fileSections: Section[]
  ): string[] {
    const fileSectionNames = fileSections.map(s => s.name.toLowerCase());
    const missingSections: string[] = [];

    for (const requiredSection of template.sections) {
      if (!fileSectionNames.includes(requiredSection.toLowerCase())) {
        missingSections.push(requiredSection);
      }
    }

    return missingSections;
  }

  /**
   * Find unknown sections not in template
   */
  private findUnknownSections(
    template: Template,
    fileSections: Section[]
  ): Section[] {
    const templateSectionNames = template.sections.map(s => s.toLowerCase());
    const unknownSections: Section[] = [];

    for (const section of fileSections) {
      if (!templateSectionNames.includes(section.name.toLowerCase())) {
        unknownSections.push(section);
      }
    }

    return unknownSections;
  }

  /**
   * Validate section order
   */
  private validateSectionOrder(
    fileSections: Section[],
    template: Template
  ): Issue[] {
    const issues: Issue[] = [];
    const expectedOrder =
      this.settings.section_order.length > 0
        ? this.settings.section_order
        : template.sections;

    // Simple order validation (could be more sophisticated)
    let lastExpectedIndex = -1;

    for (const section of fileSections) {
      const expectedIndex = expectedOrder.findIndex(
        s => s.toLowerCase() === section.name.toLowerCase()
      );

      if (expectedIndex !== -1 && expectedIndex < lastExpectedIndex) {
        issues.push({
          ruleId: this.id.full,
          severity: 'info',
          message: `Section "${section.name}" appears out of expected order`,
          file: '', // Will be set by caller
          line: section.line,
          fixable: this.settings.auto_fix,
        });
      }

      if (expectedIndex > lastExpectedIndex) {
        lastExpectedIndex = expectedIndex;
      }
    }

    return issues;
  }

  /**
   * Validate template variables
   */
  private validateTemplateVariables(file: any, template: Template): Issue[] {
    const issues: Issue[] = [];

    // Check if required variables are present in frontmatter
    for (const variable of template.variables) {
      if (!file.frontmatter?.[variable]) {
        issues.push({
          ruleId: this.id.full,
          severity: 'info',
          message: `Template variable "${variable}" not found in frontmatter`,
          file: file.path,
          line: 1,
          fixable: this.settings.auto_fix,
        });
      }
    }

    return issues;
  }

  /**
   * Add template declaration to frontmatter
   */
  private addTemplateToFrontmatter(
    file: any,
    template: Template
  ): FileChange | null {
    // This would need to modify the frontmatter section
    // Simplified implementation
    return {
      type: 'replace',
      line: 1,
      oldText: '---',
      newText: `---\ntemplate: ${template.name.toLowerCase().replace(/\s+/g, '-')}`,
    };
  }

  /**
   * Apply template to file
   */
  private applyTemplate(file: any, template: Template): FileChange[] {
    const changes: FileChange[] = [];

    // This would be a complex operation to apply a full template
    // Simplified implementation - just add template content at the end
    changes.push({
      type: 'insert',
      line: file.content.split('\n').length + 1,
      column: 1,
      newText: `\n\n<!-- Template: ${template.name} -->\n${template.content}`,
    });

    return changes;
  }

  /**
   * Add missing section
   */
  private addMissingSection(
    file: any,
    sectionName: string,
    template: Template
  ): FileChange | null {
    // Find appropriate insertion point
    const lines = file.content.split('\n');
    const insertionLine = lines.length + 1;

    return {
      type: 'insert',
      line: insertionLine,
      column: 1,
      newText: `\n## ${sectionName}\n\n`,
    };
  }

  /**
   * Fix section order
   */
  private fixSectionOrder(file: any, template: Template): FileChange[] {
    // This would be a complex operation to reorder sections
    // Simplified implementation - return empty array
    return [];
  }
}

/**
 * Enforce Templates variant - strictly enforces template usage
 */
export class TemplateCorrectionEnforceTemplatesRule extends TemplateCorrectionRule {
  constructor(config: RuleConfig) {
    const enforceConfig = {
      ...config,
      settings: {
        ...config.settings,
        enforce_templates: true,
        suggest_templates: true,
        auto_fix: true,
        allow_custom_sections: false,
      },
    };

    super(
      {
        major: 'template-correction',
        minor: 'enforce-templates',
        full: 'template-correction.enforce-templates',
      },
      'Template Correction Enforce',
      'Strictly enforce template usage and structure',
      enforceConfig
    );
  }
}

/**
 * Suggest Templates variant - suggests templates without enforcing
 */
export class TemplateCorrectionSuggestTemplatesRule extends TemplateCorrectionRule {
  constructor(config: RuleConfig) {
    const suggestConfig = {
      ...config,
      settings: {
        ...config.settings,
        enforce_templates: false,
        suggest_templates: true,
        auto_fix: false,
        allow_custom_sections: true,
      },
    };

    super(
      {
        major: 'template-correction',
        minor: 'suggest-templates',
        full: 'template-correction.suggest-templates',
      },
      'Template Correction Suggest',
      'Suggest appropriate templates without enforcing structure',
      suggestConfig
    );
  }
}

/**
 * Flexible variant - minimal template validation
 */
export class TemplateCorrectionFlexibleRule extends TemplateCorrectionRule {
  constructor(config: RuleConfig) {
    const flexibleConfig = {
      ...config,
      settings: {
        ...config.settings,
        enforce_templates: false,
        suggest_templates: false,
        auto_fix: false,
        allow_custom_sections: true,
        check_frontmatter_template: false,
      },
    };

    super(
      {
        major: 'template-correction',
        minor: 'flexible',
        full: 'template-correction.flexible',
      },
      'Template Correction Flexible',
      'Flexible template validation with minimal requirements',
      flexibleConfig
    );
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createTemplateCorrectionRule(
  ruleId: string,
  config: RuleConfig
): TemplateCorrectionRule {
  switch (ruleId) {
    case 'template-correction.enforce-templates':
      return new TemplateCorrectionEnforceTemplatesRule(config);
    case 'template-correction.suggest-templates':
      return new TemplateCorrectionSuggestTemplatesRule(config);
    case 'template-correction.flexible':
      return new TemplateCorrectionFlexibleRule(config);
    default:
      throw new Error(`Unknown template correction rule variant: ${ruleId}`);
  }
}
