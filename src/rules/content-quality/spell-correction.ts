/**
 * Spell Correction Rule Implementation
 * Validates and fixes spelling errors in markdown content
 */

import { BaseRule } from '../../types/rules.js';
import type {
  RuleId,
  RuleConfig,
  RuleExecutionContext,
} from '../../types/rules.js';
import type { Issue, Fix, FileChange } from '../../types/common.js';

/**
 * Interface for spell correction settings
 */
interface SpellCorrectionSettings {
  auto_fix: boolean;
  suggest_only: boolean;
  ignore_code_blocks: boolean;
  ignore_links: boolean;
  ignore_frontmatter: boolean;
  custom_dictionary: string[];
  ignore_words: string[];
  min_word_length: number;
  check_headings: boolean;
  check_content: boolean;
  language: string;
}

/**
 * Simple spell checker interface (would integrate with external library in production)
 */
interface SpellChecker {
  check(word: string): boolean;
  suggest(word: string): string[];
}

/**
 * Basic spell checker implementation using common word patterns
 */
class BasicSpellChecker implements SpellChecker {
  private commonWords: Set<string>;
  private corrections: Map<string, string>;

  constructor(customDictionary: string[] = []) {
    // Common English words (simplified set for demo)
    this.commonWords = new Set([
      'the',
      'be',
      'to',
      'of',
      'and',
      'a',
      'in',
      'that',
      'have',
      'i',
      'it',
      'for',
      'not',
      'on',
      'with',
      'he',
      'as',
      'you',
      'do',
      'at',
      'this',
      'but',
      'his',
      'by',
      'from',
      'they',
      'we',
      'say',
      'her',
      'she',
      'or',
      'an',
      'will',
      'my',
      'one',
      'all',
      'would',
      'there',
      'their',
      'what',
      'so',
      'up',
      'out',
      'if',
      'about',
      'who',
      'get',
      'which',
      'go',
      'me',
      'when',
      'make',
      'can',
      'like',
      'time',
      'no',
      'just',
      'him',
      'know',
      'take',
      'people',
      'into',
      'year',
      'your',
      'good',
      'some',
      'could',
      'them',
      'see',
      'other',
      'than',
      'then',
      'now',
      'look',
      'only',
      'come',
      'its',
      'over',
      'think',
      'also',
      'back',
      'after',
      'use',
      'two',
      'how',
      'our',
      'work',
      'first',
      'well',
      'way',
      'even',
      'new',
      'want',
      'because',
      'any',
      'these',
      'give',
      'day',
      'most',
      'us',
      'is',
      'was',
      'are',
      'been',
      'has',
      'had',
      'were',
      'said',
      'each',
      'which',
      'their',
      'time',
      'will',
      'about',
      'if',
      'up',
      'out',
      'many',
      'then',
      'them',
      'these',
      'so',
      'some',
      'her',
      'would',
      'make',
      'like',
      'into',
      'him',
      'has',
      'two',
      'more',
      'very',
      'what',
      'know',
      'just',
      'first',
      'get',
      'over',
      'think',
      'where',
      'much',
      'go',
      'well',
      'were',
      'right',
      'too',
      'any',
      'old',
      'see',
      'now',
      'way',
      'who',
      'its',
      'did',
      'yes',
      'his',
      'been',
      'or',
      'when',
      'much',
      'no',
      'may',
      'such',
      'say',
      'great',
      'where',
      'help',
      'through',
      'line',
      'turn',
      'cause',
      'same',
      'mean',
      'differ',
      'move',
      'right',
      'boy',
      'old',
      'too',
      'does',
      'tell',
      'sentence',
      'set',
      'three',
      'want',
      'air',
      'well',
      'also',
      'play',
      'small',
      'end',
      'put',
      'home',
      'read',
      'hand',
      'port',
      'large',
      'spell',
      'add',
      'even',
      'land',
      'here',
      'must',
      'big',
      'high',
      'such',
      'follow',
      'act',
      'why',
      'ask',
      'men',
      'change',
      'went',
      'light',
      'kind',
      'off',
      'need',
      'house',
      'picture',
      'try',
      'us',
      'again',
      'animal',
      'point',
      'mother',
      'world',
      'near',
      'build',
      'self',
      'earth',
      'father',
      'head',
      'stand',
      'own',
      'page',
      'should',
      'country',
      'found',
      'answer',
      'school',
      'grow',
      'study',
      'still',
      'learn',
      'plant',
      'cover',
      'food',
      'sun',
      'four',
      'between',
      'state',
      'keep',
      'eye',
      'never',
      'last',
      'let',
      'thought',
      'city',
      'tree',
      'cross',
      'farm',
      'hard',
      'start',
      'might',
      'story',
      'saw',
      'far',
      'sea',
      'draw',
      'left',
      'late',
      'run',
      'dont',
      'while',
      'press',
      'close',
      'night',
      'real',
      'life',
      'few',
      'north',
      'open',
      'seem',
      'together',
      'next',
      'white',
      'children',
      'begin',
      'got',
      'walk',
      'example',
      'ease',
      'paper',
      'group',
      'always',
      'music',
      'those',
      'both',
      'mark',
      'often',
      'letter',
      'until',
      'mile',
      'river',
      'car',
      'feet',
      'care',
      'second',
      'book',
      'carry',
      'took',
      'science',
      'eat',
      'room',
      'friend',
      'began',
      'idea',
      'fish',
      'mountain',
      'stop',
      'once',
      'base',
      'hear',
      'horse',
      'cut',
      'sure',
      'watch',
      'color',
      'face',
      'wood',
      'main',
      'enough',
      'plain',
      'girl',
      'usual',
      'young',
      'ready',
      'above',
      'ever',
      'red',
      'list',
      'though',
      'feel',
      'talk',
      'bird',
      'soon',
      'body',
      'dog',
      'family',
      'direct',
      'pose',
      'leave',
      'song',
      'measure',
      'door',
      'product',
      'black',
      'short',
      'numeral',
      'class',
      'wind',
      'question',
      'happen',
      'complete',
      'ship',
      'area',
      'half',
      'rock',
      'order',
      'fire',
      'south',
      'problem',
      'piece',
      'told',
      'knew',
      'pass',
      'since',
      'top',
      'whole',
      'king',
      'space',
      'heard',
      'best',
      'hour',
      'better',
      'during',
      'hundred',
      'five',
      'remember',
      'step',
      'early',
      'hold',
      'west',
      'ground',
      'interest',
      'reach',
      'fast',
      'verb',
      'sing',
      'listen',
      'six',
      'table',
      'travel',
      'less',
      'morning',
      'ten',
      'simple',
      'several',
      'vowel',
      'toward',
      'war',
      'lay',
      'against',
      'pattern',
      'slow',
      'center',
      'love',
      'person',
      'money',
      'serve',
      'appear',
      'road',
      'map',
      'rain',
      'rule',
      'govern',
      'pull',
      'cold',
      'notice',
      'voice',
      'unit',
      'power',
      'town',
      'fine',
      'certain',
      'fly',
      'fall',
      'lead',
      'cry',
      'dark',
      'machine',
      'note',
      'wait',
      'plan',
      'figure',
      'star',
      'box',
      'noun',
      'field',
      'rest',
      'correct',
      'able',
      'pound',
      'done',
      'beauty',
      'drive',
      'stood',
      'contain',
      'front',
      'teach',
      'week',
      'final',
      'gave',
      'green',
      'oh',
      'quick',
      'develop',
      'ocean',
      'warm',
      'free',
      'minute',
      'strong',
      'special',
      'mind',
      'behind',
      'clear',
      'tail',
      'produce',
      'fact',
      'street',
      'inch',
      'multiply',
      'nothing',
      'course',
      'stay',
      'wheel',
      'full',
      'force',
      'blue',
      'object',
      'decide',
      'surface',
      'deep',
      'moon',
      'island',
      'foot',
      'system',
      'busy',
      'test',
      'record',
      'boat',
      'common',
      'gold',
      'possible',
      'plane',
      'stead',
      'dry',
      'wonder',
      'laugh',
      'thousands',
      'ago',
      'ran',
      'check',
      'game',
      'shape',
      'equate',
      'hot',
      'miss',
      'brought',
      'heat',
      'snow',
      'tire',
      'bring',
      'yes',
      'distant',
      'fill',
      'east',
      'paint',
      'language',
      'among',
    ]);

    // Add custom dictionary words
    customDictionary.forEach(word => this.commonWords.add(word.toLowerCase()));

    // Common corrections (simplified set)
    this.corrections = new Map([
      ['teh', 'the'],
      ['adn', 'and'],
      ['recieve', 'receive'],
      ['seperate', 'separate'],
      ['definately', 'definitely'],
      ['occured', 'occurred'],
      ['neccessary', 'necessary'],
      ['accomodate', 'accommodate'],
      ['begining', 'beginning'],
      ['beleive', 'believe'],
      ['calender', 'calendar'],
      ['cemetary', 'cemetery'],
      ['changable', 'changeable'],
      ['collegue', 'colleague'],
      ['concious', 'conscious'],
      ['definite', 'definite'],
      ['embarass', 'embarrass'],
      ['enviroment', 'environment'],
      ['existance', 'existence'],
      ['goverment', 'government'],
      ['harrass', 'harass'],
      ['independant', 'independent'],
      ['judgement', 'judgment'],
      ['knowlege', 'knowledge'],
      ['liason', 'liaison'],
      ['maintainance', 'maintenance'],
      ['noticable', 'noticeable'],
      ['occassion', 'occasion'],
      ['persistant', 'persistent'],
      ['priviledge', 'privilege'],
      ['recomend', 'recommend'],
      ['refered', 'referred'],
      ['relevent', 'relevant'],
      ['resistence', 'resistance'],
      ['succesful', 'successful'],
      ['tommorow', 'tomorrow'],
      ['untill', 'until'],
      ['wierd', 'weird'],
    ]);
  }

  check(word: string): boolean {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    return this.commonWords.has(cleanWord) || cleanWord.length < 2;
  }

  suggest(word: string): string[] {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');

    // Check direct corrections first
    if (this.corrections.has(cleanWord)) {
      return [this.corrections.get(cleanWord)!];
    }

    // Simple suggestions based on edit distance (simplified)
    const suggestions: string[] = [];

    // Try removing one character
    for (let i = 0; i < cleanWord.length; i++) {
      const candidate = cleanWord.slice(0, i) + cleanWord.slice(i + 1);
      if (this.commonWords.has(candidate)) {
        suggestions.push(candidate);
      }
    }

    // Try adding one character
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i <= cleanWord.length; i++) {
      for (const char of alphabet) {
        const candidate = cleanWord.slice(0, i) + char + cleanWord.slice(i);
        if (this.commonWords.has(candidate)) {
          suggestions.push(candidate);
        }
      }
    }

    // Try substituting one character
    for (let i = 0; i < cleanWord.length; i++) {
      for (const char of alphabet) {
        const candidate = cleanWord.slice(0, i) + char + cleanWord.slice(i + 1);
        if (this.commonWords.has(candidate)) {
          suggestions.push(candidate);
        }
      }
    }

    return [...new Set(suggestions)].slice(0, 3); // Return up to 3 unique suggestions
  }
}

/**
 * Base class for spell correction rules
 */
export abstract class SpellCorrectionRule extends BaseRule {
  protected settings: SpellCorrectionSettings;
  protected spellChecker: SpellChecker;

  constructor(
    id: RuleId,
    name: string,
    description: string,
    config: RuleConfig
  ) {
    super(id, name, description, 'content-quality', config);
    this.settings = this.parseSettings(config.settings);
    this.spellChecker = new BasicSpellChecker(this.settings.custom_dictionary);
  }

  /**
   * Parse and validate settings from rule configuration
   */
  private parseSettings(
    settings: Record<string, any>
  ): SpellCorrectionSettings {
    const defaultSettings: SpellCorrectionSettings = {
      auto_fix: false,
      suggest_only: true,
      ignore_code_blocks: true,
      ignore_links: true,
      ignore_frontmatter: true,
      custom_dictionary: [],
      ignore_words: [],
      min_word_length: 3,
      check_headings: true,
      check_content: true,
      language: 'en',
    };

    return {
      ...defaultSettings,
      ...settings,
      auto_fix:
        typeof settings.auto_fix === 'boolean'
          ? settings.auto_fix
          : defaultSettings.auto_fix,
      suggest_only:
        typeof settings.suggest_only === 'boolean'
          ? settings.suggest_only
          : defaultSettings.suggest_only,
      ignore_code_blocks:
        typeof settings.ignore_code_blocks === 'boolean'
          ? settings.ignore_code_blocks
          : defaultSettings.ignore_code_blocks,
      ignore_links:
        typeof settings.ignore_links === 'boolean'
          ? settings.ignore_links
          : defaultSettings.ignore_links,
      ignore_frontmatter:
        typeof settings.ignore_frontmatter === 'boolean'
          ? settings.ignore_frontmatter
          : defaultSettings.ignore_frontmatter,
      custom_dictionary: Array.isArray(settings.custom_dictionary)
        ? settings.custom_dictionary
        : defaultSettings.custom_dictionary,
      ignore_words: Array.isArray(settings.ignore_words)
        ? settings.ignore_words
        : defaultSettings.ignore_words,
      min_word_length:
        typeof settings.min_word_length === 'number' &&
        settings.min_word_length > 0
          ? settings.min_word_length
          : defaultSettings.min_word_length,
      check_headings:
        typeof settings.check_headings === 'boolean'
          ? settings.check_headings
          : defaultSettings.check_headings,
      check_content:
        typeof settings.check_content === 'boolean'
          ? settings.check_content
          : defaultSettings.check_content,
      language:
        typeof settings.language === 'string'
          ? settings.language
          : defaultSettings.language,
    };
  }

  /**
   * Lint implementation - check for spelling errors
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { file } = context;

    // Extract text content to check
    const textToCheck = this.extractTextContent(file);

    for (const textBlock of textToCheck) {
      const words = this.extractWords(textBlock.content);

      for (const wordInfo of words) {
        if (this.shouldCheckWord(wordInfo.word)) {
          if (!this.spellChecker.check(wordInfo.word)) {
            const suggestions = this.spellChecker.suggest(wordInfo.word);
            const suggestionText =
              suggestions.length > 0
                ? ` (suggestions: ${suggestions.join(', ')})`
                : '';

            issues.push({
              ruleId: this.id.full,
              severity: 'info',
              message: `Possible spelling error: "${wordInfo.word}"${suggestionText}`,
              file: file.path,
              line: textBlock.line + wordInfo.lineOffset,
              column: wordInfo.column,
              fixable: this.settings.auto_fix && suggestions.length > 0,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Fix implementation - fix spelling errors
   */
  async fix(context: RuleExecutionContext, issues: Issue[]): Promise<Fix[]> {
    if (!this.settings.auto_fix) {
      return [];
    }

    const fixes: Fix[] = [];
    const { file } = context;
    const changes: FileChange[] = [];

    for (const issue of issues) {
      if (issue.fixable && issue.message.includes('suggestions:')) {
        // Extract the misspelled word and first suggestion
        const match = issue.message.match(
          /Possible spelling error: "([^"]+)"\s*\(suggestions: ([^,)]+)/
        );
        if (match) {
          const [, misspelledWord, suggestion] = match;

          // Find and replace the word in the content
          const lines = file.content.split('\n');
          if (issue.line && issue.line <= lines.length) {
            const line = lines[issue.line - 1];
            const updatedLine = line.replace(
              new RegExp(`\\b${this.escapeRegex(misspelledWord)}\\b`, 'g'),
              suggestion
            );

            if (updatedLine !== line) {
              changes.push({
                type: 'replace',
                line: issue.line,
                oldText: line,
                newText: updatedLine,
              });
            }
          }
        }
      }
    }

    if (changes.length > 0) {
      fixes.push({
        ruleId: this.id.full,
        file: file.path,
        description: 'Fixed spelling errors',
        changes,
      });
    }

    return fixes;
  }

  /**
   * Extract text content from markdown file
   */
  private extractTextContent(
    file: any
  ): Array<{ content: string; line: number; type: string }> {
    const textBlocks: Array<{ content: string; line: number; type: string }> =
      [];
    const lines = file.content.split('\n');

    let inCodeBlock = false;
    let inFrontmatter = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for frontmatter boundaries
      if (line === '---') {
        if (i === 0) {
          inFrontmatter = true;
          continue;
        } else if (inFrontmatter) {
          inFrontmatter = false;
          continue;
        }
      }

      // Skip frontmatter if configured
      if (inFrontmatter && this.settings.ignore_frontmatter) {
        continue;
      }

      // Check for code block boundaries
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Skip code blocks if configured
      if (inCodeBlock && this.settings.ignore_code_blocks) {
        continue;
      }

      // Process headings
      if (line.startsWith('#') && this.settings.check_headings) {
        const headingText = line.replace(/^#+\s*/, '');
        textBlocks.push({
          content: headingText,
          line: lineNumber,
          type: 'heading',
        });
      }

      // Process regular content
      if (!line.startsWith('#') && this.settings.check_content && line.trim()) {
        // Remove markdown formatting for spell checking
        let cleanContent = line;

        if (this.settings.ignore_links) {
          // Remove markdown links completely
          cleanContent = cleanContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '');
          cleanContent = cleanContent.replace(/\[\[([^\]]+)\]\]/g, '');
        }

        // Remove other markdown formatting
        cleanContent = cleanContent.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
        cleanContent = cleanContent.replace(/\*([^*]+)\*/g, '$1'); // Italic
        cleanContent = cleanContent.replace(/`([^`]+)`/g, ''); // Remove inline code completely

        if (cleanContent.trim()) {
          textBlocks.push({
            content: cleanContent,
            line: lineNumber,
            type: 'content',
          });
        }
      }
    }

    return textBlocks;
  }

  /**
   * Extract words from text content
   */
  private extractWords(
    content: string
  ): Array<{ word: string; column: number; lineOffset: number }> {
    const words: Array<{ word: string; column: number; lineOffset: number }> =
      [];
    const wordRegex = /\b[a-zA-Z]+\b/g;
    let match;

    while ((match = wordRegex.exec(content)) !== null) {
      words.push({
        word: match[0],
        column: match.index + 1,
        lineOffset: 0, // Simplified - would need more complex logic for multi-line blocks
      });
    }

    return words;
  }

  /**
   * Check if a word should be spell-checked
   */
  private shouldCheckWord(word: string): boolean {
    // Skip short words
    if (word.length < this.settings.min_word_length) {
      return false;
    }

    // Skip ignored words
    if (this.settings.ignore_words.includes(word.toLowerCase())) {
      return false;
    }

    // Skip words that are all uppercase (likely acronyms)
    if (word === word.toUpperCase()) {
      return false;
    }

    // Skip words with numbers
    if (/\d/.test(word)) {
      return false;
    }

    return true;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Auto-fix variant - automatically fixes spelling errors
 */
export class SpellCorrectionAutoFixRule extends SpellCorrectionRule {
  constructor(config: RuleConfig) {
    const autoFixConfig = {
      ...config,
      settings: {
        ...config.settings,
        auto_fix: true,
        suggest_only: false,
      },
    };

    super(
      {
        major: 'spell-correction',
        minor: 'auto-fix',
        full: 'spell-correction.auto-fix',
      },
      'Spell Correction Auto-fix',
      'Automatically fix spelling errors with best suggestions',
      autoFixConfig
    );
  }
}

/**
 * Suggest-only variant - only suggests corrections without fixing
 */
export class SpellCorrectionSuggestOnlyRule extends SpellCorrectionRule {
  constructor(config: RuleConfig) {
    const suggestOnlyConfig = {
      ...config,
      settings: {
        ...config.settings,
        auto_fix: false,
        suggest_only: true,
      },
    };

    super(
      {
        major: 'spell-correction',
        minor: 'suggest-only',
        full: 'spell-correction.suggest-only',
      },
      'Spell Correction Suggest Only',
      'Suggest spelling corrections without automatically fixing',
      suggestOnlyConfig
    );
  }
}

/**
 * Ignore variant - disables spell checking
 */
export class SpellCorrectionIgnoreRule extends SpellCorrectionRule {
  constructor(config: RuleConfig) {
    super(
      {
        major: 'spell-correction',
        minor: 'ignore',
        full: 'spell-correction.ignore',
      },
      'Spell Correction Ignore',
      'Disable spell checking entirely',
      config
    );
  }

  /**
   * Override lint to return no issues (effectively disabling spell checking)
   */
  async lint(context: RuleExecutionContext): Promise<Issue[]> {
    return [];
  }
}

/**
 * Factory function to create rule instances based on rule ID
 */
export function createSpellCorrectionRule(
  ruleId: string,
  config: RuleConfig
): SpellCorrectionRule {
  switch (ruleId) {
    case 'spell-correction.auto-fix':
      return new SpellCorrectionAutoFixRule(config);
    case 'spell-correction.suggest-only':
      return new SpellCorrectionSuggestOnlyRule(config);
    case 'spell-correction.ignore':
      return new SpellCorrectionIgnoreRule(config);
    default:
      throw new Error(`Unknown spell correction rule variant: ${ruleId}`);
  }
}
