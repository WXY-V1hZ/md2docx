import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { writeFileSync, readFileSync, existsSync } from "fs";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { type Heading } from "mdast";
import { visit } from "unist-util-visit";

import { type NumberingConfig, DEFAULT_CONFIG } from "./config";
import { addTitle, normalizeHeadings, numberHeadings } from "./preprocess/title";
import { numberTables, numberPictures } from "./preprocess/caption";
import { renderMermaid } from "./preprocess/mermaid";

const fileName = "base.md";

let numberingConfig: NumberingConfig | undefined;
if (existsSync("config.json")) {
  numberingConfig = JSON.parse(readFileSync("config.json", "utf-8")) as NumberingConfig;
}
const md = readFileSync(fileName, "utf-8");

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkStringify, { resourceLink: true, bullet: "-" });
const ast = processor.parse(md);

const headings: Heading[] = [];
visit(ast, "heading", (heading: Heading) => {
  headings.push(heading);
});
const cfg = numberingConfig ?? DEFAULT_CONFIG;

addTitle(fileName, ast, headings, cfg.title);

if (cfg.normalizeHeadings.enabled || cfg.numberHeadings.enabled) {
  normalizeHeadings(headings);
}
if (cfg.numberHeadings.enabled) {
  numberHeadings(headings, cfg.numberHeadings);
}

if (cfg.tableCaption.enabled) {
  numberTables(ast, cfg);
}
if (cfg.renderMermaid.enabled) {
  await renderMermaid(
    ast,
    fileName,
    cfg.renderMermaid.outputDir,
    cfg.renderMermaid.theme,
    cfg.renderMermaid.density,
    cfg.renderMermaid.fileName,
  );
}
if (cfg.figureCaption.enabled) {
  numberPictures(ast, cfg);
}

const outputName = fileName.replace(/\.[^.]*$/, "_formatted.md");
writeFileSync(outputName, processor.stringify(ast), "utf-8");
