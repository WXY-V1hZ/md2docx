import { existsSync, lstatSync, rmSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { TMP_DIR } from "../paths";

interface CleanPaths {
  targetDir: string;
  homeDir: string;
  /** 为 true 时删除整个 ~/.md2docx（含预设和设置） */
  all?: boolean;
}

function validateTarget(target: string, home: string): void {
  const expected = resolve(home, ".md2docx");
  if (target !== expected || dirname(target) !== home) {
    throw new Error(`拒绝清理非预期目录：${target}`);
  }
  if (!existsSync(target)) {
    console.log(`无需清理：${target}`);
    return;
  }
  if (lstatSync(target).isSymbolicLink()) {
    throw new Error(`拒绝清理符号链接目录：${target}`);
  }
}

export function cleanIntermediateFiles(paths: Partial<CleanPaths> = {}): void {
  const home = resolve(paths.homeDir ?? homedir());
  const target = resolve(paths.targetDir ?? TMP_DIR);
  validateTarget(target, home);
  if (!existsSync(target)) return;

  if (paths.all) {
    rmSync(target, { recursive: true, force: true });
    console.log(`已清除所有用户数据：${target}`);
    return;
  }

  for (const name of ["preprocess", "resources", "style"]) {
    const cachePath = resolve(target, name);
    if (dirname(cachePath) !== target) throw new Error(`拒绝清理非预期目录：${cachePath}`);
    if (!existsSync(cachePath)) continue;
    if (lstatSync(cachePath).isSymbolicLink()) unlinkSync(cachePath);
    else rmSync(cachePath, { recursive: true, force: true });
  }
  console.log(`已清理缓存：${target}`);
}
