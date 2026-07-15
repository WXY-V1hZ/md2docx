import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { parse, resolve } from "node:path";

import { type ConvertOptions } from "../cli";
import { loadConfig } from "../config";
import { CONFIG_PATH, PKG_DIR, STYLE_CONFIG, formattedMdPath, preprocessDir } from "../paths";
import { prepareOutput, resolveInputPath, resolveOutputPath } from "../output";
import { preprocess } from "../preprocess/index";
import { ensureTemplateDocx } from "../style/generate";

export async function convertMarkdown(options: ConvertOptions): Promise<void> {
  if (!options.file) throw new Error("缺少必填参数：--file");
  const input = resolveInputPath(options.file, [".md", ".markdown"], "Markdown 文件");
  const configPath = options.config
    ? resolveInputPath(options.config, [".json"], "配置文件")
    : CONFIG_PATH;
  const stylePath = options.style
    ? resolveInputPath(options.style, [".json"], "样式文件")
    : STYLE_CONFIG;
  const baseName = parse(input).name;
  const output = resolveOutputPath(options.output, `${baseName}.docx`, [".docx"], "DOCX 输出文件");
  prepareOutput(output, options.force ?? false);

  const config = await loadConfig(configPath);
  const outDir = resolve(preprocessDir(baseName));
  mkdirSync(outDir, { recursive: true });
  const formatted = await preprocess(input, config, outDir);
  const markdownOutput = resolve(formattedMdPath(baseName));
  writeFileSync(markdownOutput, formatted, "utf-8");

  const templatePath = await ensureTemplateDocx(stylePath);
  const luaFilter = resolve(PKG_DIR, "config/lua/add-inline-code.lua");
  const pandocArgs = [
    markdownOutput,
    "-o",
    output,
    `--reference-doc=${templatePath}`,
    ...(existsSync(luaFilter) ? [`--lua-filter=${luaFilter}`] : []),
  ];
  const { exitCode, stderr } = await runProcess("pandoc", pandocArgs);
  if (exitCode !== 0) {
    throw new Error(`pandoc 转换失败 (exit code ${exitCode})：${stderr.trim()}`);
  }
  console.log(`已生成：${output}`);
}

function runProcess(
  command: string,
  args: string[],
): Promise<{ exitCode: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, stderr }));
  });
}
