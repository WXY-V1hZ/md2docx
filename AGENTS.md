# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

md2docx —— Markdown 预处理工具。在将 Markdown 文档通过 pandoc 转换为 Word (.docx) 之前，对 Markdown AST 进行预处理：自动提取/生成 YAML frontmatter title、规范化标题层级、自动编号标题。

## 常用命令

```bash
bun test           # 运行测试（test/ 目录下所有 *.test.ts）
bun check          # 完整检查：tsc 类型检查 → oxlint 代码检查 → oxfmt 格式化检查
bun run index.ts   # 运行主程序（处理 base.md 输出 base_formatted.md）
bun add <pkg>      # 添加依赖
```

## 项目结构

- `index.ts` — 入口文件。读取 `base.md`，用 unified/remark 解析为 Markdown AST，调用预处理函数，将处理后的 AST 输出到 `base_formatted.md`。
- `preprocess.ts` — 核心预处理逻辑，导出五个函数：
  - `addTitle()` — 检测是否有 YAML frontmatter title；否且第一个 heading 是唯一 H1 → 将该 H1 提取为 title；否则用文件名作为 fallback title。
  - `normalizeHeadings()` — 将所有 heading 的层级归一化到从 H1 开始，并确保层级连续（无跳跃）。
  - `numberHeadings()` — 给每个 heading 文本前添加数字前缀（如 "1.2.3"）。
  - `numberPictures()` — 给独立成行的图片编号，修改 alt 为 "图 n：xxx"（优先级 title > alt > 文件名）。
  - `numberTables()` — 给表格编号，查找已有 "Table:" 题注并加前缀，无则插入。
- `base.md` — 综合测试文档，覆盖各种 Markdown 语法特性。
- `pandoc_docx_template/` — 捆绑的 [Achuan-2/pandoc_docx_template](https://github.com/Achuan-2/pandoc_docx_template) 仓库，提供中文排版优化的 Word 模板和 pandoc lua 过滤器。

## 技术栈

- **Runtime**: Bun
- **Markdown 解析**: unified + remark-parse + remark-gfm + remark-frontmatter + remark-stringify
- **AST 处理**: mdast 类型 + unist-util-visit
- **代码工具**: oxlint（lint）/ oxfmt（format）/ tsc（typecheck）
- **目标格式**: pandoc → .docx（使用 pandoc_docx_template 中的模板）

## 数据处理流程

```
base.md → unified(remark-parse) → AST → addTitle()
                                       → normalizeHeadings()
                                       → numberHeadings()
                                       → numberPictures()
                                       → numberTables()
                                     → unified(remark-stringify) → base_formatted.md
```

后续预期会接入 pandoc 命令，将处理后的 Markdown 配合 `pandoc_docx_template/` 中的模板导出为 .docx 文件。

## 测试

测试文件位于 `test/` 目录，使用 Bun 内置 test runner。

```bash
bun test           # 运行全部测试
bun test --watch   # 监听模式
```

**编写规范：**

- `describe` 分组按函数或模块划分。
- 测试用例用中文描述（it + 期望行为的自然语言）。
- 使用 `parse()` 辅助函数将 Markdown 字符串解析为 AST + heading 列表。
- 使用 `serialize()` 辅助函数将 AST 序列化回 Markdown 字符串用于断言。
- 优先测试纯函数行为（构造 AST 调用函数），避免文件 IO。

**开发守则：**

- 新增或修改功能后，必须先编写或更新对应的测试用例，并运行 `bun test` 确保全部通过。
- 提交 git 之前，必须先运行 `bun check` 确保类型检查、代码检查、格式化全部通过。

## 已知陷阱

- `Array.prototype.fill(value, start)` 的第二个参数是**起始索引**，不是结束索引。
  如 `counter.fill(0, d)` 表示从索引 `d` 开始往后填充为 0，而不是填充前 `d` 个元素。
  如果在代码审查中产生困惑，优先信任测试结果而非静态推理。
