import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";

import { loadConfig } from "./config";
import { resolveInputPath } from "./output";
import { PRESETS_DIR, SETTINGS_PATH } from "./paths";
import {
  materializeDefaultConfig,
  materializeDefaultStyleConfig,
  materializeDefaultStyleRaw,
} from "./resources";
import { loadStyleConfig, loadStyleRaw } from "./style/compiler";

export const DEFAULT_PRESET_NAME = "default";
const PRESET_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const PRESET_FILES = ["config.json", "style-raw.json", "style-config.json"] as const;

export interface PresetStoragePaths {
  presetsDir: string;
  settingsPath: string;
}

export interface ResolvedPreset {
  name: string;
  configPath: string;
  styleRawPath: string;
  styleConfigPath: string;
}

export interface PresetDescriptor {
  name: string;
  source: "builtin" | "user";
  current: boolean;
  customFiles: string[];
  valid: boolean;
  error?: string;
}

export interface SavePresetInput {
  name: string;
  config?: string;
  styleRaw?: string;
  styleConfig?: string;
}

const DEFAULT_STORAGE_PATHS: PresetStoragePaths = {
  presetsDir: PRESETS_DIR,
  settingsPath: SETTINGS_PATH,
};

export function readCurrentPresetName(paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS): string {
  if (!existsSync(paths.settingsPath)) return DEFAULT_PRESET_NAME;

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(paths.settingsPath, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`预设设置不是有效的 JSON：${paths.settingsPath}\n${message}`);
  }
  if (isLegacyDesktopSettings(value)) return DEFAULT_PRESET_NAME;
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.preset !== "string") {
    throw new Error(`预设设置无效：${paths.settingsPath}`);
  }
  const unknownKeys = Object.keys(value).filter(
    (key) => key !== "schemaVersion" && key !== "preset" && key !== "desktop",
  );
  if (unknownKeys.length > 0) {
    throw new Error(`预设设置无效：${paths.settingsPath}\n未知字段：${unknownKeys.join(", ")}`);
  }
  assertPresetName(value.preset);
  return value.preset;
}

export async function resolvePreset(
  name?: string,
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<ResolvedPreset> {
  const selected = name ?? readCurrentPresetName(paths);
  return resolvePresetByName(selected, paths);
}

export async function resolvePresetConfig(
  name?: string,
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<{ name: string; configPath: string }> {
  const selected = name ?? readCurrentPresetName(paths);
  assertPresetName(selected);
  const defaultConfigPath = materializeDefaultConfig();
  const configPath =
    selected === DEFAULT_PRESET_NAME
      ? defaultConfigPath
      : resolveOptionalPresetFile(
          requireUserPresetDirectory(selected, paths),
          "config.json",
          defaultConfigPath,
        );
  await loadConfig(configPath);
  return { name: selected, configPath };
}

export async function resolvePresetByName(
  name: string,
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<ResolvedPreset> {
  assertPresetName(name);
  const defaults = defaultPresetFiles();
  if (name === DEFAULT_PRESET_NAME) {
    await validatePresetFiles(defaults);
    return { name, ...defaults };
  }

  const directory = requireUserPresetDirectory(name, paths);
  const files = {
    configPath: resolveOptionalPresetFile(directory, "config.json", defaults.configPath),
    styleRawPath: resolveOptionalPresetFile(directory, "style-raw.json", defaults.styleRawPath),
    styleConfigPath: resolveOptionalPresetFile(
      directory,
      "style-config.json",
      defaults.styleConfigPath,
    ),
  };
  await validatePresetFiles(files);
  return { name, ...files };
}

export async function discoverPresets(
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<PresetDescriptor[]> {
  const current = readCurrentPresetName(paths);
  const descriptors: PresetDescriptor[] = [
    {
      name: DEFAULT_PRESET_NAME,
      source: "builtin",
      current: current === DEFAULT_PRESET_NAME,
      customFiles: [...PRESET_FILES],
      valid: true,
    },
  ];
  if (!existsSync(paths.presetsDir)) return descriptors;

  const entries = readdirSync(paths.presetsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const directory = join(paths.presetsDir, entry.name);
    const customFiles = PRESET_FILES.filter((file) => existsSync(join(directory, file)));
    try {
      assertPresetName(entry.name);
      if (entry.name === DEFAULT_PRESET_NAME) {
        throw new Error("名称 default 为系统保留名称");
      }
      await resolvePresetByName(entry.name, paths);
      descriptors.push({
        name: entry.name,
        source: "user",
        current: current === entry.name,
        customFiles,
        valid: true,
      });
    } catch (error) {
      descriptors.push({
        name: entry.name,
        source: "user",
        current: current === entry.name,
        customFiles,
        valid: false,
        error: error instanceof Error ? error.message.split("\n")[0] : String(error),
      });
    }
  }
  return descriptors;
}

export async function usePreset(
  name: string,
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<void> {
  await resolvePresetByName(name, paths);
  mkdirSync(dirname(paths.settingsPath), { recursive: true });
  const temporary = `${paths.settingsPath}.${process.pid}.${randomUUID()}.tmp`;
  const desktop = readExistingDesktopSettings(paths.settingsPath);
  writeFileSync(
    temporary,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        preset: name,
        ...(desktop ? { desktop } : {}),
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  try {
    renameSync(temporary, paths.settingsPath);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function readExistingDesktopSettings(settingsPath: string): Record<string, unknown> | undefined {
  if (!existsSync(settingsPath)) return undefined;
  try {
    const value: unknown = JSON.parse(readFileSync(settingsPath, "utf-8"));
    if (isLegacyDesktopSettings(value)) return value;
    return isRecord(value) && isRecord(value.desktop) ? value.desktop : undefined;
  } catch {
    return undefined;
  }
}

export async function copyPreset(
  sourceName: string,
  newName: string,
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<void> {
  assertPresetName(newName);
  if (newName === DEFAULT_PRESET_NAME) throw new Error("不能覆盖系统预设 default");
  const source = await resolvePresetByName(sourceName, paths);
  mkdirSync(paths.presetsDir, { recursive: true });
  const target = join(paths.presetsDir, newName);
  if (existsSync(target)) throw new Error(`预设 ${newName} 已存在`);

  const temporary = mkdtempSync(join(paths.presetsDir, `.copy-${newName}-`));
  try {
    copyFileSync(source.configPath, join(temporary, "config.json"));
    copyFileSync(source.styleRawPath, join(temporary, "style-raw.json"));
    copyFileSync(source.styleConfigPath, join(temporary, "style-config.json"));
    renameSync(temporary, target);
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

export async function renamePreset(
  oldName: string,
  newName: string,
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<void> {
  assertPresetName(newName);
  if (newName === DEFAULT_PRESET_NAME) throw new Error("不能覆盖系统预设 default");
  if (oldName === newName) return;

  const source = requireStoredPresetDirectory(oldName, paths);
  const target = join(paths.presetsDir, newName);
  if (existsSync(target)) throw new Error(`预设 ${newName} 已存在`);
  const wasCurrent = readCurrentPresetName(paths) === oldName;

  renameSync(source, target);
  try {
    if (wasCurrent) await usePreset(newName, paths);
  } catch (error) {
    renameSync(target, source);
    throw error;
  }
}

export async function deletePreset(
  name: string,
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<void> {
  const directory = requireStoredPresetDirectory(name, paths);
  if (readCurrentPresetName(paths) === name) await usePreset(DEFAULT_PRESET_NAME, paths);
  rmSync(directory, { recursive: true, force: true });
}

export async function savePreset(
  input: SavePresetInput,
  paths: PresetStoragePaths = DEFAULT_STORAGE_PATHS,
): Promise<void> {
  assertPresetName(input.name);
  if (input.name === DEFAULT_PRESET_NAME) throw new Error("不能保存或覆盖系统预设 default");
  if (!input.config && !input.styleRaw && !input.styleConfig) {
    throw new Error("preset save 至少需要 --config、--style-raw 或 --style-config 之一");
  }

  const sources = {
    config: input.config ? resolveInputPath(input.config, [".json"], "配置文件") : undefined,
    styleRaw: input.styleRaw
      ? resolveInputPath(input.styleRaw, [".json"], "底层样式文件")
      : undefined,
    styleConfig: input.styleConfig
      ? resolveInputPath(input.styleConfig, [".json"], "语义化样式配置")
      : undefined,
  };
  if (sources.config) await loadConfig(sources.config);
  if (sources.styleRaw) loadStyleRaw(sources.styleRaw);
  if (sources.styleConfig) loadStyleConfig(sources.styleConfig);

  mkdirSync(paths.presetsDir, { recursive: true });
  const temporary = mkdtempSync(join(paths.presetsDir, `.save-${input.name}-`));
  const target = join(paths.presetsDir, input.name);
  const backup = join(paths.presetsDir, `.backup-${input.name}-${randomUUID()}`);
  let movedExisting = false;
  try {
    if (sources.config) copyFileSync(sources.config, join(temporary, "config.json"));
    if (sources.styleRaw) copyFileSync(sources.styleRaw, join(temporary, "style-raw.json"));
    if (sources.styleConfig) {
      copyFileSync(sources.styleConfig, join(temporary, "style-config.json"));
    }
    if (existsSync(target)) {
      if (!statSync(target).isDirectory()) throw new Error(`预设目标不是目录：${target}`);
      renameSync(target, backup);
      movedExisting = true;
    }
    renameSync(temporary, target);
    if (movedExisting) rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
    if (movedExisting && existsSync(backup) && !existsSync(target)) renameSync(backup, target);
    throw error;
  }
}

function defaultPresetFiles(): Omit<ResolvedPreset, "name"> {
  return {
    configPath: materializeDefaultConfig(),
    styleRawPath: materializeDefaultStyleRaw(),
    styleConfigPath: materializeDefaultStyleConfig(),
  };
}

async function validatePresetFiles(files: Omit<ResolvedPreset, "name">): Promise<void> {
  await loadConfig(files.configPath);
  loadStyleRaw(files.styleRawPath);
  loadStyleConfig(files.styleConfigPath);
}

function resolveOptionalPresetFile(directory: string, fileName: string, fallback: string): string {
  const path = join(directory, fileName);
  if (!existsSync(path)) return fallback;
  if (!statSync(path).isFile()) throw new Error(`预设配置不是文件：${path}`);
  return path;
}

function requireUserPresetDirectory(name: string, paths: PresetStoragePaths): string {
  const directory = join(paths.presetsDir, name);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new Error(
      `找不到预设：${name}\n用户预设目录：${directory}\n可执行 md2docx preset use default 恢复默认预设`,
    );
  }
  return directory;
}

function requireStoredPresetDirectory(name: string, paths: PresetStoragePaths): string {
  if (name === DEFAULT_PRESET_NAME) throw new Error("不能修改系统预设 default");
  if (!name || basename(name) !== name || name === "." || name === "..") {
    throw new Error("预设名称无效");
  }
  const root = resolve(paths.presetsDir);
  const directory = resolve(root, name);
  if (dirname(directory) !== root || !existsSync(directory)) throw new Error(`预设 ${name} 不存在`);
  const stats = lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`预设 ${name} 不是有效目录`);
  return directory;
}

function assertPresetName(name: string): void {
  if (!PRESET_NAME_PATTERN.test(name)) {
    throw new Error(`预设名称无效：${name}\n只允许字母、数字、- 和 _`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLegacyDesktopSettings(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 3 &&
    keys.every((key) => ["outputMode", "outputFolder", "conflictAction"].includes(key)) &&
    ["source", "folder", "ask"].includes(String(value.outputMode)) &&
    typeof value.outputFolder === "string" &&
    ["overwrite", "rename", "ask"].includes(String(value.conflictAction))
  );
}
