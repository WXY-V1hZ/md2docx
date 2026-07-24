import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("md2docx", {
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke("dialog:selectFiles"),

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  getPresets: (): Promise<{ name: string; current: boolean }[]> =>
    ipcRenderer.invoke("preset:list"),

  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke("settings:get"),

  convert: (files: string[]): Promise<void> => ipcRenderer.invoke("convert:start", files),

  onConversionProgress: (callback: (event: unknown, data: unknown) => void) => {
    ipcRenderer.on("convert:progress", callback);
  },
});
