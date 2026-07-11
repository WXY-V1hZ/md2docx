import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { writeFileSync, readFileSync, existsSync } from "fs";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { type Heading } from "mdast";
import { visit } from "unist-util-visit";

import { type NumberingConfig } from "./config";
import {
  addTitle,
  normalizeHeadings,
  numberHeadings,
  numberPictures,
  numberTables,
  renderMermaid,
} from "./preprocess";

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
addTitle(fileName, ast, headings);
normalizeHeadings(headings);
numberHeadings(headings);
numberTables(ast, numberingConfig);
await renderMermaid(ast, fileName);
numberPictures(ast, numberingConfig);

const outputName = fileName.replace(/\.[^.]*$/, "_formatted.md");
writeFileSync(outputName, processor.stringify(ast), "utf-8");
