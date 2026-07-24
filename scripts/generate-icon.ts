import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const SVG = resolve(ROOT, "assets/logo.svg");
const PNG = resolve(ROOT, "assets/icon.png");
const SIZE = 1024;

try {
  const svg = readFileSync(SVG);
  await sharp(svg).resize(SIZE, SIZE).png().toFile(PNG);
  console.log(`icon: ${PNG} (${SIZE}x${SIZE})`);
} catch (err) {
  console.error("icon 生成失败:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
