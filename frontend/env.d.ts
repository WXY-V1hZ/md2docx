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

interface Window {
  md2docx?: {
    selectFiles: () => Promise<string[]>;
    getPathForFile: (file: File) => string;
    getPresets: () => Promise<{ name: string; current: boolean }[]>;
    openFile: (filePath: string) => Promise<string>;
    showInFolder: (filePath: string) => Promise<void>;
    convert: (request: {
      files: { id: string; path: string }[];
      preset?: string;
      openAfterConvert: boolean;
    }) => Promise<void>;
    regenerate: (recordId: string) => Promise<void>;
    getHistory: () => Promise<ConversionRecord[]>;
    clearHistory: () => Promise<void>;
    removeHistoryRecord: (recordId: string) => Promise<void>;
    onFileDone: (callback: (data: FileDoneEvent) => void) => () => void;
    onFileError: (callback: (data: FileErrorEvent) => void) => () => void;
  };
}
