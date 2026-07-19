import { Command } from "commander";

export interface ConvertOptions {
  file?: string;
  config?: string;
  style?: string;
  output?: string;
  force?: boolean;
}

export interface FormatOptions {
  file: string;
  config?: string;
  output?: string;
  force?: boolean;
}

export interface ExportConfigOptions {
  output?: string;
  force?: boolean;
}

export interface ExportStyleOptions {
  file?: string;
  output?: string;
  force?: boolean;
}

export interface CliActions {
  convert(options: ConvertOptions): Promise<void>;
  format(options: FormatOptions): Promise<void>;
  exportConfig(options: ExportConfigOptions): Promise<void>;
  exportStyle(options: ExportStyleOptions): Promise<void>;
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
    .option("-c, --config <path>", "自定义配置文件")
    .option("-s, --style <path>", "自定义底层样式或语义化样式配置")
    .option("-o, --output <path>", "输出 DOCX 文件")
    .option("--force", "覆盖已有文件")
    .action(async function (this: Command, markdown: string | undefined, options: ConvertOptions) {
      const hasAdditionalOptions =
        options.config !== undefined ||
        options.style !== undefined ||
        options.output !== undefined ||
        options.force !== undefined;

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
    .option("--force", "覆盖已有文件")
    .action(actions.exportConfig);
  exportConfigCommand.exitOverride();

  const exportStyleCommand = exportCommand
    .command("style")
    .description("导出默认样式，或从 DOCX 提取样式")
    .helpOption("-h, --help", "显示帮助")
    .option("-f, --file <path>", "用于提取样式的 DOCX 文件")
    .option("-o, --output <path>", "输出 JSON 文件")
    .option("--force", "覆盖已有文件")
    .action(actions.exportStyle);
  exportStyleCommand.exitOverride();

  const formatCommand = program
    .command("format")
    .description("预处理并格式化 Markdown")
    .helpOption("-h, --help", "显示帮助")
    .requiredOption("-f, --file <path>", "Markdown 文件")
    .option("-c, --config <path>", "自定义配置文件")
    .option("-o, --output <path>", "输出 Markdown 文件")
    .option("--force", "覆盖已有文件")
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
