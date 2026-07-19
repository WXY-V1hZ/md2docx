import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PizZip from "pizzip";

import { DEFAULT_STYLE_CONFIG_TEXT, DEFAULT_STYLE_TEXT } from "../src/resources";
import {
  compileStyleConfig,
  loadEffectiveStyles,
  type WordStyleDefinition,
} from "../src/style/compiler";
import { validateStyleConfig } from "../src/style/config";
import { generateTemplateDocx } from "../src/style/generate";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "md2docx-style-"));
  tempDirs.push(dir);
  return dir;
}

function defaultStyles(): WordStyleDefinition {
  return JSON.parse(DEFAULT_STYLE_TEXT) as WordStyleDefinition;
}

function styleByName(
  styles: WordStyleDefinition,
  collection: "paragraphStyles" | "characterStyles",
  name: string,
): Record<string, unknown> {
  const entries = styles[collection] as Record<string, unknown>[];
  const style = entries.find((entry) => entry.name === name);
  if (!style) throw new Error(`测试样式不存在：${name}`);
  return style;
}

function objectAt(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  return parent[key] as Record<string, unknown>;
}

describe("语义化样式配置", () => {
  it("内置默认语义化配置有效", () => {
    const path = join(import.meta.dir, "..", "config", "style-config.json");
    const config = JSON.parse(readFileSync(path, "utf-8"));

    expect(validateStyleConfig(config, path)).toEqual(config);
    expect(JSON.parse(DEFAULT_STYLE_CONFIG_TEXT)).toEqual(config);
  });

  it("未提供选项时完整保留预设", () => {
    const preset = defaultStyles();
    const compiled = compileStyleConfig(preset, { schemaVersion: 1, preset: "default" });

    expect(compiled).toEqual(preset);
    expect(compiled).not.toBe(preset);
  });

  it("关闭正文首行缩进", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      preset: "default",
      options: { body: { firstLineIndent: false } },
    });

    for (const name of ["First Paragraph", "Body Text"]) {
      const paragraph = objectAt(styleByName(compiled, "paragraphStyles", name), "paragraph");
      expect(paragraph.indent).toMatchObject({ firstLine: 0, firstLineChars: 0 });
    }
  });

  it("关闭一级标题另起一页", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      preset: "default",
      options: { headings: { "1": { startOnNewPage: false } } },
    });
    const paragraph = objectAt(styleByName(compiled, "paragraphStyles", "heading 1"), "paragraph");

    expect(paragraph.pageBreakBefore).toBe(false);
  });

  it("关闭行内代码背景", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      preset: "default",
      options: { inlineCode: { background: false } },
    });
    const run = objectAt(styleByName(compiled, "characterStyles", "Inline Code"), "run");

    expect(run.shading).toEqual({ type: "clear", color: "auto", fill: "auto" });
  });

  it("关闭代码块外框", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      preset: "default",
      options: { codeBlock: { border: false } },
    });
    const paragraph = objectAt(
      styleByName(compiled, "paragraphStyles", "Source Code"),
      "paragraph",
    );
    const border = paragraph.border as Record<string, Record<string, unknown>>;

    for (const side of ["top", "left", "bottom", "right"]) {
      expect(border[side]).toMatchObject({ style: "none", size: 0, space: 0 });
    }
  });

  it("启用选项时显式写入预设效果", () => {
    const preset = defaultStyles();
    delete objectAt(styleByName(preset, "paragraphStyles", "First Paragraph"), "paragraph").indent;
    delete styleByName(preset, "paragraphStyles", "Body Text").paragraph;
    delete objectAt(styleByName(preset, "paragraphStyles", "heading 1"), "paragraph")
      .pageBreakBefore;
    delete objectAt(styleByName(preset, "characterStyles", "Inline Code"), "run").shading;
    delete objectAt(styleByName(preset, "paragraphStyles", "Source Code"), "paragraph").border;

    const compiled = compileStyleConfig(preset, {
      schemaVersion: 1,
      preset: "default",
      options: {
        body: { firstLineIndent: true },
        headings: { "1": { startOnNewPage: true } },
        inlineCode: { background: true },
        codeBlock: { border: true },
      },
    });

    for (const name of ["First Paragraph", "Body Text"]) {
      const paragraph = objectAt(styleByName(compiled, "paragraphStyles", name), "paragraph");
      expect(paragraph.indent).toMatchObject({ firstLine: 200, firstLineChars: 200 });
    }
    const heading = objectAt(styleByName(compiled, "paragraphStyles", "heading 1"), "paragraph");
    expect(heading.pageBreakBefore).toBe(true);
    const inlineRun = objectAt(styleByName(compiled, "characterStyles", "Inline Code"), "run");
    expect(inlineRun.shading).toEqual({ type: "clear", color: "F3F4F4", fill: "F2F2F2" });
    const codeParagraph = objectAt(
      styleByName(compiled, "paragraphStyles", "Source Code"),
      "paragraph",
    );
    const codeBorder = codeParagraph.border as Record<string, Record<string, unknown>>;
    for (const side of ["top", "left", "bottom", "right"]) {
      expect(codeBorder[side]).toMatchObject({
        style: "single",
        color: "BFBFBF",
        size: 8,
        space: 10,
      });
    }
  });

  it("从 --style 文件识别并编译语义化配置", () => {
    const path = join(createTempDir(), "style-config.json");
    writeFileSync(
      path,
      JSON.stringify({
        schemaVersion: 1,
        preset: "default",
        options: { headings: { "1": { startOnNewPage: false } } },
      }),
      "utf-8",
    );

    const styles = loadEffectiveStyles(path);
    const paragraph = objectAt(styleByName(styles, "paragraphStyles", "heading 1"), "paragraph");
    expect(paragraph.pageBreakBefore).toBe(false);
  });

  it("继续接受原有完整底层样式文件", () => {
    const path = join(createTempDir(), "style.json");
    writeFileSync(path, DEFAULT_STYLE_TEXT, "utf-8");

    expect(loadEffectiveStyles(path)).toEqual(defaultStyles());
  });

  it("可以用语义化配置生成 reference DOCX", async () => {
    const dir = createTempDir();
    const configPath = join(dir, "style-config.json");
    const outputPath = join(dir, "reference.docx");
    writeFileSync(
      configPath,
      JSON.stringify({
        schemaVersion: 1,
        preset: "default",
        options: {
          body: { firstLineIndent: false },
          headings: { "1": { startOnNewPage: false } },
          inlineCode: { background: false },
          codeBlock: { border: true },
        },
      }),
      "utf-8",
    );

    await generateTemplateDocx(configPath, outputPath);
    expect(existsSync(outputPath)).toBe(true);

    const stylesXml = new PizZip(readFileSync(outputPath)).file("word/styles.xml")?.asText();
    expect(stylesXml).toBeString();
    const sourceCodeStyle = stylesXml?.match(
      /<w:style[^>]*w:styleId="SourceCode"[\s\S]*?<\/w:style>/,
    )?.[0];
    expect(sourceCodeStyle).toContain("<w:pBdr>");
    expect(sourceCodeStyle).toContain('w:val="single"');
  });

  it("拒绝未开放字段并报告路径", () => {
    expect(() =>
      validateStyleConfig(
        {
          schemaVersion: 1,
          preset: "default",
          options: { codeBlock: { borderColor: "#000000" } },
        },
        "style-config.json",
      ),
    ).toThrow("位置：options.codeBlock.borderColor");
  });

  it("拒绝错误的选项类型", () => {
    expect(() =>
      validateStyleConfig(
        {
          schemaVersion: 1,
          preset: "default",
          options: { body: { firstLineIndent: "yes" } },
        },
        "style-config.json",
      ),
    ).toThrow("位置：options.body.firstLineIndent");
  });
});
