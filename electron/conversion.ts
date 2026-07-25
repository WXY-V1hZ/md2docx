import { randomUUID } from "node:crypto";
import { dirname, parse, resolve } from "node:path";

import { type ConvertOptions } from "../src/cli";
import { type ConvertOverrides, convertMarkdown } from "../src/commands/convert";
import { validateConfigValue } from "../src/config";
import { validateStyleConfig } from "../src/style/config";
import { createRecord } from "./conversion-history";
import type { ConversionRecord, DesktopConversionRequest, DesktopConversionResult } from "./types";

type ConvertMarkdown = (options: ConvertOptions, overrides?: ConvertOverrides) => Promise<void>;
type ResultHandler = (result: DesktopConversionResult) => void | Promise<void>;

export function parseConversionRequest(value: unknown): DesktopConversionRequest {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("转换请求无效");
  }
  const rawFiles = value.files;
  if (rawFiles.length === 0) {
    throw new Error("请选择至少一个 Markdown 文件");
  }
  const legacyFiles = rawFiles.every((file) => typeof file === "string" && file.length > 0);
  const structuredFiles = rawFiles.every(
    (file) =>
      isRecord(file) &&
      typeof file.id === "string" &&
      file.id.length > 0 &&
      typeof file.path === "string" &&
      file.path.length > 0 &&
      (file.editor === undefined || typeof file.editor === "boolean") &&
      Object.keys(file).every((key) => ["id", "path", "editor"].includes(key)),
  );
  if (!legacyFiles && !structuredFiles) throw new Error("转换文件列表无效");

  const legacyJobId =
    legacyFiles && typeof value.jobId === "string" && value.jobId.length > 0
      ? value.jobId
      : undefined;
  const legacyPrefix = legacyJobId ?? randomUUID();
  const files = legacyFiles
    ? rawFiles.map((path, index) => ({
        id: `${legacyPrefix}:${index}`,
        path: String(path),
      }))
    : rawFiles.map((file) => ({
        id: String((file as Record<string, unknown>).id),
        path: String((file as Record<string, unknown>).path),
        ...((file as Record<string, unknown>).editor === true ? { editor: true } : {}),
      }));

  const fileIds = files.map((file) => String((file as Record<string, unknown>).id));
  if (new Set(fileIds).size !== fileIds.length) {
    throw new Error("转换记录 ID 重复");
  }
  if (typeof value.preset !== "string" || value.preset.length === 0) {
    throw new Error("预设名称无效");
  }
  if (typeof value.openAfterConvert !== "boolean") {
    throw new Error("转换后打开设置无效");
  }
  return {
    files,
    preset: value.preset,
    config: validateConfigValue(structuredClone(value.config), "桌面转换设置"),
    styleConfig: validateStyleConfig(structuredClone(value.styleConfig), "桌面转换样式"),
    openAfterConvert: value.openAfterConvert,
    ...(legacyJobId ? { legacyJobId } : {}),
  };
}

export function createRecordsFromRequest(request: DesktopConversionRequest): ConversionRecord[] {
  return request.files.map(({ id, path }) => createRecord(id, path, request.preset));
}

export async function convertDesktopFiles(
  request: DesktopConversionRequest,
  onResult: ResultHandler,
  convert: ConvertMarkdown = convertMarkdown,
): Promise<void> {
  for (const { id, path: filePath, outputPath: requestedOutputPath } of request.files) {
    const outputPath =
      requestedOutputPath ?? resolve(dirname(filePath), `${parse(filePath).name}.docx`);
    let result: DesktopConversionResult;
    try {
      await convert(
        { file: filePath, output: outputPath, preset: request.preset },
        { config: request.config, styleConfig: request.styleConfig },
      );
      result = {
        status: "done",
        path: filePath,
        outputPath,
        recordId: id,
        ...(request.legacyJobId ? { jobId: request.legacyJobId } : {}),
      };
    } catch (error) {
      result = {
        status: "error",
        path: filePath,
        recordId: id,
        ...(request.legacyJobId ? { jobId: request.legacyJobId } : {}),
        error: error instanceof Error ? error.message : String(error),
      };
    }
    await onResult(result);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
