import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "path";
import { styleTemplateDocx } from "../paths";
import { type RawStyleDefinition } from "./compiler";

/**
 * 根据完整底层样式生成模板 docx。
 */
export async function generateTemplateDocx(
  rawStyle: RawStyleDefinition,
  outputPath: string,
): Promise<void> {
  await generateTemplateDocxFromStyles(rawStyle, outputPath);
}

async function generateTemplateDocxFromStyles(
  raw: RawStyleDefinition,
  outputPath: string,
): Promise<void> {
  const { Document, Packer } = await import("docx");
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
      await writeFile(outputPath, modifiedBuf);
      return;
    }
  }

  await writeFile(outputPath, buf);
}

const generatePromises = new Map<string, Promise<void>>();

export function styleCacheHash(rawStyle: RawStyleDefinition): string {
  return createHash("sha256").update(JSON.stringify(rawStyle)).digest("hex").slice(0, 16);
}

/**
 * 获取模板 docx 路径。如果模板不存在，则自动生成。
 */
export async function ensureTemplateDocx(rawStyle: RawStyleDefinition): Promise<string> {
  const hash = styleCacheHash(rawStyle);
  const outputPath = styleTemplateDocx(hash);
  if (!existsSync(outputPath)) {
    let promise = generatePromises.get(outputPath);
    if (!promise) {
      promise = generateTemplateDocxFromStyles(rawStyle, outputPath).catch((error) => {
        generatePromises.delete(outputPath);
        throw error;
      });
      generatePromises.set(outputPath, promise);
    }
    await promise;
  }
  return outputPath;
}
