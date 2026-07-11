import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { writeFileSync } from "fs";
import { readFileSync } from "fs";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { type Heading } from "mdast";
import { visit } from "unist-util-visit";

import {
  addTitle,
  normalizeHeadings,
  numberHeadings,
} from "./utils/preprocess";

const fileName = "base.md";
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

const outputName = fileName.replace(/\.[^.]*$/, "_formatted.md");
writeFileSync(outputName, processor.stringify(ast), "utf-8");
