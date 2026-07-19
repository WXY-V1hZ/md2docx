import { readFileSync } from "node:fs";

import { DEFAULT_STYLE_TEXT } from "../resources";
import { isStyleConfig, type StyleConfig, validateStyleConfig } from "./config";

export type WordStyleDefinition = Record<string, unknown>;

type StyleEntry = Record<string, unknown> & {
  id?: string;
  name?: string;
};

export function loadEffectiveStyles(stylePath: string): WordStyleDefinition {
  const source = parseJson(readFileSync(stylePath, "utf-8"), stylePath);
  if (!isStyleConfig(source)) return expectStyleDefinition(source, stylePath);

  const config = validateStyleConfig(source, stylePath);
  const preset = expectStyleDefinition(
    parseJson(DEFAULT_STYLE_TEXT, "内置默认样式"),
    "内置默认样式",
  );
  return compileStyleConfig(preset, config);
}

export function compileStyleConfig(
  preset: WordStyleDefinition,
  config: StyleConfig,
): WordStyleDefinition {
  const styles = structuredClone(preset);
  const options = config.options;
  if (!options) return styles;

  const firstLineIndent = options.body?.firstLineIndent;
  if (firstLineIndent !== undefined) applyBodyFirstLineIndent(styles, firstLineIndent);

  const startOnNewPage = options.headings?.["1"]?.startOnNewPage;
  if (startOnNewPage !== undefined) applyHeading1PageBreak(styles, startOnNewPage);

  const inlineCodeBackground = options.inlineCode?.background;
  if (inlineCodeBackground !== undefined) {
    applyInlineCodeBackground(styles, inlineCodeBackground);
  }

  const codeBlockBorder = options.codeBlock?.border;
  if (codeBlockBorder !== undefined) applyCodeBlockBorder(styles, codeBlockBorder);

  return styles;
}

function applyBodyFirstLineIndent(styles: WordStyleDefinition, enabled: boolean): void {
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

function applyHeading1PageBreak(styles: WordStyleDefinition, enabled: boolean): void {
  const heading1 = findStyle(styles, "paragraphStyles", "heading 1");
  ensureObject(heading1, "paragraph").pageBreakBefore = enabled;
}

function applyInlineCodeBackground(styles: WordStyleDefinition, enabled: boolean): void {
  const inlineCode = findStyle(styles, "characterStyles", "Inline Code");
  ensureObject(inlineCode, "run").shading = {
    type: "clear",
    color: enabled ? "F3F4F4" : "auto",
    fill: enabled ? "F2F2F2" : "auto",
  };
}

function applyCodeBlockBorder(styles: WordStyleDefinition, enabled: boolean): void {
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
  styles: WordStyleDefinition,
  collectionName: "paragraphStyles" | "characterStyles",
  name: string,
): StyleEntry {
  const collection = styles[collectionName];
  if (!Array.isArray(collection)) {
    throw new Error(`内置样式缺少 ${collectionName}，无法应用样式配置`);
  }
  const normalizedName = name.toLowerCase();
  const style = collection.find(
    (entry): entry is StyleEntry =>
      isRecord(entry) &&
      typeof entry.name === "string" &&
      entry.name.toLowerCase() === normalizedName,
  );
  if (!style) throw new Error(`内置样式缺少“${name}”，无法应用样式配置`);
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

function parseJson(text: string, path: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`样式文件不是有效的 JSON：${path}\n${message}`);
  }
}

function expectStyleDefinition(value: unknown, path: string): WordStyleDefinition {
  if (!isRecord(value)) throw new Error(`样式文件必须是 JSON 对象：${path}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
