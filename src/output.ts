import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

export function resolveInputPath(path: string, extensions: string[], label: string): string {
  const resolved = resolve(path);
  if (!existsSync(resolved)) throw new Error(`找不到${label}：${resolved}`);
  if (!statSync(resolved).isFile()) throw new Error(`${label}不是文件：${resolved}`);
  assertExtension(resolved, extensions, label);
  return resolved;
}

export function resolveOutputPath(
  path: string | undefined,
  defaultName: string,
  extensions: string[],
  label: string,
): string {
  const resolved = resolve(path ?? defaultName);
  assertExtension(resolved, extensions, label);
  return resolved;
}

export function prepareOutput(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function assertExtension(path: string, extensions: string[], label: string): void {
  const extension = extname(path).toLowerCase();
  if (!extensions.includes(extension)) {
    throw new Error(`${label}扩展名必须是 ${extensions.join(" 或 ")}：${path}`);
  }
}
