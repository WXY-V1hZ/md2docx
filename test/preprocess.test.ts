import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { type Heading, type Root } from "mdast";
import { visit } from "unist-util-visit";
import {
  addTitle,
  normalizeHeadings,
  numberHeadings,
  numberPictures,
  numberTables,
} from "../preprocess";

const fixturesDir = import.meta.dirname + "/fixtures";

/** 解析 markdown → AST + headings */
function parse(md: string) {
  const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
  const root = processor.parse(md) as Root;
  const headings: Heading[] = [];
  visit(root, "heading", (node: Heading) => {
    headings.push(node);
  });
  return { processor, root, headings };
}

/** 把 AST 序列化为 markdown */
function serialize(root: Root) {
  return unified()
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    .use(remarkStringify, { resourceLink: true })
    .stringify(root);
}

/** 将字符串中的 CRLF 统一转为 LF */
function normalizeEol(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

/** 运行完整的预处理管道 */
function runPipeline(input: string): string {
  const { root, headings } = parse(input);
  addTitle("input.md", root, headings);
  normalizeHeadings(headings);
  numberHeadings(headings);
  numberPictures(root);
  numberTables(root);
  return serialize(root);
}

// ─── 读取所有 fixture 目录，每个目录自动注册一个测试 ────────

const entries = readdirSync(fixturesDir, { withFileTypes: true });
const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

describe("fixtures", () => {
  for (const dir of dirs) {
    const inputPath = join(fixturesDir, dir, "input.md");
    const expectedPath = join(fixturesDir, dir, "expected.md");

    it(dir, () => {
      const input = normalizeEol(readFileSync(inputPath, "utf-8"));
      const expected = normalizeEol(readFileSync(expectedPath, "utf-8"));
      const result = runPipeline(input);
      expect(result).toBe(expected);
    });
  }
});
