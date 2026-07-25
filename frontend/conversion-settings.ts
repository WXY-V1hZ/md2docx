export type HeadingLevel = "1" | "2" | "3" | "4" | "5" | "6";

export interface ConversionEditorStyle {
  firstLineIndent: boolean;
  lineSpacing: number;
  startOnNewPage: boolean;
  alignment: "left" | "center";
  bold: Record<HeadingLevel, boolean>;
  italic: Record<HeadingLevel, boolean>;
  inlineCodeBackground: boolean;
  codeBlockBorder: boolean;
}

export interface ConversionEditorModel {
  config: PresetAppConfig;
  style: ConversionEditorStyle;
}

export interface ConversionWorkspaceSettings {
  schemaVersion: 1;
  preset: string;
  config: PresetAppConfig;
  styleConfig: PresetStyleConfig;
  collapsed: boolean;
}

export function toEditorModel(preset: EditablePreset): ConversionEditorModel {
  const headings = preset.styleConfig.options?.headings;
  return {
    config: structuredClone(preset.config),
    style: {
      firstLineIndent: preset.styleConfig.options?.body?.firstLineIndent ?? false,
      lineSpacing: preset.styleConfig.options?.body?.lineSpacing ?? 1.5,
      startOnNewPage: headings?.["1"]?.startOnNewPage ?? false,
      alignment: headings?.["1"]?.alignment ?? "left",
      bold: {
        "1": headings?.["1"]?.bold ?? true,
        "2": headings?.["2"]?.bold ?? true,
        "3": headings?.["3"]?.bold ?? true,
        "4": headings?.["4"]?.bold ?? true,
        "5": headings?.["5"]?.bold ?? true,
        "6": headings?.["6"]?.bold ?? true,
      },
      italic: {
        "1": false,
        "2": false,
        "3": false,
        "4": headings?.["4"]?.italic ?? false,
        "5": headings?.["5"]?.italic ?? false,
        "6": headings?.["6"]?.italic ?? false,
      },
      inlineCodeBackground: preset.styleConfig.options?.inlineCode?.background ?? true,
      codeBlockBorder: preset.styleConfig.options?.codeBlock?.border ?? true,
    },
  };
}

export function toStyleConfig(style: ConversionEditorStyle): PresetStyleConfig {
  return {
    schemaVersion: 1,
    options: {
      body: {
        firstLineIndent: style.firstLineIndent,
        lineSpacing: style.lineSpacing,
      },
      headings: {
        "1": {
          startOnNewPage: style.startOnNewPage,
          alignment: style.alignment,
          bold: style.bold["1"],
        },
        "2": { bold: style.bold["2"] },
        "3": { bold: style.bold["3"] },
        "4": { bold: style.bold["4"], italic: style.italic["4"] },
        "5": { bold: style.bold["5"], italic: style.italic["5"] },
        "6": { bold: style.bold["6"], italic: style.italic["6"] },
      },
      inlineCode: { background: style.inlineCodeBackground },
      codeBlock: { border: style.codeBlockBorder },
    },
  };
}

export function validationMessage(model: ConversionEditorModel | null): string {
  if (!model) return "";
  if (
    !Number.isInteger(model.config.renderMermaid.density) ||
    model.config.renderMermaid.density < 72
  ) {
    return "图表清晰度必须是不小于 72 的整数";
  }
  if (model.config.imageSize.maxWidthCm <= 0 || model.config.imageSize.maxHeightCm <= 0) {
    return "图片尺寸必须大于 0";
  }
  if (!Number.isFinite(model.style.lineSpacing) || model.style.lineSpacing <= 0) {
    return "正文行距必须大于 0";
  }
  return "";
}

export function toWorkspaceSettings(
  preset: string,
  model: ConversionEditorModel,
  collapsed: boolean,
): ConversionWorkspaceSettings {
  return {
    schemaVersion: 1,
    preset,
    config: cloneJson(model.config),
    styleConfig: toStyleConfig(model.style),
    collapsed,
  };
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
