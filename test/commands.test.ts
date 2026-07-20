import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  defaultStyleRawOutputName,
  exportConfig,
  exportStyleConfig,
  exportStyleRaw,
} from "../src/commands/export";
import { formatMarkdown } from "../src/commands/format";
import { cleanIntermediateFiles } from "../src/commands/clean";
import { buildImageSizePandocArgs, buildPandocResourcePathArgs } from "../src/commands/convert";
import { loadConfig } from "../src/config";
import { DEFAULT_CONFIG_TEXT, DEFAULT_STYLE_RAW_TEXT } from "../src/resources";
import { type RawStyleDefinition } from "../src/style/compiler";
import { generateTemplateDocx } from "../src/style/generate";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "md2docx-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("export 命令", () => {
  it("导出默认配置", async () => {
    const dir = createTempDir();
    const output = join(dir, "config.json");
    await exportConfig({ output });

    const config = JSON.parse(readFileSync(output, "utf-8")) as Record<string, unknown>;
    expect(config).not.toHaveProperty("pandoc");
    expect(config.$schema).toBeString();
    expect(config.imageSize).toEqual({ enabled: true, maxWidthCm: 15.5, maxHeightCm: 22 });
  });

  it("导出默认底层样式", async () => {
    const dir = createTempDir();
    const output = join(dir, "style-raw.json");
    await exportStyleRaw({ output });

    const style = JSON.parse(readFileSync(output, "utf-8")) as Record<string, unknown>;
    expect(style.default).toBeDefined();
  });

  it("导出默认语义化样式配置", async () => {
    const dir = createTempDir();
    const output = join(dir, "style-config.json");
    await exportStyleConfig({ output });

    const config = JSON.parse(readFileSync(output, "utf-8")) as Record<string, unknown>;
    expect(config.schemaVersion).toBe(1);
    expect(config.options).toBeDefined();
    expect(config).not.toHaveProperty("preset");
  });

  it("使用约定的底层样式默认文件名", () => {
    expect(defaultStyleRawOutputName()).toBe("style-raw.json");
    expect(defaultStyleRawOutputName("C:/docs/template.docx")).toBe("template_style-raw.json");
  });

  it("从 DOCX 提取底层样式", async () => {
    const dir = createTempDir();
    const input = join(dir, "template.docx");
    const output = join(dir, "template_style-raw.json");
    await generateTemplateDocx(JSON.parse(DEFAULT_STYLE_RAW_TEXT) as RawStyleDefinition, input);

    await exportStyleRaw({ file: input, output });
    const styles = JSON.parse(readFileSync(output, "utf-8")) as Record<string, unknown>;
    expect(styles.paragraphStyles).toBeArray();
  });

  it("默认覆盖已有文件", async () => {
    const dir = createTempDir();
    const output = join(dir, "config.json");
    writeFileSync(output, "existing", "utf-8");

    await exportConfig({ output });
    expect(JSON.parse(readFileSync(output, "utf-8"))).toBeObject();
  });
});

describe("clean 命令", () => {
  it("清除主目录下的 .md2docx 并允许重复执行", () => {
    const home = createTempDir();
    const target = join(home, ".md2docx");
    mkdirSync(join(target, "preprocess", "example"), { recursive: true });
    writeFileSync(join(target, "preprocess", "example", "input.md"), "test", "utf-8");

    cleanIntermediateFiles({ targetDir: target, homeDir: home });
    expect(existsSync(target)).toBe(false);

    cleanIntermediateFiles({ targetDir: target, homeDir: home });
    expect(existsSync(target)).toBe(false);
  });

  it("拒绝清理非预期目录", () => {
    const home = createTempDir();
    const target = join(home, "other");

    expect(() => cleanIntermediateFiles({ targetDir: target, homeDir: home })).toThrow(
      "拒绝清理非预期目录",
    );
  });
});

describe("format 命令", () => {
  it("格式化 Markdown 并写入指定文件", async () => {
    const dir = createTempDir();
    const input = join(dir, "input.md");
    const output = join(dir, "result.md");
    writeFileSync(input, "# 标题\n\n正文\n", "utf-8");

    await formatMarkdown({ file: input, output });

    expect(existsSync(output)).toBe(true);
    expect(readFileSync(output, "utf-8")).toContain('title: "标题"');
    expect(existsSync(join(dir, "result_assets"))).toBe(false);
  });

  it("标题回退只使用文件名", async () => {
    const dir = createTempDir();
    const input = join(dir, "报告.md");
    const output = join(dir, "result.md");
    writeFileSync(input, "正文\n", "utf-8");

    await formatMarkdown({ file: input, output });

    expect(readFileSync(output, "utf-8")).toContain('title: "报告"');
    expect(readFileSync(output, "utf-8")).not.toContain(dir);
  });

  it("默认覆盖已有 Markdown 输出", async () => {
    const dir = createTempDir();
    const input = join(dir, "input.md");
    const output = join(dir, "result.md");
    const assetsDir = join(dir, "result_assets");
    writeFileSync(input, "# 新标题\n", "utf-8");
    writeFileSync(output, "旧内容\n", "utf-8");
    mkdirSync(assetsDir);
    writeFileSync(join(assetsDir, "stale.txt"), "旧资源", "utf-8");

    await formatMarkdown({ file: input, output });

    expect(readFileSync(output, "utf-8")).toContain('title: "新标题"');
    expect(readFileSync(output, "utf-8")).not.toContain("旧内容");
    expect(existsSync(assetsDir)).toBe(false);
  });

  it("拒绝错误的输出扩展名", async () => {
    const dir = createTempDir();
    const input = join(dir, "input.md");
    writeFileSync(input, "正文\n", "utf-8");

    expect(formatMarkdown({ file: input, output: join(dir, "result.docx") })).rejects.toThrow(
      "Markdown 输出文件扩展名",
    );
  });
});

describe("配置校验", () => {
  it("报告无效配置的字段路径", async () => {
    const dir = createTempDir();
    const config = join(dir, "config.json");
    writeFileSync(config, JSON.stringify({ renderMermaid: { density: 20 } }), "utf-8");

    expect(loadConfig(config)).rejects.toThrow("位置：figureCaption");
  });

  it("报告无效 JSON", async () => {
    const dir = createTempDir();
    const config = join(dir, "config.json");
    writeFileSync(config, "{", "utf-8");

    expect(loadConfig(config)).rejects.toThrow("不是有效的 JSON");
  });

  it("拒绝非正数的图片尺寸限制", async () => {
    const dir = createTempDir();
    const path = join(dir, "config.json");
    const config = JSON.parse(DEFAULT_CONFIG_TEXT) as Record<string, Record<string, unknown>>;
    config.imageSize!.maxWidthCm = 0;
    writeFileSync(path, JSON.stringify(config), "utf-8");

    expect(loadConfig(path)).rejects.toThrow("位置：imageSize.maxWidthCm");
  });
});

describe("Pandoc 资源路径", () => {
  it("优先从原始 Markdown 目录解析相对资源", () => {
    const root = createTempDir();
    const workingDir = join(root, "working");
    const sourceDir = join(root, "docs");
    const input = join(sourceDir, "example.md");

    expect(buildPandocResourcePathArgs(input, workingDir)).toEqual([
      `--resource-path=${workingDir}`,
      `--resource-path=${sourceDir}`,
    ]);
  });

  it("源目录与工作目录相同时不重复添加", () => {
    const sourceDir = createTempDir();
    const input = join(sourceDir, "example.md");

    expect(buildPandocResourcePathArgs(input, sourceDir)).toEqual([`--resource-path=${sourceDir}`]);
  });
});

describe("Pandoc 图片尺寸参数", () => {
  it("启用时传递最大宽高和独立 Lua filter", () => {
    expect(
      buildImageSizePandocArgs(
        { enabled: true, maxWidthCm: 15.5, maxHeightCm: 22 },
        "limit-image-size.lua",
      ),
    ).toEqual([
      "--metadata=md2docx-image-max-width-cm:15.5",
      "--metadata=md2docx-image-max-height-cm:22",
      "--lua-filter=limit-image-size.lua",
    ]);
  });

  it("关闭时不传递图片尺寸参数", () => {
    expect(
      buildImageSizePandocArgs(
        { enabled: false, maxWidthCm: 15.5, maxHeightCm: 22 },
        "limit-image-size.lua",
      ),
    ).toEqual([]);
  });
});
