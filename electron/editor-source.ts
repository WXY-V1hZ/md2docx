import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { TMP_DIR } from "../src/paths";

const MAX_EDITOR_CONTENT_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_NAME_LENGTH = 80;

export interface EditorSource {
  path: string;
  name: string;
}

export function createEditorSource(
  value: unknown,
  editorDirectory = join(TMP_DIR, "editor"),
): EditorSource {
  if (!isRecord(value)) throw new Error("编辑器内容无效");
  const unknownKeys = Object.keys(value).filter((key) => !["content", "name"].includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`编辑器内容无效：未知字段 ${unknownKeys.join(", ")}`);
  }
  if (typeof value.content !== "string" || value.content.trim().length === 0) {
    throw new Error("请输入 Markdown 内容");
  }
  if (Buffer.byteLength(value.content, "utf-8") > MAX_EDITOR_CONTENT_BYTES) {
    throw new Error("Markdown 内容不能超过 5 MB");
  }
  if (typeof value.name !== "string") throw new Error("文档名称无效");

  const name = normalizeDocumentName(value.name);
  const directory = join(editorDirectory, randomUUID());
  const path = join(directory, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path, value.content, "utf-8");
  return { path, name };
}

function normalizeDocumentName(value: string): string {
  const withoutControlCharacters = [...value]
    .map((character) => (character.charCodeAt(0) < 32 ? " " : character))
    .join("");
  const stem = withoutControlCharacters
    .trim()
    .replace(/\.(?:md|markdown)$/i, "")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[. ]+/g, "")
    .replace(/[. ]+$/g, "")
    .slice(0, MAX_DOCUMENT_NAME_LENGTH)
    .trim();
  return `${stem || "未命名"}.md`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
