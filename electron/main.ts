import { app, BrowserWindow, nativeTheme, ipcMain, dialog } from "electron";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

  ipcMain.handle("preset:list", async () => {
    // 后续从 preset 系统获取
    return [{ name: "default", current: true }];
  });

  ipcMain.handle("settings:get", async () => {
    return {};
  });

  ipcMain.handle("convert:start", async (_event, files: string[]) => {
    // 后续实现转换逻辑
    console.log("convert files:", files);
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
      preload: resolve(__dirname, "preload.ts"),
      contextIsolation: true,
      nodeIntegration: false,
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
    mainWindow.setBackgroundColor(
      nativeTheme.shouldUseDarkColors ? BG.dark : BG.light,
    );
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
