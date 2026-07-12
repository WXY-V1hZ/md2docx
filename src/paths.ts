// ── 路径常量 ───────────────────────────────────────────

/** 配置文件路径 */
export const CONFIG_PATH = "config/config.json";

/** 临时文件根目录 */
export const TMP_DIR = "tmp";

/** 预处理模块的输出目录（相对于项目根目录） */
export function preprocessDir(baseName: string): string {
  return `${TMP_DIR}/preprocess/${baseName}`;
}

/** 预处理后的 Markdown 文件路径 */
export function formattedMdPath(baseName: string): string {
  return `${preprocessDir(baseName)}/${baseName}_formatted.md`;
}

/** 预处理后的 docx 文件路径 */
export function docxOutputPath(baseName: string): string {
  return `${preprocessDir(baseName)}/${baseName}.docx`;
}

/** 样式模块目录 */
export const STYLE_DIR = `${TMP_DIR}/style`;

/** 参考 docx 文件路径（样式提取的输入） */
export const STYLE_REF_DOCX = `${STYLE_DIR}/ref.docx`;

/** 样式 JSON 文件路径（提取结果的输出 / 模板生成的输入） */
export const STYLE_JSON = `${STYLE_DIR}/style.json`;

/** 生成的模板 docx 文件路径 */
export const STYLE_TEMPLATE_DOCX = `${STYLE_DIR}/template.docx`;
