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

export interface PandocConfig {
  enabled: boolean;
  outputName: string;
}

export interface AppConfig {
  figureCaption: CaptionStyle;
  tableCaption: CaptionStyle;
  normalizeHeadings: BooleanConfig;
  numberHeadings: HeadingNumberingConfig;
  renderMermaid: MermaidConfig;
  detectTitle: TitleConfig;
  pandoc: PandocConfig;
}

export async function loadConfig(path: string): Promise<AppConfig> {
  const exists = await Bun.file(path).exists();
  if (!exists) throw new Error(`找不到配置文件：${path}`);
  const raw = JSON.parse(await Bun.file(path).text()) as Record<string, unknown>;
  delete raw.$schema;
  return raw as unknown as AppConfig;
}
