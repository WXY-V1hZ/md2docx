import { contextBridge, ipcRenderer, webUtils } from "electron";

interface ConversionRequest {
  files: { id: string; path: string }[];
  preset?: string;
  openAfterConvert: boolean;
}

interface FileDoneEvent {
  recordId: string;
  path: string;
  outputPath: string;
}

interface FileErrorEvent {
  recordId: string;
  path: string;
  error: string;
  missing?: boolean;
}

interface EditablePreset {
  name: string;
  source: "builtin" | "user";
  config: Record<string, unknown>;
  styleConfig: Record<string, unknown>;
}

interface UpdateSnapshot {
  state: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  revision?: number;
  supported?: boolean;
  version?: string;
  progress?: number;
  bytesPerSecond?: number;
  message?: string;
  retry?: "check" | "download";
}

contextBridge.exposeInMainWorld("md2docx", {
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke("dialog:selectFiles"),

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  getPresets: (): Promise<
    {
      name: string;
      source: "builtin" | "user";
      current: boolean;
      customFiles: string[];
      valid: boolean;
      error?: string;
    }[]
  > => ipcRenderer.invoke("preset:list"),

  usePreset: (name: string): Promise<void> => ipcRenderer.invoke("preset:use", name),

  savePreset: (options: {
    name: string;
    config?: string;
    styleRaw?: string;
    styleConfig?: string;
  }): Promise<void> => ipcRenderer.invoke("preset:save", options),

  deletePreset: (name: string): Promise<void> => ipcRenderer.invoke("preset:delete", name),

  renamePreset: (oldName: string, newName: string): Promise<void> =>
    ipcRenderer.invoke("preset:rename", { oldName, newName }),

  copyPreset: (sourceName: string, newName: string): Promise<void> =>
    ipcRenderer.invoke("preset:copy", { sourceName, newName }),

  readPreset: (name: string): Promise<EditablePreset> => ipcRenderer.invoke("preset:read", name),

  updatePreset: (input: {
    sourceName: string;
    targetName?: string;
    config: Record<string, unknown>;
    styleConfig: Record<string, unknown>;
  }): Promise<EditablePreset> => ipcRenderer.invoke("preset:update", input),

  convert: (request: ConversionRequest): Promise<void> =>
    ipcRenderer.invoke("convert:start", request),

  regenerate: (recordId: string): Promise<void> =>
    ipcRenderer.invoke("convert:regenerate", recordId),

  getHistory: (): Promise<unknown[]> => ipcRenderer.invoke("history:list"),

  clearHistory: (): Promise<void> => ipcRenderer.invoke("history:clear"),

  removeHistoryRecord: (recordId: string): Promise<void> =>
    ipcRenderer.invoke("history:remove", recordId),

  openFile: (filePath: string): Promise<string> => ipcRenderer.invoke("shell:openPath", filePath),

  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("shell:showInFolder", filePath),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:openExternal", url),

  detectPandoc: (): Promise<{ available: boolean; version: string | null; path: string | null }> =>
    ipcRenderer.invoke("pandoc:detect"),

  selectFolder: (): Promise<string | null> => ipcRenderer.invoke("dialog:selectFolder"),

  loadSettings: (): Promise<{
    outputMode: "source" | "folder" | "ask";
    outputFolder: string;
    conflictAction: "overwrite" | "rename" | "ask";
  }> => ipcRenderer.invoke("settings:load"),

  saveSettings: (settings: {
    outputMode: "source" | "folder" | "ask";
    outputFolder: string;
    conflictAction: "overwrite" | "rename" | "ask";
  }): Promise<void> => ipcRenderer.invoke("settings:save", settings),

  onFileDone: (callback: (data: FileDoneEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: FileDoneEvent) => callback(data);
    ipcRenderer.on("convert:file-done", handler);
    return () => ipcRenderer.removeListener("convert:file-done", handler);
  },

  onFileError: (callback: (data: FileErrorEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: FileErrorEvent) => callback(data);
    ipcRenderer.on("convert:file-error", handler);
    return () => ipcRenderer.removeListener("convert:file-error", handler);
  },

  getUpdateState: (): Promise<UpdateSnapshot> => ipcRenderer.invoke("update:state"),

  checkUpdate: (): Promise<UpdateSnapshot> => ipcRenderer.invoke("update:check"),

  downloadUpdate: (): Promise<void> => ipcRenderer.invoke("update:download"),

  installUpdate: (): Promise<void> => ipcRenderer.invoke("update:install"),

  onUpdateState: (callback: (data: UpdateSnapshot) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdateSnapshot) => callback(data);
    ipcRenderer.on("update:state-changed", handler);
    return () => ipcRenderer.removeListener("update:state-changed", handler);
  },
});
