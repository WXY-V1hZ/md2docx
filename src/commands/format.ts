import { existsSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, parse, resolve } from "node:path";

import { type FormatOptions } from "../cli";
import { loadConfig } from "../config";
import { prepareOutput, resolveInputPath, resolveOutputPath } from "../output";
import { resolvePresetConfig } from "../preset";
import { preprocess } from "../preprocess/index";

export async function formatMarkdown(options: FormatOptions): Promise<void> {
  const input = resolveInputPath(options.file, [".md", ".markdown"], "Markdown 文件");
  const preset = await resolvePresetConfig(options.preset);
  const configPath = options.config
    ? resolveInputPath(options.config, [".json"], "配置文件")
    : preset.configPath;
  const defaultName = `${parse(input).name}_formatted.md`;
  const output = resolveOutputPath(
    options.output,
    defaultName,
    [".md", ".markdown"],
    "Markdown 输出文件",
  );
  prepareOutput(output);

  const config = await loadConfig(configPath);
  const outputName = parse(output).name;
  const assetsName = `${outputName}_assets`;
  const assetsDir = resolve(dirname(output), assetsName);
  if (config.renderMermaid.enabled && existsSync(assetsDir)) {
    const parent = resolve(dirname(output));
    if (dirname(assetsDir) !== parent) throw new Error(`拒绝清理非输出目录：${assetsDir}`);
    rmSync(assetsDir, { recursive: true, force: true });
  }

  const formatted = await preprocess(input, config, assetsDir, basename(assetsDir));
  writeFileSync(output, formatted, "utf-8");
  console.log(`已格式化：${output}`);
}
