import { writeFileSync } from "fs";
import { $ } from "bun";

import { loadConfig } from "./config";
import { CONFIG_PATH, preprocessDir, formattedMdPath, docxOutputPath } from "./paths";
import { preprocess } from "./preprocess/index";

const cfg = await loadConfig(CONFIG_PATH);

const inputFile = "base.md";
const baseName = inputFile.replace(/\.[^.]*$/, "");
const outDir = preprocessDir(baseName);

const formattedMd = await preprocess(inputFile, cfg, outDir);

const mdOutput = formattedMdPath(baseName);
writeFileSync(mdOutput, formattedMd, "utf-8");

if (cfg.pandoc.enabled) {
  const docxOutput = docxOutputPath(baseName);
  const result = await $`pandoc ${mdOutput} -o ${docxOutput}`.nothrow();
  if (result.exitCode !== 0) {
    console.error(`pandoc 转换失败 (exit code ${result.exitCode}):`, result.stderr.toString());
    process.exit(1);
  }
}
