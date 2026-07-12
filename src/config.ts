export interface CaptionStyle {
  enabled: boolean;
  format: string;
  separator: string;
}

export interface MermaidConfig {
  enabled: boolean;
  outputDir: string;
  theme: string;
  density: number;
  fileName: string;
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
  title: TitleConfig;
  pandoc: PandocConfig;
}

export async function loadConfig(path: string): Promise<AppConfig> {
  const exists = await Bun.file(path).exists();
  if (exists) {
    const raw = JSON.parse(await Bun.file(path).text());
    delete raw.$schema;
    return raw as AppConfig;
  }
  return JSON.parse(await Bun.file("config.json").text()) as AppConfig;
}
