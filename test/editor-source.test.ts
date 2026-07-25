import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createEditorSource } from "../electron/editor-source";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Markdown 编辑器源文件", () => {
  test("安全物化文本并规范文档名称", () => {
    const directory = mkdtempSync(join(tmpdir(), "md2docx-editor-"));
    temporaryDirectories.push(directory);

    const source = createEditorSource(
      { content: "# 标题\n\n正文", name: "../实验报告.md" },
      directory,
    );

    expect(source.name).toBe("实验报告.md");
    expect(existsSync(source.path)).toBe(true);
    expect(readFileSync(source.path, "utf-8")).toBe("# 标题\n\n正文");
    expect(source.path.startsWith(directory)).toBe(true);
  });

  test("拒绝空文本、未知字段和过大内容", () => {
    const directory = mkdtempSync(join(tmpdir(), "md2docx-editor-"));
    temporaryDirectories.push(directory);

    expect(() => createEditorSource({ content: "  ", name: "文档" }, directory)).toThrow(
      "请输入 Markdown 内容",
    );
    expect(() =>
      createEditorSource({ content: "# 标题", name: "文档", path: "outside.md" }, directory),
    ).toThrow("未知字段 path");
    expect(() =>
      createEditorSource({ content: "a".repeat(5 * 1024 * 1024 + 1), name: "文档" }, directory),
    ).toThrow("不能超过 5 MB");
  });
});
