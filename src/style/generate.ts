import { readFileSync, mkdirSync } from "fs";
import { Document, Packer } from "docx";
import { dirname } from "path";
import { STYLE_TEMPLATE_DOCX } from "../paths";

/**
 * 根据样式 JSON 文件生成模板 docx。
 *
 * @param styleJsonPath - 样式 JSON 文件路径（如 config/style.json）
 */
export async function generateTemplateDocx(styleJsonPath: string): Promise<void> {
  const raw = JSON.parse(readFileSync(styleJsonPath, "utf-8")) as Record<string, unknown>;
  const tableStylesXml = raw.tableStylesXml as string | undefined;
  // 移除 tableStylesXml，docx 包不识别它
  const { tableStylesXml: _, ...styles } = raw;

  const doc = new Document({
    styles: styles as Record<string, unknown>,
    sections: [],
  });
  const buf = await Packer.toBuffer(doc);
  mkdirSync(dirname(STYLE_TEMPLATE_DOCX), { recursive: true });

  // 如果有表格样式 XML，注入到生成的 docx 中
  if (tableStylesXml) {
    const PizZip = (await import("pizzip")).default;
    const zip = new PizZip(buf);
    const stylesFile = zip.file("word/styles.xml");
    if (stylesFile) {
      const originalXml = stylesFile.asText();
      // 在 </w:styles> 之前插入表格样式
      const injectedXml = originalXml.replace("</w:styles>", tableStylesXml + "</w:styles>");
      zip.file("word/styles.xml", injectedXml);
      const modifiedBuf = zip.generate({ type: "nodebuffer" }) as Buffer;
      await Bun.write(STYLE_TEMPLATE_DOCX, modifiedBuf);
      return;
    }
  }

  await Bun.write(STYLE_TEMPLATE_DOCX, buf);
}

let _generatePromise: Promise<void> | null = null;

/**
 * 获取模板 docx 路径。如果模板不存在，则自动生成。
 *
 * @param styleJsonPath - 样式 JSON 文件路径（如 config/style.json）
 */
export async function ensureTemplateDocx(styleJsonPath: string): Promise<string> {
  const exists = await Bun.file(STYLE_TEMPLATE_DOCX).exists();
  if (!exists) {
    if (_generatePromise === null) {
      _generatePromise = generateTemplateDocx(styleJsonPath).catch((e) => {
        _generatePromise = null;
        throw e;
      });
    }
    await _generatePromise;
  }
  return STYLE_TEMPLATE_DOCX;
}
