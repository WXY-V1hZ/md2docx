#!/usr/bin/env bun

import { CommanderError } from "commander";

import { createProgram } from "./cli";
import { convertMarkdown } from "./commands/convert";
import { exportConfig, exportStyle } from "./commands/export";
import { formatMarkdown } from "./commands/format";
import { PKG_DIR } from "./paths";

export async function run(args: string[]): Promise<number> {
  const { version } = (await Bun.file(`${PKG_DIR}/package.json`).json()) as { version: string };
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

if (import.meta.main) {
  process.exitCode = await run(Bun.argv.slice(2));
}
