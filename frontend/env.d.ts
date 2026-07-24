/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface FileDoneEvent {
  path: string;
  outputPath: string;
}

interface FileErrorEvent {
  path: string;
  error: string;
}

interface ConversionRequest {
  files: string[];
  preset?: string;
  openAfterConvert: boolean;
}

interface Window {
  md2docx?: {
    selectFiles: () => Promise<string[]>;
    getPathForFile: (file: File) => string;
    getPresets: () => Promise<{ name: string; current: boolean }[]>;
    getSettings: () => Promise<Record<string, unknown>>;
    convert: (request: ConversionRequest) => Promise<void>;
    openFile: (filePath: string) => Promise<string>;
    showInFolder: (filePath: string) => Promise<void>;
    onFileDone: (callback: (data: FileDoneEvent) => void) => () => void;
    onFileError: (callback: (data: FileErrorEvent) => void) => () => void;
  };
}
