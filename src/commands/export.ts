import { readFileSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { parse } from "node:path";

import { type ExportConfigOptions, type ExportStyleOptions } from "../cli";
import { CONFIG_PATH, STYLE_CONFIG } from "../paths";
import { prepareOutput, resolveInputPath, resolveOutputPath } from "../output";
import { extractStylesFromDocx } from "../style/extract";

export async function exportConfig(options: ExportConfigOptions): Promise<void> {
  const output = resolveOutputPath(options.output, "config.json", [".json"], "配置输出文件");
  prepareOutput(output, options.force ?? false);
  await copyFile(CONFIG_PATH, output);
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
    writeFileSync(output, readFileSync(STYLE_CONFIG));
  }
  console.log(`已导出样式：${output}`);
}
