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
- **Mermaid 渲染** — beautiful-mermaid + resvg-wasm → 高 DPI PNG
- **Word 样式** — 受控语义化配置 / 完整底层样式 / 从 DOCX 提取
- **预设系统** — 可切换、可继承默认值的配置与样式预设
- **Markdown 格式化** — 只运行预处理流水线
- **集中缓存** — `~/.md2docx/`，工作目录保持干净
- **双构建** — npm CLI + Windows 单文件 EXE

---

## 桌面应用

仓库包含基于 Electron + Vue 3 + Vite + Tailwind CSS 的桌面端（早期开发阶段）。标题栏使用 `titleBarStyle: "hidden"` 自定义内容区域并在各平台保留原生窗口控制按钮。系统拖入的文件通过 preload 中的 `webUtils.getPathForFile()` 解析本地路径。桌面转换复用完整 CLI 流水线与预设，支持源文件目录、指定文件夹或每次询问三种输出位置，以及覆盖、自动重命名或每次询问三种同名文件策略。成功文件会从队列收入标题栏转换记录；点击记录按钮后，每个文件都可独立打开、定位或使用最新源文件重新生成。设置面板还可检测 Pandoc，并通过可视化编辑器调整转换规则、图片与图表行为和语义化 Word 样式；内置 `default` 只读，自定义时保存为新的用户预设，用户预设可直接编辑。设置中的选择器使用应用内统一菜单，支持鼠标和完整键盘操作，不依赖平台原生网页下拉样式。复制、重命名和删除位于更多菜单，未保存的编辑在离开前会确认。偏好与记录仅保存在本机。旧版扁平桌面设置会继续生效，并在下次保存时迁移到共享格式。转换记录最多保留 30 条；`Ctrl/⌘ + Enter` 可直接开始转换。

```bash
bun run build:electron # 构建主进程与 preload
bun run electron       # 构建 Electron 与前端并启动
bun run dev            # 启动前端开发服务器与 Electron
```

## AI 辅助

[`SKILL.md`](SKILL.md) 供 AI 代码助手引用，使其正确使用 md2docx CLI。

---

## 安装

前置：Node.js 22.12+, [Pandoc](https://pandoc.org/installing.html)（需在 PATH 中；图片尺寸限制需 Pandoc 3.1.13+）

```bash
npm install -g @v1hz/md2docx
# 或
npx @v1hz/md2docx report.md
```

## 快速开始

```bash
md2docx report.md                     # 仅路径
md2docx -f report.md -o output.docx   # 带选项（必须有 --file）
md2docx -f report.md -c config.json --style-raw raw.json --style-config style-config.json
md2docx preset save --name academic --config config.json
md2docx preset use academic
md2docx format -f report.md           # 只格式化
md2docx export config                 # 导出配置
md2docx export style-raw -f template.docx  # 从 DOCX 提取样式
md2docx clean                         # 清除缓存
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

### 转换选项

| 参数                    | 说明                         |
| ----------------------- | ---------------------------- |
| `<markdown>`            | 位置参数，仅无其他选项时可用 |
| `-f, --file <path>`     | Markdown 输入                |
| `--preset <name>`       | 本次指定预设                 |
| `-c, --config <path>`   | 配置 JSON                    |
| `--style-raw <path>`    | 底层 Word 样式 JSON          |
| `--style-config <path>` | 语义化样式配置 JSON          |
| `-o, --output <path>`   | DOCX 输出                    |

位置参数不能与 `--file` 或其他选项混用。`format --file` 必填，支持 `--preset`/`--config`/`--output`，不接受样式参数，不调用 Pandoc。

### 默认输出

```text
report.md                     → ./report.docx
format -f report.md           → ./report_formatted.md
export config                 → ./config.json
export style-raw              → ./style-raw.json
export style-raw -f t.docx    → ./t_style-raw.json
export style-config           → ./style-config.json
```

---

## 中间文件

```
~/.md2docx/
├── settings.json + presets/          # 持久数据，clean 保留
├── preprocess/<basename>-<hash:12>/  # 预处理 Markdown + Mermaid PNG
├── resources/default/*.json + *.lua  # 物化的内置资源
└── style/<hash:16>.docx              # reference DOCX 缓存
```

预处理目录用输入绝对路径 SHA-256 前 12 位，不同目录的同名文件隔离。Pandoc 读取缓存 Markdown 时以原始 Markdown 目录为优先资源搜索路径。

---

## 配置

内置配置来自 `config/default/config.json`（`config/config.schema.json` 提供校验）。推荐先导出再编辑：

```bash
md2docx export config
md2docx -f report.md -c config.json
```

| 配置项                                                    | 说明                                            | 默认值                                 |
| --------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| `detectTitle.enabled / strategy`                          | 自动设置标题 / first-h1/single-h1/filename/none | `true` / `"first-h1"`                  |
| `normalizeHeadings.enabled`                               | 修正标题层级                                    | `true`                                 |
| `numberHeadings.{enabled,detectExisting,useBuiltinRules}` | 标题编号 / 剥离已有编号                         | `true` / `true` / `true`               |
| `figureCaption.{enabled,format,separator}`                | 图片题注 / `"图 {n}"` / `"："`                  | `true`                                 |
| `tableCaption.{enabled,format,separator}`                 | 表格题注 / `"表 {n}"` / `" "`                   | `true`                                 |
| `renderMermaid.{enabled,theme,density}`                   | Mermaid 渲染 / 主题 / DPI（≥72）                | `true` / `"tokyo-night-light"` / `200` |
| `imageSize.{enabled,maxWidthCm,maxHeightCm}`              | 图片尺寸限制（厘米）                            | `true` / `12` / `12`                   |
| `removeThematicBreaks.enabled`                            | 移除分隔符行                                    | `true`                                 |

图片尺寸通过 Lua filter 在 Pandoc 阶段等比缩小，不放大小图。Markdown 已显式设 width/height 时不应用。单图读取失败时警告并继续。

---

## 样式定制

受控语义化配置（`config/default/style-config.json`）开放以下白名单选项：

- `body.firstLineIndent` — 正文首行缩进
- `body.lineSpacing` — 行距倍数（如 `1.5`）
- `headings["1"]` — `startOnNewPage`、`alignment`（left/center）、`bold`
- `headings["2".."6"]` — `bold`
- `headings["4".."6"]` — `italic`
- `inlineCode.background` — 行内代码背景
- `codeBlock.border` — 代码块外框

字段缺失继承底层样式；`true` 写入完整效果；`false` 写入 Word 关闭值。输入组合规则：

| 参数                | 行为                          |
| ------------------- | ----------------------------- |
| 都不指定            | 当前预设 raw + config         |
| 仅 `--style-raw`    | 直接使用 raw，不读默认 config |
| 仅 `--style-config` | config 应用到当前预设 raw     |
| 两者都指定          | config 应用到用户 raw         |

```bash
md2docx export style-config
md2docx -f report.md --style-config style-config.json
# 从现有 DOCX 提取样式
md2docx export style-raw -f template.docx
md2docx -f report.md --style-raw template_style-raw.json
```

完整设计见 [`docs/style-config-design.md`](docs/style-config-design.md)。

---

## 处理流水线

```
Markdown → AST → addTitle → removeThematicBreaks → normalizeHeadings
→ numberHeadings → numberTables → renderMermaid → numberPictures
→ 序列化 → reference DOCX → Pandoc + Lua filter → DOCX
```

`removeThematicBreaks` 在标题处理之前；`numberTables` 在 Mermaid 渲染之前；`renderMermaid` 在 `numberPictures` 之前。

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

两种构建互斥（先 `clean:dist`）。`prepack` 自动执行 `bun run build`。

---

## 常见问题

**找不到 Pandoc** — 确认 `pandoc --version` 可用，从 [pandoc.org](https://pandoc.org/installing.html) 安装并重启终端。

**跨目录转换图片缺失** — 相对路径以原始 Markdown 文件为基准解析，顺序优先于调用目录。检查路径大小写、文件存在性和 URL 编码。

---

## 许可

[GNU GPL v3.0](LICENSE)
