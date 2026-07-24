import { app, BrowserWindow, nativeTheme } from "electron";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TITLE_BAR_HEIGHT = 48;

let mainWindow: BrowserWindow | null = null;

function getTitleBarOverlayOptions() {
  return {
    color: nativeTheme.shouldUseDarkColors ? "#1f2024" : "#f7f8fa",
    symbolColor: nativeTheme.shouldUseDarkColors ? "#f3f4f6" : "#25272b",
    height: TITLE_BAR_HEIGHT,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1f2024" : "#f7f8fa",
    titleBarStyle: "hidden",
    titleBarOverlay: process.platform === "darwin" ? true : getTitleBarOverlayOptions(),
    ...(process.platform === "darwin" ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    webPreferences: {
      preload: resolve(__dirname, "preload.ts"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(resolve(__dirname, "../dist-frontend/index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  nativeTheme.on("updated", () => {
    if (mainWindow === null || process.platform === "darwin") {
      return;
    }

    mainWindow.setTitleBarOverlay(getTitleBarOverlayOptions());
    mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#1f2024" : "#f7f8fa");
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
