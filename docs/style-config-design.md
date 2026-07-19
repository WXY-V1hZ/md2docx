# 受控语义化样式配置设计

## 目标

md2docx 的底层 `style.json` 包含 Word 样式 ID、OOXML 单位、继承关系、边框和颜色等大量实现细节。它适合作为生成 reference DOCX 的完整样式定义，但不适合作为普通用户或 Web 页面直接编辑的模型。

语义化样式配置只开放经过筛选的高频选项。未开放的颜色、尺寸、间距、对齐方式和 Word 样式关系始终由预设控制。它不是通用 Word 样式编辑器，也不允许任意字段透传到底层样式。

## 分层

样式处理分为三层：

```text
用户 StyleConfig（少量白名单选项）
                ↓
受控 StyleCompiler
                ↓
完整 WordStyleDefinition 预设
                ↓
reference DOCX
```

`StyleConfig` 面向用户和未来的 Web 页面。`WordStyleDefinition` 是当前 `config/style.json` 所使用的底层结构，只在程序内部和高级兼容场景中出现。Compiler 从完整预设的副本开始，只修改公开选项对应的固定属性，不改写用户提供的配置文件。

仓库提供 `config/style-config.json` 作为可直接使用的默认配置，并提供 `config/style-config.schema.json` 作为公开配置契约。转换未指定 `--style` 时自动物化并加载内嵌的默认语义化配置；完整的 `config/style.json` 只作为它的底层编译预设。

## 第一版配置

```json
{
  "$schema": "https://raw.githubusercontent.com/WXY-V1hZ/md2docx/main/config/style-config.schema.json",
  "schemaVersion": 1,
  "preset": "default",
  "options": {
    "body": {
      "firstLineIndent": true
    },
    "headings": {
      "1": {
        "startOnNewPage": true
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

字段缺失表示完整继承预设；`true` 表示启用预设中定义的效果；`false` 表示显式关闭效果。用户不能配置缩进量、背景色、边框颜色、边框宽度或一级标题的其他段落属性。

第一版只支持 `default` 预设。转换命令的 `--style` 同时接受上述语义化配置和旧版底层样式 JSON。包含 `schemaVersion`、`preset` 或 `options` 的文件按语义化配置校验；包含 `paragraphStyles` 等底层字段的旧文件保持原行为。

## 编译规则

Compiler 每次从未修改的预设创建深拷贝。字段为 `true` 时明确写入该选项的预设效果，即使底层样式当前缺少相应属性也能启用；字段为 `false` 时写入明确的关闭值：

| 用户选项                       | 底层目标                         | 关闭方式                               |
| ------------------------------ | -------------------------------- | -------------------------------------- |
| `body.firstLineIndent`         | `First Paragraph` 和 `Body Text` | `firstLine`、`firstLineChars` 设为 `0` |
| `headings["1"].startOnNewPage` | `heading 1`                      | `pageBreakBefore` 设为 `false`         |
| `inlineCode.background`        | `Inline Code` 字符样式           | 底纹设为 `clear/auto`                  |
| `codeBlock.border`             | `Source Code` 段落样式           | 四边均写入 `val: "none"`               |

关闭时不能简单删除字段，否则 Word 可能继续从父样式继承效果。Compiler 通过稳定的样式名称定位目标，不依赖当前默认样式中的短 ID。

编译后的完整样式参与缓存哈希。不同语义化配置只有在最终 Word 样式确实不同时才生成不同的 reference DOCX 缓存。

## 校验与 Web 页面

`config/style-config.schema.json` 是公开配置契约。Schema 和运行时校验都在每一层拒绝未知字段，因此拼写错误不会被静默忽略，Web 页面也只能展示程序明确支持的控件。

后续新增能力时继续采用白名单方式。例如可以为各级标题开放中英文字体、粗体和斜体，为表格开放少量命名预设；标题颜色、段落对齐、边框颜色等没有明确用户需求的底层设置不进入公开 Schema。不得增加通用 `deepMerge` 或任意样式补丁入口。

## 扩展边界

公开配置的字段名表达用户意图，而不是 OOXML 实现。例如表格样式应优先设计为 `three-line`、`grid`、`minimal` 等有限预设，而不是暴露每条边框。新增字段时必须同步更新 TypeScript 类型、运行时校验、JSON Schema、README、本文档和正常/边界测试。
