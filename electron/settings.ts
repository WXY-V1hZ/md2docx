import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";

import { SETTINGS_PATH } from "../src/paths";
import { readCurrentPresetName } from "../src/preset";

export interface DesktopSettings {
  outputMode: "source" | "folder" | "ask";
  outputFolder: string;
  conflictAction: "overwrite" | "rename" | "ask";
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  outputMode: "source",
  outputFolder: "",
  conflictAction: "overwrite",
};

export function loadDesktopSettings(settingsPath = SETTINGS_PATH): DesktopSettings {
  if (!existsSync(settingsPath)) return { ...DEFAULT_DESKTOP_SETTINGS };

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return { ...DEFAULT_DESKTOP_SETTINGS };
  }
  if (!isRecord(value)) {
    return { ...DEFAULT_DESKTOP_SETTINGS };
  }
  try {
    return parseDesktopSettings(isRecord(value.desktop) ? value.desktop : value);
  } catch {
    return { ...DEFAULT_DESKTOP_SETTINGS };
  }
}

export function saveDesktopSettings(value: unknown, settingsPath = SETTINGS_PATH): DesktopSettings {
  const settings = parseDesktopSettings(value);
  const preset = readPresetForMerge(settingsPath);
  const document = {
    schemaVersion: 1,
    preset,
    desktop: settings,
  };

  mkdirSync(dirname(settingsPath), { recursive: true });
  const temporary = `${settingsPath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
  try {
    renameSync(temporary, settingsPath);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  return settings;
}

export function requireOutputFolder(folder: string): string {
  if (!folder || !isAbsolute(folder)) throw new Error("请选择有效的输出文件夹");
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error("输出文件夹不存在");
  }
  return folder;
}

export function outputPathFor(sourcePath: string, outputDirectory: string): string {
  return join(outputDirectory, `${parse(sourcePath).name}.docx`);
}

export function availableOutputPath(
  outputPath: string,
  reservedPaths: ReadonlySet<string> = new Set(),
): string {
  if (!existsSync(outputPath) && !reservedPaths.has(pathKey(outputPath))) return outputPath;
  const parsed = parse(outputPath);
  for (let index = 1; index < 10_000; index++) {
    const candidate = join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
    if (!existsSync(candidate) && !reservedPaths.has(pathKey(candidate))) return candidate;
  }
  throw new Error("无法生成可用的输出文件名");
}

export function pathKey(path: string): string {
  const absolute = resolve(path);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

function parseDesktopSettings(value: unknown): DesktopSettings {
  if (!isRecord(value)) throw new Error("设置数据无效");
  const unknownKeys = Object.keys(value).filter(
    (key) => !["outputMode", "outputFolder", "conflictAction"].includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(`设置数据无效：未知字段 ${unknownKeys.join(", ")}`);
  }
  if (!["source", "folder", "ask"].includes(String(value.outputMode))) {
    throw new Error("输出位置设置无效");
  }
  if (typeof value.outputFolder !== "string") throw new Error("输出文件夹设置无效");
  if (!["overwrite", "rename", "ask"].includes(String(value.conflictAction))) {
    throw new Error("同名文件设置无效");
  }
  return {
    outputMode: value.outputMode as DesktopSettings["outputMode"],
    outputFolder: value.outputFolder,
    conflictAction: value.conflictAction as DesktopSettings["conflictAction"],
  };
}

function readPresetForMerge(settingsPath: string): string {
  try {
    return readCurrentPresetName({
      presetsDir: join(dirname(settingsPath), "presets"),
      settingsPath,
    });
  } catch {
    return "default";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
