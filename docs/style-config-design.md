# 底层样式与语义化样式配置设计

## 目标

md2docx 将 Word 样式拆分为两个类型固定的输入。`style-raw.json` 保存 `docx` 生成 reference DOCX 所需的完整底层样式；`style-config.json` 只开放经过筛选的高频语义化选项。两者不能通过内容自动识别或混用。

底层 raw 包含 Word 样式 ID、OOXML 单位、继承关系、边框和颜色等实现细节，主要面向内置资源、高级用户和 DOCX 样式提取。语义化 config 面向普通用户和未来 Web 页面，不允许任意属性透传。

## 分层与输入组合

```text
Style Raw（完整底层样式）
          +
Style Config（可选白名单覆盖）
          ↓
受控 Style Compiler
          ↓
最终 RawStyleDefinition
          ↓
reference DOCX
```

转换必须严格遵守：

| 参数                | 行为                                      |
| ------------------- | ----------------------------------------- |
| 都不指定            | 默认 raw + 默认 config                    |
| 仅 `--style-raw`    | 直接使用用户 raw，不读取或应用默认 config |
| 仅 `--style-config` | 用户 config 应用到默认 raw                |
| 两者都指定          | 用户 config 应用到用户 raw                |

仓库提供 `config/style-raw.json`、`config/style-config.json` 和 `config/style-config.schema.json`。默认资源以文本形式打入 npm bundle 和单文件 EXE。

## 当前语义化配置

```json
{
  "$schema": "https://raw.githubusercontent.com/WXY-V1hZ/md2docx/main/config/style-config.schema.json",
  "schemaVersion": 1,
  "options": {
    "body": {
      "firstLineIndent": true,
      "lineSpacing": "double"
    },
    "headings": {
      "1": {
        "startOnNewPage": false,
        "alignment": "center",
        "bold": true
      },
      "2": {
        "bold": true
      },
      "3": {
        "bold": true
      },
      "4": {
        "bold": true,
        "italic": false
      },
      "5": {
        "bold": true,
        "italic": false
      },
      "6": {
        "bold": true,
        "italic": false
      }
    },
    "inlineCode": {
      "background": true
    },
    "codeBlock": {
      "border": true
    }
  }
}
```

字段缺失表示继承 raw；`true` 表示明确写入完整启用效果，即使 raw 缺少对应属性也必须生效；`false` 表示写入明确关闭值。正文行距为浮点数倍数，例如 `1.5` 表示 1.5 倍行距；一级标题对齐使用 `left`、`center`。配置不包含 `preset`，也不允许设置缩进量、其他对齐方式、背景色、边框颜色或其他未开放属性。

## 编译与校验

Compiler 每次从选定 raw 的深拷贝开始，只修改公开选项对应的固定属性：

| 用户选项                       | 底层目标                         | 关闭方式                               |
| ------------------------------ | -------------------------------- | -------------------------------------- |
| `body.firstLineIndent`         | `First Paragraph` 和 `Body Text` | `firstLine`、`firstLineChars` 设为 `0` |
| `body.lineSpacing`             | `First Paragraph` 和 `Body Text` | `line = Math.round(multiplier × 240)`  |
| `headings["1"].startOnNewPage` | `heading 1`                      | `pageBreakBefore` 设为 `false`         |
| `headings["1"].alignment`      | `heading 1`                      | 写入 `left` 或 `center`                |
| `headings["1".."6"].bold`      | 对应标题的 run                   | 同时写入普通和复杂文字粗体             |
| `headings["4".."6"].italic`    | 对应标题的 run                   | 同时写入普通和复杂文字斜体             |
| `inlineCode.background`        | `Inline Code` 字符样式           | 底纹设为 `clear/auto`                  |
| `codeBlock.border`             | `Source Code` 段落样式           | 四边写入 `style: "none"`               |

关闭时不能只删除属性，否则 Word 可能继续继承效果。启用和关闭都不能因 raw 当前属性存在或缺失而直接返回。不得增加通用 `deepMerge` 或任意样式补丁入口。

`loadStyleRaw()` 只接受具有底层 Word 样式字段的 JSON 对象；`loadStyleConfig()` 只接受通过 Schema 契约的语义化配置。传错入口时必须提示改用对应的 `--style-raw` 或 `--style-config`。

## 导出与缓存

```text
md2docx export style-raw                  → style-raw.json
md2docx export style-raw -f template.docx → template_style-raw.json
md2docx export style-config               → style-config.json
```

从 DOCX 提取的结果是底层 raw。reference DOCX 缓存哈希只基于最终 `RawStyleDefinition`，因此不同输入组合产生相同有效样式时复用缓存，最终样式不同时隔离缓存。

## 扩展边界

后续能力继续按白名单增加，例如为标题开放中英文字体，或为表格开放有限的命名方案。Web 页面只根据 `style-config.schema.json` 展示允许修改的控件；颜色、未明确开放的段落对齐和底层 Word 属性不进入公开配置。
