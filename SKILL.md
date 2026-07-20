---
name: md2docx
description: "将 Markdown 文件转换为排版完善的 Word DOCX，或只格式化 Markdown；支持标题层级与编号、表格和图片题注、Mermaid、图片尺寸限制、受控语义化样式、完整底层 Word 样式，以及从现有 DOCX 提取样式。当用户要求把 Markdown 转成 Word、从 Markdown 生成 DOCX、规范 Markdown、复用 Word 模板样式或调整 md2docx 配置时使用。"
---

# md2docx

## 概述

使用 `md2docx` CLI 将 Markdown 转换为 DOCX。优先调用 CLI，不要自行拼装 Pandoc 参数或直接修改 DOCX XML；md2docx 已处理标题归一化、编号、题注、Mermaid、资源路径、reference DOCX 和 Lua filter。

## 默认行为约束

- 用户只要求“把 Markdown 转成 DOCX”且没有提出其他要求时，直接使用默认转换。
- 禁止修改、格式化、覆盖或回写用户的源 Markdown。不要为了转换调用 `format`，也不要向源文件添加 frontmatter、图片尺寸、标题编号或其他内容。md2docx 在缓存目录中生成内部格式化副本是允许的。
- 用户没有明确指定配置、样式定制或导出需求时，禁止运行任何 `md2docx export ...` 命令，禁止擅自创建或导出 `config.json`、`style-config.json`、`style-raw.json`。
- 用户没有指定配置或样式文件时，使用 md2docx 内置的默认 config、默认 style config 和默认 raw style，不要为了“更好看”自行选择或生成替代配置。

## 前置检查

1. 确认 CLI 和 Pandoc 可用：

```bash
md2docx --help
pandoc --version
```

2. 如果缺少 CLI 且当前环境有 Node.js 22.12+，先取得用户同意，再安装 npm CLI：

```bash
npm install -g @v1hz/md2docx
```

3. 如果缺少 Pandoc，停止转换并提示用户安装 Pandoc。图片自然尺寸限制需要 Pandoc 3.1.13 或更高版本。

## 工作流程

1. 确认输入 Markdown 路径；只有用户指定输出路径时才添加 `--output`。
2. 用户只要求转换时直接使用默认转换；只有用户明确提出自定义需求或提供配置、样式文件时，才选择对应选项。
3. 执行转换并检查退出状态。
4. 确认输出文件存在且非空；交付前如可使用 Word 或 DOCX 渲染工具，再检查分页、标题、表格、图片和 Mermaid。

## Markdown 转 DOCX

只有输入文件、不附带其他转换选项时，使用位置参数：

```bash
md2docx report.md
```

需要指定任何选项时，必须通过 `-f, --file` 指定输入：

```bash
md2docx -f report.md -o output/report.docx
```

不要写成：

```bash
md2docx report.md -o output/report.docx
```

所有写文件命令默认覆盖已有输出，不存在 `--force` 选项。

## 处理配置

仅当用户明确要求自定义处理配置或导出配置时使用本节。用户已经提供配置文件时直接使用，不要重复导出；需要新建配置时，先导出完整默认配置，再修改需要的字段：

```bash
md2docx export config -o config.json
md2docx -f report.md -c config.json
```

处理配置控制标题检测与编号、表格和图片题注、Mermaid、分隔符移除和 DOCX 图片最大尺寸。不要把只包含少数字段的局部对象当作完整配置传入。

## Word 样式

仅当用户明确要求调整 Word 样式、导出样式或复用现有 DOCX 样式时使用本节。普通转换禁止导出样式。需要调整常用选项时，优先使用语义化样式配置：

```bash
md2docx export style-config -o style-config.json
md2docx -f report.md --style-config style-config.json
```

语义化配置只开放受控选项，包括：

- 正文首行缩进和正数倍数行距，例如 `1`、`1.5`、`2`。
- 一级标题左对齐或居中、是否另起一页。
- 一至六级标题是否加粗。
- 四至六级标题是否斜体。
- 行内代码背景和代码块外框。

需要完整控制 Word 样式时，导出或提取底层样式：

```bash
md2docx export style-raw -o style-raw.json
md2docx export style-raw -f template.docx -o template_style-raw.json
md2docx -f report.md --style-raw style-raw.json
```

严格遵守样式输入组合：

| 输入                | 行为                                |
| ------------------- | ----------------------------------- |
| 都不指定            | 默认 raw + 默认 config              |
| 仅 `--style-raw`    | 直接使用用户 raw，不应用默认 config |
| 仅 `--style-config` | 用户 config 应用到默认 raw          |
| 两者都指定          | 用户 config 应用到用户 raw          |

同时使用两个样式文件：

```bash
md2docx -f report.md --style-raw template_style-raw.json --style-config style-config.json -o report.docx
```

## 只格式化 Markdown

需要预处理 Markdown、但不生成 DOCX 时运行：

```bash
md2docx format -f report.md
md2docx format -f report.md -c config.json -o report_formatted.md
```

`format` 不调用 Pandoc，也不应用 Word 样式或 DOCX 图片尺寸限制。默认输出为 `<文件名>_formatted.md`。

## 输出与资源

默认输出：

```text
md2docx report.md                     → report.docx
md2docx format -f report.md           → report_formatted.md
md2docx export config                 → config.json
md2docx export style-raw              → style-raw.json
md2docx export style-raw -f a.docx    → a_style-raw.json
md2docx export style-config           → style-config.json
```

相对图片路径优先相对于原始 Markdown 所在目录解析。不要为了转换把图片 URL 全部改成绝对路径。远程图片需要网络访问；本地 Markdown、普通图片和 Mermaid 渲染本身不要求联网。

中间文件和样式缓存位于 `~/.md2docx/`。只有用户明确要求清理时才运行：

```bash
md2docx clean
```

不要将 `clean` 作为普通转换后的收尾步骤。

## 故障处理

- CLI 不存在：安装 `@v1hz/md2docx` 或确认可执行文件位于 `PATH`。
- Pandoc 不存在：安装 Pandoc 后重新打开终端。
- 使用选项时报输入缺失：改用 `md2docx -f input.md ...`。
- 图片找不到：检查路径是否相对于原始 Markdown 文件目录。
- 样式文件类型错误：`style-config.json` 使用 `--style-config`，完整底层样式使用 `--style-raw`。
- Mermaid 单图失败：保留错误信息和原代码块，继续检查其他输出，不要把整次预处理误判为完全失败。

## 验证

转换成功后至少确认：

1. 命令退出码为 0。
2. 输出 DOCX 存在且文件大小大于 0。
3. Pandoc stderr 中没有 reference document、Lua filter 或资源路径错误。
4. 对最终交付文档检查标题编号、正文行距、分页、题注、表格、图片缩放和 Mermaid；布局要求严格时优先使用 Microsoft Word 复核。
