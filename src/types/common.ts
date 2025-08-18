/**
 * Common Type Definitions
 */

export interface ProcessOptions {
  dryRun: boolean;
  fix: boolean;
  verbose: boolean;
  rules?: string[];
  ignore?: string[];
  generateMoc: boolean;
  parallel: boolean;
  enableCaching?: boolean;
  enableMemoryManagement?: boolean;
  maxMemoryMB?: number;
}

export interface LintResult {
  filesProcessed: number;
  issuesFound: Issue[];
  fixesApplied: Fix[];
  errors: Error[];
  duration: number;
}

export interface Issue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line?: number;
  column?: number;
  fixable: boolean;
}

export interface Fix {
  ruleId: string;
  file: string;
  description: string;
  changes: FileChange[];
}

export interface FileChange {
  type: 'insert' | 'delete' | 'replace' | 'move';
  line?: number;
  column?: number;
  oldText?: string;
  newText?: string;
  oldPath?: string;
  newPath?: string;
}

export interface MarkdownFile {
  path: string;
  content: string;
  frontmatter: Record<string, any>;
  headings: Heading[];
  links: Link[];
  attachments: Attachment[];
  ast: MarkdownAST;
}

export interface Heading {
  level: number;
  text: string;
  line: number;
  id?: string;
}

export interface Link {
  type: 'internal' | 'external';
  text: string;
  target: string;
  line: number;
  column: number;
  isValid?: boolean;
}

export interface Attachment {
  name: string;
  path: string;
  type: string;
  size: number;
  referencedBy: string[];
}

export interface MarkdownAST {
  type: 'root';
  children: MarkdownNode[];
}

export interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}
