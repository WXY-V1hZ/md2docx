export interface CaptionStyle {
  enabled: boolean;
  format: string;
  separator: string;
}

export interface NumberingConfig {
  figureCaption: CaptionStyle;
  tableCaption: CaptionStyle;
}

export const DEFAULT_CONFIG: NumberingConfig = {
  figureCaption: { enabled: true, format: "图 {n}", separator: "：" },
  tableCaption: { enabled: true, format: "表 {n}", separator: "" },
};
