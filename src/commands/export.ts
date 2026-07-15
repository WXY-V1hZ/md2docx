import { writeFileSync } from "node:fs";
import { parse } from "node:path";

import { type ExportConfigOptions, type ExportStyleOptions } from "../cli";
import { prepareOutput, resolveInputPath, resolveOutputPath } from "../output";
import { DEFAULT_CONFIG_TEXT, DEFAULT_STYLE_TEXT } from "../resources";
import { extractStylesFromDocx } from "../style/extract";

export async function exportConfig(options: ExportConfigOptions): Promise<void> {
  const output = resolveOutputPath(options.output, "config.json", [".json"], "配置输出文件");
  prepareOutput(output, options.force ?? false);
  writeFileSync(output, DEFAULT_CONFIG_TEXT, "utf-8");
  console.log(`已导出配置：${output}`);
}

export async function exportStyle(options: ExportStyleOptions): Promise<void> {
  const source = options.file ? resolveInputPath(options.file, [".docx"], "DOCX 文件") : undefined;
  const defaultName = source ? `${parse(source).name}_style.json` : "style.json";
  const output = resolveOutputPath(options.output, defaultName, [".json"], "样式输出文件");
  prepareOutput(output, options.force ?? false);

  if (source) {
    const styles = extractStylesFromDocx(source);
    writeFileSync(output, `${JSON.stringify(styles, null, 2)}\n`, "utf-8");
  } else {
    writeFileSync(output, DEFAULT_STYLE_TEXT, "utf-8");
  }
  console.log(`已导出样式：${output}`);
}
