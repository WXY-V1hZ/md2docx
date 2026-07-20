#!/usr/bin/env node

import { CommanderError } from "commander";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json" with { type: "json" };

import { createProgram } from "./cli";
import { cleanIntermediateFiles } from "./commands/clean";
import { convertMarkdown } from "./commands/convert";
import { exportConfig, exportStyleConfig, exportStyleRaw } from "./commands/export";
import { formatMarkdown } from "./commands/format";
import { listPresets, saveUserPreset, selectPreset } from "./commands/preset";

export async function run(args: string[]): Promise<number> {
  const program = createProgram(`${packageJson.name} ${packageJson.version}`, {
    convert: convertMarkdown,
    format: formatMarkdown,
    exportConfig,
    exportStyleRaw,
    exportStyleConfig,
    presetList: listPresets,
    presetUse: selectPreset,
    presetSave: saveUserPreset,
    clean: cleanIntermediateFiles,
  });
  program.exitOverride();

  try {
    await program.parseAsync(args, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`错误：${message}`);
    console.error("使用 --help 查看帮助");
    return 1;
  }
}

const entryPath = process.argv[1];
if (
  import.meta.main ||
  (entryPath &&
    existsSync(entryPath) &&
    realpathSync(entryPath) === realpathSync(fileURLToPath(import.meta.url)))
) {
  process.exitCode = await run(process.argv.slice(2));
}
