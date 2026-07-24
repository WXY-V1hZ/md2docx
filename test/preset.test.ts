import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  copyPreset,
  deletePreset,
  discoverPresets,
  readEditablePreset,
  readCurrentPresetName,
  renamePreset,
  resolvePreset,
  resolvePresetConfig,
  savePreset,
  updatePreset,
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

  it("旧版扁平桌面设置使用 default 预设", () => {
    const storage = createStorage();
    writeFileSync(
      storage.settingsPath,
      JSON.stringify({
        outputMode: "folder",
        outputFolder: "C:\\output",
        conflictAction: "rename",
      }),
      "utf-8",
    );

    expect(readCurrentPresetName(storage)).toBe("default");
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

  it("复制预设的自定义文件", async () => {
    const storage = createStorage();
    const source = join(storage.presetsDir, "academic");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "config.json"), DEFAULT_CONFIG_TEXT, "utf-8");

    await copyPreset("academic", "academic_copy", storage);

    expect(readFileSync(join(storage.presetsDir, "academic_copy", "config.json"), "utf-8")).toBe(
      DEFAULT_CONFIG_TEXT,
    );
    expect(existsSync(join(storage.presetsDir, "academic_copy", "style-raw.json"))).toBe(true);
    expect(existsSync(join(storage.presetsDir, "academic_copy", "style-config.json"))).toBe(true);
  });

  it("可以基于 default 创建完整用户预设", async () => {
    const storage = createStorage();

    await copyPreset("default", "custom", storage);

    const target = join(storage.presetsDir, "custom");
    expect(existsSync(join(target, "config.json"))).toBe(true);
    expect(existsSync(join(target, "style-raw.json"))).toBe(true);
    expect(existsSync(join(target, "style-config.json"))).toBe(true);
  });

  it("重命名当前预设后同步当前名称", async () => {
    const storage = createStorage();
    mkdirSync(join(storage.presetsDir, "academic"), { recursive: true });
    await usePreset("academic", storage);

    await renamePreset("academic", "paper", storage);

    expect(existsSync(join(storage.presetsDir, "academic"))).toBe(false);
    expect(existsSync(join(storage.presetsDir, "paper"))).toBe(true);
    expect(readCurrentPresetName(storage)).toBe("paper");
  });

  it("删除当前预设前切换到 default", async () => {
    const storage = createStorage();
    mkdirSync(join(storage.presetsDir, "academic"), { recursive: true });
    await usePreset("academic", storage);

    await deletePreset("academic", storage);

    expect(existsSync(join(storage.presetsDir, "academic"))).toBe(false);
    expect(readCurrentPresetName(storage)).toBe("default");
  });

  it("拒绝越过预设目录执行管理操作", async () => {
    const storage = createStorage();
    const outside = join(storage.presetsDir, "..", "outside");
    mkdirSync(outside, { recursive: true });

    expect(deletePreset("../outside", storage)).rejects.toThrow("预设名称无效");
    expect(renamePreset("../outside", "safe", storage)).rejects.toThrow("预设名称无效");
    expect(copyPreset("../outside", "safe", storage)).rejects.toThrow("预设名称无效");
    expect(existsSync(outside)).toBe(true);
  });

  it("读取继承不完整的用户预设时返回完整可编辑配置", async () => {
    const storage = createStorage();
    mkdirSync(join(storage.presetsDir, "partial"), { recursive: true });
    writeFileSync(
      join(storage.presetsDir, "partial", "style-config.json"),
      JSON.stringify({ schemaVersion: 1, options: { body: { lineSpacing: 2 } } }),
      "utf-8",
    );

    const preset = await readEditablePreset("partial", storage);

    expect(preset.config.renderMermaid.density).toBeGreaterThanOrEqual(72);
    expect(preset.styleConfig.options?.body?.lineSpacing).toBe(2);
    expect(preset.styleConfig.options?.headings?.["1"]?.bold).toBeBoolean();
  });

  it("更新用户预设写入配置并保留有效底层样式", async () => {
    const storage = createStorage();
    await copyPreset("default", "academic", storage);
    const beforeRaw = readFileSync(join(storage.presetsDir, "academic", "style-raw.json"), "utf-8");
    const editable = await readEditablePreset("academic", storage);
    editable.config.renderMermaid.density = 300;
    editable.styleConfig.options!.body!.lineSpacing = 2;

    await updatePreset(
      {
        sourceName: "academic",
        config: editable.config,
        styleConfig: editable.styleConfig,
      },
      storage,
    );

    expect((await readEditablePreset("academic", storage)).config.renderMermaid.density).toBe(300);
    expect(readFileSync(join(storage.presetsDir, "academic", "style-raw.json"), "utf-8")).toBe(
      beforeRaw,
    );
  });

  it("自定义 default 创建完整副本且拒绝非法字段", async () => {
    const storage = createStorage();
    const editable = await readEditablePreset("default", storage);
    editable.config.detectTitle.enabled = false;

    await updatePreset(
      {
        sourceName: "default",
        targetName: "custom",
        config: editable.config,
        styleConfig: editable.styleConfig,
      },
      storage,
    );

    expect((await readEditablePreset("default", storage)).config.detectTitle.enabled).toBe(true);
    expect((await readEditablePreset("custom", storage)).config.detectTitle.enabled).toBe(false);
    const invalid = structuredClone(editable.config) as PresetAppConfig & { unknown?: boolean };
    invalid.unknown = true;
    expect(
      updatePreset(
        {
          sourceName: "custom",
          config: invalid,
          styleConfig: editable.styleConfig,
        },
        storage,
      ),
    ).rejects.toThrow("不是支持的配置项");
  });
});

function dirnameOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
}
