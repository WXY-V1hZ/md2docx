import { contextBridge, ipcRenderer, webUtils } from "electron";

interface ConversionRequest {
  files: string[];
  preset?: string;
  openAfterConvert: boolean;
}

interface FileDoneEvent {
  path: string;
  outputPath: string;
}

interface FileErrorEvent {
  path: string;
  error: string;
}

contextBridge.exposeInMainWorld("md2docx", {
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke("dialog:selectFiles"),

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  getPresets: (): Promise<{ name: string; current: boolean }[]> =>
    ipcRenderer.invoke("preset:list"),

  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke("settings:get"),

  convert: (request: ConversionRequest): Promise<void> =>
    ipcRenderer.invoke("convert:start", request),

  openFile: (filePath: string): Promise<string> => ipcRenderer.invoke("shell:openPath", filePath),

  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("shell:showInFolder", filePath),

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
});
