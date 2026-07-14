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

export function prepareOutput(path: string, force: boolean): void {
  if (existsSync(path) && !force) {
    throw new Error(`输出文件已存在：${path}\n使用 --force 覆盖现有文件`);
  }
  mkdirSync(dirname(path), { recursive: true });
}

function assertExtension(path: string, extensions: string[], label: string): void {
  const extension = extname(path).toLowerCase();
  if (!extensions.includes(extension)) {
    throw new Error(`${label}扩展名必须是 ${extensions.join(" 或 ")}：${path}`);
  }
}
