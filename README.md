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

| 功能              | 说明                                                               |
| ----------------- | ------------------------------------------------------------------ |
| 文档标题          | 从 YAML frontmatter、H1 或文件名提取标题                           |
| 标题层级归一化    | 将最浅标题归一化为 H1，并修复标题层级跳跃                          |
| 标题编号          | 生成 `1`、`1.1`、`1.1.1` 等编号，并可剥离常见的已有中英文编号      |
| 表格与图片编号    | 自动生成“表 1”“图 1：标题”等题注                                   |
| Mermaid 图表      | 使用 beautiful-mermaid 和 resvg-wasm 将 Mermaid 渲染为高 DPI PNG   |
| Word 样式         | 根据 JSON 样式生成 Pandoc reference DOCX，也可从现有 DOCX 提取样式 |
| Markdown 格式化   | 可只运行预处理流水线，输出格式化后的 Markdown                      |
| 集中缓存          | 中间文件统一存储到 `~/.md2docx/`，不会在当前目录创建 `tmp/`        |
| Node 与可执行版本 | 支持 npm CLI，也支持构建不依赖 Node.js/Bun 的 Windows 可执行文件   |

## 安装方式

### npm CLI

前置依赖：

- [Node.js 22.12+](https://nodejs.org/)
- [Pandoc](https://pandoc.org/installing.html)，并确保 `pandoc` 可通过 `PATH` 调用

```bash
npm install -g @v1hz/md2docx
md2docx --version
md2docx report.md
```

也可以不全局安装：

```bash
npx @v1hz/md2docx report.md
```

## 快速开始

```bash
# 只有输入路径时，可以省略 --file
md2docx report.md

# 使用任何转换选项时，输入必须通过 --file 指定
md2docx --file report.md --output output/report.docx --force

# 使用自定义配置和样式
md2docx -f report.md -c config.json -s style.json

# 只执行 Markdown 预处理
md2docx format -f report.md

# 导出内置默认配置和样式
md2docx export config
md2docx export style

# 从现有 DOCX 提取样式
md2docx export style -f template.docx

# 删除 ~/.md2docx 中的中间文件和缓存
md2docx clean
```

所有写文件命令默认拒绝覆盖已有文件。确认覆盖时显式传入 `--force`。

## CLI 参考

```shell
md2docx <markdown>
md2docx -f <markdown> [转换选项]
md2docx format -f <markdown> [选项]
md2docx export config [选项]
md2docx export style [选项]
md2docx clean
```

### 转换

| 参数                  | 说明                                     |
| --------------------- | ---------------------------------------- |
| `<markdown>`          | 位置参数；仅在没有其他转换选项时允许使用 |
| `-f, --file <path>`   | Markdown 输入文件                        |
| `-c, --config <path>` | 自定义配置 JSON                          |
| `-s, --style <path>`  | 自定义样式 JSON                          |
| `-o, --output <path>` | DOCX 输出路径                            |
| `--force`             | 覆盖已有输出                             |
| `-h, --help`          | 显示帮助                                 |
| `-v, --version`       | 显示版本号                               |

位置参数不能和 `--file`、`--config`、`--style`、`--output` 或 `--force` 混用。例如：

```bash
md2docx report.md                 # 正确
md2docx report.md --force         # 错误
md2docx -f report.md --force      # 正确
```

### format

`format` 运行完整 Markdown 预处理，但不生成 DOCX，也不调用 Pandoc。

| 参数                  | 说明                                        |
| --------------------- | ------------------------------------------- |
| `-f, --file <path>`   | 必填，Markdown 输入文件                     |
| `-c, --config <path>` | 自定义配置 JSON                             |
| `-o, --output <path>` | 输出 Markdown，默认 `<文件名>_formatted.md` |
| `--force`             | 覆盖已有输出                                |

### export

```bash
md2docx export config [-o config.json] [--force]
md2docx export style [-f template.docx] [-o style.json] [--force]
```

`export config` 导出内置默认配置。`export style` 不带 `--file` 时导出内置默认样式；指定 DOCX 时从该文档提取样式。

### clean

```bash
md2docx clean
```

`clean` 只允许删除当前用户主目录下严格匹配的 `~/.md2docx/`。如果目标是符号链接，只删除链接本身。命令可重复执行；目录不存在时正常退出。

npm 卸载不会可靠地清理用户数据。卸载前如需清理，请显式运行：

```bash
md2docx clean
npm uninstall -g @v1hz/md2docx
```

## 默认输出

```text
md2docx report.md                     → ./report.docx
md2docx -f report.md                  → ./report.docx
md2docx format -f report.md           → ./report_formatted.md
md2docx export config                 → ./config.json
md2docx export style                  → ./style.json
md2docx export style -f template.docx → ./template_style.json
```

## 中间文件与缓存

所有运行时资源统一位于：

```text
~/.md2docx/
├── preprocess/
│   └── <输入文件名>-<绝对路径哈希>/
│       ├── <输入文件名>_formatted.md
│       └── mermaid_*.png
├── resources/
│   ├── config.json
│   ├── style.json
│   └── add-inline-code.lua
└── style/
    └── <样式内容哈希>.docx
```

输入文件的绝对路径参与目录哈希，因此不同目录下的同名 Markdown 不会复用中间文件。内置资源会在需要时写入 `resources/`；样式模板按样式内容哈希缓存。

输出 DOCX 和显式导出的配置、样式仍写到用户指定位置或当前工作目录，不会写入缓存目录。

虽然 Pandoc 实际读取的是缓存中的格式化 Markdown，但本地相对资源始终优先相对于**原始 Markdown 所在目录**解析；找不到时再搜索命令运行目录。例如 `C:/docs/example.md` 中的 `./pictures/test.png` 会解析为 `C:/docs/pictures/test.png`，与从哪个目录执行 `md2docx` 无关。绝对路径、HTTP(S) URL 和 Mermaid 生成的缓存图片不受影响。

## 配置

内置配置来自 `config/config.json`，并由 `config/config.schema.json` 提供 JSON Schema。推荐先导出再编辑：

```bash
md2docx export config
md2docx -f report.md -c config.json
```

CLI 不支持覆盖单个配置项，所有配置都通过 JSON 文件管理。

| 配置项                           | 说明                                           | 默认值                |
| -------------------------------- | ---------------------------------------------- | --------------------- |
| `detectTitle.enabled`            | 自动设置文档标题                               | `true`                |
| `detectTitle.strategy`           | `first-h1` / `single-h1` / `filename` / `none` | `"first-h1"`          |
| `normalizeHeadings.enabled`      | 修正标题起始层级与层级跳跃                     | `true`                |
| `numberHeadings.enabled`         | 为标题添加多级编号                             | `true`                |
| `numberHeadings.detectExisting`  | 重新编号前移除已识别的编号                     | `true`                |
| `numberHeadings.useBuiltinRules` | 使用内置中文和数字编号识别规则                 | `true`                |
| `figureCaption.enabled`          | 为独立图片添加题注                             | `true`                |
| `figureCaption.format`           | 图片编号格式                                   | `"图 {n}"`            |
| `figureCaption.separator`        | 图片编号与标题之间的分隔符                     | `"："`                |
| `tableCaption.enabled`           | 为表格添加题注                                 | `true`                |
| `tableCaption.format`            | 表格编号格式                                   | `"表 {n}"`            |
| `tableCaption.separator`         | 表格编号与标题之间的分隔符                     | `" "`                 |
| `renderMermaid.enabled`          | 将 Mermaid 渲染为 PNG                          | `true`                |
| `renderMermaid.theme`            | beautiful-mermaid 主题                         | `"tokyo-night-light"` |
| `renderMermaid.density`          | PNG 输出 DPI，最小值 72                        | `200`                 |

## 样式定制

`config/style.json` 定义 DOCX 的默认样式、标题样式、段落样式和字符样式。转换时，项目用 `docx` 生成 reference DOCX，再通过 Pandoc 的 `--reference-doc` 应用样式。

### 从现有 DOCX 提取

```bash
md2docx export style -f template.docx
md2docx -f report.md -s template_style.json
```

### 手动维护

主要区域包括：

- `default.document`：全局字体、字号与段落设置
- `default.heading1` 至 `default.heading6`：标题样式
- `default.title`：文档标题样式
- `paragraphStyles`：自定义段落样式
- `characterStyles`：自定义字符样式
- `tableStylesXml`：从 DOCX 提取并重新注入的表格样式 XML

基于 `a0`（Body Text）的样式会继承首行缩进。如果子样式不需要缩进，应在 `indent` 中显式清零。

## Mermaid 渲染

渲染流程如下：

```text
Mermaid
→ beautiful-mermaid
→ SVG
→ 内联 CSS var() / color-mix()
→ @resvg/resvg-wasm
→ 写入正确的 PNG DPI 元数据
→ PNG
```

resvg 不直接支持 beautiful-mermaid 输出中的所有 CSS 自定义属性，因此转换前会解析：

- `var(--name)`
- `var(--name, fallback)`
- 嵌套 fallback
- `color-mix(in srgb, ...)`
- 三位和六位十六进制颜色

Windows 会显式加载微软雅黑、Arial 和 Consolas；macOS 与 Linux 使用各自的候选系统字体。PNG 像素尺寸和 `pHYs` DPI 元数据都与 `renderMermaid.density` 保持一致。

运行时不依赖 Sharp。Sharp 只作为开发依赖，用于测试中比较 resvg 与旧渲染结果，不会打入 npm 运行时包或平台 EXE。

## 处理流水线

```text
Markdown
    ↓
解析 AST
    ↓
addTitle()
    ↓
normalizeHeadings()
    ↓
numberHeadings()
    ↓
numberTables()
    ↓
renderMermaid()
    ↓
numberPictures()
    ↓
序列化 Markdown
    ↓
生成或复用 reference DOCX
    ↓
Pandoc + Lua filter
    ↓
DOCX
```

`numberTables()` 必须先于 Mermaid 渲染；`numberPictures()` 必须后于 Mermaid 渲染，这样 Mermaid 生成的图片也能获得图题。

## 构建

从源码开发需要 [Bun](https://bun.sh/)。

```bash
git clone https://github.com/WXY-V1hZ/md2docx.git
cd md2docx
bun install

# 从源码运行
bun run src/index.ts report.md

# 测试和静态检查
bun test
bun check
```

### npm 构建

```bash
bun run build
```

输出：

```text
dist/
├── index.js
└── index_bg.wasm
```

依赖会打包进 `index.js`，resvg WASM 作为相邻资源输出。`prepack` 会自动执行此构建。

### Windows 可执行文件

```bash
bun run build:exe
```

Windows 输出为 `dist/md2docx.exe`。

`build` 和 `build:exe` 都会先删除整个 `dist/`，因此两种产物不会同时保留。尤其不要依赖手工生成的 EXE 参与 `npm publish`：发布时 `prepack` 会重新生成 npm 所需的 `index.js` 和 WASM。

## 常见问题

### 找不到 Pandoc

先检查：

```bash
pandoc --version
```

如果命令不存在，请从 [Pandoc 官方安装页](https://pandoc.org/installing.html) 安装，并重新打开终端使 `PATH` 生效。

### 输出文件已存在

默认不会覆盖文件。确认目标可以覆盖后使用：

```bash
md2docx -f report.md --force
```

### 从其他目录转换时图片缺失

相对图片路径应以原始 Markdown 文件为基准：

```text
docs/
├── example.md
└── pictures/
    └── test.png
```

```markdown
![](./pictures/test.png)
```

新版会把原始文档目录和命令运行目录传给 Pandoc 的 `--resource-path`，并优先搜索原始文档目录。如果仍然缺图，请检查路径大小写、文件是否存在，以及图片语法中是否包含错误的 URL 编码。

## 许可

md2docx 以 [GNU GPL v3.0](LICENSE) 发布。
