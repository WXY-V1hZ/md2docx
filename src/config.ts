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

export const DEFAULT_CONFIG: AppConfig = {
  figureCaption: { enabled: true, format: "图 {n}", separator: "：" },
  tableCaption: { enabled: true, format: "表 {n}", separator: "" },
  normalizeHeadings: { enabled: true },
  numberHeadings: {
    enabled: true,
    detectExisting: true,
    useBuiltinRules: true,
  },
  renderMermaid: {
    enabled: true,
    outputDir: "{file_name}_assets",
    theme: "tokyo-night-light",
    density: 200,
    fileName: "mermaid_{n}",
  },
  title: {
    enabled: true,
    strategy: "first-h1",
  },
  pandoc: {
    enabled: true,
    outputName: "{file_name}.docx",
  },
};
