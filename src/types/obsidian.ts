/**
 * Obsidian API Type Definitions
 * These types mirror the Obsidian API for development and testing
 */

export interface EditorPosition {
  line: number;
  ch: number;
}

export interface EditorRange {
  from: EditorPosition;
  to: EditorPosition;
}

export interface Editor {
  getValue(): string;
  setValue(content: string): void;
  getCursor(type?: 'from' | 'to'): EditorPosition;
  setCursor(pos: EditorPosition): void;
  somethingSelected(): boolean;
  getSelection(): string;
  replaceSelection(text: string): void;
  replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void;
  getLine(line: number): string;
  lineCount(): number;
  containerEl?: HTMLElement;
}

export interface TFile {
  name: string;
  path: string;
  stat: {
    mtime: number;
  };
}

export interface MarkdownView {
  editor: Editor;
  file: TFile | null;
  leaf: {
    view: {
      getState(): { mode: string };
    };
  };
}

export interface App {
  workspace: {
    getActiveFile(): TFile | null;
    getActiveViewOfType<T>(type: new (...args: any[]) => T): T | null;
    on(event: string, callback: (...args: any[]) => void): any;
  };
  vault: {
    adapter: {
      basePath: string;
    };
  };
}

export interface Command {
  id: string;
  name: string;
  callback: () => void;
  hotkeys?: Array<{ modifiers: string[]; key: string }>;
}

export abstract class Plugin {
  app: App;

  constructor() {
    this.app = {} as App;
  }

  abstract onload(): Promise<void>;
  abstract onunload(): Promise<void>;

  async loadData(): Promise<any> {
    return {};
  }

  async saveData(data: any): Promise<void> {
    // Implementation provided by Obsidian
  }

  addStatusBarItem(): HTMLElement {
    return {} as HTMLElement;
  }

  addCommand(command: Command): void {
    // Implementation provided by Obsidian
  }

  addSettingTab(settingTab: any): void {
    // Implementation provided by Obsidian
  }

  registerEvent(event: any): void {
    // Implementation provided by Obsidian
  }
}

export class Notice {
  constructor(message: string) {
    // Implementation provided by Obsidian
  }
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {} as HTMLElement;
  }

  display(): void {
    // Implementation provided by Obsidian
  }
}

export class Setting {
  constructor(containerEl: HTMLElement) {
    // Implementation provided by Obsidian
  }

  setName(name: string): this {
    return this;
  }

  setDesc(desc: string): this {
    return this;
  }

  addText(callback: (text: any) => void): this {
    return this;
  }

  addTextArea(callback: (text: any) => void): this {
    return this;
  }

  addToggle(callback: (toggle: any) => void): this {
    return this;
  }

  addSlider(callback: (slider: any) => void): this {
    return this;
  }

  addButton(callback: (button: any) => void): this {
    return this;
  }

  addDropdown(callback: (dropdown: any) => void): this {
    return this;
  }
}

export class ButtonComponent {
  setButtonText(text: string): this {
    return this;
  }

  setCta(): this {
    return this;
  }

  setWarning(): this {
    return this;
  }

  onClick(callback: () => void): this {
    return this;
  }
}

export class DropdownComponent {
  addOption(value: string, text: string): this {
    return this;
  }

  setValue(value: string): this {
    return this;
  }

  onChange(callback: (value: string) => void): this {
    return this;
  }
}
