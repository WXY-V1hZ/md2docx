import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { exportConfig, exportStyle } from "../src/commands/export";
import { formatMarkdown } from "../src/commands/format";
import { cleanIntermediateFiles } from "../src/commands/clean";
import { loadConfig } from "../src/config";

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
  });

  it("导出默认样式", async () => {
    const dir = createTempDir();
    const output = join(dir, "style.json");
    await exportStyle({ output });

    const style = JSON.parse(readFileSync(output, "utf-8")) as Record<string, unknown>;
    expect(style.default).toBeDefined();
  });

  it("默认拒绝覆盖并允许 --force", async () => {
    const dir = createTempDir();
    const output = join(dir, "config.json");
    writeFileSync(output, "existing", "utf-8");

    expect(exportConfig({ output })).rejects.toThrow("输出文件已存在");
    await exportConfig({ output, force: true });
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
});
