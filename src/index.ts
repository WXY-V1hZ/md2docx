#!/usr/bin/env bun

import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, parse, resolve } from "path";
import { $ } from "bun";

import { applyConfigOverrides, formatHelp, getConfigOptions, parseCliArgs } from "./cli";
import { loadConfig } from "./config";
import {
  CONFIG_PATH,
  CONFIG_SCHEMA_PATH,
  PKG_DIR,
  STYLE_CONFIG,
  TMP_DIR,
  formattedMdPath,
  preprocessDir,
} from "./paths";
import { preprocess } from "./preprocess/index";
import { startWebEditor } from "./web";
import { ensureTemplateDocx } from "./style/generate";

async function cleanCache(): Promise<number> {
  const resolved = resolve(TMP_DIR);
  if (existsSync(resolved)) {
    rmSync(resolved, { recursive: true, force: true });
    console.log(`已清除缓存：${resolved}`);
  } else {
    console.log("缓存目录不存在，无需清理。");
  }
  return 0;
}

export async function run(args: string[]): Promise<number> {
  try {
    // 检查子命令
    const subcommand = args[0];
    if (subcommand === "clean") {
      return await cleanCache();
    }
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
    if (!existsSync(mdPath)) throw new Error(`找不到 Markdown 文件：${mdPath}`);

    const config = await loadConfig(cli.configPath ?? CONFIG_PATH);
    const cfg = applyConfigOverrides(config, cli.overrides);
    const baseName = parse(mdPath).name;
    const outDir = preprocessDir(baseName);
    mkdirSync(outDir, { recursive: true });

    const formattedMd = await preprocess(mdPath, cfg, outDir);
    const mdOutput = formattedMdPath(baseName);
    writeFileSync(mdOutput, formattedMd, "utf-8");

    if (cfg.pandoc.enabled) {
      const templatePath = await ensureTemplateDocx(STYLE_CONFIG);
      const configuredName = cfg.pandoc.outputName.replaceAll("{file_name}", baseName);
      const docxOutput = resolve(cli.outputPath ?? configuredName);
      mkdirSync(dirname(docxOutput), { recursive: true });
      const luaFilter = resolve(PKG_DIR, "config/lua/add-inline-code.lua");
      const luaFlag = existsSync(luaFilter) ? `--lua-filter=${luaFilter}` : "";
      const result =
        await $`pandoc ${mdOutput} -o ${docxOutput} --reference-doc=${templatePath} ${luaFlag}`.nothrow();
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
