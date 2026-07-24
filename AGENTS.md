# AGENTS.md

Coding Agent 实现指南。修改用户可见行为时同步更新本文件和 `README.md`。

---

## 工作流

1. 阅读相关实现、测试、README 和本文件
2. 只修改任务需要的代码，不重构无关模块
3. 更新或添加测试
4. `bun test && bun check`
5. `git status && git diff && git diff --check`
6. 向用户展示修改并等待审核

**禁止擅自提交。** 不得覆盖、回滚或整理用户已有的暂存/未暂存修改。

## 命令

```bash
bun install
bun test                         # 全部测试
bun check                        # tsc + oxlint + oxfmt
bun run src/index.ts report.md   # 从源码转换
bun run build                    # npm 构建输出 dist/index.js + WASM
bun run build:exe                # Windows 单文件构建
bun run build:electron           # 构建 Electron 主进程 + preload
bun run electron                 # 构建前端并启动 Electron
```

`build` 和 `build:exe` 互斥（先 `clean:dist`）。TypeScript 严格模式。包管理/运行时：Bun。

---

## 项目结构

| 路径                      | 职责                                                 |
| ------------------------- | ---------------------------------------------------- |
| `src/index.ts`            | 入口、action 绑定                                    |
| `src/cli.ts`              | Commander 命令树                                     |
| `src/commands/convert.ts` | Markdown→DOCX + Pandoc 子进程                        |
| `src/commands/format.ts`  | 只预处理并写出 Markdown                              |
| `src/commands/export.ts`  | 导出内置或从 DOCX 提取样式                           |
| `src/commands/preset.ts`  | 预设 list/use/save                                   |
| `src/commands/clean.ts`   | 安全删除 `~/.md2docx` 缓存                           |
| `src/preset.ts`           | 预设发现、回退、保存、持久化                         |
| `src/config.ts`           | AppConfig 类型定义与校验                             |
| `src/output.ts`           | 路径解析与扩展名校验                                 |
| `src/paths.ts`            | `~/.md2docx/` 各子目录路径                           |
| `src/resources.ts`        | 物化内置 JSON/Lua 到文件系统                         |
| `src/preprocess/`         | 流水线各步骤（title/caption/mermaid/thematic-break） |
| `src/style/`              | 样式系统（config/compiler/generate/extract）         |
| `electron/`               | Electron 主进程 + preload                            |
| `frontend/`               | Vue 3 + Vite + Tailwind 桌面端                       |
| `config/default/`         | 内置默认配置、样式                                   |
| `config/lua/`             | Pandoc Lua filter                                    |
| `test/`                   | 测试                                                 |

`pandoc_docx_template/` 是历史实验目录，不参与运行时。

### Electron 桌面端规则

- `titleBarStyle: "hidden"`；Windows/Linux 用 `titleBarOverlay` 保留原生按钮，macOS traffic lights
- 标题栏 48px，拖拽区同时声明 `-webkit-app-region: drag` 和 `app-region: drag`，交互控件同时声明对应的 `no-drag`
- 不使用 `frame: false`，不通过 renderer 操作 BrowserWindow
- 布局优先 Tailwind；Electron 专属 CSS（app-region/titlebar-area）保持独立 CSS 文件
- Vite `base` 保持 `"./"`
- `AppTitleBar.vue` 必须显式加载 `frontend/styles/titlebar.css`，否则 Logo 会按 SVG 自然尺寸展开，且拖拽与安全区域失效
- Electron 32+ 不再提供 `File.path`；拖入文件路径由 preload 使用 `webUtils.getPathForFile()` 获取
- Electron 运行前先由 Bun 将 `electron/main.ts` 打包到 `dist-electron/main.js`，并将 sandbox preload 编译为 `dist-electron/preload.cjs`
- 桌面转换必须调用 `convertMarkdown()` 复用完整 CLI 流水线，不得单独执行裸 `pandoc`
- 完成项目从队列移除后进入标题栏转换记录；每个文件保留独立记录，可打开输出、定位文件并基于最新源文件重新生成
- 转换记录保存到 `~/.md2docx/conversion-history.json`，最多 30 条；清除记录不得影响转换中的任务或删除实际文件
- 转换记录面板只由点击标题栏按钮触发，不使用悬停自动展开
- 面板遮罩与面板本体分别过渡；动效使用短时长和减速曲线，并遵守 `prefers-reduced-motion`

---

## CLI 契约

```text
md2docx <markdown>
md2docx -f <markdown> [转换选项]
md2docx format -f <markdown> [选项]
md2docx export config [选项]
md2docx export style-raw [选项]
md2docx export style-config [选项]
md2docx preset list|use <name>|save --name <name> [选项]
md2docx clean
```

**顶层转换**：位置参数只能单独使用，不能与 `--file`/`--preset`/`--config`/`--style-raw`/`--style-config`/`--output` 混用。

**format**：`--file` 必填，支持 `--preset`/`--config`/`--output`，不接受样式参数，不生成 reference DOCX，不调用 Pandoc。

**export**：`config` 和 `style-config` 导出内置文件；`style-raw` 无 `--file` 时导出内置，有 `--file file.docx` 时从 DOCX 提取。

**preset**：`list` 每行一个名称，当前项加绿色 `*`。`use <name>` 校验并持久化。`save --name <name>` 至少需 `--config`/`--style-raw`/`--style-config` 之一，同名完整替换。`default` 为保留名称。

**clean**：只删 `preprocess/`、`resources/`、`style/`，保留 `presets/` 和 `settings.json`。删除前校验目标严格等于 `<home>/.md2docx`，根目录为符号链时拒绝，缓存子目录为符号链时只 unlink。

**默认输出**：

```text
report.md                  → ./report.docx
format -f report.md        → ./report_formatted.md
export config              → ./config.json
export style-raw           → ./style-raw.json
export style-raw -f t.docx → ./t_style-raw.json
export style-config        → ./style-config.json
```

所有写文件命令默认覆盖已有输出。无参数时显示帮助并以 0 退出。

---

## 运行时目录

```
~/.md2docx/
├── settings.json
├── presets/<name>/{config,style-raw,style-config}.json  (可选)
├── preprocess/<basename>-<sha256:12>/{formatted.md, mermaid_*.png}
├── resources/default/{config,style-raw,style-config}.json + *.lua
└── style/<sha256:16>.docx
```

- 预处理目录用绝对路径 SHA-256 前 12 位，Windows 路径哈希前小写
- 内置资源以 Bun text loader 打入 bundle，Pandoc 读取前物化到 `resources/`
- 样式缓存基于最终有效样式 SHA-256 前 16 位
- 预设缺失文件逐项继承 system default，文件存在但无效时报错

---

## 预处理流水线 (顺序固定)

```
Markdown → AST → addTitle() → removeThematicBreaks() → normalizeHeadings()
→ numberHeadings() → numberTables() → renderMermaid() → numberPictures()
→ 序列化 → 生成/复用 reference DOCX → Pandoc + Lua filter → DOCX
```

约束：`removeThematicBreaks` 在标题处理前；`numberTables` 在 `renderMermaid` 前；`renderMermaid` 在 `numberPictures` 前。新功能优先作为独立步骤。

### 各步骤行为

- **addTitle**：保留已有 YAML title；按策略 first-h1/single-h1/filename/none 查找 H1，回退到文件名（不含路径）
- **normalizeHeadings**：最浅标题 → H1，消除层级跳跃
- **numberHeadings**：生成层级编号，剥离已有编号（剥离顺序：顿号多级 → 中文括号 → 中文单级 → 数字点分；数字点分至少两段防误判版本号）
- **removeThematicBreaks**：移除根级别 `thematicBreak` 节点
- **numberTables**：识别已有 `Table:` 题注并编号，无题注则插入
- **numberPictures**：只编号段落中唯一图片（行内混排不编号）；标题优先级 image title > alt > 文件名

---

## Mermaid 渲染

流程：`Mermaid → beautiful-mermaid → SVG → resolveCSSVars() → resvg-wasm → setPngDensity() → PNG`

**CSS 兼容**：`resolveCSSVars()` 解析 `var(--name, fallback)`（平衡括号、顶层逗号分隔）、嵌套 var、循环引用防护、`color-mix(in srgb, #hex pct%, #hex)`、`#RGB`/`#RRGGBB`。不得退回简单正则。

**DPI**：`fitTo.zoom = density / 72` 控制像素尺寸。resvg 默认 pHYs 不准确，必须用 `setPngDensity()` 写入 `pHYs` 块（`round(dpi / 0.0254)` ppm），需重新计算 CRC32。

**字体**：按进程缓存一次。Windows: msyh.ttc/msyhbd.ttc/arial.ttf/consola.ttf；macOS: PingFang/Helvetica/Menlo；Linux: Noto Sans CJK/DejaVu Sans/DejaVu Sans Mono。需覆盖中文和等宽场景，容错字体缺失。

**错误**：单图失败输出错误信息并 `continue`，保留代码块，不中断整个文档。

---

## DOCX 图片尺寸限制

`config.json` 的 `imageSize` 控制（enabled/maxWidthCm/maxHeightCm）。通过 Pandoc metadata 传给 `limit-image-size.lua` filter。规则：`scale = min(1, maxW/naturalW, maxH/naturalH)`，不放大小图；Markdown 已显式设 width/height 时不应用；读取失败只警告一次；相同 src 缓存尺寸；Pandoc 3.1.13+ 才支持 `pandoc.image.size()`；`format` 不应用此限制。

---

## 样式系统

双层设计：**底层样式** (`style-raw.json`) 为完整 Word 样式定义；**语义化配置** (`style-config.json`) 为受控白名单，schemaVersion: 1。

当前开放选项：

- `body.firstLineIndent` (boolean)
- `body.lineSpacing` (正浮点数，行距倍数)
- `headings["1"].startOnNewPage`, `.alignment` (left/center)
- `headings["1".."6"].bold`
- `headings["4".."6"].italic`
- `inlineCode.background`
- `codeBlock.border`

输入组合：都不指定→当前预设；仅 `--style-raw`→直接用 raw，不读默认 config；仅 `--style-config`→config 应用到当前预设 raw；两者都指定→config 应用到用户 raw。

编译规则：字段缺失继承 raw；`true` 写入完整效果；`false` 写入明确关闭值。每层拒绝未知字段。从 raw 深拷贝开始编译。正文行距编译到 First Paragraph/Body Text 的 `paragraph.spacing`，`line = Math.round(multiplier * 240)`，`lineRule: "auto"`。标题粗体同时写 `bold` + `boldComplexScript`，斜体同时写 `italics` + `italicsComplexScript`。

缓存：用最终有效样式 SHA-256 前 16 位命名。`docx` 包必须动态导入（避免顶层触发 Web Storage 警告）。并发生成用 Promise map 去重，失败后清除以允许重试。

---

## Pandoc 集成

命令：`pandoc <formatted.md> -o <output.docx> --resource-path=<cwd> --resource-path=<源目录> --reference-doc=<模板> --lua-filter=<add-inline-code.lua> [--metadata=md2docx-image-max-width-cm:... --metadata=md2docx-image-max-height-cm:... --lua-filter=<limit-image-size.lua>]`

- 只通过系统 PATH 查找 pandoc
- 两个 `--resource-path`：调用目录在前（优先级低），源目录在后（优先级高）；相同时只传一次
- 不要把图片 URL 改写为绝对路径，不要把格式化 Markdown 写回源目录
- `imageSize.enabled` 关闭时不传参数，不物化 filter
- Pandoc 非 0 退出时返回 exit code + stderr

---

## 构建与发布

- `bun run build`：`dist/index.js` + `dist/index_bg.wasm`。Node 目标必须捆绑 JS 依赖，不能 `--packages=external`
- `bun run build:exe`：`dist/md2docx.exe`
- 发布前：`bun test && bun check && bun run build && node dist/index.js -v && npm pack --dry-run && git status`
- npm 已发布版本不可覆盖
- npm 发 Node CLI，GitHub Releases 发 EXE

---

## 依赖边界

**运行时**：unified/remark-\*、beautiful-mermaid、@resvg/resvg-wasm、docx、pizzip、commander、@xmldom/xmldom、xpath

**禁止重新引入 Sharp 到生产代码**。它只作为 devDep 用于测试对比。

---

## 测试

| 文件                                     | 内容                                 |
| ---------------------------------------- | ------------------------------------ |
| `test/preprocess.test.ts`                | 自动发现 fixtures 运行完整流水线比对 |
| `test/cli.test.ts`                       | Commander 参数解析                   |
| `test/commands.test.ts`                  | export/format/clean/校验             |
| `test/preset.test.ts`                    | 预设解析/保存/use                    |
| `test/style-config.test.ts`              | 样式校验/编译/生成/缓存              |
| `test/mermaid.test.ts`                   | CSS/PNG 纯逻辑                       |
| `test/mermaid-render-comparison.test.ts` | Sharp/resvg 视觉对比                 |
| `test/paths.test.ts`                     | 目录隔离                             |
| `test/image-size.test.ts`                | 图片尺寸逻辑                         |

Fixture 格式：`test/fixtures/<name>/input.md + expected.md`。新 AST 行为优先用 fixture。

---

## 编码规范

- TypeScript 严格模式，避免 `any`
- 优先不可变数据，除非原地修改更简单
- 禁止创建 `utils.ts`/`common.ts`/`helper.ts`/`shared.ts`
- 每个预处理步骤理想情况只遍历 AST 一次
- 单节点失败局部处理，不静默吞错
- 命名：`camelCase` / `UPPER_CASE` / `PascalCase`

---

## 已知陷阱

- **Array.fill**：`fill(value, start)` 的第二个参数是起始索引，不是填充数量
- **CSS var fallback**：`var(--x, color-mix(...))` 必须平衡括号、顶层逗号分隔，不能简单正则
- **PNG pHYs**：修改/插入 pHYs chunk 必须重新计算 CRC32
- **beautiful-mermaid/ELK** 可能偶发失败，先区分布局失败和 PNG 编码失败
- **透明 PNG**：黑背景不一定是黑色填充，检查 alpha
- **docx 动态导入**：避免顶层导入触发 Node Web Storage 警告
- **Bun 虚拟资源**：外部进程不能直接读取，需物化到文件系统
- **Windows 路径**：哈希前小写、URL 用 `/`、spawn 用参数数组、`windowsHide: true`
