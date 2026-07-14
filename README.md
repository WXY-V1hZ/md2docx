<p align="center">
  <img src="assets/logo.svg" alt="md2docx" width="160" height="160">
</p>

<h1 align="center">md2docx</h1>

<p align="center">
  基于 pandoc 的 Markdown 转 Word 工具，自动格式化 Markdown，支持自定义样式，AI 友好，用户友好。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@v1hz/md2docx"><img src="https://img.shields.io/npm/v/@v1hz/md2docx" alt="npm version"></a>
  <a href="https://github.com/WXY-V1hZ/md2docx"><img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="license"></a>
</p>

---

## 功能

将 Markdown 转换为格式精美的 Word 文档，自动处理：

| 功能               | 说明                                                        |
| ------------------ | ----------------------------------------------------------- |
| **文档标题**       | 从 frontmatter、H1 或文件名自动提取                         |
| **标题层级归一化** | 修正标题层级跳跃，确保从 H1 开始连续递增                    |
| **标题编号**       | 为标题添加多级编号（1、1.1、1.1.1 …），支持剥离已有编号     |
| **表格编号**       | 自动为表格添加编号（表 1、表 2 …）                          |
| **图片编号**       | 为独立图片添加编号（图 1、图 2 …）                          |
| **Mermaid 图表**   | 将 Mermaid 代码块渲染为 PNG 图片                            |
| **Word 导出**      | 集成 pandoc，传入自定义样式模板，一键生成 .docx             |
| **样式定制**       | 通过 `config/style.json` 定义文档样式，支持从模板 docx 提取 |
| **web 配置编辑器** | 浏览器中可视化编辑配置                                      |

## 安装

**前置依赖**：[Bun](https://bun.sh) | [Pandoc](https://pandoc.org)

```bash
npm install -g @v1hz/md2docx
md2docx --file docs/example.md
```

也可通过 `npx @v1hz/md2docx` 直接运行。

## 快速开始

```bash
# 转换 Markdown 为 Word
md2docx --file docs/example.md

# 使用自定义配置、样式和输出路径
md2docx -f docs/example.md -c config.json -s style.json -o output/example.docx

# 只执行 Markdown 预处理
md2docx format --file docs/example.md

# 导出可编辑的默认配置和样式
md2docx export config
md2docx export style

# 从现有 Word 文档提取样式
md2docx export style --file template.docx
```

所有写文件命令默认拒绝覆盖已有文件。确认覆盖时传入 `--force`。
不传入任何参数时显示顶层帮助，行为与 `md2docx --help` 相同。

## CLI

```text
md2docx -f <markdown> [选项]
md2docx format -f <markdown> [选项]
md2docx export config [选项]
md2docx export style [选项]
```

`--file` 在顶层转换和 `format` 命令中必填；在 `export style` 中可选，不提供时导出内置默认样式，提供 DOCX 时从该文档提取样式。

| 参数                  | 说明                           |
| --------------------- | ------------------------------ |
| `-f, --file <path>`   | 输入文件                       |
| `-c, --config <path>` | 自定义配置文件                 |
| `-s, --style <path>`  | 自定义样式文件（仅 Word 转换） |
| `-o, --output <path>` | 完整输出文件路径               |
| `--force`             | 覆盖已有输出                   |
| `-h, --help`          | 显示当前命令帮助               |
| `-v, --version`       | 显示版本号                     |

默认输出分别为 `<源文件名>.docx`、`<源文件名>_formatted.md`、`config.json` 和
`style.json`。从 DOCX 提取样式时，默认输出 `<DOCX 文件名>_style.json`。

## 配置

配置文件位于 `config/config.json`，通过 JSON Schema 提供 IDE 校验。使用
`md2docx export config` 导出副本，修改后通过 `--config` 指定；CLI 不提供单个配置项覆盖。

| 配置项                           | 说明                                                         | 默认值                |
| -------------------------------- | ------------------------------------------------------------ | --------------------- |
| `detectTitle.enabled`            | 自动设置文档标题                                             | `true`                |
| `detectTitle.strategy`           | 标题来源策略：`first-h1` / `single-h1` / `filename` / `none` | `"first-h1"`          |
| `normalizeHeadings.enabled`      | 自动修正标题层级                                             | `true`                |
| `numberHeadings.enabled`         | 自动为标题编号（开启时自动启用 normalizeHeadings）           | `true`                |
| `numberHeadings.detectExisting`  | 重新编号前移除已有编号                                       | `true`                |
| `numberHeadings.useBuiltinRules` | 识别常见的中文和数字编号                                     | `true`                |
| `figureCaption.enabled`          | 自动为图片编号（格式：`图 {n}`）                             | `true`                |
| `figureCaption.format`           | 图片编号格式                                                 | `"图 {n}"`            |
| `figureCaption.separator`        | 编号与标题之间的分隔符                                       | `"："`                |
| `tableCaption.enabled`           | 自动为表格编号（格式：`表 {n}`）                             | `true`                |
| `tableCaption.format`            | 表格编号格式                                                 | `"表 {n}"`            |
| `tableCaption.separator`         | 编号与标题之间的分隔符                                       | `" "`                 |
| `renderMermaid.enabled`          | 渲染 Mermaid 图表为 PNG                                      | `true`                |
| `renderMermaid.theme`            | 图表主题                                                     | `"tokyo-night-light"` |
| `renderMermaid.density`          | 图片清晰度（DPI，最小 72）                                   | `200`                 |

## 样式定制

`config/style.json` 定义了 docx 输出的全部样式，包括字体、字号、颜色、缩进、间距等。

### 从模板 docx 提取样式

如果你有一个排版精美的 docx 模板，可以提取其样式：

```bash
md2docx export style --file template.docx
```

提取后修改 `config/style.json`，转换时会自动使用这些样式生成输出文档。

### 手动维护样式

可直接编辑 `config/style.json`。支持以下样式配置：

- **文档默认样式**（`default.document`）：全局字体、字号、段落间距
- **内置样式覆盖**（`default.heading1` … `default.heading6`、`default.title` 等）
- **自定义段落样式**（`paragraphStyles`）
- **自定义字符样式**（`characterStyles`）

详细的样式字段定义参考 [docx 包文档](https://docx.js.org)。

## 处理流水线

项目遵循单向处理流水线，每个步骤职责单一。

```
Markdown
    ↓
解析 AST
    ↓
addTitle()            ← 提取文档标题
    ↓
normalizeHeadings()   ← 修正标题层级（最小深度 → H1，消除跳跃）
    ↓
numberHeadings()      ← 添加标题编号（1 / 1.1 / 1.1.1 …）
    ↓
numberTables()         ← 添加表格编号（表 1、表 2 …）
    ↓
renderMermaid()       ← Mermaid 代码块 → PNG 图片
    ↓
numberPictures()      ← 添加图片编号（图 1、图 2 …）
    ↓
序列化 Markdown
    ↓
生成样式模板 docx     ← 根据 config/style.json 生成 pandoc reference-doc
    ↓
pandoc → DOCX         ← 以 --reference-doc 传入样式模板
```

## 开发

### 从源码运行

```bash
git clone https://github.com/WXY-V1hZ/md2docx.git
cd md2docx
bun install
bun run src/index.ts --file docs/example.md
```

### 命令

```bash
# 测试
bun test

# 类型检查 + 代码检查 + 格式检查
bun check

# 查看 CLI 帮助
bun run src/index.ts --help
```

## 许可

本项目基于 GNU General Public License v3.0 开源 — 详见 [LICENSE](LICENSE)。
