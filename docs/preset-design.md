# Preset 设计

## 目录模型

系统内置预设固定为 `config/default/`，包含完整的 `config.json`、`style-raw.json` 和 `style-config.json`。用户预设位于 `~/.md2docx/presets/<name>/`，三个文件均可缺省；缺失文件逐项回退到系统 `default`，存在但校验失败的文件不得回退。

当前选择保存在 `~/.md2docx/settings.json`：

```json
{
  "schemaVersion": 1,
  "preset": "default"
}
```

预设名称只允许字母、数字、`-` 和 `_`，`default` 为系统保留名称。设置不存在时使用 `default`；设置指向已删除或无效的用户预设时明确报错。

## 命令

```text
md2docx preset list
md2docx preset use <name>
md2docx preset save --name <name> [--config <path>] [--style-raw <path>] [--style-config <path>]
```

`list` 每行只输出一个预设名称，当前正在使用的预设在名称后追加绿色 `*`。

`save` 至少需要一个输入文件。所有输入先通过现有类型校验，再复制到同目录临时文件夹并替换目标目录。同名保存是完整替换，未提供的标准文件会从新预设中移除并继承 `default`。输入无效或复制失败时保留旧预设。

## 转换优先级

未显式指定预设时使用设置中的当前预设，`--preset` 只覆盖本次执行。`--config` 覆盖预设 config。样式继续保持原有显式输入语义：无样式参数时使用预设 raw + config；仅指定 raw 时不应用预设 config；仅指定 config 时编译到预设 raw；两者都指定时完全使用用户输入。

`format --preset` 只读取解析后的 `config.json`。导出命令始终导出系统 `default`，不受当前预设影响。reference DOCX 缓存仍只由最终完整样式决定。

## 持久数据与清理

`presets/` 和 `settings.json` 是用户持久数据。`clean` 只删除 `preprocess/`、`resources/` 和 `style/`，不得删除预设或当前选择，也不得跟随符号链接。
