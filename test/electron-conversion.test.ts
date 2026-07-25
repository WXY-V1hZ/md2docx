import { describe, expect, test } from "bun:test";
import { dirname, join, parse, resolve } from "node:path";

import {
  createRecordsFromRequest,
  convertDesktopFiles,
  parseConversionRequest,
} from "../electron/conversion";
import { selectHistoryToPersist } from "../electron/conversion-history";
import { type DesktopConversionResult } from "../electron/types";
import defaultConfig from "../config/default/config.json" with { type: "json" };
import defaultStyleConfig from "../config/default/style-config.json" with { type: "json" };

const config = structuredClone(defaultConfig) as PresetAppConfig & { $schema?: string };
delete config.$schema;
const styleConfig = defaultStyleConfig as PresetStyleConfig;

describe("Electron 桌面转换", () => {
  test("校验来自 renderer 的转换请求", () => {
    expect(() => parseConversionRequest({ files: [], openAfterConvert: true })).toThrow(
      "请选择至少一个 Markdown 文件",
    );
    expect(() =>
      parseConversionRequest({
        files: [{ id: "report", path: "report.md" }],
        preset: "default",
        config,
        styleConfig,
        openAfterConvert: "yes",
      }),
    ).toThrow("转换后打开设置无效");

    expect(
      parseConversionRequest({
        files: [{ id: "report", path: "report.md" }],
        preset: "academic",
        config,
        styleConfig,
        openAfterConvert: false,
      }),
    ).toEqual({
      files: [{ id: "report", path: "report.md" }],
      preset: "academic",
      config,
      styleConfig,
      openAfterConvert: false,
    });

    expect(() =>
      parseConversionRequest({
        files: [
          { id: "duplicate", path: "first.md" },
          { id: "duplicate", path: "second.md" },
        ],
        openAfterConvert: false,
      }),
    ).toThrow("转换记录 ID 重复");

    expect(() =>
      parseConversionRequest({
        files: [{ id: "report", path: "report.md" }],
        preset: "default",
        config: { ...config, unexpected: true },
        styleConfig,
        openAfterConvert: false,
      }),
    ).toThrow("不是支持的配置项");

    expect(() =>
      parseConversionRequest({
        files: [{ id: "report", path: "report.md" }],
        preset: "default",
        config,
        styleConfig: { ...styleConfig, unexpected: true },
        openAfterConvert: false,
      }),
    ).toThrow("不是支持的配置项");
  });

  test("兼容开发期 HMR 尚未刷新的旧版文件请求", () => {
    expect(
      parseConversionRequest({
        jobId: "legacy-batch",
        files: ["first.md", "second.md"],
        preset: "default",
        config,
        styleConfig,
        openAfterConvert: true,
      }),
    ).toEqual({
      files: [
        { id: "legacy-batch:0", path: "first.md" },
        { id: "legacy-batch:1", path: "second.md" },
      ],
      preset: "default",
      config,
      styleConfig,
      openAfterConvert: true,
      legacyJobId: "legacy-batch",
    });
  });

  test("为批量文件保留独立且稳定的历史记录 ID", () => {
    const records = createRecordsFromRequest({
      files: [
        { id: "first-record", path: "first.md" },
        { id: "second-record", path: "second.md" },
      ],
      preset: "academic",
      config,
      styleConfig,
      openAfterConvert: false,
    });

    expect(records.map(({ id }) => id)).toEqual(["first-record", "second-record"]);
  });

  test("历史上限不会移除仍在转换的记录", () => {
    const active = createRecordsFromRequest({
      files: [
        { id: "active-1", path: "active-1.md" },
        { id: "active-2", path: "active-2.md" },
      ],
      preset: "default",
      config,
      styleConfig,
      openAfterConvert: false,
    });
    const completed = Array.from({ length: 32 }, (_, index) => ({
      ...active[0]!,
      id: `completed-${index}`,
      status: "success" as const,
      startedAt: index,
      completedAt: index,
    }));

    const selected = selectHistoryToPersist([...completed, ...active]);

    expect(selected).toHaveLength(30);
    expect(selected.filter(({ status }) => status === "converting")).toHaveLength(2);
    expect(selected.some(({ id }) => id === "completed-31")).toBe(true);
    expect(selected.some(({ id }) => id === "completed-0")).toBe(false);
  });

  test("复用完整转换入口并逐文件报告结果", async () => {
    const first = join(process.cwd(), "documents", "first.md");
    const second = join(process.cwd(), "documents", "second.markdown");
    const customOutput = join(process.cwd(), "output", "first.docx");
    const calls: {
      options: { file?: string; output?: string; preset?: string };
      overrides: unknown;
    }[] = [];
    const results: DesktopConversionResult[] = [];

    await convertDesktopFiles(
      {
        files: [
          { id: "first-record", path: first, outputPath: customOutput },
          { id: "second-record", path: second },
        ],
        preset: "academic",
        config,
        styleConfig,
        openAfterConvert: true,
      },
      (result) => {
        results.push(result);
      },
      async (options, overrides) => {
        calls.push({ options, overrides });
        if (options.file === second) throw new Error("测试转换失败");
      },
    );

    expect(calls).toEqual([
      {
        options: {
          file: first,
          output: customOutput,
          preset: "academic",
        },
        overrides: { config, styleConfig },
      },
      {
        options: {
          file: second,
          output: resolve(dirname(second), `${parse(second).name}.docx`),
          preset: "academic",
        },
        overrides: { config, styleConfig },
      },
    ]);
    expect(results).toEqual([
      {
        status: "done",
        path: first,
        outputPath: customOutput,
        recordId: "first-record",
      },
      {
        status: "error",
        path: second,
        error: "测试转换失败",
        recordId: "second-record",
      },
    ]);
  });
});
