import { describe, expect, it } from "bun:test";
import { Command, CommanderError } from "commander";

import {
  type CliActions,
  type ConvertOptions,
  type ExportConfigOptions,
  type ExportStyleOptions,
  type FormatOptions,
  createProgram,
} from "../src/cli";

interface Calls {
  convert: ConvertOptions[];
  format: FormatOptions[];
  exportConfig: ExportConfigOptions[];
  exportStyle: ExportStyleOptions[];
}

function setup() {
  const calls: Calls = { convert: [], format: [], exportConfig: [], exportStyle: [] };
  const output: string[] = [];
  const actions: CliActions = {
    convert: async (options) => void calls.convert.push(options),
    format: async (options) => void calls.format.push(options),
    exportConfig: async (options) => void calls.exportConfig.push(options),
    exportStyle: async (options) => void calls.exportStyle.push(options),
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
      ["-f", "report.md", "-c", "config.json", "-s", "style.json", "-o", "report.docx", "--force"],
      { from: "user" },
    );

    expect(calls.convert).toEqual([
      {
        file: "report.md",
        config: "config.json",
        style: "style.json",
        output: "report.docx",
        force: true,
      },
    ]);
  });

  it("解析 format 子命令", async () => {
    const { program, calls } = setup();
    await program.parseAsync(
      ["format", "--file", "report.md", "--config", "config.json", "--force"],
      { from: "user" },
    );

    expect(calls.format).toEqual([{ file: "report.md", config: "config.json", force: true }]);
  });

  it("解析 export config 子命令", async () => {
    const { program, calls } = setup();
    await program.parseAsync(["export", "config", "-o", "custom.json", "--force"], {
      from: "user",
    });

    expect(calls.exportConfig).toEqual([{ output: "custom.json", force: true }]);
  });

  it("解析 export style 的可选 DOCX 文件", async () => {
    const { program, calls } = setup();
    await program.parseAsync(
      ["export", "style", "--file", "template.docx", "--output", "style.json"],
      { from: "user" },
    );

    expect(calls.exportStyle).toEqual([{ file: "template.docx", output: "style.json" }]);
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

  it("拒绝旧版 Markdown 位置参数", async () => {
    const { program } = setup();
    expect(program.parseAsync(["report.md"], { from: "user" })).rejects.toThrow(
      "too many arguments",
    );
  });

  it("各层级均提供帮助", async () => {
    for (const args of [
      ["--help"],
      ["export", "--help"],
      ["export", "config", "--help"],
      ["export", "style", "--help"],
      ["format", "--help"],
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
