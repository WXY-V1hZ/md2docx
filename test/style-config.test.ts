import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PizZip from "pizzip";

import { DEFAULT_STYLE_CONFIG_TEXT, DEFAULT_STYLE_RAW_TEXT } from "../src/resources";
import {
  compileStyleConfig,
  loadStyleConfig,
  loadStyleRaw,
  resolveEffectiveStyles,
  type RawStyleDefinition,
} from "../src/style/compiler";
import { validateStyleConfig } from "../src/style/config";
import { generateTemplateDocx, styleCacheHash } from "../src/style/generate";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "md2docx-style-"));
  tempDirs.push(dir);
  return dir;
}

function defaultStyles(): RawStyleDefinition {
  return JSON.parse(DEFAULT_STYLE_RAW_TEXT) as RawStyleDefinition;
}

function styleByName(
  styles: RawStyleDefinition,
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

function heading1PageBreak(styles: RawStyleDefinition): boolean {
  const paragraph = objectAt(styleByName(styles, "paragraphStyles", "heading 1"), "paragraph");
  return paragraph.pageBreakBefore as boolean;
}

function setHeading1PageBreak(styles: RawStyleDefinition, enabled: boolean): void {
  const paragraph = objectAt(styleByName(styles, "paragraphStyles", "heading 1"), "paragraph");
  paragraph.pageBreakBefore = enabled;
}

function headingStyle(styles: RawStyleDefinition, level: number): Record<string, unknown> {
  return styleByName(styles, "paragraphStyles", `heading ${level}`);
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

describe("语义化样式配置", () => {
  it("内置默认语义化配置有效且不包含 preset", () => {
    const path = join(import.meta.dir, "..", "config", "style-config.json");
    const config = JSON.parse(readFileSync(path, "utf-8"));

    expect(validateStyleConfig(config, path)).toEqual(config);
    expect(JSON.parse(DEFAULT_STYLE_CONFIG_TEXT)).toEqual(config);
    expect(config).not.toHaveProperty("preset");
  });

  it("未提供选项时完整保留底层样式", () => {
    const rawStyle = defaultStyles();
    const compiled = compileStyleConfig(rawStyle, { schemaVersion: 1 });

    expect(compiled).toEqual(rawStyle);
    expect(compiled).not.toBe(rawStyle);
  });

  it("关闭正文首行缩进", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      options: { body: { firstLineIndent: false } },
    });

    for (const name of ["First Paragraph", "Body Text"]) {
      const paragraph = objectAt(styleByName(compiled, "paragraphStyles", name), "paragraph");
      expect(paragraph.indent).toMatchObject({ firstLine: 0, firstLineChars: 0 });
    }
  });

  it("设置正文行距倍数", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      options: { body: { lineSpacing: 1.5 } },
    });

    for (const name of ["First Paragraph", "Body Text"]) {
      const paragraph = objectAt(styleByName(compiled, "paragraphStyles", name), "paragraph");
      expect(paragraph.spacing).toMatchObject({ line: 360, lineRule: "auto" });
    }
  });

  it("关闭一级标题另起一页", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      options: { headings: { "1": { startOnNewPage: false } } },
    });

    expect(heading1PageBreak(compiled)).toBe(false);
  });

  it("设置一级标题左对齐或居中", () => {
    for (const alignment of ["left", "center"] as const) {
      const compiled = compileStyleConfig(defaultStyles(), {
        schemaVersion: 1,
        options: { headings: { "1": { alignment } } },
      });
      expect(objectAt(headingStyle(compiled, 1), "paragraph").alignment).toBe(alignment);
    }
  });

  it("显式设置一至六级标题粗体", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      options: {
        headings: {
          "1": { bold: false },
          "2": { bold: false },
          "3": { bold: false },
          "4": { bold: false },
          "5": { bold: false },
          "6": { bold: false },
        },
      },
    });

    for (let level = 1; level <= 6; level++) {
      const run = objectAt(headingStyle(compiled, level), "run");
      expect(run).toMatchObject({ bold: false, boldComplexScript: false });
    }
  });

  it("显式设置四至六级标题斜体", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      options: {
        headings: {
          "4": { italic: true },
          "5": { italic: true },
          "6": { italic: true },
        },
      },
    });

    for (let level = 4; level <= 6; level++) {
      const run = objectAt(headingStyle(compiled, level), "run");
      expect(run).toMatchObject({ italics: true, italicsComplexScript: true });
    }
  });

  it("关闭行内代码背景", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      options: { inlineCode: { background: false } },
    });
    const run = objectAt(styleByName(compiled, "characterStyles", "Inline Code"), "run");

    expect(run.shading).toEqual({ type: "clear", color: "auto", fill: "auto" });
  });

  it("关闭代码块外框", () => {
    const compiled = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
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

  it("启用选项时显式写入完整效果", () => {
    const rawStyle = defaultStyles();
    delete objectAt(styleByName(rawStyle, "paragraphStyles", "First Paragraph"), "paragraph")
      .indent;
    delete styleByName(rawStyle, "paragraphStyles", "Body Text").paragraph;
    delete objectAt(styleByName(rawStyle, "paragraphStyles", "heading 1"), "paragraph")
      .pageBreakBefore;
    delete objectAt(styleByName(rawStyle, "characterStyles", "Inline Code"), "run").shading;
    delete objectAt(styleByName(rawStyle, "paragraphStyles", "Source Code"), "paragraph").border;
    delete objectAt(styleByName(rawStyle, "paragraphStyles", "First Paragraph"), "paragraph")
      .spacing;
    delete objectAt(headingStyle(rawStyle, 1), "paragraph").alignment;
    for (let level = 1; level <= 6; level++) delete headingStyle(rawStyle, level).run;

    const compiled = compileStyleConfig(rawStyle, {
      schemaVersion: 1,
      options: {
        body: { firstLineIndent: true, lineSpacing: 1.5 },
        headings: {
          "1": { startOnNewPage: true, alignment: "left", bold: true },
          "2": { bold: true },
          "3": { bold: true },
          "4": { bold: true, italic: true },
          "5": { bold: true, italic: true },
          "6": { bold: true, italic: true },
        },
        inlineCode: { background: true },
        codeBlock: { border: true },
      },
    });

    for (const name of ["First Paragraph", "Body Text"]) {
      const paragraph = objectAt(styleByName(compiled, "paragraphStyles", name), "paragraph");
      expect(paragraph.indent).toMatchObject({ firstLine: 200, firstLineChars: 200 });
    }
    expect(
      objectAt(styleByName(compiled, "paragraphStyles", "First Paragraph"), "paragraph").spacing,
    ).toMatchObject({ line: 360, lineRule: "auto" });
    expect(heading1PageBreak(compiled)).toBe(true);
    expect(objectAt(headingStyle(compiled, 1), "paragraph").alignment).toBe("left");
    for (let level = 1; level <= 6; level++) {
      expect(objectAt(headingStyle(compiled, level), "run")).toMatchObject({
        bold: true,
        boldComplexScript: true,
      });
    }
    for (let level = 4; level <= 6; level++) {
      expect(objectAt(headingStyle(compiled, level), "run")).toMatchObject({
        italics: true,
        italicsComplexScript: true,
      });
    }
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
});

describe("样式输入组合", () => {
  function createSources() {
    const dir = createTempDir();
    const defaultRawPath = join(dir, "default-style-raw.json");
    const defaultConfigPath = join(dir, "default-style-config.json");
    writeFileSync(defaultRawPath, DEFAULT_STYLE_RAW_TEXT, "utf-8");
    writeFileSync(defaultConfigPath, DEFAULT_STYLE_CONFIG_TEXT, "utf-8");
    return {
      dir,
      defaults: { styleRawPath: defaultRawPath, styleConfigPath: defaultConfigPath },
    };
  }

  it("二者都不指定时应用默认 raw 和默认 config", () => {
    const { defaults } = createSources();
    expect(heading1PageBreak(resolveEffectiveStyles({}, defaults))).toBe(false);
  });

  it("仅指定 raw 时不应用默认 config", () => {
    const { dir, defaults } = createSources();
    const rawPath = join(dir, "custom-style-raw.json");
    const rawStyle = defaultStyles();
    setHeading1PageBreak(rawStyle, true);
    writeJson(rawPath, rawStyle);

    expect(heading1PageBreak(resolveEffectiveStyles({ styleRawPath: rawPath }, defaults))).toBe(
      true,
    );
  });

  it("仅指定 config 时应用到默认 raw", () => {
    const { dir, defaults } = createSources();
    const configPath = join(dir, "custom-style-config.json");
    writeJson(configPath, {
      schemaVersion: 1,
      options: { headings: { "1": { startOnNewPage: false } } },
    });

    expect(
      heading1PageBreak(resolveEffectiveStyles({ styleConfigPath: configPath }, defaults)),
    ).toBe(false);
  });

  it("同时指定 raw 和 config 时将 config 应用到用户 raw", () => {
    const { dir, defaults } = createSources();
    const rawPath = join(dir, "custom-style-raw.json");
    const configPath = join(dir, "custom-style-config.json");
    const rawStyle = defaultStyles();
    setHeading1PageBreak(rawStyle, false);
    writeJson(rawPath, rawStyle);
    writeJson(configPath, {
      schemaVersion: 1,
      options: { headings: { "1": { startOnNewPage: true } } },
    });

    expect(
      heading1PageBreak(
        resolveEffectiveStyles({ styleRawPath: rawPath, styleConfigPath: configPath }, defaults),
      ),
    ).toBe(true);
  });

  it("raw 和 config 传错入口时给出明确提示", () => {
    const { defaults } = createSources();

    expect(() => loadStyleRaw(defaults.styleConfigPath)).toThrow("请改用 --style-config");
    expect(() => loadStyleConfig(defaults.styleRawPath)).toThrow("请改用 --style-raw");
  });
});

describe("样式生成与校验", () => {
  it("可以用编译后的样式生成带代码块外框的 reference DOCX", async () => {
    const outputPath = join(createTempDir(), "reference.docx");
    const styles = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      options: { codeBlock: { border: true } },
    });

    await generateTemplateDocx(styles, outputPath);
    expect(existsSync(outputPath)).toBe(true);

    const stylesXml = new PizZip(readFileSync(outputPath)).file("word/styles.xml")?.asText();
    const sourceCodeStyle = stylesXml?.match(
      /<w:style[^>]*w:styleId="SourceCode"[\s\S]*?<\/w:style>/,
    )?.[0];
    expect(sourceCodeStyle).toContain("<w:pBdr>");
    expect(sourceCodeStyle).toContain('w:val="single"');
  });

  it("将标题和正文语义化选项写入 reference DOCX XML", async () => {
    const outputPath = join(createTempDir(), "reference.docx");
    const styles = compileStyleConfig(defaultStyles(), {
      schemaVersion: 1,
      options: {
        body: { lineSpacing: 1.5 },
        headings: {
          "1": { alignment: "left", bold: false },
          "4": { italic: true },
        },
      },
    });

    await generateTemplateDocx(styles, outputPath);
    const stylesXml = new PizZip(readFileSync(outputPath)).file("word/styles.xml")?.asText();
    expect(stylesXml).toBeDefined();
    const styleBlocks = stylesXml!.match(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/g) ?? [];
    const byName = (name: string) =>
      styleBlocks.find((block) => block.includes(`<w:name w:val="${name}"/>`));

    expect(byName("First Paragraph")).toContain('w:line="360"');
    expect(byName("heading 1")).toContain('<w:jc w:val="left"/>');
    expect(byName("heading 1")).toContain('<w:b w:val="false"/>');
    expect(byName("heading 4")).toContain("<w:i/>");
    expect(byName("heading 4")).toContain("<w:iCs/>");
  });

  it("缓存哈希只取决于最终有效样式", () => {
    const rawStyle = defaultStyles();
    const equivalent = structuredClone(rawStyle);
    const changed = compileStyleConfig(rawStyle, {
      schemaVersion: 1,
      options: { codeBlock: { border: false } },
    });

    expect(styleCacheHash(equivalent)).toBe(styleCacheHash(rawStyle));
    expect(styleCacheHash(changed)).not.toBe(styleCacheHash(rawStyle));
  });

  it("拒绝 preset、未开放字段和错误类型", () => {
    expect(() =>
      validateStyleConfig({ schemaVersion: 1, preset: "default" }, "style-config.json"),
    ).toThrow("位置：样式配置.preset");
    expect(() =>
      validateStyleConfig(
        { schemaVersion: 1, options: { codeBlock: { borderColor: "#000000" } } },
        "style-config.json",
      ),
    ).toThrow("位置：options.codeBlock.borderColor");
    expect(() =>
      validateStyleConfig(
        { schemaVersion: 1, options: { body: { firstLineIndent: "yes" } } },
        "style-config.json",
      ),
    ).toThrow("位置：options.body.firstLineIndent");
    expect(() =>
      validateStyleConfig(
        { schemaVersion: 1, options: { body: { lineSpacing: 0 } } },
        "style-config.json",
      ),
    ).toThrow("位置：options.body.lineSpacing");
    expect(() =>
      validateStyleConfig(
        { schemaVersion: 1, options: { headings: { "1": { alignment: "right" } } } },
        "style-config.json",
      ),
    ).toThrow('位置：options.headings["1"].alignment');
    expect(() =>
      validateStyleConfig(
        { schemaVersion: 1, options: { headings: { "3": { italic: true } } } },
        "style-config.json",
      ),
    ).toThrow('位置：options.headings["3"].italic');
  });
});
