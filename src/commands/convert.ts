import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, parse, resolve } from "node:path";

import { type ConvertOptions } from "../cli";
import { loadConfig } from "../config";
import { formattedMdPath, preprocessDir } from "../paths";
import { prepareOutput, resolveInputPath, resolveOutputPath } from "../output";
import { preprocess } from "../preprocess/index";
import {
  materializeDefaultConfig,
  materializeDefaultStyle,
  materializeLuaFilter,
} from "../resources";
import { ensureTemplateDocx } from "../style/generate";

export async function convertMarkdown(options: ConvertOptions): Promise<void> {
  if (!options.file) throw new Error("缺少必填参数：--file");
  const input = resolveInputPath(options.file, [".md", ".markdown"], "Markdown 文件");
  const configPath = options.config
    ? resolveInputPath(options.config, [".json"], "配置文件")
    : materializeDefaultConfig();
  const stylePath = options.style
    ? resolveInputPath(options.style, [".json"], "样式文件")
    : materializeDefaultStyle();
  const baseName = parse(input).name;
  const output = resolveOutputPath(options.output, `${baseName}.docx`, [".docx"], "DOCX 输出文件");
  prepareOutput(output, options.force ?? false);

  const config = await loadConfig(configPath);
  const outDir = preprocessDir(input);
  mkdirSync(outDir, { recursive: true });
  const formatted = await preprocess(input, config, outDir);
  const markdownOutput = formattedMdPath(input);
  writeFileSync(markdownOutput, formatted, "utf-8");

  const templatePath = await ensureTemplateDocx(stylePath);
  const luaFilter = materializeLuaFilter();
  const pandocArgs = [
    markdownOutput,
    "-o",
    output,
    ...buildPandocResourcePathArgs(input),
    `--reference-doc=${templatePath}`,
    ...(existsSync(luaFilter) ? [`--lua-filter=${luaFilter}`] : []),
  ];
  const { exitCode, stderr } = await runProcess("pandoc", pandocArgs);
  if (exitCode !== 0) {
    throw new Error(`pandoc 转换失败 (exit code ${exitCode})：${stderr.trim()}`);
  }
  console.log(`已生成：${output}`);
}

/**
 * Pandoc 从缓存 Markdown 读取内容，因此需要显式保留原文档和调用目录的资源搜索语义。
 * 后出现的 --resource-path 优先级更高，原始 Markdown 目录必须放在最后。
 */
export function buildPandocResourcePathArgs(
  inputPath: string,
  workingDirectory: string = process.cwd(),
): string[] {
  const workingDir = resolve(workingDirectory);
  const sourceDir = dirname(resolve(inputPath));
  const searchDirs = workingDir === sourceDir ? [sourceDir] : [workingDir, sourceDir];
  return searchDirs.map((directory) => `--resource-path=${directory}`);
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
