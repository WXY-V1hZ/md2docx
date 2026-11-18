import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type AppConfig } from "../src/config";
import { DEFAULT_CONFIG_TEXT } from "../src/resources";
import { preprocess } from "../src/preprocess";

const fixturesDir = import.meta.dirname + "/fixtures";
const config: AppConfig = JSON.parse(DEFAULT_CONFIG_TEXT);

/** 将字符串中的 CRLF 统一转为 LF */
function normalizeEol(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

/** 将表格格式归一化，消除 remark-stringify 与 oxfmt 间的风格差异 */
function normalizeTable(s: string): string {
  // 匹配完整表格行，包括首尾管道
  return s.replace(/^\|[^\n]*\|$/gm, (line) => {
    const cells = line.slice(1, -1).split("|");
    const trimmed = cells.map((c) => c.trim());
    // 统一分隔行（|---| → |-|-|）
    if (trimmed.every((c) => /^-+$/.test(c))) {
      return `|${trimmed.map(() => " - ").join("|")}|`;
    }
    // 统一数据行（去掉多余填充空格）
    return `| ${trimmed.join(" | ")} |`;
  });
}

// ─── 读取所有 fixture 目录，每个目录自动注册一个测试 ────────

const entries = readdirSync(fixturesDir, { withFileTypes: true });
const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

describe("fixtures", () => {
  for (const dir of dirs) {
    const inputPath = join(fixturesDir, dir, "input.md");
    const expectedPath = join(fixturesDir, dir, "expected.md");

    it(dir, async () => {
      const expected = normalizeEol(readFileSync(expectedPath, "utf-8"));
      const result = await preprocess(inputPath, config, dirname(inputPath));
      expect(normalizeTable(normalizeEol(result))).toBe(normalizeTable(expected));
    });
  }
});
