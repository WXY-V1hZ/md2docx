import { access, readFile } from "node:fs/promises";

export interface CaptionStyle {
  enabled: boolean;
  format: string;
  separator: string;
}

export interface MermaidConfig {
  enabled: boolean;
  theme: string;
  density: number;
}

export interface ImageSizeConfig {
  enabled: boolean;
  maxWidthCm: number;
  maxHeightCm: number;
}

export interface BooleanConfig {
  enabled: boolean;
}

export interface HeadingNumberingConfig {
  enabled: boolean;
  detectExisting: boolean;
  existingPattern?: string;
  useBuiltinRules?: boolean;
}

export type TitleExtractStrategy = "first-h1" | "single-h1" | "filename" | "none";

export interface TitleConfig {
  enabled: boolean;
  strategy: TitleExtractStrategy;
}

export interface AppConfig {
  figureCaption: CaptionStyle;
  tableCaption: CaptionStyle;
  normalizeHeadings: BooleanConfig;
  numberHeadings: HeadingNumberingConfig;
  renderMermaid: MermaidConfig;
  imageSize: ImageSizeConfig;
  detectTitle: TitleConfig;
  removeThematicBreaks: BooleanConfig;
}

export async function loadConfig(path: string): Promise<AppConfig> {
  try {
    await access(path);
  } catch {
    throw new Error(`找不到配置文件：${path}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`配置文件不是有效的 JSON：${path}\n${message}`);
  }
  validateConfig(raw, path);
  delete raw.$schema;
  return raw as AppConfig;
}

function validateConfig(
  value: unknown,
  path: string,
): asserts value is AppConfig & Record<string, unknown> {
  const root = expectRecord(value, path, "配置");
  validateCaption(root.figureCaption, path, "figureCaption");
  validateCaption(root.tableCaption, path, "tableCaption");
  validateEnabled(root.normalizeHeadings, path, "normalizeHeadings");

  const numbering = expectRecord(root.numberHeadings, path, "numberHeadings");
  expectBoolean(numbering.enabled, path, "numberHeadings.enabled");
  expectBoolean(numbering.detectExisting, path, "numberHeadings.detectExisting");
  if (numbering.existingPattern !== undefined) {
    expectString(numbering.existingPattern, path, "numberHeadings.existingPattern");
  }
  if (numbering.useBuiltinRules !== undefined) {
    expectBoolean(numbering.useBuiltinRules, path, "numberHeadings.useBuiltinRules");
  }

  const mermaid = expectRecord(root.renderMermaid, path, "renderMermaid");
  expectBoolean(mermaid.enabled, path, "renderMermaid.enabled");
  expectString(mermaid.theme, path, "renderMermaid.theme");
  if (!Number.isInteger(mermaid.density) || (mermaid.density as number) < 72) {
    invalidConfig(path, "renderMermaid.density", "必须是不小于 72 的整数");
  }

  const imageSize = expectRecord(root.imageSize, path, "imageSize");
  expectBoolean(imageSize.enabled, path, "imageSize.enabled");
  expectPositiveNumber(imageSize.maxWidthCm, path, "imageSize.maxWidthCm");
  expectPositiveNumber(imageSize.maxHeightCm, path, "imageSize.maxHeightCm");

  validateEnabled(root.removeThematicBreaks, path, "removeThematicBreaks");

  const title = expectRecord(root.detectTitle, path, "detectTitle");
  expectBoolean(title.enabled, path, "detectTitle.enabled");
  const strategy = expectString(title.strategy, path, "detectTitle.strategy");
  if (!["first-h1", "single-h1", "filename", "none"].includes(strategy)) {
    invalidConfig(path, "detectTitle.strategy", "不是支持的标题提取策略");
  }
}

function validateCaption(value: unknown, path: string, field: string): void {
  const caption = expectRecord(value, path, field);
  expectBoolean(caption.enabled, path, `${field}.enabled`);
  expectString(caption.format, path, `${field}.format`);
  expectString(caption.separator, path, `${field}.separator`);
}

function validateEnabled(value: unknown, path: string, field: string): void {
  const config = expectRecord(value, path, field);
  expectBoolean(config.enabled, path, `${field}.enabled`);
}

function expectRecord(value: unknown, path: string, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalidConfig(path, field, "必须是对象");
  }
  return value as Record<string, unknown>;
}

function expectBoolean(value: unknown, path: string, field: string): boolean {
  if (typeof value !== "boolean") invalidConfig(path, field, "必须是 boolean");
  return value;
}

function expectString(value: unknown, path: string, field: string): string {
  if (typeof value !== "string") invalidConfig(path, field, "必须是字符串");
  return value;
}

function expectPositiveNumber(value: unknown, path: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    invalidConfig(path, field, "必须是大于 0 的有限数字");
  }
  return value;
}

function invalidConfig(path: string, field: string, reason: string): never {
  throw new Error(`配置文件无效：${path}\n位置：${field}\n原因：${reason}`);
}
