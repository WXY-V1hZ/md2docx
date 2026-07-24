import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { discoverPresets } from "../src/preset";
import {
  convertDesktopFiles,
  createRecordsFromRequest,
  parseConversionRequest,
  regenerateRecord,
} from "./conversion";
import {
  clearCompletedHistory,
  loadHistory,
  recoverHistory,
  removeHistoryRecord,
  saveHistory,
} from "./conversion-history";
import type { ConversionRecord, DesktopConversionResult } from "./types";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TITLE_BAR_HEIGHT = 48;

let mainWindow: BrowserWindow | null = null;

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
    return (
      await dialog.showOpenDialog(mainWindow, {
        title: "选择 Markdown 文件",
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
        properties: ["openFile", "multiSelections"],
      })
    ).filePaths;
  });

  ipcMain.handle("preset:list", async () =>
    (await discoverPresets())
      .filter((p) => p.valid)
      .map(({ name, current }) => ({ name, current })),
  );

  ipcMain.handle("shell:openPath", async (_e, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) throw new Error("文件路径无效");
    return shell.openPath(filePath);
  });

  ipcMain.handle("shell:showInFolder", async (_e, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) throw new Error("文件路径无效");
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("history:list", () => loadHistory());

  ipcMain.handle("history:clear", clearCompletedHistory);

  ipcMain.handle("history:remove", (_event, recordId: unknown) => {
    if (typeof recordId !== "string" || recordId.length === 0) {
      throw new Error("记录 ID 无效");
    }
    removeHistoryRecord(recordId);
  });

  ipcMain.handle("convert:start", async (event, value: unknown) => {
    const request = parseConversionRequest(value);
    const records = createRecordsFromRequest(request);
    const history = loadHistory();
    saveHistory([...records, ...history]);

    await convertDesktopFiles(request, async (result: DesktopConversionResult) => {
      const current = loadHistory();
      updateHistoryFromResult(current, result);
      saveHistory(current);

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

  ipcMain.handle("convert:regenerate", async (event, recordId: unknown) => {
    if (typeof recordId !== "string") throw new Error("记录 ID 无效");
    const history = loadHistory();
    const record = history.find((r) => r.id === recordId);
    if (!record) throw new Error("找不到转换记录");
    const request = regenerateRecord(record);
    if (!request) {
      record.status = "missing";
      record.error = undefined;
      saveHistory(history);
      event.sender.send("convert:file-error", {
        recordId,
        path: record.sourcePath,
        error: "源文件不存在",
        missing: true,
      });
      return;
    }
    record.status = "converting";
    record.error = undefined;
    record.startedAt = Date.now();
    saveHistory(history);

    await convertDesktopFiles(request, async (result: DesktopConversionResult) => {
      const cur = loadHistory();
      updateHistoryFromResult(cur, result);
      saveHistory(cur);

      if (event.sender.isDestroyed()) return;
      event.sender.send(
        result.status === "done" ? "convert:file-done" : "convert:file-error",
        result,
      );
    });
  });
}

function updateHistoryFromResult(
  history: ConversionRecord[],
  result: DesktopConversionResult,
): void {
  const record = history.find(({ id }) => id === result.recordId);
  if (!record) return;

  record.completedAt = Date.now();
  if (result.status === "done") {
    record.status = "success";
    record.outputPath = result.outputPath;
    record.error = undefined;
  } else {
    record.status = result.missing ? "missing" : "error";
    record.error = result.missing ? undefined : result.error;
  }
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
  recoverHistory();
  registerIpcHandlers();
  createWindow();

  nativeTheme.on("updated", () => {
    if (mainWindow === null || process.platform === "darwin") return;
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
