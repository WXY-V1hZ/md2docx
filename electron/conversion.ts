import { dirname, parse, resolve } from "node:path";

import { type ConvertOptions } from "../src/cli";
import { convertMarkdown } from "../src/commands/convert";

export interface DesktopConversionRequest {
  files: string[];
  preset?: string;
  openAfterConvert: boolean;
}

export type DesktopConversionResult =
  | { status: "done"; path: string; outputPath: string }
  | { status: "error"; path: string; error: string };

type ConvertMarkdown = (options: ConvertOptions) => Promise<void>;
type ResultHandler = (result: DesktopConversionResult) => void | Promise<void>;

export function parseConversionRequest(value: unknown): DesktopConversionRequest {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("转换请求无效");
  }

  const files = value.files;
  if (files.length === 0 || files.some((file) => typeof file !== "string" || file.length === 0)) {
    throw new Error("请选择至少一个 Markdown 文件");
  }
  if (value.preset !== undefined && typeof value.preset !== "string") {
    throw new Error("预设名称无效");
  }
  if (typeof value.openAfterConvert !== "boolean") {
    throw new Error("转换后打开设置无效");
  }

  return {
    files,
    preset: value.preset,
    openAfterConvert: value.openAfterConvert,
  };
}

export async function convertDesktopFiles(
  request: DesktopConversionRequest,
  onResult: ResultHandler,
  convert: ConvertMarkdown = convertMarkdown,
): Promise<void> {
  for (const filePath of request.files) {
    const outputPath = resolve(dirname(filePath), `${parse(filePath).name}.docx`);
    try {
      await convert({ file: filePath, output: outputPath, preset: request.preset });
      await onResult({ status: "done", path: filePath, outputPath });
    } catch (error) {
      await onResult({
        status: "error",
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
