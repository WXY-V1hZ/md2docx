import { type Root } from "mdast";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg, initWasm, type CustomFontsOptions } from "@resvg/resvg-wasm";
import resvgWasmPath from "@resvg/resvg-wasm/index_bg.wasm" with { type: "file" };
import { renderMermaidSVG, THEMES } from "beautiful-mermaid";

let wasmInitialization: Promise<void> | undefined;
let fontLoading: Promise<CustomFontsOptions> | undefined;
const RESVG_WASM_PATH = isAbsolute(resvgWasmPath)
  ? resvgWasmPath
  : resolve(dirname(fileURLToPath(import.meta.url)), resvgWasmPath);

function initializeResvg(): Promise<void> {
  const wasm =
    typeof Bun === "undefined"
      ? readFile(RESVG_WASM_PATH)
      : Bun.file(RESVG_WASM_PATH).arrayBuffer();
  wasmInitialization ??= initWasm(wasm);
  return wasmInitialization;
}

function loadSystemFonts(): Promise<CustomFontsOptions> {
  fontLoading ??= loadSystemFontsUncached();
  return fontLoading;
}

async function loadSystemFontsUncached(): Promise<CustomFontsOptions> {
  const fontPaths =
    process.platform === "win32"
      ? ["msyh.ttc", "msyhbd.ttc", "arial.ttf", "consola.ttf"].map((name) =>
          resolve(process.env.WINDIR ?? "C:/Windows", "Fonts", name),
        )
      : process.platform === "darwin"
        ? [
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Menlo.ttc",
          ]
        : [
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
            join(homedir(), ".local/share/fonts/NotoSansCJK-Regular.ttc"),
          ];
  const fontBuffers = await Promise.all(fontPaths.filter(existsSync).map((path) => readFile(path)));
  return {
    fontBuffers,
    ...(process.platform === "win32"
      ? { defaultFontFamily: "Microsoft YaHei", sansSerifFamily: "Microsoft YaHei" }
      : {}),
  };
}

export async function renderMermaid(
  root: Root,
  outDir: string,
  theme: string,
  density: number,
  assetUrlDir: string = outDir,
) {
  const mermaidTheme = THEMES[theme as keyof typeof THEMES] ?? THEMES["tokyo-night-light"];

  let counter = 0;
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!;
    if (child?.type !== "code" || child.lang !== "mermaid") continue;

    counter++;
    const fileName = `mermaid_${counter}.png`;
    const pngFile = join(outDir, fileName);
    const title = getMermaidTitle(child.meta);

    try {
      let svg = renderMermaidSVG(child.value, mermaidTheme);
      svg = resolveCSSVars(svg);
      await initializeResvg();
      const font = await loadSystemFonts();
      const renderer = new Resvg(svg, {
        dpi: density,
        fitTo: { mode: "zoom", value: density / 72 },
        font,
      });
      let png: Uint8Array;
      try {
        const image = renderer.render();
        try {
          png = setPngDensity(image.asPng(), density);
        } finally {
          image.free();
        }
      } finally {
        renderer.free();
      }
      mkdirSync(outDir, { recursive: true });
      writeFileSync(pngFile, png);
    } catch (err) {
      console.error(`mermaid 渲染失败 (#${counter}):`, err);
      continue;
    }

    root.children[i] = {
      type: "paragraph",
      children: [
        {
          type: "image",
          url: join(assetUrlDir, fileName).replaceAll("\\", "/"),
          title: title ?? undefined,
          alt: title ?? "",
        },
      ],
    } as unknown as never;
  }
}

/** 从 mermaid code 的 meta 中提取 title="..." */
function getMermaidTitle(meta: string | null | undefined): string | null {
  if (!meta) return null;
  const match = meta.match(/title\s*=\s*["']([^"']+)["']/);
  return match ? match[1]! : null;
}

interface MixColors {
  c1: string;
  c2: string;
  pct: number;
}

/**
 * 将 SVG 中的 CSS 自定义属性（var()）和 color-mix() 内联为
 * resvg 能理解的具体十六进制颜色值。
 */
export function resolveCSSVars(svg: string): string {
  const vars: Record<string, string> = {};

  // 1. 从 <svg style="--bg:#...;--fg:#..."> 提取基础变量
  const styleAttr = svg.match(/<svg[^>]*style="([^"]+)"/)?.[1];
  if (!styleAttr) return svg;
  styleAttr.replace(/--([\w-]+)\s*:\s*([^;]+)/g, (_, n, v) => {
    vars[n] = v.trim();
    return "";
  });

  // 2. 从 <style> 块提取派生变量（svg { --_text: var(--fg); ... }）
  const styleBlock = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  if (styleBlock) {
    const svgRules = styleBlock.match(/svg\s*\{([^}]+)\}/)?.[1];
    if (svgRules) {
      svgRules.replace(/--([\w-]+)\s*:\s*([^;]+)/g, (_, n, v) => {
        vars[n] = v.trim();
        return "";
      });
    }
  }

  // 3. 解析 var(--name) 和 var(--name, fallback)，包括嵌套回退表达式
  for (const key of Object.keys(vars)) {
    vars[key] = resolveVarFunctions(vars[key]!, vars, new Set([key]));
  }

  // 4. 解析 color-mix(in srgb, <color> X%, <color>)
  function resolveColorMix(expr: string): string {
    const colors = getMixColors(expr);
    if (!colors) return expr;
    return blendColors(colors.c1, colors.c2, colors.pct);
  }

  for (const key of Object.keys(vars)) {
    vars[key] = vars[key]!.replace(/color-mix\([^)]+\)/g, (m) => resolveColorMix(m));
  }

  // 5. 全局替换所有剩余的 var() 为具体值
  return resolveVarFunctions(svg, vars, new Set());
}

function resolveVarFunctions(
  value: string,
  vars: Readonly<Record<string, string>>,
  resolving: ReadonlySet<string>,
): string {
  let result = value;
  let start = result.indexOf("var(");

  while (start !== -1) {
    const end = findClosingParenthesis(result, start + 3);
    if (end === -1) break;

    const expression = result.slice(start + 4, end);
    const separator = findTopLevelComma(expression);
    const name = expression.slice(0, separator === -1 ? undefined : separator).trim();
    const fallback = separator === -1 ? undefined : expression.slice(separator + 1).trim();
    const key = name.startsWith("--") ? name.slice(2) : "";
    const variable = key && !resolving.has(key) ? vars[key] : undefined;

    let replacement: string | undefined;
    if (variable !== undefined) {
      replacement = resolveVarFunctions(variable, vars, new Set([...resolving, key]));
    } else if (fallback !== undefined) {
      replacement = resolveVarFunctions(fallback, vars, resolving);
    }

    if (replacement === undefined) {
      start = result.indexOf("var(", end + 1);
      continue;
    }

    result = result.slice(0, start) + replacement + result.slice(end + 1);
    start = result.indexOf("var(", start);
  }

  return result;
}

function findClosingParenthesis(value: string, openingIndex: number): number {
  let depth = 0;
  for (let i = openingIndex; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findTopLevelComma(value: string): number {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") depth--;
    else if (value[i] === "," && depth === 0) return i;
  }
  return -1;
}

/** 将 PNG 的 pHYs 块设置为指定 DPI，确保 Word 使用正确的物理尺寸。 */
export function setPngDensity(png: Uint8Array, density: number): Uint8Array {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.length < 33 || !signature.every((byte, index) => png[index] === byte)) {
    throw new Error("resvg 返回了无效的 PNG 数据");
  }

  const pixelsPerMeter = Math.round(density / 0.0254);
  const chunk = createPhysicalPixelDimensionsChunk(pixelsPerMeter);
  let offset = 8;
  let insertAt = 33;

  while (offset + 12 <= png.length) {
    const view = new DataView(png.buffer, png.byteOffset + offset);
    const length = view.getUint32(0);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error("resvg 返回了损坏的 PNG 数据");

    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === "IHDR") insertAt = end;
    if (type === "pHYs") {
      return concatenateBytes(png.subarray(0, offset), chunk, png.subarray(end));
    }
    if (type === "IEND") break;
    offset = end;
  }

  return concatenateBytes(png.subarray(0, insertAt), chunk, png.subarray(insertAt));
}

function createPhysicalPixelDimensionsChunk(pixelsPerMeter: number): Uint8Array {
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

function concatenateBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** 解析 color-mix(in srgb, <color> <pct>%, <color>) */
function getMixColors(expr: string): MixColors | null {
  const match = expr.match(
    /color-mix\(\s*in\s+srgb\s*,\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s+(\d+(?:\.\d+)?)%\s*,\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s*\)/,
  );
  if (!match) return null;
  return { c1: match[1]!, c2: match[3]!, pct: parseFloat(match[2]!) / 100 };
}

/** 混合两个十六进制颜色，pct 是 c1 的权重 */
function blendColors(c1: string, c2: string, pct: number): string {
  c1 = expandHexColor(c1);
  c2 = expandHexColor(c2);
  const r1 = Number.parseInt(c1.slice(1, 3), 16);
  const g1 = Number.parseInt(c1.slice(3, 5), 16);
  const b1 = Number.parseInt(c1.slice(5, 7), 16);
  const r2 = Number.parseInt(c2.slice(1, 3), 16);
  const g2 = Number.parseInt(c2.slice(3, 5), 16);
  const b2 = Number.parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 * pct + r2 * (1 - pct));
  const g = Math.round(g1 * pct + g2 * (1 - pct));
  const b = Math.round(b1 * pct + b2 * (1 - pct));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function expandHexColor(color: string): string {
  return color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color;
}
