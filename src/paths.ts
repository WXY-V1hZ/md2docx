import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, parse, resolve } from "node:path";

/** 中间文件根目录（位于用户主目录） */
export const TMP_DIR = join(homedir(), ".md2docx");

/** 用户预设目录（持久数据，不由 clean 删除） */
export const PRESETS_DIR = join(TMP_DIR, "presets");

/** 当前预设设置（持久数据，不由 clean 删除） */
export const SETTINGS_PATH = join(TMP_DIR, "settings.json");

/** 预处理模块的输出目录，使用输入路径哈希隔离同名文件 */
export function preprocessDir(inputPath: string): string {
  const absolutePath = resolve(inputPath);
  const hashInput = process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath;
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 12);
  return join(TMP_DIR, "preprocess", `${parse(inputPath).name}-${hash}`);
}

/** 预处理后的 Markdown 文件路径 */
export function formattedMdPath(inputPath: string): string {
  return join(preprocessDir(inputPath), `${parse(inputPath).name}_formatted.md`);
}

/** 样式模块目录 */
export const STYLE_DIR = join(TMP_DIR, "style");

/** 根据样式内容哈希生成模板 docx 缓存路径 */
export function styleTemplateDocx(hash: string): string {
  return join(STYLE_DIR, `${hash}.docx`);
}
