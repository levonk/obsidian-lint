/**
 * Mock implementation of Obsidian API for testing
 */

export class Plugin {
  app: any;

  constructor() {
    this.app = {
      workspace: {
        getActiveFile: () => null,
        getActiveViewOfType: () => null,
        on: () => ({}),
      },
      vault: {
        adapter: {
          basePath: '/mock/vault',
        },
      },
    };
  }

  async loadData(): Promise<any> {
    return {};
  }

  async saveData(data: any): Promise<void> {
    // Mock implementation
  }

  addStatusBarItem(): HTMLElement {
    return {
      setText: () => {},
      addClass: () => {},
      remove: () => {},
    } as any;
  }

  addCommand(command: any): void {
    // Mock implementation
  }

  addSettingTab(settingTab: any): void {
    // Mock implementation
  }

  registerEvent(event: any): void {
    // Mock implementation
  }
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {
      empty: () => {},
      createEl: () => ({}),
    } as any;
  }

  display(): void {
    // Mock implementation
  }
}

export class Setting {
  constructor(containerEl: HTMLElement) {
    // Mock implementation
  }

  setName(name: string): this {
    return this;
  }

  setDesc(desc: string): this {
    return this;
  }

  addText(callback: (text: any) => void): this {
    const mockText = {
      setPlaceholder: () => mockText,
      setValue: () => mockText,
      onChange: () => mockText,
    };
    callback(mockText);
    return this;
  }

  addTextArea(callback: (text: any) => void): this {
    const mockTextArea = {
      setPlaceholder: () => mockTextArea,
      setValue: () => mockTextArea,
      onChange: () => mockTextArea,
    };
    callback(mockTextArea);
    return this;
  }

  addToggle(callback: (toggle: any) => void): this {
    const mockToggle = {
      setValue: () => mockToggle,
      onChange: () => mockToggle,
    };
    callback(mockToggle);
    return this;
  }

  addSlider(callback: (slider: any) => void): this {
    const mockSlider = {
      setLimits: () => mockSlider,
      setValue: () => mockSlider,
      setDynamicTooltip: () => mockSlider,
      onChange: () => mockSlider,
    };
    callback(mockSlider);
    return this;
  }

  addButton(callback: (button: any) => void): this {
    const mockButton = {
      setButtonText: () => mockButton,
      setCta: () => mockButton,
      setWarning: () => mockButton,
      onClick: () => mockButton,
    };
    callback(mockButton);
    return this;
  }
}

export class Notice {
  constructor(message: string) {
    // Mock implementation
  }
}

export class MarkdownView {
  editor: Editor;
  file: TFile | null;
  leaf: any;

  constructor() {
    this.editor = {
      getValue: () => '',
      setValue: () => {},
      getCursor: () => ({ line: 0, ch: 0 }),
      setCursor: () => {},
      somethingSelected: () => false,
      getSelection: () => '',
      replaceSelection: () => {},
      replaceRange: () => {},
      getLine: () => '',
      lineCount: () => 0,
    };
    this.file = null;
    this.leaf = {
      view: {
        getState: () => ({ mode: 'source' }),
      },
    };
  }
}

export interface TFile {
  name: string;
  path: string;
  stat: {
    mtime: number;
  };
}

export interface Command {
  id: string;
  name: string;
  callback: () => void;
  hotkeys?: Array<{ modifiers: string[]; key: string }>;
}

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
