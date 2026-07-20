import { writeFileSync } from "node:fs";
import { parse } from "node:path";

import {
  type ExportConfigOptions,
  type ExportStyleConfigOptions,
  type ExportStyleRawOptions,
} from "../cli";
import { prepareOutput, resolveInputPath, resolveOutputPath } from "../output";
import {
  DEFAULT_CONFIG_TEXT,
  DEFAULT_STYLE_CONFIG_TEXT,
  DEFAULT_STYLE_RAW_TEXT,
} from "../resources";
import { extractStylesFromDocx } from "../style/extract";

export async function exportConfig(options: ExportConfigOptions): Promise<void> {
  const output = resolveOutputPath(options.output, "config.json", [".json"], "配置输出文件");
  prepareOutput(output);
  writeFileSync(output, DEFAULT_CONFIG_TEXT, "utf-8");
  console.log(`已导出配置：${output}`);
}

export async function exportStyleRaw(options: ExportStyleRawOptions): Promise<void> {
  const source = options.file ? resolveInputPath(options.file, [".docx"], "DOCX 文件") : undefined;
  const defaultName = defaultStyleRawOutputName(source);
  const output = resolveOutputPath(options.output, defaultName, [".json"], "底层样式输出文件");
  prepareOutput(output);

  if (source) {
    const styles = extractStylesFromDocx(source);
    writeFileSync(output, `${JSON.stringify(styles, null, 2)}\n`, "utf-8");
  } else {
    writeFileSync(output, DEFAULT_STYLE_RAW_TEXT, "utf-8");
  }
  console.log(`已导出底层样式：${output}`);
}

export function defaultStyleRawOutputName(source?: string): string {
  return source ? `${parse(source).name}_style-raw.json` : "style-raw.json";
}

export async function exportStyleConfig(options: ExportStyleConfigOptions): Promise<void> {
  const output = resolveOutputPath(
    options.output,
    "style-config.json",
    [".json"],
    "语义化样式配置输出文件",
  );
  prepareOutput(output);
  writeFileSync(output, DEFAULT_STYLE_CONFIG_TEXT, "utf-8");
  console.log(`已导出语义化样式配置：${output}`);
}
