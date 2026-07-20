import { Command } from "commander";

export interface ConvertOptions {
  file?: string;
  preset?: string;
  config?: string;
  styleRaw?: string;
  styleConfig?: string;
  output?: string;
}

export interface FormatOptions {
  file: string;
  preset?: string;
  config?: string;
  output?: string;
}

export interface ExportConfigOptions {
  output?: string;
}

export interface ExportStyleRawOptions {
  file?: string;
  output?: string;
}

export interface ExportStyleConfigOptions {
  output?: string;
}

export interface PresetSaveOptions {
  name: string;
  config?: string;
  styleRaw?: string;
  styleConfig?: string;
}

export interface CliActions {
  convert(options: ConvertOptions): Promise<void>;
  format(options: FormatOptions): Promise<void>;
  exportConfig(options: ExportConfigOptions): Promise<void>;
  exportStyleRaw(options: ExportStyleRawOptions): Promise<void>;
  exportStyleConfig(options: ExportStyleConfigOptions): Promise<void>;
  presetList(): Promise<void>;
  presetUse(name: string): Promise<void>;
  presetSave(options: PresetSaveOptions): Promise<void>;
  clean(): void | Promise<void>;
}

export function createProgram(version: string, actions: CliActions): Command {
  const program = new Command();

  program
    .name("md2docx")
    .description("将 Markdown 转换为 Word 文档")
    .version(version, "-v, --version", "显示版本号")
    .helpOption("-h, --help", "显示帮助")
    .helpCommand(false)
    .showHelpAfterError("使用 --help 查看帮助")
    .showSuggestionAfterError()
    .enablePositionalOptions()
    .argument("[markdown]", "Markdown 文件（仅无其他转换选项时）")
    .option("-f, --file <path>", "Markdown 文件")
    .option("--preset <name>", "使用指定预设")
    .option("-c, --config <path>", "自定义配置文件")
    .option("--style-raw <path>", "自定义底层 Word 样式")
    .option("--style-config <path>", "自定义语义化样式配置")
    .option("-o, --output <path>", "输出 DOCX 文件")
    .action(async function (this: Command, markdown: string | undefined, options: ConvertOptions) {
      const hasAdditionalOptions =
        options.preset !== undefined ||
        options.config !== undefined ||
        options.styleRaw !== undefined ||
        options.styleConfig !== undefined ||
        options.output !== undefined;

      if (markdown !== undefined) {
        if (options.file !== undefined || hasAdditionalOptions) {
          this.error(
            "位置参数不能与转换选项同时使用；使用选项时请通过 -f, --file 指定 Markdown 文件",
          );
        }
        await actions.convert({ file: markdown });
        return;
      }

      if (!options.file) {
        if (hasAdditionalOptions) {
          this.error("使用转换选项时必须通过 -f, --file 指定 Markdown 文件");
        }
        this.help();
      }
      await actions.convert(options);
    });
  program.exitOverride();

  const exportCommand = program
    .command("export")
    .description("导出默认配置或样式")
    .helpOption("-h, --help", "显示帮助")
    .helpCommand(false)
    .action(function (this: Command) {
      this.help({ error: true });
    });
  exportCommand.exitOverride();

  const exportConfigCommand = exportCommand
    .command("config")
    .description("导出默认配置")
    .helpOption("-h, --help", "显示帮助")
    .option("-o, --output <path>", "输出 JSON 文件，默认 ./config.json")
    .action(actions.exportConfig);
  exportConfigCommand.exitOverride();

  const exportStyleRawCommand = exportCommand
    .command("style-raw")
    .description("导出默认底层 Word 样式，或从 DOCX 提取底层样式")
    .helpOption("-h, --help", "显示帮助")
    .option("-f, --file <path>", "用于提取底层样式的 DOCX 文件")
    .option("-o, --output <path>", "输出 JSON 文件")
    .action(actions.exportStyleRaw);
  exportStyleRawCommand.exitOverride();

  const exportStyleConfigCommand = exportCommand
    .command("style-config")
    .description("导出默认语义化样式配置")
    .helpOption("-h, --help", "显示帮助")
    .option("-o, --output <path>", "输出 JSON 文件，默认 ./style-config.json")
    .action(actions.exportStyleConfig);
  exportStyleConfigCommand.exitOverride();

  const presetCommand = program
    .command("preset")
    .description("管理配置与样式预设")
    .helpOption("-h, --help", "显示帮助")
    .helpCommand(false)
    .action(function (this: Command) {
      this.help({ error: true });
    });
  presetCommand.exitOverride();

  const presetListCommand = presetCommand
    .command("list")
    .description("列出系统和用户预设")
    .helpOption("-h, --help", "显示帮助")
    .action(actions.presetList);
  presetListCommand.exitOverride();

  const presetUseCommand = presetCommand
    .command("use")
    .description("设置默认使用的预设")
    .argument("<name>", "预设名称")
    .helpOption("-h, --help", "显示帮助")
    .action(actions.presetUse);
  presetUseCommand.exitOverride();

  const presetSaveCommand = presetCommand
    .command("save")
    .description("从一个或多个配置文件保存用户预设")
    .requiredOption("--name <name>", "预设名称")
    .option("-c, --config <path>", "Markdown 处理配置")
    .option("--style-raw <path>", "底层 Word 样式")
    .option("--style-config <path>", "语义化样式配置")
    .helpOption("-h, --help", "显示帮助")
    .action(actions.presetSave);
  presetSaveCommand.exitOverride();

  const formatCommand = program
    .command("format")
    .description("预处理并格式化 Markdown")
    .helpOption("-h, --help", "显示帮助")
    .requiredOption("-f, --file <path>", "Markdown 文件")
    .option("--preset <name>", "使用指定预设中的 Markdown 处理配置")
    .option("-c, --config <path>", "自定义配置文件")
    .option("-o, --output <path>", "输出 Markdown 文件")
    .action(actions.format);
  formatCommand.exitOverride();

  const cleanCommand = program
    .command("clean")
    .description("清除 ~/.md2docx 中的预处理文件和样式缓存")
    .helpOption("-h, --help", "显示帮助")
    .action(async () => {
      await actions.clean();
    });
  cleanCommand.exitOverride();

  return program;
}
