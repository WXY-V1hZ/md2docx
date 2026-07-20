import { describe, expect, it } from "bun:test";
import { Command, CommanderError } from "commander";

import {
  type CliActions,
  type ConvertOptions,
  type ExportConfigOptions,
  type ExportStyleConfigOptions,
  type ExportStyleRawOptions,
  type FormatOptions,
  type PresetSaveOptions,
  createProgram,
} from "../src/cli";

interface Calls {
  convert: ConvertOptions[];
  format: FormatOptions[];
  exportConfig: ExportConfigOptions[];
  exportStyleRaw: ExportStyleRawOptions[];
  exportStyleConfig: ExportStyleConfigOptions[];
  presetList: number;
  presetUse: string[];
  presetSave: PresetSaveOptions[];
  clean: number;
}

function setup() {
  const calls: Calls = {
    convert: [],
    format: [],
    exportConfig: [],
    exportStyleRaw: [],
    exportStyleConfig: [],
    presetList: 0,
    presetUse: [],
    presetSave: [],
    clean: 0,
  };
  const output: string[] = [];
  const actions: CliActions = {
    convert: async (options) => void calls.convert.push(options),
    format: async (options) => void calls.format.push(options),
    exportConfig: async (options) => void calls.exportConfig.push(options),
    exportStyleRaw: async (options) => void calls.exportStyleRaw.push(options),
    exportStyleConfig: async (options) => void calls.exportStyleConfig.push(options),
    presetList: async () => void calls.presetList++,
    presetUse: async (name) => void calls.presetUse.push(name),
    presetSave: async (options) => void calls.presetSave.push(options),
    clean: () => void calls.clean++,
  };
  const program = createProgram("1.2.3", actions);
  function configure(command: Command): void {
    command.exitOverride();
    command.configureOutput({
      writeOut: (text) => void output.push(text),
      writeErr: (text) => void output.push(text),
    });
    for (const child of command.commands) configure(child);
  }
  configure(program);
  return { program, calls, output };
}

describe("CLI 命令解析", () => {
  it("解析顶层转换参数", async () => {
    const { program, calls } = setup();
    await program.parseAsync(
      [
        "-f",
        "report.md",
        "-c",
        "config.json",
        "--preset",
        "academic",
        "--style-raw",
        "style-raw.json",
        "--style-config",
        "style-config.json",
        "-o",
        "report.docx",
      ],
      { from: "user" },
    );

    expect(calls.convert).toEqual([
      {
        file: "report.md",
        preset: "academic",
        config: "config.json",
        styleRaw: "style-raw.json",
        styleConfig: "style-config.json",
        output: "report.docx",
      },
    ]);
  });

  it("解析 format 子命令", async () => {
    const { program, calls } = setup();
    await program.parseAsync(["format", "--file", "report.md", "--config", "config.json"], {
      from: "user",
    });

    expect(calls.format).toEqual([{ file: "report.md", config: "config.json" }]);
  });

  it("解析 preset list、use 和 save", async () => {
    const setupResult = setup();
    await setupResult.program.parseAsync(["preset", "list"], { from: "user" });
    expect(setupResult.calls.presetList).toBe(1);

    const useResult = setup();
    await useResult.program.parseAsync(["preset", "use", "academic"], { from: "user" });
    expect(useResult.calls.presetUse).toEqual(["academic"]);

    const saveResult = setup();
    await saveResult.program.parseAsync(
      [
        "preset",
        "save",
        "--name",
        "academic",
        "--config",
        "config.json",
        "--style-raw",
        "style-raw.json",
        "--style-config",
        "style-config.json",
      ],
      { from: "user" },
    );
    expect(saveResult.calls.presetSave).toEqual([
      {
        name: "academic",
        config: "config.json",
        styleRaw: "style-raw.json",
        styleConfig: "style-config.json",
      },
    ]);
  });

  it("format 接受 preset，并允许 config 显式覆盖", async () => {
    const { program, calls } = setup();
    await program.parseAsync(
      ["format", "--file", "report.md", "--preset", "academic", "--config", "config.json"],
      { from: "user" },
    );
    expect(calls.format).toEqual([
      { file: "report.md", preset: "academic", config: "config.json" },
    ]);
  });

  it("解析 export config 子命令", async () => {
    const { program, calls } = setup();
    await program.parseAsync(["export", "config", "-o", "custom.json"], {
      from: "user",
    });

    expect(calls.exportConfig).toEqual([{ output: "custom.json" }]);
  });

  it("解析 export style-raw 的可选 DOCX 文件", async () => {
    const { program, calls } = setup();
    await program.parseAsync(
      ["export", "style-raw", "--file", "template.docx", "--output", "style-raw.json"],
      { from: "user" },
    );

    expect(calls.exportStyleRaw).toEqual([{ file: "template.docx", output: "style-raw.json" }]);
  });

  it("解析 export style-config", async () => {
    const { program, calls } = setup();
    await program.parseAsync(["export", "style-config", "--output", "style-config.json"], {
      from: "user",
    });

    expect(calls.exportStyleConfig).toEqual([{ output: "style-config.json" }]);
  });

  it("export style-config 不接受 --file", async () => {
    const { program } = setup();
    expect(
      program.parseAsync(["export", "style-config", "--file", "template.docx"], {
        from: "user",
      }),
    ).rejects.toMatchObject({ code: "commander.unknownOption" });
  });

  it("解析 clean 子命令", async () => {
    const { program, calls } = setup();
    await program.parseAsync(["clean"], { from: "user" });

    expect(calls.clean).toBe(1);
  });

  it("无参数时显示顶层帮助", async () => {
    const { program, output } = setup();
    try {
      await program.parseAsync([], { from: "user" });
    } catch (error) {
      expect(error).toBeInstanceOf(CommanderError);
      expect((error as CommanderError).code).toBe("commander.help");
      expect((error as CommanderError).exitCode).toBe(0);
    }
    expect(output.join("")).toContain("Usage: md2docx");
  });

  it("format 缺少 --file 时失败", async () => {
    const { program } = setup();
    expect(program.parseAsync(["format"], { from: "user" })).rejects.toMatchObject({
      code: "commander.missingMandatoryOptionValue",
    });
  });

  it("拒绝旧版动态配置参数", async () => {
    const { program } = setup();
    expect(
      program.parseAsync(["-f", "report.md", "--figureCaption.enabled", "false"], {
        from: "user",
      }),
    ).rejects.toMatchObject({ code: "commander.unknownOption" });
  });

  it("拒绝旧的 --style 和 export style", async () => {
    const first = setup();
    expect(
      first.program.parseAsync(["-f", "report.md", "--style", "style.json"], { from: "user" }),
    ).rejects.toMatchObject({ code: "commander.unknownOption" });

    const second = setup();
    expect(second.program.parseAsync(["export", "style"], { from: "user" })).rejects.toThrow(
      "too many arguments",
    );
  });

  it("仅提供 Markdown 位置参数时执行转换", async () => {
    const { program, calls } = setup();
    await program.parseAsync(["report.md"], { from: "user" });

    expect(calls.convert).toEqual([{ file: "report.md" }]);
  });

  it("位置参数不能与转换选项混用", async () => {
    const { program } = setup();
    expect(
      program.parseAsync(["report.md", "--output", "report.docx"], { from: "user" }),
    ).rejects.toThrow("位置参数不能与转换选项同时使用");
  });

  it("使用转换选项时必须通过 --file 指定输入", async () => {
    const { program } = setup();
    expect(program.parseAsync(["--output", "report.docx"], { from: "user" })).rejects.toThrow(
      "使用转换选项时必须通过 -f, --file 指定 Markdown 文件",
    );
  });

  it("不再接受 --force", async () => {
    for (const args of [
      ["-f", "report.md", "--force"],
      ["format", "-f", "report.md", "--force"],
      ["export", "config", "--force"],
      ["export", "style-raw", "--force"],
      ["export", "style-config", "--force"],
      ["preset", "save", "--name", "example", "--config", "config.json", "--force"],
    ]) {
      const { program } = setup();
      expect(program.parseAsync(args, { from: "user" })).rejects.toMatchObject({
        code: "commander.unknownOption",
      });
    }
  });

  it("各层级均提供帮助", async () => {
    for (const args of [
      ["--help"],
      ["export", "--help"],
      ["export", "config", "--help"],
      ["export", "style-raw", "--help"],
      ["export", "style-config", "--help"],
      ["preset", "--help"],
      ["preset", "list", "--help"],
      ["preset", "use", "--help"],
      ["preset", "save", "--help"],
      ["format", "--help"],
      ["clean", "--help"],
    ]) {
      const { program, output } = setup();
      try {
        await program.parseAsync(args, { from: "user" });
      } catch (error) {
        expect(error).toBeInstanceOf(CommanderError);
        expect((error as CommanderError).code).toBe("commander.helpDisplayed");
      }
      expect(output.join("")).toContain("Usage:");
    }
  });

  it("显示版本号", async () => {
    const { program, output } = setup();
    try {
      await program.parseAsync(["--version"], { from: "user" });
    } catch (error) {
      expect(error).toBeInstanceOf(CommanderError);
      expect((error as CommanderError).code).toBe("commander.version");
    }
    expect(output.join("")).toContain("1.2.3");
  });
});
