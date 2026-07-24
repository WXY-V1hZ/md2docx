/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface Window {
  md2docx?: {
    selectFiles: () => Promise<string[]>;
    getPathForFile: (file: File) => string;
    getPresets: () => Promise<{ name: string; current: boolean }[]>;
    getSettings: () => Promise<Record<string, unknown>>;
    convert: (files: string[]) => Promise<void>;
    onConversionProgress: (callback: (event: unknown, data: unknown) => void) => void;
  };
}
