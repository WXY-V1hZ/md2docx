import { describe, it, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { type Heading, type Root } from "mdast";
import { visit } from "unist-util-visit";
import { addTitle, normalizeHeadings, numberHeadings } from "../utils/preprocess";

/** 解析 Markdown 字符串，返回 root 和所有 heading 节点 */
function parse(md: string) {
  const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
  const root = processor.parse(md) as Root;
  const headings: Heading[] = [];
  visit(root, "heading", (node: Heading) => {
    headings.push(node);
  });
  return { processor, root, headings };
}

/** 将 AST 序列化为 Markdown 字符串 */
function serialize(root: Root) {
  return unified()
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkStringify, { resourceLink: true })
    .stringify(root);
}

// ─── addTitle ───────────────────────────────────────────────

describe("addTitle", () => {
  it("已有 frontmatter title 时不做任何修改", () => {
    const md = `---
title: 已有的标题
---

# 一级标题
`;
    const { root, headings } = parse(md);
    addTitle("test.md", root, headings);
    const yaml = root.children[0];
    expect(yaml).toHaveProperty("type", "yaml");
    expect((yaml as { value: string }).value).toMatch(/^title: 已有的标题$/m);
    expect(root.children).toHaveLength(2); // yaml + heading
  });

  it("无 title，第一个 heading 是唯一 H1 → 提取为 title 并移除原 H1", () => {
    const md = `# 文档标题

## 二级标题

### 三级标题
`;
    const { root, headings } = parse(md);
    addTitle("test.md", root, headings);
    const yaml = root.children[0];
    expect(yaml).toHaveProperty("type", "yaml");
    expect((yaml as { value: string }).value).toMatch(/^title: 文档标题$/m);
    // heading 数组中应不再有那个 H1
    expect(headings.every((h) => h.depth !== 1)).toBe(true);
    // root 中也不再有 H1
    expect(root.children.some((c) => c.type === "heading" && "depth" in c && c.depth === 1)).toBe(
      false,
    );
  });

  it("无 title，多个 H1 → 用文件名 fallback", () => {
    const md = `# 第一个

## 中间

# 第二个
`;
    const { root, headings } = parse(md);
    addTitle("我的文档.md", root, headings);
    const yaml = root.children[0];
    expect(yaml).toHaveProperty("type", "yaml");
    expect((yaml as { value: string }).value).toMatch(/^title: 我的文档$/m);
  });

  it("无 title，唯一 H1 不在最前 → 用文件名 fallback", () => {
    const md = `## 二级开头

# 后面的一级
`;
    const { root, headings } = parse(md);
    addTitle("test.md", root, headings);
    const yaml = root.children[0];
    expect(yaml).toHaveProperty("type", "yaml");
    expect((yaml as { value: string }).value).toMatch(/^title: test$/m);
  });

  it("无 title，也无任何 heading → 用文件名 fallback", () => {
    const md = "只有一段正文。\n";
    const { root, headings } = parse(md);
    addTitle("文档.md", root, headings);
    const yaml = root.children[0];
    expect(yaml).toHaveProperty("type", "yaml");
    expect((yaml as { value: string }).value).toMatch(/^title: 文档$/m);
  });
});

// ─── normalizeHeadings ──────────────────────────────────────

describe("normalizeHeadings", () => {
  it("空数组不报错", () => {
    expect(() => normalizeHeadings([])).not.toThrow();
  });

  it("从 H3 开头 → 归一化为 H1 开头", () => {
    const md = `### A

#### B

### C
`;
    const { headings } = parse(md);
    normalizeHeadings(headings);
    expect(headings.map((h) => h.depth)).toEqual([1, 2, 1]);
  });

  it("层级跳跃 → 补齐连续性", () => {
    const md = `# A

### C
`;
    const { headings } = parse(md);
    normalizeHeadings(headings);
    expect(headings.map((h) => h.depth)).toEqual([1, 2]);
  });

  it("三级跳跃 → 逐步补齐", () => {
    const md = `# A

###### F
`;
    const { headings } = parse(md);
    normalizeHeadings(headings);
    expect(headings.map((h) => h.depth)).toEqual([1, 2]);
  });

  it("已经是连续标准层级 → 不变", () => {
    const md = `# A

## B

### C

## D
`;
    const { headings } = parse(md);
    normalizeHeadings(headings);
    expect(headings.map((h) => h.depth)).toEqual([1, 2, 3, 2]);
  });
});

// ─── numberHeadings ─────────────────────────────────────────

describe("numberHeadings", () => {
  it("连续的 H1 / H2 → 正确编号", () => {
    const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
    const root = processor.parse("# A\n\n## B\n\n## C\n\n# D\n") as Root;
    const headings: Heading[] = [];
    visit(root, "heading", (node: Heading) => {
      headings.push(node);
    });
    numberHeadings(headings);
    const result = processor().use(remarkStringify, { resourceLink: true }).stringify(root);
    expect(result).toContain("# 1 A");
    expect(result).toContain("## 1.1 B");
    expect(result).toContain("## 1.2 C");
    expect(result).toContain("# 2 D");
  });

  it("从 H2 起始（normalize 后为 H1）→ 正确编号", () => {
    const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
    const root = processor.parse("## A\n\n### B\n") as Root;
    const headings: Heading[] = [];
    visit(root, "heading", (node: Heading) => {
      headings.push(node);
    });
    normalizeHeadings(headings);
    numberHeadings(headings);
    const result = processor().use(remarkStringify, { resourceLink: true }).stringify(root);
    expect(result).toContain("# 1 A");
    expect(result).toContain("## 1.1 B");
  });

  it("已有编号的 heading → 前缀追加编号（不剥离已有编号）", () => {
    const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
    const root = processor.parse("# 一、旧标题\n\n## 1.1 旧二级\n\n### （三）旧三级\n") as Root;
    const headings: Heading[] = [];
    visit(root, "heading", (node: Heading) => {
      headings.push(node);
    });
    numberHeadings(headings);
    const result = processor().use(remarkStringify, { resourceLink: true }).stringify(root);
    expect(result).toContain("# 1 一、旧标题");
    expect(result).toContain("## 1.1 1.1 旧二级");
    expect(result).toContain("### 1.1.1 （三）旧三级");
  });

  it("纯文本 heading（无已有编号）→ 正常添加编号", () => {
    const md = "# 介绍\n\n## 安装\n\n### 环境要求\n";
    const { root, headings } = parse(md);
    numberHeadings(headings);
    const result = serialize(root);
    expect(result).toContain("# 1 介绍");
    expect(result).toContain("## 1.1 安装");
    expect(result).toContain("### 1.1.1 环境要求");
  });
});

// ─── 完整流程（集成） ────────────────────────────────────────

describe("完整流程", () => {
  it("base.md 输入 → 预期输出一致", () => {
    const input = `# 我的文档

## 简介

### 背景

### 目的

## 安装指南

### 前置条件

### 步骤
`;
    const { root, headings } = parse(input);
    addTitle("input.md", root, headings);
    normalizeHeadings(headings);
    numberHeadings(headings);
    const result = serialize(root);

    const expected = `---
title: 我的文档
---

# 1 简介

## 1.1 背景

## 1.2 目的

# 2 安装指南

## 2.1 前置条件

## 2.2 步骤
`;
    expect(result).toBe(expected);
  });
});
