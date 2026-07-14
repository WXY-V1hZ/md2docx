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
}

export function createProgram(version: string, actions: CliActions): Command {
  const program = new Command();

  program
    .name("md2docx")
    .description("将 Markdown 转换为 Word 文档")
    .version(version, "-v, --version", "显示版本号")
    .helpOption("-h, --help", "显示帮助")
    .addHelpCommand(false)
    .showHelpAfterError("使用 --help 查看帮助")
    .showSuggestionAfterError()
    .enablePositionalOptions()
    .option("-f, --file <path>", "Markdown 文件")
    .option("-c, --config <path>", "自定义配置文件")
    .option("-s, --style <path>", "自定义样式文件")
    .option("-o, --output <path>", "输出 DOCX 文件")
    .option("--force", "覆盖已有文件")
    .action(async function (options: ConvertOptions) {
      if (!options.file) this.help();
      await actions.convert(options);
    });
  program.exitOverride();

  const exportCommand = program
    .command("export")
    .description("导出默认配置或样式")
    .helpOption("-h, --help", "显示帮助")
    .addHelpCommand(false)
    .action(function () {
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

  return program;
}
