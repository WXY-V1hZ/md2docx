<p align="center">
  <img src="assets/logo.svg" alt="md2docx" width="160" height="160">
</p>

<h1 align="center">md2docx</h1>

<p align="center">
  基于 Pandoc 的 Markdown 转 Word 工具。在转换前规范文档结构、补充编号、渲染 Mermaid，并通过可定制的 Word 样式生成 DOCX。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@v1hz/md2docx"><img src="https://img.shields.io/npm/v/@v1hz/md2docx" alt="npm version"></a>
  <a href="https://github.com/WXY-V1hZ/md2docx"><img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="license"></a>
</p>

---

## 功能

- **文档标题** — 从 YAML frontmatter、H1 或文件名提取
- **标题归一化** — 最浅标题 → H1，修复层级跳跃
- **标题编号** — `1`、`1.1`、`1.1.1`，可剥离已有中英文编号
- **表格与图片题注** — "表 1"、"图 1：标题"
- **图片尺寸限制** — 等比缩小超限图片
- **数学公式** — 保留 `$…$` 行内公式和 `$$…$$` 块级公式，由 Pandoc 生成可编辑的 DOCX 公式
- **Mermaid 渲染** — beautiful-mermaid + resvg-wasm → 高 DPI PNG
- **Word 样式** — 语义化配置 / 完整底层样式 / 从 DOCX 提取
- **预设系统** — 可切换、可继承默认值的配置与样式预设
- **Markdown 格式化** — 只运行预处理流水线
- **桌面图形界面** — Electron + Vue 3，支持文件拖放、批量转换、预设编辑、转换历史、自动更新
- **集中缓存** — `~/.md2docx/`，工作目录保持干净
- **双构建** — npm CLI + Windows 单文件 EXE + 桌面安装包

---

## 安装

前置：Node.js 22.12+, [Pandoc](https://pandoc.org/installing.html)（需在 PATH 中；图片尺寸限制需 Pandoc 3.1.13+）

```bash
npm install -g @v1hz/md2docx
# 或
npx @v1hz/md2docx report.md
```

Windows 桌面用户也可下载安装版或便携版（见 [Releases](https://github.com/WXY-V1hZ/md2docx/releases)）。

---

## 快速开始

```bash
md2docx report.md                     # 仅路径，默认输出 ./report.docx
md2docx -f report.md -o output.docx   # 带选项（必须有 --file）
md2docx -f report.md -c config.json --style-raw raw.json --style-config style-config.json
md2docx preset save --name academic --config config.json
md2docx preset use academic
md2docx format -f report.md           # 只格式化
md2docx export config                 # 导出默认配置
md2docx export style-raw -f template.docx  # 从 DOCX 提取样式
md2docx clean                         # 清除预处理/资源/样式缓存
```

所有写文件命令默认覆盖已有输出。

---

## CLI 参考

```text
md2docx <markdown>
md2docx -f <markdown> [转换选项]
md2docx format -f <markdown> [选项]
md2docx export config|style-raw|style-config [选项]
md2docx preset list|use <name>|save --name <name> [选项]
md2docx clean
```

| 参数                    | 说明                         |
| ----------------------- | ---------------------------- |
| `<markdown>`            | 位置参数，仅无其他选项时可用 |
| `-f, --file <path>`     | Markdown 输入                |
| `--preset <name>`       | 本次指定预设                 |
| `-c, --config <path>`   | 配置 JSON                    |
| `--style-raw <path>`    | 底层 Word 样式 JSON          |
| `--style-config <path>` | 语义化样式配置 JSON          |
| `-o, --output <path>`   | DOCX 输出（format 为 `.md`） |

位置参数不能与 `--file` 或其他选项混用。`format` 必须提供 `--file`，不接受样式参数，不调用 Pandoc。

### 默认输出路径

```text
report.md                     → ./report.docx
format -f report.md           → ./report_formatted.md
export config                 → ./config.json
export style-raw              → ./style-raw.json
export style-raw -f t.docx    → ./t_style-raw.json
export style-config           → ./style-config.json
```

---

## 桌面应用

仓库包含 Electron 桌面端（Windows 安装版支持自动更新）。主要功能：

- **文件管理**：拖入 `.md` 文件或粘贴 Markdown 文本进行转换，支持批量
- **转换侧边栏**（`Ctrl+Alt+B`）：实时调整输出目录、命名策略、样式等配置
- **预设可视化编辑**：创建、编辑、管理预设，内置 `default` 只读，自定义时自动保存为新预设
- **转换记录**：最多 30 条，可打开输出、定位文件或重新转换
- **设置面板**：Pandoc 检测、输出设置、更新检查

```bash
bun run build:electron       # 构建主进程与 preload
bun run electron             # 构建并启动桌面端
bun run dev                  # 开发模式（隔离 Chromium 缓存）
bun run pack                 # 构建 Windows NSIS 安装版（含自动更新）
bun run pack:portable        # 构建便携版
```

---

## 配置

内置配置来自 `config/default/config.json`（`config/config.schema.json` 提供校验），推荐先导出再编辑：

```bash
md2docx export config
md2docx -f report.md -c config.json
```

| 配置项                                                    | 说明                                            | 默认值                                 |
| --------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| `detectTitle.enabled / strategy`                          | 自动设置标题 / first-h1/single-h1/filename/none | `true` / `"first-h1"`                  |
| `numberHeadings.{enabled,detectExisting,useBuiltinRules}` | 标题编号 / 剥离已有编号                         | `true` / `true` / `true`               |
| `figureCaption.{enabled,format,separator}`                | 图片题注 / `"图 {n}"` / `"："`                  | `true`                                 |
| `tableCaption.{enabled,format,separator}`                 | 表格题注 / `"表 {n}"` / `" "`                   | `true`                                 |
| `renderMermaid.{enabled,theme,density}`                   | Mermaid 渲染 / 主题 / DPI（≥72）                | `true` / `"tokyo-night-light"` / `200` |
| `imageSize.{enabled,maxWidthCm,maxHeightCm}`              | 图片尺寸限制（厘米）                            | `true` / `12` / `12`                   |
| `removeThematicBreaks.enabled`                            | 移除分隔符行                                    | `true`                                 |
| `normalizeHeadings.enabled`                               | 修正标题层级                                    | `true`                                 |

图片尺寸限制：超限等比缩小，不放大小图；已显式设 width/height 时不应用；读取失败时警告并继续。

Linux 上的 Mermaid 渲染通过 Fontconfig（`fc-match`）查找已安装的字体，并支持常见字体路径。中文标签需要安装中文字体，例如 Noto Sans CJK。找不到字体文件时会提示渲染失败并保留 Mermaid 代码块。

---

## 样式定制

语义化配置（`config/default/style-config.json`）开放常用 Word 样式白名单：

- `body.firstLineIndent` — 正文首行缩进
- `body.lineSpacing` — 行距倍数（如 `1.5`）
- `headings["1"]` — `startOnNewPage`、`alignment`（left/center）、`bold`
- `headings["2".."6"]` — `bold`
- `headings["4".."6"]` — `italic`
- `inlineCode.background` — 行内代码背景
- `codeBlock.border` — 代码块外框

输入组合：

| 参数                | 行为                          |
| ------------------- | ----------------------------- |
| 都不指定            | 当前预设 raw + config         |
| 仅 `--style-raw`    | 直接使用 raw，不读默认 config |
| 仅 `--style-config` | config 应用到当前预设 raw     |
| 两者都指定          | config 应用到用户 raw         |

```bash
md2docx export style-config
md2docx -f report.md --style-config style-config.json
md2docx export style-raw -f template.docx
md2docx -f report.md --style-raw template_style-raw.json
```

字段缺失继承底层样式；`true` 写入完整效果；`false` 写入 Word 关闭值。详见 [`docs/style-config-design.md`](docs/style-config-design.md)。

---

## 处理流水线

```
Markdown → AST → addTitle → removeThematicBreaks → normalizeHeadings
→ numberHeadings → numberTables → renderMermaid → numberPictures
→ 序列化 → reference DOCX → Pandoc + Lua filter → DOCX
```

顺序约束：`removeThematicBreaks` 在标题处理前；`numberTables` 在 Mermaid 前；`renderMermaid` 在 `numberPictures` 前。

---

## 中间文件

```
~/.md2docx/
├── settings.json + presets/          # 持久数据，clean 保留
├── preprocess/<basename>-<hash:12>/  # 预处理 Markdown + Mermaid PNG
├── resources/default/*.json + *.lua  # 物化的内置资源
└── style/<hash:16>.docx              # reference DOCX 缓存
```

预处理目录使用输入路径 SHA-256 前 12 位，同名文件在不同目录下隔离。

---

## 构建

需要 [Bun](https://bun.sh/)。

```bash
git clone https://github.com/WXY-V1hZ/md2docx.git && cd md2docx
bun install
bun run src/index.ts report.md   # 从源码运行
bun test                          # 全部测试
bun check                         # tsc + oxlint + oxfmt
bun run build                     # npm 构建 → dist/index.js + WASM
bun run build:exe                 # Windows 单文件 → dist/md2docx.exe
```

---

## 常见问题

**找不到 Pandoc** — 确认 `pandoc --version` 可用，从 [pandoc.org](https://pandoc.org/installing.html) 安装并重启终端。

**跨目录转换图片缺失** — 相对路径以原始 Markdown 文件为基准解析。检查路径大小写、文件存在性和 URL 编码。

---

## 许可

[GNU GPL v3.0](LICENSE)
