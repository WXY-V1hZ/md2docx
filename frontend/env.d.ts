/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_DEV_SERVER_URL?: string;
}

interface ConversionRecord {
  id: string;
  sourcePath: string;
  outputPath?: string;
  sourceName: string;
  preset: string;
  status: "converting" | "success" | "error" | "missing";
  startedAt: number;
  completedAt?: number;
  error?: string;
}

interface FileDoneEvent {
  recordId: string;
  jobId?: string;
  path: string;
  outputPath: string;
}

interface FileErrorEvent {
  recordId: string;
  jobId?: string;
  path: string;
  error: string;
  missing?: boolean;
}

interface PresetAppConfig {
  figureCaption: { enabled: boolean; format: string; separator: string };
  tableCaption: { enabled: boolean; format: string; separator: string };
  normalizeHeadings: { enabled: boolean };
  numberHeadings: {
    enabled: boolean;
    detectExisting: boolean;
    existingPattern?: string;
    useBuiltinRules?: boolean;
  };
  renderMermaid: { enabled: boolean; theme: string; density: number };
  imageSize: { enabled: boolean; maxWidthCm: number; maxHeightCm: number };
  detectTitle: {
    enabled: boolean;
    strategy: "first-h1" | "single-h1" | "filename" | "none";
  };
  removeThematicBreaks: { enabled: boolean };
}

interface PresetStyleConfig {
  schemaVersion: 1;
  options?: {
    body?: { firstLineIndent?: boolean; lineSpacing?: number };
    headings?: {
      "1"?: { startOnNewPage?: boolean; alignment?: "left" | "center"; bold?: boolean };
      "2"?: { bold?: boolean };
      "3"?: { bold?: boolean };
      "4"?: { bold?: boolean; italic?: boolean };
      "5"?: { bold?: boolean; italic?: boolean };
      "6"?: { bold?: boolean; italic?: boolean };
    };
    inlineCode?: { background?: boolean };
    codeBlock?: { border?: boolean };
  };
}

interface EditablePreset {
  name: string;
  source: "builtin" | "user";
  config: PresetAppConfig;
  styleConfig: PresetStyleConfig;
}

interface DesktopConversionSettings {
  schemaVersion: 1;
  preset: string;
  config: PresetAppConfig;
  styleConfig: PresetStyleConfig;
  collapsed: boolean;
}

interface UpdateSnapshot {
  state: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  revision?: number;
  supported?: boolean;
  preview?: boolean;
  version?: string;
  progress?: number;
  bytesPerSecond?: number;
  message?: string;
  retry?: "check" | "download";
}

interface Window {
  md2docx?: {
    selectFiles: () => Promise<string[]>;
    getPathForFile: (file: File) => string;
    getPresets: () => Promise<
      {
        name: string;
        source: "builtin" | "user";
        current: boolean;
        customFiles: string[];
        valid: boolean;
        error?: string;
      }[]
    >;
    usePreset: (name: string) => Promise<void>;
    savePreset: (options: {
      name: string;
      config?: string;
      styleRaw?: string;
      styleConfig?: string;
    }) => Promise<void>;
    deletePreset: (name: string) => Promise<void>;
    renamePreset: (oldName: string, newName: string) => Promise<void>;
    copyPreset: (sourceName: string, newName: string) => Promise<void>;
    readPreset: (name: string) => Promise<EditablePreset>;
    updatePreset: (input: {
      sourceName: string;
      targetName?: string;
      config: PresetAppConfig;
      styleConfig: PresetStyleConfig;
    }) => Promise<EditablePreset>;
    openFile: (filePath: string) => Promise<string>;
    showInFolder: (filePath: string) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
    convert: (request: {
      files: { id: string; path: string; editor?: boolean }[];
      preset: string;
      config: PresetAppConfig;
      styleConfig: PresetStyleConfig;
      openAfterConvert: boolean;
    }) => Promise<void>;
    createEditorSource: (input: {
      content: string;
      name: string;
    }) => Promise<{ path: string; name: string }>;
    getHistory: () => Promise<ConversionRecord[]>;
    clearHistory: () => Promise<void>;
    removeHistoryRecord: (recordId: string) => Promise<void>;
    detectPandoc: () => Promise<{
      available: boolean;
      version: string | null;
      path: string | null;
    }>;
    selectFolder: () => Promise<string | null>;
    loadSettings: () => Promise<{
      outputMode: "source" | "folder" | "ask";
      outputFolder: string;
      conflictAction: "overwrite" | "rename" | "ask";
    }>;
    saveSettings: (settings: {
      outputMode: "source" | "folder" | "ask";
      outputFolder: string;
      conflictAction: "overwrite" | "rename" | "ask";
    }) => Promise<void>;
    loadConversionSettings: () => Promise<DesktopConversionSettings | undefined>;
    saveConversionSettings: (settings: DesktopConversionSettings) => Promise<void>;
    onFileDone: (callback: (data: FileDoneEvent) => void) => () => void;
    onFileError: (callback: (data: FileErrorEvent) => void) => () => void;
    getUpdateState: () => Promise<UpdateSnapshot>;
    checkUpdate: () => Promise<UpdateSnapshot>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    onUpdateState: (callback: (data: UpdateSnapshot) => void) => () => void;
  };
}
