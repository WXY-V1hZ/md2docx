import { readFileSync, mkdirSync } from "fs";
import { createHash } from "node:crypto";
import { Document, Packer } from "docx";
import { dirname } from "path";
import { styleTemplateDocx } from "../paths";

/**
 * 根据样式 JSON 文件生成模板 docx。
 *
 * @param styleJsonPath - 样式 JSON 文件路径（如 config/style.json）
 */
export async function generateTemplateDocx(
  styleJsonPath: string,
  outputPath: string,
): Promise<void> {
  const raw = JSON.parse(readFileSync(styleJsonPath, "utf-8")) as Record<string, unknown>;
  const tableStylesXml = raw.tableStylesXml as string | undefined;
  // 移除 tableStylesXml，docx 包不识别它
  const { tableStylesXml: _, ...styles } = raw;

  const doc = new Document({
    styles: styles as Record<string, unknown>,
    sections: [],
  });
  const buf = await Packer.toBuffer(doc);
  mkdirSync(dirname(outputPath), { recursive: true });

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
      await Bun.write(outputPath, modifiedBuf);
      return;
    }
  }

  await Bun.write(outputPath, buf);
}

const generatePromises = new Map<string, Promise<void>>();

/**
 * 获取模板 docx 路径。如果模板不存在，则自动生成。
 *
 * @param styleJsonPath - 样式 JSON 文件路径（如 config/style.json）
 */
export async function ensureTemplateDocx(styleJsonPath: string): Promise<string> {
  const raw = readFileSync(styleJsonPath);
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  const outputPath = styleTemplateDocx(hash);
  const exists = await Bun.file(outputPath).exists();
  if (!exists) {
    let promise = generatePromises.get(outputPath);
    if (!promise) {
      promise = generateTemplateDocx(styleJsonPath, outputPath).catch((error) => {
        generatePromises.delete(outputPath);
        throw error;
      });
      generatePromises.set(outputPath, promise);
    }
    await promise;
  }
  return outputPath;
}
