# AGENTS.md

本文档是 Coding Agent 在本仓库中工作的实现指南。它描述当前行为、架构约束、测试要求和发布边界。文档中的“规划”不等于已实现功能；修改用户可见行为时必须同步更新本文件与 `README.md`。

---

# 项目概览

**md2docx** 是一个基于 Pandoc 的 Markdown → Word（DOCX）CLI。程序先解析 Markdown AST，执行结构化预处理，再生成 Pandoc reference DOCX，最后调用 Pandoc 输出文档。

当前预处理包括：

- 从 YAML frontmatter、H1 或文件名确定文档标题
- 规范化标题层级
- 为标题添加多级编号
- 移除文档中的分隔符（`---`、`***`、`___`）
- 为表格添加题注
- 将 Mermaid 渲染为 PNG
- 为独立图片添加题注

当前有两种构建产物：

| 产物               | 运行时                                            | Pandoc                    |
| ------------------ | ------------------------------------------------- | ------------------------- |
| npm CLI            | Node.js 22.12+                                    | 外部安装，必须位于 `PATH` |
| Windows 单文件程序 | 内置 Bun、项目代码、配置、样式、Lua 和 resvg WASM | 外部安装，必须位于 `PATH` |

单文件程序不依赖 Node.js、Bun 或 Sharp，但当前并非完全零依赖程序。便携 ZIP 捆绑 Pandoc 仍是规划，尚未实现。

---

# 必须遵守的工作流

实施变更时：

1. 阅读相关实现、测试、README 和本文件。
2. 只修改任务需要的代码，不重构无关模块。
3. 更新或添加测试，覆盖正常路径和边界情况。
4. 运行 `bun test`。
5. 运行 `bun check`。
6. 使用 `git status`、`git diff` 和 `git diff --check` 审查结果。
7. 向用户展示修改并等待审核。

提交前必须通过：

```bash
bun test
bun check
```

**禁止擅自提交。** 用户明确审核并同意之前，不得执行 git commit。不得覆盖、回滚或整理用户已有的暂存及未暂存修改。

---

# 开发命令

```bash
bun install

bun test                         # 运行全部测试
bun test --watch                 # 监视模式
bun check                        # tsc + oxlint + oxfmt

bun run src/index.ts report.md   # 从源码转换
bun run src/index.ts -f report.md --force
bun run src/index.ts format -f report.md

bun run build                    # npm/Node 构建
bun run build:exe                # Windows 单文件构建（含程序图标）
```

工具配置：

- TypeScript 严格模式：`tsconfig.json`
- oxlint：`.oxlintrc.json`
- oxfmt：`.oxfmtrc.json`
- 包管理与运行时：Bun

`build` 和 `build:exe` 都会先运行 `clean:dist`，两种产物不会同时保留在 `dist/`。

---

# 项目结构

| 文件 / 目录                              | 职责                                                    |
| ---------------------------------------- | ------------------------------------------------------- |
| `src/index.ts`                           | 入口、版本读取、CLI action 绑定和主模块检测             |
| `src/cli.ts`                             | Commander 命令树、参数、帮助与位置参数规则              |
| `src/commands/convert.ts`                | 完整 Markdown → DOCX 流程和 Pandoc 子进程调用           |
| `src/commands/format.ts`                 | 只执行 Markdown 预处理并写出 Markdown                   |
| `src/commands/export.ts`                 | 导出内置配置/样式，或从 DOCX 提取样式                   |
| `src/commands/clean.ts`                  | 安全删除 `~/.md2docx/`                                  |
| `src/preprocess/index.ts`                | 预处理流水线编排                                        |
| `src/preprocess/title.ts`                | 标题提取、标题归一化、标题编号                          |
| `src/preprocess/caption.ts`              | 表格和图片编号                                          |
| `src/preprocess/thematic-break.ts`       | 移除文档中所有 `thematicBreak`（分隔符）节点            |
| `src/preprocess/mermaid.ts`              | Mermaid → SVG → PNG、字体加载、CSS 解析、PNG DPI 元数据 |
| `src/style/extract.ts`                   | 从 DOCX 提取样式 JSON                                   |
| `src/style/config.ts`                    | 受控语义化样式配置类型、识别和运行时校验                |
| `src/style/compiler.ts`                  | 将白名单样式选项编译到完整 Word 样式预设                |
| `src/style/generate.ts`                  | 用 `docx` 生成 reference DOCX，并注入表格样式 XML       |
| `src/config.ts`                          | `AppConfig` 类型、JSON 加载与校验                       |
| `src/output.ts`                          | 输入、输出路径和覆盖策略                                |
| `src/paths.ts`                           | `~/.md2docx`、预处理目录和样式缓存路径                  |
| `src/resources.ts`                       | 内嵌默认配置、样式和 Lua filter，并按需写入运行时目录   |
| `src/assets.d.ts`                        | Bun `text` / `file` 资源导入类型声明                    |
| `config/config.json`                     | 内置默认配置                                            |
| `config/config.schema.json`              | 配置 JSON Schema                                        |
| `config/style.json`                      | 内置默认 Word 样式                                      |
| `config/style-config.json`               | 可直接使用的默认受控语义化样式配置                      |
| `config/style-config.schema.json`        | 受控语义化样式配置 JSON Schema                          |
| `config/lua/add-inline-code.lua`         | Pandoc 行内代码字符样式 filter                          |
| `assets/logo.svg`                        | Logo 矢量源文件，也是 README 展示资源                   |
| `docs/style-config-design.md`            | 受控语义化样式配置设计文档                              |
| `docs/example.md`                        | 综合转换样例                                            |
| `test/fixtures/`                         | AST 流水线输入/期望 Markdown                            |
| `test/mermaid.test.ts`                   | CSS fallback 和 PNG DPI 等纯逻辑测试                    |
| `test/mermaid-render-comparison.test.ts` | Sharp 与 resvg 人工对比；输出到 `tmp/render-compare/`   |
| `~/.md2docx/`                            | 用户运行时中间文件、内嵌资源和样式缓存，不属于仓库      |
| `dist/`                                  | 构建产物；被 git 忽略                                   |

`pandoc_docx_template/` 是历史/实验目录时应谨慎处理，不要假设它参与当前运行时流程。当前 reference DOCX 由 `src/style/generate.ts` 动态生成。

---

# CLI 契约

## 命令

```text
md2docx <markdown>
md2docx -f <markdown> [转换选项]
md2docx format -f <markdown> [选项]
md2docx export config [选项]
md2docx export style [选项]
md2docx clean
```

## 顶层转换

只有单独提供 Markdown 路径时才能使用位置参数：

```text
md2docx report.md                 合法
md2docx report.md --force         非法
md2docx -f report.md --force      合法
```

一旦出现 `--config`、`--style`、`--output` 或 `--force`，必须通过 `-f, --file` 指定输入。位置参数不能与 `--file` 混用。

顶层选项：

- `-f, --file <path>`：Markdown 输入
- `-c, --config <path>`：配置 JSON
- `-s, --style <path>`：样式 JSON
- `-o, --output <path>`：DOCX 输出
- `--force`：允许覆盖

## format

`format` 的 `--file` 必填；支持 `--config`、`--output` 和 `--force`，不接受样式。它不生成 reference DOCX，也不调用 Pandoc。

## export

- `export config` 导出内嵌默认配置。
- `export style` 不带 `--file` 时导出内嵌默认样式。
- `export style --file template.docx` 从 DOCX 提取样式。
- 两者都支持 `--output` 和 `--force`。

## clean

`clean` 删除整个 `~/.md2docx/`，包括：

- 预处理 Markdown
- Mermaid PNG
- 物化的默认配置、样式和 Lua filter
- reference DOCX 缓存
- 未来如存放于该目录中的其他可重建缓存

安全要求：

- 删除前必须确认目标严格等于 `<home>/.md2docx`。
- 必须确认目标父目录严格等于用户主目录。
- 目标为符号链接时只 unlink 链接，不递归跟随。
- 目录不存在时幂等成功。
- 禁止扩展为任意路径清理命令。

npm uninstall 生命周期脚本不应用来删除用户主目录数据。卸载清理由用户显式执行 `md2docx clean`。

## 帮助、错误和覆盖

- CLI 无参数时显示顶层帮助并以 0 退出。
- 子命令缺少必填参数时返回非 0。
- 所有写文件命令默认拒绝覆盖。
- 只有显式 `--force` 才能覆盖。
- 错误消息应指出字段、文件或命令上下文。

## 默认输出

```text
md2docx report.md                     → ./report.docx
md2docx -f report.md                  → ./report.docx
md2docx format -f report.md           → ./report_formatted.md
md2docx export config                 → ./config.json
md2docx export style                  → ./style.json
md2docx export style -f template.docx → ./template_style.json
```

---

# 运行时目录与资源

所有中间文件统一写入：

```text
~/.md2docx/
├── preprocess/
│   └── <basename>-<12位路径哈希>/
│       ├── <basename>_formatted.md
│       └── mermaid_*.png
├── resources/
│   ├── config.json
│   ├── style-config.json
│   ├── style.json
│   └── add-inline-code.lua
└── style/
    └── <16位样式哈希>.docx
```

路径规则：

- 预处理目录由输入文件名和绝对路径 SHA-256 前 12 位组成。
- Windows 哈希前将绝对路径转为小写，避免大小写导致重复缓存。
- 同名但不同目录的输入必须隔离。
- 禁止恢复在当前工作目录创建 `tmp/` 的旧行为。

资源规则：

- 默认配置、语义化样式配置、底层样式和 Lua filter 以文本形式打入 bundle/EXE。
- 外部程序 Pandoc 无法直接读取 Bun 虚拟文件，因此调用前物化到 `resources/`。
- 内容未变化时不重复写入。
- npm 构建的 resvg WASM 是 `dist/index_bg.wasm` 相邻资源。
- EXE 构建将 resvg WASM 嵌入单文件。

---

# 预处理流水线

```text
Markdown
    ↓
解析 AST
    ↓
addTitle()
    ↓
removeThematicBreaks()
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
生成/复用 reference DOCX
    ↓
Pandoc + Lua filter
    ↓
DOCX
```

顺序约束：

- `removeThematicBreaks()` 位于 `addTitle()` 之后、标题处理之前，不依赖其他步骤状态。
- `numberTables()` 必须位于 `renderMermaid()` 之前。
- `renderMermaid()` 必须位于 `numberPictures()` 之前，否则 Mermaid 图片不会编号。
- 每个步骤保持单一职责，避免步骤间隐式读写私有状态。
- 新功能优先作为独立预处理步骤实现。

---

# 核心行为

## preprocess()

`src/preprocess/index.ts` 读取 Markdown，构建 AST，按配置执行流水线并返回序列化字符串。`format` 和完整转换复用该函数。

## addTitle()

- 保留已有 YAML title。
- 无 title 时按配置策略查找 H1。
- 无合适 H1 时回退到输入文件名。
- 只使用文件名，不把完整路径写入标题。

## normalizeHeadings()

- 将文档中最浅标题映射为 H1。
- 消除标题层级跳跃。
- 尽量保留原节点、元数据和位置信息。

## numberHeadings()

- 生成层级编号，如 `1`、`1.1`、`1.1.1`。
- 可识别并剥离已有中文或数字编号。
- 编号剥离规则顺序不可随意调整：顿号多级、中文括号、中文单级、数字点分。
- 数字点分至少要求两段，避免把版本号误判为标题编号。

## removeThematicBreaks()

- 遍历根节点 `children`，移除所有 `type === "thematicBreak"` 的节点。
- 只操作根级别节点，不影响段落内或嵌套结构中可能出现的分隔符。
- 默认开启，可通过配置关闭。

## numberTables()

- 识别现有表格题注。
- 按配置生成编号和分隔符。
- 无题注时插入新题注节点。

## numberPictures()

- 只处理段落中唯一的图片节点。
- 行内混排图片不编号。
- 标题优先级：image title → alt → 文件名。
- Mermaid 图片在渲染后进入同一编号流程。

---

# Mermaid 渲染

## 流程

```text
Mermaid
→ beautiful-mermaid
→ SVG
→ resolveCSSVars()
→ resvg-wasm
→ setPngDensity()
→ PNG
```

运行时禁止重新引入 Sharp。`@resvg/resvg-wasm` 避免原生 `.node`/DLL 阻碍 Bun 单文件构建。

## CSS 兼容

beautiful-mermaid 的 SVG 包含 CSS 自定义属性，而 resvg 不能完整解释这些表达式。`resolveCSSVars()` 必须在渲染前执行，并支持：

- `var(--name)`
- `var(--name, fallback)`
- fallback 内嵌套 `var()`
- 循环引用防护
- `color-mix(in srgb, #hex pct%, #hex)`
- `#RGB` 与 `#RRGGBB`

不要退回只匹配 `/var\(--name\)/` 的简单正则。带 fallback 的变量控制节点填充、边框、生命线和消息文本；解析失败会造成“只剩 Alice/John 文本”等不完整图像。

## DPI

- `fitTo.zoom = density / 72` 控制像素尺寸。
- resvg 默认写出的 PNG DPI 元数据不符合配置，因此必须通过 `setPngDensity()` 写入/替换 `pHYs` 块。
- pHYs 使用 `round(dpi / 0.0254)` pixels per metre。
- 修改 PNG chunk 时必须重新计算 CRC32。
- 像素尺寸和 DPI 元数据都应与 Sharp 基线一致。

## 字体

resvg WASM 不会自动获得完整系统字体。当前候选：

- Windows：微软雅黑、微软雅黑粗体、Arial、Consolas
- macOS：PingFang、Helvetica、Menlo
- Linux：Noto Sans CJK、DejaVu Sans、DejaVu Sans Mono 和用户本地 Noto 字体

字体内容按进程缓存，只加载一次。调整字体时必须覆盖中文和等宽字符场景，并考虑字体文件不存在的容错行为。

## 错误处理

单个 Mermaid 节点失败时：

- 输出包含序号的错误信息。
- 保留该代码块并继续处理后续图表。
- 不得因为单图失败中断整个文档预处理。

---

# 样式系统

`config/style.json` 同时支持内置默认样式、手工维护和从 DOCX 提取。

`--style` 同时接受完整底层样式 JSON 和版本化的受控语义化样式配置。语义化配置包含 `schemaVersion: 1`、`preset: "default"` 和可选 `options`，当前只开放：

- `body.firstLineIndent`
- `headings["1"].startOnNewPage`
- `inlineCode.background`
- `codeBlock.border`

未指定 `--style` 时必须物化并加载内嵌的 `config/style-config.json`，再以 `config/style.json` 作为底层预设编译；不得绕过默认语义化配置直接使用底层样式。

字段缺失表示继承预设，`true` 必须明确写入完整的预设效果，不能因为底层属性已存在或缺失而直接返回；`false` 必须写入明确的 Word 关闭值，不能仅删除属性后继续继承。配置及其每层对象必须拒绝未知字段。不得加入任意样式透传或通用深合并入口；后续能力继续按用户需要加入白名单。完整设计位于 `docs/style-config-design.md`。

语义化配置从内置完整样式的深拷贝开始编译，不改写用户文件。缓存哈希基于编译后的完整有效样式，因此等效配置应复用缓存，不同有效样式必须隔离。

转换流程：

1. 读取样式 JSON。
2. 对内容计算 SHA-256 前 16 位。
3. 在 `~/.md2docx/style/<hash>.docx` 查找缓存。
4. 缓存不存在时用 `docx` 生成 reference DOCX。
5. 如包含 `tableStylesXml`，使用 PizZip 注入 `word/styles.xml`。
6. 将 reference DOCX 传给 Pandoc。

并发生成同一模板时使用 Promise map 去重。失败后必须删除失败 Promise，允许下次重试。

`docx` 必须按需动态导入。顶层导入会在新版 Node.js 中过早访问 Web Storage，并可能产生 ``--localstorage-file` was provided without a valid path` 警告，即使用户只运行 `md2docx -v`。

样式继承陷阱：基于 `a0`（Body Text）的样式会继承 `firstLine`。不需要缩进的子样式必须显式将 indent 清零。

---

# Pandoc 集成

当前 `src/commands/convert.ts` 直接执行：

```text
pandoc <formatted.md>
  -o <output.docx>
  --resource-path=<调用目录>
  --resource-path=<原始 Markdown 目录>
  --reference-doc=<cached-template.docx>
  --lua-filter=<materialized-filter.lua>
```

当前行为：

- 只通过系统 `PATH` 查找 `pandoc`。
- Pandoc 默认读取 `~/.md2docx` 中的格式化 Markdown，因此必须显式传入资源搜索路径，不能依赖缓存文件的位置或子进程默认 cwd。
- 使用两个独立的 `--resource-path`：先传调用目录，后传原始 Markdown 目录。Pandoc 对后出现的资源路径赋予更高搜索优先级，因此相对图片首先按源文档目录解析。
- 源目录与调用目录相同时只传一次，避免重复参数。
- 不要把原始图片 URL 全部改写为绝对路径；这会破坏 `format` 输出的可移植性。也不要为了资源解析把格式化 Markdown 写回源目录。
- 绝对资源路径、HTTP(S) URL 和 Mermaid 的绝对缓存路径应保持原行为。
- `format`、`export` 和 `clean` 不需要 Pandoc。
- Pandoc 非 0 退出时返回 exit code 和 stderr。
- Pandoc 启动失败时让错误向上层传播，不要伪装成转换成功。

## 便携发行版规划（未实现）

目标查找优先级：

1. 显式 CLI 配置或 `MD2DOCX_PANDOC` 环境变量。
2. md2docx 可执行文件旁的 `bin/pandoc` 或 `bin/pandoc.exe`。
3. 系统 `PATH`。

推荐发布 ZIP，而非把 Pandoc 塞进 npm 包：

```text
md2docx-<platform>-<arch>/
├── md2docx[.exe]
├── bin/
│   └── pandoc[.exe]
├── LICENSE
└── THIRD_PARTY_LICENSES/
    └── pandoc-COPYRIGHT
```

实现前不得修改 README 宣称 EXE 已内置 Pandoc。若未来选择把 Pandoc 嵌入单个 EXE，必须先释放到真实文件系统再 spawn，并处理版本目录、原子写入、哈希验证、Unix 执行权限、并发启动和 `clean` 后重建。

Pandoc 是 GPL-2.0-or-later。再分发官方二进制时必须包含版权和许可证声明，并提供对应源码获取信息。此处只是仓库分发要求，不替代法律审查。

---

# 构建与发布

## npm 构建

```bash
bun run build
```

期望输出：

```text
dist/
├── index.js
└── index_bg.wasm
```

约束：

- Node 目标必须捆绑 JS 依赖，不能恢复 `--packages=external`，否则全局包会缺少运行时依赖。
- resvg WASM 使用 file loader 输出为相邻文件。
- 内置 JSON/Lua 使用 text loader，不能依赖源码目录在安装后存在。
- `prepack` 自动运行 `bun run build`。
- 构建前删除 `dist/`，防止旧 EXE 或资源进入 tarball。
- 发布前必须执行 `npm pack --dry-run` 审查文件清单。

## 单文件构建

```bash
bun run build:exe
```

Windows 输出 `dist/md2docx.exe`。跨平台发布必须为每个 OS/CPU 构建并测试，不得把 Windows EXE 标记为通用产物。

单文件构建必须验证：

- `-v` 和 `--help`
- 在仓库外的工作目录运行
- 位置参数转换
- Mermaid 中文渲染
- 默认配置、样式和 Lua 资源物化
- `export config` / `export style`
- 隔离 HOME 下的 `clean`
- Pandoc 不存在时的错误

不要在测试中对真实用户的 `~/.md2docx` 执行 `clean`；使用临时 HOME/USERPROFILE。

## 发布渠道

- npm：发布 Node CLI，保持跨平台和较小包体；不含 EXE/Pandoc。
- GitHub Releases：发布平台 EXE；未来发布带 Pandoc 的便携 ZIP。
- 不建议主 npm 包携带百兆级平台二进制。
- 如果未来通过 npm 分发平台二进制，应拆分 `win32-x64`、`linux-x64`、`darwin-arm64` 等平台包，并由薄主包选择；不得把所有平台塞入一个包。

## npm 版本不可覆盖

npm 已发布版本不可重新发布。若 `npm publish` 返回 `Cannot publish over previously published version`，必须提升版本后重新发布，不能重复使用相同版本号或移动已有 tag 冒充新产物。

## 发布前清单

```bash
bun test
bun check
bun run build
node dist/index.js -v
npm pack --dry-run
git status
```

还应从临时目录运行一次真实 DOCX 转换。只有用户审核并明确同意后才能提交、打 tag、push 或 publish。

---

# 依赖边界

## 运行时依赖

- `unified` / `remark-*`：Markdown AST
- `beautiful-mermaid`：Mermaid → SVG
- `@resvg/resvg-wasm`：SVG → PNG
- `docx`：生成 reference DOCX
- `pizzip`：注入表格样式 XML
- `commander`：CLI
- `@xmldom/xmldom` / `xpath`：DOCX XML 样式提取

## 开发依赖

Sharp 只用于 `test/mermaid-render-comparison.test.ts` 生成旧渲染基线、读取 PNG 和计算像素差。禁止从生产代码导入 Sharp，禁止将它重新加入 `dependencies`。

不要重新实现依赖已经可靠提供的 Markdown 解析、DOCX 打包或 SVG 栅格化能力。可以为兼容层实现必要的 CSS 展开和 PNG 元数据修正。

---

# 测试

## 测试类别

- `test/preprocess.test.ts`：自动发现 fixture 并比较完整 AST 流水线输出，不含 Mermaid 栅格化。
- `test/cli.test.ts`：Commander 参数、帮助、版本和非法组合。
- `test/commands.test.ts`：export、format、clean、配置错误和覆盖策略。
- `test/paths.test.ts`：主目录缓存和同名输入隔离。
- `test/mermaid.test.ts`：CSS fallback、颜色和 PNG pHYs 等确定性逻辑。
- `test/mermaid-render-comparison.test.ts`：Sharp/resvg 视觉回归数据。
- `test/style-config.test.ts`：语义化样式配置校验、编译和 reference DOCX 生成。

## fixture

每个 fixture 位于：

```text
test/fixtures/<名称>/
├── input.md
└── expected.md
```

测试描述使用中文。新 AST 行为优先添加 fixture；文件系统、CLI 或二进制行为使用独立测试。

## Mermaid 对比

对比测试覆盖流程图、时序图和类图，分别使用 72 与 200 DPI，并输出：

- 像素尺寸
- 文件大小
- 差异像素比例
- 平均色差
- 人工检查 PNG

输出位于仓库忽略的 `tmp/render-compare/`。它不是用户运行时缓存，不由 `md2docx clean` 管理。

不同渲染器的抗锯齿不可能逐像素完全一致。少量差异可接受，但节点、边框、生命线、箭头或文本缺失绝不能归类为抗锯齿差异。当前参考差异应低于 5%。

## 必测边界

- 空文档
- 分隔符（---、***、___）被移除，配置关闭时分隔符保留
- 无标题、单 H1、多个 H1
- 标题不在首节点
- 标题层级跳跃
- 已有中文/数字编号
- YAML 存在、缺少和特殊字符转义
- 仅图片、行内图片、无标题图片
- 仅表格、已有表题
- Mermaid 中文、fallback CSS 和多个图表中单图失败
- 72/200 DPI 元数据
- 同名文件来自不同绝对路径
- 从不同 cwd 转换时，`./images/a.png` 和 `../shared/a.png` 相对于原始 Markdown 目录解析
- 原始 Markdown 目录与 cwd 中存在同名资源时优先使用原始目录
- 绝对图片、HTTP(S) 图片和 Mermaid 缓存图片不受 resource path 影响
- 输出存在与 `--force`
- clean 目录不存在、正常目录、符号链接和危险路径拒绝
- Node 构建与 EXE 在仓库外运行

---

# 编码与 AST 规范

- TypeScript 严格模式，避免 `any`。
- 优先精确类型和清晰的错误上下文。
- 除非原地修改明显更简单，否则优先不可变数据。
- 不创建泛化的 `utils.ts`、`common.ts`、`helper.ts` 或 `shared.ts`。
- 共享逻辑只有在多个模块真实复用时才提取。
- 不引入与任务无关的依赖或目录。
- 每个预处理步骤理想情况下只遍历 AST 一次。
- 避免重复 `visit()`、重复解析和二次算法。
- 仅修改必要节点，尽量保留节点标识、元数据和位置信息。
- 单节点失败应尽可能局部处理，不静默吞错。

命名：

- 函数和变量：`camelCase`
- 常量：`UPPER_CASE`
- 类型和接口：`PascalCase`

---

# 已知陷阱

## Array.fill()

`fill(value, start)` 的第二个参数是起始索引，不是填充数量：

```ts
counter.fill(0, depth);
```

## CSS var() fallback

`var(--muted, color-mix(...))` 不能用只识别简单右括号的正则正确解析。解析嵌套函数时必须平衡括号，并只在顶层逗号处分离变量名与 fallback。

## PNG pHYs

只缩放像素不会改变 PNG 物理 DPI。修改或插入 pHYs 时必须保持 PNG chunk 结构有效，并为 `pHYs + data` 重新计算 CRC32。

## beautiful-mermaid / ELK

beautiful-mermaid 使用 ELK WASM 布局，在 Bun 下可能偶发失败。先分别检查 `renderMermaidSVG()` 和 resvg 阶段，不要把布局失败误判为 PNG 编码失败。

## 字体与透明背景

透明 PNG 在深色图片查看器中可能显示黑色背景，这不等于图片真的填充为黑色。判断颜色时检查 alpha 或在白色背景中查看。文本缺失时先区分字体缺失和无效 fill/stroke。

## Node Web Storage 警告

不要在入口顶层导入 `docx`。按需动态导入可避免版本/帮助命令触发 Node 的 localStorage 警告。

## Bun 虚拟资源

编译 EXE 内的 file/text 资源可能位于 Bun 虚拟路径。Bun 自身可以读取，但 Pandoc 等外部进程不能；外部程序需要的内容必须物化到真实文件系统。

## Windows 路径

- 哈希路径前应规范化大小写。
- 传给 Markdown 的图片 URL 使用 `/`。
- spawn 使用参数数组，不拼接 shell 字符串。
- 子进程设置 `windowsHide: true`。

---

# 未来功能

可能的预处理扩展：

- 交叉引用
- 脚注增强
- 目录
- 公式编号
- 引文处理

可能的分发扩展：

- 程序旁便携 Pandoc 查找
- 多平台 GitHub Release 自动构建
- 包含 Pandoc 许可证与源码信息的便携 ZIP
- 可选 `MD2DOCX_PANDOC` 或 `--pandoc` 路径

未来功能必须遵守现有单向流水线、平台隔离、许可证和测试要求。
