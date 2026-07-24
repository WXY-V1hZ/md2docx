const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("md2docx", {
  selectFiles: () => ipcRenderer.invoke("dialog:selectFiles"),

  getPathForFile: (file) => webUtils.getPathForFile(file),

  getPresets: () => ipcRenderer.invoke("preset:list"),

  getSettings: () => ipcRenderer.invoke("settings:get"),

  openFile: (filePath) => ipcRenderer.invoke("shell:openPath", filePath),

  showInFolder: (filePath) => ipcRenderer.invoke("shell:showInFolder", filePath),

  convert: (request) => ipcRenderer.invoke("convert:start", request),

  onFileDone: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("convert:file-done", handler);
    return () => ipcRenderer.removeListener("convert:file-done", handler);
  },

  onFileError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("convert:file-error", handler);
    return () => ipcRenderer.removeListener("convert:file-error", handler);
  },
});
