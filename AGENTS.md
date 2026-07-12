# CLAUDE.md

此文件为 Claude Code 在本仓库中工作时提供指导。

---

# 项目

**md2docx** 是一个 Markdown 预处理工具。

在通过 pandoc 将 Markdown 转换为 Word (.docx) 之前，它会执行一系列 AST 变换以提升文档质量。

当前预处理包括：

- 提取 YAML frontmatter 标题
- 规范化标题层级
- 为标题编号
- 为图片编号
- 为表格编号
- 将 Mermaid 图表渲染为 PNG

最终生成的 Markdown 将通过 pandoc 转换为 DOCX。

---

# 开发命令

```bash
bun test                  # 运行所有测试
bun test --watch          # 监视模式

bun check                 # 类型检查 (tsc --noEmit) + 代码检查 (oxlint) + 格式检查 (oxfmt)

bun run index.ts          # 处理 base.md，输出 base_formatted.md
bun add <package>         # 安装依赖
```

- **oxlint** 配置在 `.oxlintrc.json`（`correctness: error`，插件：typescript/unicorn/oxc）
- **oxfmt** 配置在 `.oxfmtrc.json`

提交前必须两个命令都通过：

```bash
bun test
bun check
```

**提交须经用户审核**：在提交 git 之前，必须将修改内容展示给用户审核，经用户确认后方可提交。不要擅自提交。

---

# 项目结构

| 文件 / 目录                        | 职责                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| 文件 / 目录                        | 职责                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `src/index.ts`                     | 入口点。读取 Markdown，执行预处理流水线，通过 pandoc 转换为 DOCX。                  |
| `src/preprocess/index.ts`          | 预处理流水线封装（preprocess），编排所有步骤。                                      |
| `src/preprocess/title.ts`          | 标题提取（addTitle）、标题归一化（normalizeHeadings）、标题编号（numberHeadings）。 |
| `src/preprocess/caption.ts`        | 表格编号（numberTables）、图片编号（numberPictures）。                              |
| `src/preprocess/mermaid.ts`        | Mermaid → PNG 渲染（renderMermaid）及 SVG CSS 变量内联。                            |
| `src/config.ts`                    | 配置类型定义（AppConfig）与 loadConfig 加载函数。                                   |
| `src/paths.ts`                     | 路径常量统一管理。                                                                  |
| `config/config.json`               | 用户配置文件。                                                                      |
| `config/config.schema.json`        | JSON Schema，为 config.json 提供 IDE 校验。                                         |
| `base.md`                          | 全面的 Markdown 测试文档。                                                          |
| `tmp/preprocess/`                  | 预处理中间产物（格式化 md、mermaid PNG、pandoc docx）。                             |
| `tmp/style/`                       | 样式提取与模板生成的中间产物。                                                      |
| `pandoc_docx_template/`            | 用于 DOCX 生成的捆绑 pandoc 模板仓库。                                              |
| `test/`                            | 单元测试。                                                                          |

---

# 处理流水线

项目遵循单向处理流水线。

```
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
pandoc → DOCX
```

每个预处理步骤职责单一。

避免预处理步骤之间的耦合。

新功能应优先作为新的预处理步骤实现，而非扩展现有的无关步骤。

---

# 核心函数

## preprocess()

位于 `src/preprocess/index.ts`，编排所有预处理步骤，输入 Markdown 文件路径，返回格式化后的 Markdown 字符串。

---

## addTitle()

职责：

- 检测 YAML frontmatter。
- 如果没有标题：
  - 如果第一个标题是唯一的 H1，则将其提取为标题。
  - 否则使用文件名作为回退。

---

## normalizeHeadings()

职责：

- 将最小标题深度规范化为 H1。
- 消除标题层级跳跃。

示例：

```
H3
H4
H6
```

变为

```
H1
H2
H3
```

---

## numberHeadings()

添加层级编号。

示例：

```
1
1.1
1.2
2
2.1
```

---

## numberPictures()

处理**独立图片**（段落中仅有一个图片节点，行内混排的图片不编号）。

标题优先级（title → alt → 文件名）：

结果：

```
图 1：xxx
图 2：xxx
```

编号在 `renderMermaid()` 之后执行，确保 Mermaid 生成的图片也被编号。

---

## numberTables()

对于每个表格：

- 检测以 "Table:" 开头的现有标题
- 添加编号

否则：

- 插入新标题

---

## renderMermaid()

职责：

```
Mermaid
    ↓
beautiful-mermaid
    ↓
SVG
    ↓
resolveCSSVars()
    ↓
sharp
    ↓
PNG
```

生成的图片存储在：

```
base_assets/
```

Markdown 代码块被替换为图片节点。

---

# 编码规范

- 使用 TypeScript 严格模式。
- 避免使用 `any`。
- 优先使用精确的类型。
- 除非原地修改明显更简单，否则优先使用不可变数据。
- 尽可能重用现有工具函数。
- 避免引入不必要的依赖。
- 保持实现简洁。
- 与现有编码风格保持一致。

不要重构无关代码。

---

# AST 修改规则

仅修改需要变更的节点。

不要重建整个 AST。

尽可能：

- 保留节点标识。
- 保留元数据。
- 保留位置信息。

避免不必要的内存分配。

---

# 性能

每个预处理步骤理想情况下应只遍历 AST 一次。

避免：

- 多次不必要的 `visit()` 调用。
- 重复的树扫描。
- 二次算法。

优先使用线性时间实现。

---

# 错误处理

预处理应具备容错能力。

单个节点失败不应导致整个文档处理中断。

要求：

- 尽可能继续处理。
- 生成有意义的错误信息。
- 不要静默吞没异常。

示例：

如果某个 Mermaid 图表渲染失败：

- 继续渲染其余图表。
- 报告该失败。

---

# 测试

测试位于 `test/`。运行：

```bash
bun test
```

每个测试用例是一个 fixture 目录：`test/fixtures/<名称>/` 下包含 `input.md`（输入）和 `expected.md`（预期输出）。测试自动发现所有 fixture 目录并逐一运行完整流水线比对。添加新测试只需新建 fixture 目录及两个 `.md` 文件。

辅助工具（在 `test/preprocess.test.ts` 中）：

- `parse(md)` — 解析 Markdown → `{ processor, root, headings }`
- `serialize(root)` — AST → Markdown 字符串
- `runPipeline(input)` — 执行完整流水线（不含 renderMermaid）

测试指南：

- 使用 `describe` 对测试进行分组。
- 测试描述应使用中文编写。
- 优先测试纯函数，避免文件系统 IO（renderMermaid 测试需单独验证）。

每个新功能都必须包含 fixture 测试，覆盖边界情况。

---

# 测试覆盖

始终包含边界情况。

典型情况包括：

- 空文档
- 无标题
- 单个标题
- 多个 H1
- 嵌套标题
- 仅有图片
- 仅有表格
- Mermaid 代码块
- 存在 YAML
- 缺少 YAML

---

# 命名约定

函数：

```
addTitle
numberTables
renderMermaid
```

变量：

```
camelCase
```

常量：

```
UPPER_CASE
```

类型：

```
PascalCase
```

---

# 仓库约定

除非必要，不要引入新目录。

避免创建诸如以下通用工具文件：

```
utils.ts
common.ts
helper.ts
shared.ts
```

仅在模块被多个组件复用时才提取共享模块。

---

# 依赖

## unified

Markdown 解析。

## remark

Markdown AST 变换。

## beautiful-mermaid

Mermaid → SVG 渲染。

## sharp

SVG → PNG 转换。

不要重新实现这些库已提供的功能。

---

# 已知陷阱

## Array.fill()

记住 `fill(value, start)` 第二个参数是起始索引。

```ts
counter.fill(0, depth); // 并**不会**填充前 depth 个元素
```

## sharp / librsvg

它们**不支持** CSS var() 和 color-mix()。在将 SVG 传入 sharp 之前必须调用 `resolveCSSVars()` 内联所有变量。

`resolveCSSVars()` 内部做了：

1. 从 `<svg style="...">` 提取基础变量
2. 从 `<style>` 块提取派生变量（如 `--_text: var(--fg)`）
3. 迭代解析多层 `var()` 引用
4. 解析 `color-mix(in srgb, #RRGGBB pct%, #RRGGBB)` 为混合后的十六进制颜色
5. 全局替换所有剩余的 `var()` 引用

## beautiful-mermaid

使用 `elkjs` WASM 布局引擎，在 Bun 下偶尔会失败。如果 Mermaid 渲染失败，先检查 `renderMermaidSVG()` 是否成功生成了 SVG。

## numberHeadings 的中文编号剥离

`stripHeadingNum()` 按优先级匹配以下前缀模式并剥离，顺序很重要：

1. **顿号多级**：`一、二、三、`（最后一个是顿号变体，必须最先测试）
2. **中文括号**：`（一）` `(一)`
3. **中文单级**：`一、` `一.`
4. **数字点分**：`1.2.3` `1.2.3.`（要求至少两段，避免与版本号冲突）

## 流水线顺序依赖

- `numberTables()` 必须在 `renderMermaid()` 之前（表格编号插入段落节点，与 mermaid 渲染无关）
- `renderMermaid()` 必须在 `numberPictures()` 之前：mermaid 代码块被替换为图片节点后，`numberPictures()` 才能为它们编号

---

# 开发工作流

实施变更时：

1. 理解现有实现。
2. 审查相关测试。
3. 实现功能。
4. 更新或添加测试。
5. 运行：

```bash
bun test
```

6. 运行：

```bash
bun check
```

7. 审查变更：

```bash
git status
```

只有所有检查都通过后才可提交变更。

---

# 未来功能

未来的预处理可能包括：

- 交叉引用
- 脚注
- 目录
- 公式编号
- 引文处理
- 调用 pandoc
- DOCX 样式定制

未来功能应遵循现有的预处理流水线架构。
