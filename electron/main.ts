import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  copyPreset,
  deletePreset,
  discoverPresets,
  readEditablePreset,
  renamePreset,
  savePreset,
  updatePreset,
  usePreset,
} from "../src/preset";
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
import {
  availableOutputPath,
  loadDesktopSettings,
  outputPathFor,
  pathKey,
  requireOutputFolder,
  saveDesktopSettings,
  type DesktopSettings,
} from "./settings";
import type {
  ConversionRecord,
  DesktopConversionFile,
  DesktopConversionRequest,
  DesktopConversionResult,
} from "./types";
import { autoUpdater } from "electron-updater";
import { createUpdateManager, type UpdateManager, type UpdateSnapshot } from "./updater";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TITLE_BAR_HEIGHT = 48;

let mainWindow: BrowserWindow | null = null;
let updateManager: UpdateManager | null = null;

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

function publishUpdateSnapshot(snapshot: UpdateSnapshot): void {
  mainWindow?.webContents.send("update:state-changed", snapshot);
}

function setupUpdateManager(): UpdateManager {
  const manager = createUpdateManager(
    {
      configure() {
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;
      },
      check: () => autoUpdater.checkForUpdates() as unknown as Promise<void>,
      download: () => autoUpdater.downloadUpdate() as unknown as Promise<void>,
      install: () => setImmediate(() => autoUpdater.quitAndInstall()),
      onAvailable: (listener) =>
        autoUpdater.on("update-available", (info) => listener(info.version)),
      onNotAvailable: (listener) => autoUpdater.on("update-not-available", () => listener()),
      onProgress: (listener) =>
        autoUpdater.on("download-progress", (p) => listener(p.percent, p.bytesPerSecond)),
      onDownloaded: (listener) =>
        autoUpdater.on("update-downloaded", (info) => listener(info?.version)),
      onError: (listener) => autoUpdater.on("error", (err) => listener(err)),
    },
    () => !process.env.VITE_DEV_SERVER_URL,
    publishUpdateSnapshot,
  );
  manager.setup();
  return manager;
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

  ipcMain.handle("preset:list", () => discoverPresets());

  ipcMain.handle("preset:use", async (_event, name: unknown) => {
    if (typeof name !== "string" || name.length === 0) throw new Error("预设名称无效");
    await usePreset(name);
  });

  ipcMain.handle("preset:save", async (_event, value: unknown) => {
    if (!isRecord(value)) throw new Error("参数无效");
    const { name, config, styleRaw, styleConfig } = value as Record<string, unknown>;
    if (typeof name !== "string" || name.length === 0) throw new Error("预设名称无效");
    await savePreset({
      name,
      ...(typeof config === "string" ? { config } : {}),
      ...(typeof styleRaw === "string" ? { styleRaw } : {}),
      ...(typeof styleConfig === "string" ? { styleConfig } : {}),
    });
  });

  ipcMain.handle("preset:delete", async (_event, name: unknown) => {
    if (typeof name !== "string" || name.length === 0) throw new Error("预设名称无效");
    await deletePreset(name);
  });

  ipcMain.handle("preset:rename", async (_event, value: unknown) => {
    if (!isRecord(value)) throw new Error("参数无效");
    const { oldName, newName } = value;
    if (typeof oldName !== "string" || typeof newName !== "string") throw new Error("名称无效");
    await renamePreset(oldName, newName);
  });

  ipcMain.handle("preset:copy", async (_event, value: unknown) => {
    if (!isRecord(value)) throw new Error("参数无效");
    const { sourceName, newName } = value;
    if (typeof sourceName !== "string" || typeof newName !== "string") throw new Error("名称无效");
    await copyPreset(sourceName, newName);
  });

  ipcMain.handle("preset:read", async (_event, name: unknown) => {
    if (typeof name !== "string" || name.length === 0) throw new Error("预设名称无效");
    return readEditablePreset(name);
  });

  ipcMain.handle("preset:update", async (_event, value: unknown) => {
    if (!isRecord(value)) throw new Error("参数无效");
    const { sourceName, targetName, config, styleConfig } = value;
    if (typeof sourceName !== "string" || sourceName.length === 0) {
      throw new Error("预设名称无效");
    }
    if (targetName !== undefined && typeof targetName !== "string") {
      throw new Error("目标预设名称无效");
    }
    return updatePreset({
      sourceName,
      ...(targetName === undefined ? {} : { targetName }),
      config,
      styleConfig,
    });
  });

  ipcMain.handle("shell:openPath", async (_e, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) throw new Error("文件路径无效");
    return shell.openPath(filePath);
  });

  ipcMain.handle("shell:showInFolder", async (_e, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) throw new Error("文件路径无效");
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("shell:openExternal", async (_event, value: unknown) => {
    if (typeof value !== "string") throw new Error("链接无效");
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "pandoc.org") {
      throw new Error("不允许打开此链接");
    }
    await shell.openExternal(url.toString());
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
    const request = await applyDesktopOutputSettings(parseConversionRequest(value));
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

  ipcMain.handle("settings:load", () => loadDesktopSettings());

  ipcMain.handle("settings:save", (_event, value: unknown) => saveDesktopSettings(value));

  ipcMain.handle("pandoc:detect", async () => {
    const executable = findExecutableOnPath("pandoc");
    if (!executable) return { available: false, version: null, path: null };
    try {
      const { stdout } = await runCommand(executable, ["--version"]);
      const firstLine = stdout.trim().split(/\r?\n/, 1)[0] ?? "";
      const version = /^pandoc\s+(.+)$/i.exec(firstLine)?.[1]?.trim() || firstLine || null;
      return { available: true, version, path: executable };
    } catch {
      return { available: false, version: null, path: null };
    }
  });

  ipcMain.handle("dialog:selectFolder", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  // ── Auto-update ──

  ipcMain.handle("update:state", () => updateManager?.getSnapshot() ?? { state: "idle" });
  ipcMain.handle("update:check", () => updateManager?.check() ?? { state: "idle" });
  ipcMain.handle("update:download", () => updateManager?.download());
  ipcMain.handle("update:install", () => updateManager?.install());
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs = 5_000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const append = (current: string, chunk: string) => `${current}${chunk}`.slice(0, 65_536);

    const timeout = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error("Pandoc 检测超时")));
    }, timeoutMs);

    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      stderr = append(stderr, chunk);
    });
    child.once("error", (error) => finish(() => reject(error)));
    child.once("close", (code) => {
      finish(() => {
        if (code === 0) resolvePromise({ stdout, stderr });
        else reject(new Error(stderr.trim() || `exit code ${code}`));
      });
    });
  });
}

function findExecutableOnPath(command: string): string | null {
  const pathEntries = process.env.PATH?.split(delimiter) ?? [];
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT?.split(";") ?? [".EXE", ".CMD", ".BAT"])
      : [""];
  const hasExtension = extname(command).length > 0;

  for (const entry of pathEntries) {
    const directory = entry.trim().replace(/^"(.*)"$/, "$1");
    if (!directory) continue;
    for (const extension of hasExtension ? [""] : extensions) {
      const candidate = join(directory, `${command}${extension}`);
      if (existsSync(candidate) && statSync(candidate).isFile()) return resolve(candidate);
    }
  }
  return null;
}

async function applyDesktopOutputSettings(
  request: DesktopConversionRequest,
): Promise<DesktopConversionRequest> {
  const settings = loadDesktopSettings();
  const selectedFolder = await resolveSelectedOutputFolder(settings);
  const files: DesktopConversionFile[] = [];
  const reservedPaths = new Set<string>();

  for (const file of request.files) {
    const directory = selectedFolder ?? dirname(file.path);
    let outputPath = outputPathFor(file.path, directory);
    if (reservedPaths.has(pathKey(outputPath))) {
      outputPath = availableOutputPath(outputPath, reservedPaths);
    } else if (existsSync(outputPath)) {
      outputPath = await resolveConflictOutputPath(
        outputPath,
        settings.conflictAction,
        reservedPaths,
      );
    }
    reservedPaths.add(pathKey(outputPath));
    files.push({ ...file, outputPath });
  }
  return { ...request, files };
}

async function resolveSelectedOutputFolder(settings: DesktopSettings): Promise<string | null> {
  if (settings.outputMode === "source") return null;
  if (settings.outputMode === "folder") return requireOutputFolder(settings.outputFolder);
  if (!mainWindow) throw new Error("窗口不可用");

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择输出文件夹",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) throw new Error("已取消选择输出位置");
  return result.filePaths[0];
}

async function resolveConflictOutputPath(
  outputPath: string,
  action: DesktopSettings["conflictAction"],
  reservedPaths: ReadonlySet<string>,
): Promise<string> {
  if (action === "overwrite") return outputPath;
  if (action === "rename") return availableOutputPath(outputPath, reservedPaths);
  if (!mainWindow) throw new Error("窗口不可用");

  const result = await dialog.showMessageBox(mainWindow, {
    type: "question",
    message: "同名文件已存在",
    detail: outputPath,
    buttons: ["自动重命名", "覆盖", "取消"],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  if (result.response === 0) return availableOutputPath(outputPath, reservedPaths);
  if (result.response === 1) return outputPath;
  throw new Error("已取消转换");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    icon: resolve(__dirname, "../assets/icon.png"),
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

  mainWindow.webContents.on("did-finish-load", () => {
    publishUpdateSnapshot(updateManager?.getSnapshot() ?? { state: "idle" });
  });
}

app.whenReady().then(() => {
  recoverHistory();
  updateManager = setupUpdateManager();
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
