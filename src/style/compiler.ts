import { readFileSync } from "node:fs";

import { materializeDefaultStyleConfig, materializeDefaultStyleRaw } from "../resources";
import { type StyleConfig, validateStyleConfig } from "./config";

export type RawStyleDefinition = Record<string, unknown>;

export interface StyleSources {
  styleRawPath?: string;
  styleConfigPath?: string;
}

export interface DefaultStyleSources {
  styleRawPath: string;
  styleConfigPath: string;
}

type StyleEntry = Record<string, unknown> & {
  id?: string;
  name?: string;
};

const HEADING_LEVELS = ["1", "2", "3", "4", "5", "6"] as const;

type CompilableHeadingOptions = {
  startOnNewPage?: boolean;
  alignment?: "left" | "center";
  bold?: boolean;
  italic?: boolean;
};

export function resolveEffectiveStyles(
  sources: StyleSources,
  defaults?: DefaultStyleSources,
): RawStyleDefinition {
  const rawPath = sources.styleRawPath ?? defaults?.styleRawPath ?? materializeDefaultStyleRaw();
  const rawStyle = loadStyleRaw(rawPath);

  if (sources.styleConfigPath) {
    return compileStyleConfig(rawStyle, loadStyleConfig(sources.styleConfigPath));
  }
  if (sources.styleRawPath) return rawStyle;
  const defaultConfigPath = defaults?.styleConfigPath ?? materializeDefaultStyleConfig();
  return compileStyleConfig(rawStyle, loadStyleConfig(defaultConfigPath));
}

export function loadStyleRaw(path: string): RawStyleDefinition {
  const source = parseJson(readFileSync(path, "utf-8"), path, "底层样式文件");
  if (!isRecord(source)) throw new Error(`底层样式文件必须是 JSON 对象：${path}`);
  if (looksLikeStyleConfig(source)) {
    throw new Error(
      `底层样式文件无效：${path}\n当前文件看起来是语义化样式配置，请改用 --style-config`,
    );
  }
  if (!looksLikeRawStyle(source)) {
    throw new Error(`底层样式文件无效：${path}\n缺少 Word 样式定义`);
  }
  return source;
}

export function loadStyleConfig(path: string): StyleConfig {
  const source = parseJson(readFileSync(path, "utf-8"), path, "语义化样式配置");
  if (isRecord(source) && looksLikeRawStyle(source)) {
    throw new Error(`语义化样式配置无效：${path}\n当前文件看起来是底层样式，请改用 --style-raw`);
  }
  return validateStyleConfig(source, path);
}

export function compileStyleConfig(
  rawStyle: RawStyleDefinition,
  config: StyleConfig,
): RawStyleDefinition {
  const styles = structuredClone(rawStyle);
  const options = config.options;
  if (!options) return styles;

  const firstLineIndent = options.body?.firstLineIndent;
  if (firstLineIndent !== undefined) applyBodyFirstLineIndent(styles, firstLineIndent);

  const lineSpacing = options.body?.lineSpacing;
  if (lineSpacing !== undefined) applyBodyLineSpacing(styles, lineSpacing);

  const startOnNewPage = options.headings?.["1"]?.startOnNewPage;
  if (startOnNewPage !== undefined) applyHeading1PageBreak(styles, startOnNewPage);

  const heading1Alignment = options.headings?.["1"]?.alignment;
  if (heading1Alignment !== undefined) applyHeading1Alignment(styles, heading1Alignment);

  for (const level of HEADING_LEVELS) {
    const heading = options.headings?.[level] as CompilableHeadingOptions | undefined;
    if (heading?.bold !== undefined) applyHeadingBold(styles, level, heading.bold);
    if (heading?.italic !== undefined) applyHeadingItalic(styles, level, heading.italic);
  }

  const inlineCodeBackground = options.inlineCode?.background;
  if (inlineCodeBackground !== undefined) {
    applyInlineCodeBackground(styles, inlineCodeBackground);
  }

  const codeBlockBorder = options.codeBlock?.border;
  if (codeBlockBorder !== undefined) applyCodeBlockBorder(styles, codeBlockBorder);

  return styles;
}

function applyBodyLineSpacing(styles: RawStyleDefinition, multiplier: number): void {
  const line = Math.round(multiplier * 240);
  for (const name of ["First Paragraph", "Body Text"]) {
    const style = findStyle(styles, "paragraphStyles", name);
    const paragraph = ensureObject(style, "paragraph");
    paragraph.spacing = {
      ...optionalObject(paragraph.spacing),
      line,
      lineRule: "auto",
    };
  }
}

function applyBodyFirstLineIndent(styles: RawStyleDefinition, enabled: boolean): void {
  const firstParagraph = findStyle(styles, "paragraphStyles", "First Paragraph");
  const bodyText = findStyle(styles, "paragraphStyles", "Body Text");

  for (const style of [firstParagraph, bodyText]) {
    const paragraph = ensureObject(style, "paragraph");
    paragraph.indent = {
      ...optionalObject(paragraph.indent),
      firstLine: enabled ? 200 : 0,
      firstLineChars: enabled ? 200 : 0,
    };
  }
}

function applyHeading1PageBreak(styles: RawStyleDefinition, enabled: boolean): void {
  const heading1 = findStyle(styles, "paragraphStyles", "heading 1");
  ensureObject(heading1, "paragraph").pageBreakBefore = enabled;
}

function applyHeading1Alignment(styles: RawStyleDefinition, alignment: "left" | "center"): void {
  const heading1 = findStyle(styles, "paragraphStyles", "heading 1");
  ensureObject(heading1, "paragraph").alignment = alignment;
}

function applyHeadingBold(styles: RawStyleDefinition, level: string, enabled: boolean): void {
  const heading = findStyle(styles, "paragraphStyles", `heading ${level}`);
  const run = ensureObject(heading, "run");
  run.bold = enabled;
  run.boldComplexScript = enabled;
}

function applyHeadingItalic(styles: RawStyleDefinition, level: string, enabled: boolean): void {
  const heading = findStyle(styles, "paragraphStyles", `heading ${level}`);
  const run = ensureObject(heading, "run");
  run.italics = enabled;
  run.italicsComplexScript = enabled;
}

function applyInlineCodeBackground(styles: RawStyleDefinition, enabled: boolean): void {
  const inlineCode = findStyle(styles, "characterStyles", "Inline Code");
  ensureObject(inlineCode, "run").shading = {
    type: "clear",
    color: enabled ? "F3F4F4" : "auto",
    fill: enabled ? "F2F2F2" : "auto",
  };
}

function applyCodeBlockBorder(styles: RawStyleDefinition, enabled: boolean): void {
  const sourceCode = findStyle(styles, "paragraphStyles", "Source Code");
  const border = (): Record<string, unknown> => ({
    style: enabled ? "single" : "none",
    color: enabled ? "BFBFBF" : "auto",
    size: enabled ? 8 : 0,
    space: enabled ? 10 : 0,
  });
  ensureObject(sourceCode, "paragraph").border = {
    top: border(),
    left: border(),
    bottom: border(),
    right: border(),
  };
}

function findStyle(
  styles: RawStyleDefinition,
  collectionName: "paragraphStyles" | "characterStyles",
  name: string,
): StyleEntry {
  const collection = styles[collectionName];
  if (!Array.isArray(collection)) {
    throw new Error(`底层样式缺少 ${collectionName}，无法应用语义化样式配置`);
  }
  const normalizedName = name.toLowerCase();
  const style = collection.find(
    (entry): entry is StyleEntry =>
      isRecord(entry) &&
      typeof entry.name === "string" &&
      entry.name.toLowerCase() === normalizedName,
  );
  if (!style) throw new Error(`底层样式缺少“${name}”，无法应用语义化样式配置`);
  return style;
}

function ensureObject(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const current = parent[key];
  if (isRecord(current)) return current;
  const created: Record<string, unknown> = {};
  parent[key] = created;
  return created;
}

function optionalObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function parseJson(text: string, path: string, kind: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${kind}不是有效的 JSON：${path}\n${message}`);
  }
}

function looksLikeStyleConfig(value: Record<string, unknown>): boolean {
  return "schemaVersion" in value || "options" in value || "preset" in value;
}

function looksLikeRawStyle(value: Record<string, unknown>): boolean {
  return ["default", "paragraphStyles", "characterStyles", "tableStyles", "tableStylesXml"].some(
    (key) => key in value,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
