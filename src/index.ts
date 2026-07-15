#!/usr/bin/env node

import { CommanderError } from "commander";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createProgram } from "./cli";
import { convertMarkdown } from "./commands/convert";
import { exportConfig, exportStyle } from "./commands/export";
import { formatMarkdown } from "./commands/format";
import { PKG_DIR } from "./paths";

export async function run(args: string[]): Promise<number> {
  const { version } = JSON.parse(await readFile(resolve(PKG_DIR, "package.json"), "utf-8")) as {
    version: string;
  };
  const program = createProgram(version, {
    convert: convertMarkdown,
    format: formatMarkdown,
    exportConfig,
    exportStyle,
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
if (entryPath && realpathSync(entryPath) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = await run(process.argv.slice(2));
}
