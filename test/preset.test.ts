import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  discoverPresets,
  readCurrentPresetName,
  resolvePreset,
  resolvePresetConfig,
  savePreset,
  usePreset,
  type PresetStoragePaths,
} from "../src/preset";
import {
  DEFAULT_CONFIG_TEXT,
  DEFAULT_STYLE_CONFIG_TEXT,
  DEFAULT_STYLE_RAW_TEXT,
} from "../src/resources";

const tempDirs: string[] = [];

function createStorage(): PresetStoragePaths {
  const root = mkdtempSync(join(tmpdir(), "md2docx-preset-"));
  tempDirs.push(root);
  return {
    presetsDir: join(root, "presets"),
    settingsPath: join(root, "settings.json"),
  };
}

function writeSource(root: string, name: string, content: string): string {
  const path = join(root, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("preset 解析", () => {
  it("设置不存在时使用内置 default", async () => {
    const storage = createStorage();
    expect(readCurrentPresetName(storage)).toBe("default");

    const preset = await resolvePreset(undefined, storage);
    expect(preset.name).toBe("default");
    expect(JSON.parse(readFileSync(preset.configPath, "utf-8"))).toBeObject();
  });

  it("用户预设逐文件继承 default", async () => {
    const storage = createStorage();
    const directory = join(storage.presetsDir, "academic");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "config.json"), DEFAULT_CONFIG_TEXT, "utf-8");

    const preset = await resolvePreset("academic", storage);
    expect(preset.configPath).toBe(join(directory, "config.json"));
    expect(preset.styleRawPath).not.toStartWith(directory);
    expect(preset.styleConfigPath).not.toStartWith(directory);
  });

  it("允许空预设目录并将全部文件继承 default", async () => {
    const storage = createStorage();
    mkdirSync(join(storage.presetsDir, "empty"), { recursive: true });

    const preset = await resolvePreset("empty", storage);
    expect(preset.name).toBe("empty");
    expect(preset.configPath).toContain("default");
    expect(preset.styleRawPath).toContain("default");
    expect(preset.styleConfigPath).toContain("default");
  });

  it("文件存在但无效时不回退", async () => {
    const storage = createStorage();
    const directory = join(storage.presetsDir, "broken");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "style-config.json"), "{}", "utf-8");

    expect(resolvePreset("broken", storage)).rejects.toThrow("样式配置无效");
  });

  it("只解析 format 配置时忽略无效样式文件", async () => {
    const storage = createStorage();
    const directory = join(storage.presetsDir, "format-only");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "style-config.json"), "{}", "utf-8");

    const preset = await resolvePresetConfig("format-only", storage);
    expect(JSON.parse(readFileSync(preset.configPath, "utf-8"))).toBeObject();
    expect(resolvePreset("format-only", storage)).rejects.toThrow("样式配置无效");
  });

  it("列出内置、有效和无效用户预设并标记当前项", async () => {
    const storage = createStorage();
    mkdirSync(join(storage.presetsDir, "academic"), { recursive: true });
    mkdirSync(join(storage.presetsDir, "bad.name"), { recursive: true });
    await usePreset("academic", storage);

    const presets = await discoverPresets(storage);
    expect(presets.find((preset) => preset.name === "default")?.source).toBe("builtin");
    expect(presets.find((preset) => preset.name === "academic")?.current).toBe(true);
    expect(presets.find((preset) => preset.name === "bad.name")?.valid).toBe(false);
  });
});

describe("preset save 和 use", () => {
  it("保存时复制文件，并在同名保存时完整替换", async () => {
    const storage = createStorage();
    const sources = dirnameOf(storage.settingsPath);
    const config = writeSource(sources, "source-config.json", DEFAULT_CONFIG_TEXT);
    const raw = writeSource(sources, "source-style-raw.json", DEFAULT_STYLE_RAW_TEXT);
    const styleConfig = writeSource(sources, "source-style-config.json", DEFAULT_STYLE_CONFIG_TEXT);

    await savePreset({ name: "academic", config, styleRaw: raw, styleConfig }, storage);
    writeFileSync(config, "changed", "utf-8");
    const target = join(storage.presetsDir, "academic");
    expect(readFileSync(join(target, "config.json"), "utf-8")).toBe(DEFAULT_CONFIG_TEXT);

    await savePreset({ name: "academic", styleConfig }, storage);
    expect(existsSync(join(target, "config.json"))).toBe(false);
    expect(existsSync(join(target, "style-raw.json"))).toBe(false);
    expect(existsSync(join(target, "style-config.json"))).toBe(true);
  });

  it("输入无效时保留已有预设", async () => {
    const storage = createStorage();
    const sources = dirnameOf(storage.settingsPath);
    const config = writeSource(sources, "source-config.json", DEFAULT_CONFIG_TEXT);
    await savePreset({ name: "academic", config }, storage);
    const invalid = writeSource(sources, "invalid-style-config.json", "{}\n");

    expect(savePreset({ name: "academic", styleConfig: invalid }, storage)).rejects.toThrow();
    expect(existsSync(join(storage.presetsDir, "academic", "config.json"))).toBe(true);
  });

  it("拒绝空保存、非法名称和 default", async () => {
    const storage = createStorage();
    expect(savePreset({ name: "empty" }, storage)).rejects.toThrow("至少需要");
    expect(savePreset({ name: "bad.name", config: "missing.json" }, storage)).rejects.toThrow(
      "预设名称无效",
    );
    expect(savePreset({ name: "default", config: "missing.json" }, storage)).rejects.toThrow(
      "不能保存或覆盖",
    );
  });

  it("持久化当前预设并能切换回 default", async () => {
    const storage = createStorage();
    mkdirSync(join(storage.presetsDir, "academic"), { recursive: true });
    await usePreset("academic", storage);
    expect(readCurrentPresetName(storage)).toBe("academic");

    await usePreset("default", storage);
    expect(readCurrentPresetName(storage)).toBe("default");
  });

  it("当前用户预设被删除后明确报错", async () => {
    const storage = createStorage();
    mkdirSync(join(storage.presetsDir, "academic"), { recursive: true });
    await usePreset("academic", storage);
    rmSync(join(storage.presetsDir, "academic"), { recursive: true });

    expect(resolvePreset(undefined, storage)).rejects.toThrow("preset use default");
  });
});

function dirnameOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
}
