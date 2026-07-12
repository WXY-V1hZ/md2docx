# md2docx

基于 pandoc 的 Markdown 转 Word (.docx) 工具，在转换前执行 AST 变换以提升文档输出质量。

## 功能

将 Markdown 转换为格式精美的 Word 文档，自动处理：

- **文档标题** — 从 frontmatter、H1 或文件名自动提取文档标题
- **标题层级归一化** — 自动修正标题层级跳跃，确保从 H1 开始连续递增
- **标题编号** — 为标题添加多级编号（1、1.1、1.1.1 …），支持剥离已有编号
- **表格编号** — 自动检测表格并添加"表 1"、"表 2"……编号
- **图片编号** — 为独立图片添加"图 1"、"图 2"……编号
- **Mermaid 图表** — 将 Mermaid 代码块渲染为 PNG 图片嵌入文档
- **Word 导出** — 集成 pandoc，一键生成 .docx 文件

## 安装

### 前置依赖

- [Bun](https://bun.sh) ≥ 1.3
- [pandoc](https://pandoc.org)（可选，需导出 Word 时安装）

### 通过 npx（推荐，无需安装）

```bash
npx @v1hz/md2docx README.md
```

### 全局安装

```bash
npm install -g @v1hz/md2docx
md2docx README.md
```

### 从源码运行

```bash
git clone https://github.com/WXY-V1hZ/md2docx.git
cd md2docx
bun install
bun run src/index.ts docs/example.md
```

## 快速开始

```bash
# 处理 Markdown 并生成 Word 文档
npx @v1hz/md2docx docs/example.md

# 只预处理，不调用 pandoc
npx @v1hz/md2docx docs/example.md --pandoc.enabled false

# 指定输出路径
npx @v1hz/md2docx docs/example.md -o output/example.docx

# 使用自定义配置文件
npx @v1hz/md2docx docs/example.md --config ./my-config.json
```

## 配置

配置文件位于 `config/config.json`，通过 JSON Schema 提供 IDE 校验。

所有配置项均可通过命令行覆盖：

```bash
npx @v1hz/md2docx docs/example.md --figureCaption.enabled false
```

### 配置项概览

| 配置项                      | 说明              | 默认值       |
| --------------------------- | ----------------- | ------------ |
| `detectTitle.enabled`       | 自定设置文档标题  | `true`       |
| `detectTitle.strategy`      | 标题来源策略      | `"first-h1"` |
| `normalizeHeadings.enabled` | 自动修正标题层级  | `true`       |
| `numberHeadings.enabled`    | 自动为标题编号    | `true`       |
| `figureCaption.enabled`     | 自动为图片编号    | `true`       |
| `tableCaption.enabled`      | 自动为表格编号    | `true`       |
| `renderMermaid.enabled`     | 渲染 Mermaid 图表 | `true`       |
| `pandoc.enabled`            | 生成 Word 文档    | `true`       |

## Web 配置编辑器

```bash
bun run src/web.ts
```

在浏览器中可视化编辑配置，实时校验并保存。

## 处理流水线

```
Markdown
    ↓
解析 AST
    ↓
addTitle()        ← 提取文档标题
    ↓
normalizeHeadings() ← 修正标题层级
    ↓
numberHeadings()  ← 添加标题编号
    ↓
numberTables()    ← 添加表格编号
    ↓
renderMermaid()   ← Mermaid → PNG
    ↓
numberPictures()  ← 添加图片编号
    ↓
序列化 Markdown
    ↓
pandoc → DOCX
```

## 开发

```bash
# 测试
bun test

# 类型检查 + 代码检查 + 格式检查
bun check
```

## 许可

本项目基于 MIT 许可证开源 — 详见 [LICENSE](LICENSE)。
