import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";

import { applyConfigOverrides, formatHelp, getConfigOptions, parseCliArgs } from "../src/cli";
import { type AppConfig } from "../src/config";
import { CONFIG_PATH, CONFIG_SCHEMA_PATH } from "../src/paths";

const schema = JSON.parse(readFileSync(CONFIG_SCHEMA_PATH, "utf-8"));
const configOptions = getConfigOptions(schema);

describe("CLI 参数解析", () => {
  it("解析最简调用", () => {
    const result = parseCliArgs(["report.md"], configOptions);
    expect(result.mdPath).toBe("report.md");
    expect(result.overrides.size).toBe(0);
  });

  it("解析固定参数和多种配置覆盖", () => {
    const result = parseCliArgs(
      [
        "report.md",
        "-o",
        "out/report.docx",
        "--config",
        "custom.json",
        "--renderMermaid.density",
        "300",
        "--figureCaption.enabled",
        "false",
        "--detectTitle.strategy",
        "filename",
      ],
      configOptions,
    );

    expect(result.outputPath).toBe("out/report.docx");
    expect(result.configPath).toBe("custom.json");
    expect(result.overrides.get("renderMermaid.density")).toBe(300);
    expect(result.overrides.get("figureCaption.enabled")).toBe(false);
    expect(result.overrides.get("detectTitle.strategy")).toBe("filename");
  });

  it("重复配置参数以后一个为准", () => {
    const result = parseCliArgs(
      ["report.md", "--renderMermaid.density", "200", "--renderMermaid.density", "400"],
      configOptions,
    );
    expect(result.overrides.get("renderMermaid.density")).toBe(400);
  });

  it("帮助模式不要求 Markdown 路径", () => {
    expect(parseCliArgs(["--help"], configOptions).help).toBe(true);
  });

  it("网页模式不要求 Markdown 路径", () => {
    const result = parseCliArgs(["--web"], configOptions);
    expect(result.web).toBe(true);
    expect(result.mdPath).toBeUndefined();
  });

  it("拒绝未知参数", () => {
    expect(() => parseCliArgs(["report.md", "--unknown", "value"], configOptions)).toThrow(
      "未知参数：--unknown",
    );
  });

  it("拒绝缺少参数值", () => {
    expect(() => parseCliArgs(["report.md", "--renderMermaid.theme"], configOptions)).toThrow(
      "--renderMermaid.theme 缺少值",
    );
  });

  it("拒绝错误的 boolean 值", () => {
    expect(() =>
      parseCliArgs(["report.md", "--figureCaption.enabled", "yes"], configOptions),
    ).toThrow("需要 boolean");
  });

  it("拒绝不符合 schema 的整数和枚举", () => {
    expect(() =>
      parseCliArgs(["report.md", "--renderMermaid.density", "71"], configOptions),
    ).toThrow("不能小于 72");
    expect(() =>
      parseCliArgs(["report.md", "--detectTitle.strategy", "invalid"], configOptions),
    ).toThrow("必须是以下值之一");
  });

  it("拒绝缺少或多余的位置参数", () => {
    expect(() => parseCliArgs([], configOptions)).toThrow("缺少 Markdown 文件路径");
    expect(() => parseCliArgs(["one.md", "two.md"], configOptions)).toThrow(
      "只能指定一个 Markdown 文件路径",
    );
  });
});

describe("CLI 配置处理", () => {
  it("只覆盖目标配置并保留相邻字段", () => {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as AppConfig;
    const overrides = new Map<string, unknown>([
      ["figureCaption.enabled", false],
      ["renderMermaid.density", 300],
    ]);
    const result = applyConfigOverrides(config, overrides);

    expect(result.figureCaption.enabled).toBe(false);
    expect(result.figureCaption.format).toBe(config.figureCaption.format);
    expect(result.renderMermaid.density).toBe(300);
    expect(config.figureCaption.enabled).toBe(true);
  });

  it("从 schema 生成配置帮助", () => {
    const help = formatHelp(configOptions);
    expect(help).toContain("--figureCaption.enabled <boolean>");
    expect(help).toContain("是否启用自动图片编号（默认: true）");
    expect(help).toContain("--renderMermaid.density <integer>");
    expect(help).not.toContain("--no-figureCaption.enabled");
    expect(help).toContain("--web");
  });
});
