import { writeFileSync } from "fs";
import { $ } from "bun";

import { loadConfig } from "./config";
import { preprocess } from "./preprocess/index";

const cfg = await loadConfig("config.json");

const inputFile = "base.md";
const formattedMd = await preprocess(inputFile, cfg);

const mdOutput = inputFile.replace(/\.[^.]*$/, "_formatted.md");
writeFileSync(mdOutput, formattedMd, "utf-8");

if (cfg.pandoc.enabled) {
  const docxOutput = cfg.pandoc.outputName.replace(
    "{file_name}",
    inputFile.replace(/\.[^.]*$/, ""),
  );
  const result = await $`pandoc ${mdOutput} -o ${docxOutput}`.nothrow();
  if (result.exitCode !== 0) {
    console.error(`pandoc 转换失败 (exit code ${result.exitCode}):`, result.stderr.toString());
    process.exit(1);
  }
}
