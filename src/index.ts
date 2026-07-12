#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "fs";
import { dirname, parse, resolve } from "path";
import { $ } from "bun";

import { applyConfigOverrides, formatHelp, getConfigOptions, parseCliArgs } from "./cli";
import { loadConfig } from "./config";
import { CONFIG_PATH, CONFIG_SCHEMA_PATH, PKG_DIR, formattedMdPath, preprocessDir } from "./paths";
import { preprocess } from "./preprocess/index";
import { startWebEditor } from "./web";

export async function run(args: string[]): Promise<number> {
  try {
    const schema = JSON.parse(await Bun.file(CONFIG_SCHEMA_PATH).text());
    const configOptions = getConfigOptions(schema);
    const cli = parseCliArgs(args, configOptions);

    if (cli.version) {
      const { version } = JSON.parse(await Bun.file(resolve(PKG_DIR, "package.json")).text()) as {
        version: string;
      };
      console.log(`@v1hz/md2docx v${version}`);
      return 0;
    }
    if (cli.help) {
      console.log(formatHelp(configOptions));
      return 0;
    }
    if (cli.web) {
      await startWebEditor();
      return 0;
    }

    const mdPath = resolve(cli.mdPath!);
    if (!(await Bun.file(mdPath).exists())) throw new Error(`找不到 Markdown 文件：${mdPath}`);

    const config = await loadConfig(cli.configPath ?? CONFIG_PATH);
    const cfg = applyConfigOverrides(config, cli.overrides);
    const baseName = parse(mdPath).name;
    const outDir = preprocessDir(baseName);
    mkdirSync(outDir, { recursive: true });

    const formattedMd = await preprocess(mdPath, cfg, outDir);
    const mdOutput = formattedMdPath(baseName);
    writeFileSync(mdOutput, formattedMd, "utf-8");

    if (cfg.pandoc.enabled) {
      const configuredName = cfg.pandoc.outputName.replaceAll("{file_name}", baseName);
      const docxOutput = resolve(cli.outputPath ?? configuredName);
      mkdirSync(dirname(docxOutput), { recursive: true });
      const result = await $`pandoc ${mdOutput} -o ${docxOutput}`.nothrow();
      if (result.exitCode !== 0) {
        console.error(`pandoc 转换失败 (exit code ${result.exitCode}):`, result.stderr.toString());
        return 1;
      }
      console.log(`已生成：${docxOutput}`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`错误：${message}`);
    console.error("使用 --help 查看帮助");
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await run(Bun.argv.slice(2));
}
