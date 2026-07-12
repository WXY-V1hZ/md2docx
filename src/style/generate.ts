import { readFileSync, mkdirSync } from "fs";
import { Document, Packer } from "docx";
import { dirname } from "path";
import { STYLE_CONFIG, STYLE_TEMPLATE_DOCX } from "../paths";

export async function generateTemplateDocx(): Promise<void> {
  const styles = JSON.parse(readFileSync(STYLE_CONFIG, "utf-8"));
  const doc = new Document({
    styles: styles,
    sections: [],
  });
  const buf = await Packer.toBuffer(doc);
  mkdirSync(dirname(STYLE_TEMPLATE_DOCX), { recursive: true });
  await Bun.write(STYLE_TEMPLATE_DOCX, buf);
}

let _generatePromise: Promise<void> | null = null;

export async function ensureTemplateDocx(): Promise<string> {
  const exists = await Bun.file(STYLE_TEMPLATE_DOCX).exists();
  if (!exists) {
    if (_generatePromise === null) {
      _generatePromise = generateTemplateDocx().catch((e) => {
        _generatePromise = null; // 重置，允许下次重试
        throw e;
      });
    }
    await _generatePromise;
  }
  return STYLE_TEMPLATE_DOCX;
}
