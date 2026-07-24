import { app, BrowserWindow, nativeTheme, ipcMain, dialog, shell } from "electron";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  convertDesktopFiles,
  parseConversionRequest,
  type DesktopConversionResult,
} from "./conversion";
import { discoverPresets } from "../src/preset";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TITLE_BAR_HEIGHT = 48;

let mainWindow: BrowserWindow | null = null;

/**
 * titleBarOverlay 的颜色必须与标题栏 CSS 背景（--app-surface）一致。
 * 窗口 backgroundColor 必须与 body 背景（--app-bg）一致。
 * 它们分别在 base.css 中定义。
 */
const SURFACE = { light: "#ffffff", dark: "#2c2c2e" };
const BG = { light: "#f5f5f7", dark: "#1c1c1e" };

function getTitleBarOverlayOptions() {
  const isDark = nativeTheme.shouldUseDarkColors;
  return {
    color: isDark ? SURFACE.dark : SURFACE.light,
    symbolColor: isDark ? "#f5f5f7" : "#1d1d1f",
    height: TITLE_BAR_HEIGHT,
  };
}

function registerIpcHandlers() {
  ipcMain.handle("dialog:selectFiles", async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择 Markdown 文件",
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      properties: ["openFile", "multiSelections"],
    });
    return result.filePaths;
  });

  ipcMain.handle("preset:list", async () =>
    (await discoverPresets())
      .filter((preset) => preset.valid)
      .map(({ name, current }) => ({ name, current })),
  );

  ipcMain.handle("settings:get", async () => {
    return {};
  });

  ipcMain.handle("shell:openPath", async (_event, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw new Error("文件路径无效");
    }
    return shell.openPath(filePath);
  });

  ipcMain.handle("shell:showInFolder", async (_event, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw new Error("文件路径无效");
    }
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("convert:start", async (event, value: unknown) => {
    const request = parseConversionRequest(value);
    await convertDesktopFiles(request, async (result: DesktopConversionResult) => {
      if (event.sender.isDestroyed()) return;
      event.sender.send(
        result.status === "done" ? "convert:file-done" : "convert:file-error",
        result,
      );
      if (result.status === "done" && request.openAfterConvert) {
        await shell.openPath(result.outputPath);
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG.dark : BG.light,
    titleBarStyle: "hidden",
    titleBarOverlay: process.platform === "darwin" ? true : getTitleBarOverlayOptions(),
    ...(process.platform === "darwin" ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    webPreferences: {
      preload: resolve(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(resolve(__dirname, "../dist-frontend/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  nativeTheme.on("updated", () => {
    if (mainWindow === null || process.platform === "darwin") {
      return;
    }

    mainWindow.setTitleBarOverlay(getTitleBarOverlayOptions());
    mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? BG.dark : BG.light);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
