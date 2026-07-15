import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  STYLE_DIR,
  TMP_DIR,
  formattedMdPath,
  preprocessDir,
  styleTemplateDocx,
} from "../src/paths";

describe("中间文件路径", () => {
  it("统一存储在用户主目录的 .md2docx 中", () => {
    expect(TMP_DIR).toBe(join(homedir(), ".md2docx"));
    expect(STYLE_DIR).toBe(join(TMP_DIR, "style"));
    expect(styleTemplateDocx("abc123")).toBe(join(TMP_DIR, "style", "abc123.docx"));
  });

  it("使用输入路径哈希隔离同名文件", () => {
    const first = join(homedir(), "documents", "report.md");
    const second = join(homedir(), "archive", "report.md");
    const firstDir = preprocessDir(first);
    const secondDir = preprocessDir(second);

    expect(dirname(firstDir)).toBe(join(TMP_DIR, "preprocess"));
    expect(firstDir).not.toBe(secondDir);
    expect(formattedMdPath(first)).toBe(join(firstDir, "report_formatted.md"));
  });
});
