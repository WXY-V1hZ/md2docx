import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { writeFileSync } from "fs";
import { readFileSync } from "fs";
import { type Root } from "mdast";

import { normalizeHeadings } from "./utils/preprocess";

const md = readFileSync("base.md", "utf-8");

// 解析得到 AST
const processor = unified().use(remarkParse).use(remarkStringify);
const ast = processor.parse(md);

normalizeHeadings(ast as Root);

writeFileSync("base.md", processor.stringify(ast), "utf-8");
