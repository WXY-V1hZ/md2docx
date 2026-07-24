import { describe, expect, test } from "bun:test";
import { dirname, join, parse, resolve } from "node:path";

import {
  convertDesktopFiles,
  parseConversionRequest,
  type DesktopConversionResult,
} from "../electron/conversion";

describe("Electron 桌面转换", () => {
  test("校验来自 renderer 的转换请求", () => {
    expect(() => parseConversionRequest({ files: [], openAfterConvert: true })).toThrow(
      "请选择至少一个 Markdown 文件",
    );
    expect(() => parseConversionRequest({ files: ["report.md"], openAfterConvert: "yes" })).toThrow(
      "转换后打开设置无效",
    );

    expect(
      parseConversionRequest({
        files: ["report.md"],
        preset: "academic",
        openAfterConvert: false,
      }),
    ).toEqual({
      files: ["report.md"],
      preset: "academic",
      openAfterConvert: false,
    });
  });

  test("复用完整转换入口并逐文件报告结果", async () => {
    const first = join(process.cwd(), "documents", "first.md");
    const second = join(process.cwd(), "documents", "second.markdown");
    const calls: { file?: string; output?: string; preset?: string }[] = [];
    const results: DesktopConversionResult[] = [];

    await convertDesktopFiles(
      {
        files: [first, second],
        preset: "academic",
        openAfterConvert: true,
      },
      (result) => {
        results.push(result);
      },
      async (options) => {
        calls.push(options);
        if (options.file === second) throw new Error("测试转换失败");
      },
    );

    expect(calls).toEqual([
      {
        file: first,
        output: resolve(dirname(first), `${parse(first).name}.docx`),
        preset: "academic",
      },
      {
        file: second,
        output: resolve(dirname(second), `${parse(second).name}.docx`),
        preset: "academic",
      },
    ]);
    expect(results).toEqual([
      {
        status: "done",
        path: first,
        outputPath: resolve(dirname(first), "first.docx"),
      },
      {
        status: "error",
        path: second,
        error: "测试转换失败",
      },
    ]);
  });
});
