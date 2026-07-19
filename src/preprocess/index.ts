import { type Heading } from "mdast";
import { readFile } from "node:fs/promises";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { visit } from "unist-util-visit";

import { type AppConfig } from "../config";
import { addTitle, normalizeHeadings, numberHeadings } from "./title";
import { numberTables, numberPictures } from "./caption";
import { renderMermaid } from "./mermaid";
import { removeThematicBreaks } from "./thematic-break";

export async function preprocess(
  mdPath: string,
  cfg: AppConfig,
  outDir: string,
  assetUrlDir: string = outDir,
): Promise<string> {
  const md = await readFile(mdPath, "utf-8");

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

  addTitle(mdPath, ast, headings, cfg.detectTitle);

  if (cfg.removeThematicBreaks.enabled) {
    removeThematicBreaks(ast);
  }

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
      outDir,
      cfg.renderMermaid.theme,
      cfg.renderMermaid.density,
      assetUrlDir,
    );
  }
  if (cfg.figureCaption.enabled) {
    numberPictures(ast, cfg);
  }

  return processor.stringify(ast);
}
