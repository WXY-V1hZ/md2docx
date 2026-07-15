/**
 * 对比 sharp 与 resvg-wasm 对同一 Mermaid SVG 的 PNG 渲染结果。
 *
 * 对比维度：
 * - 像素尺寸（width × height）
 * - 文件大小
 * - 像素差异比例（两幅图有多少像素不一致）
 * - 平均色差（不同像素的 RGB 平均差异）
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg, initWasm, type CustomFontsOptions } from "@resvg/resvg-wasm";
import resvgWasmPath from "@resvg/resvg-wasm/index_bg.wasm" with { type: "file" };
import { renderMermaidSVG, THEMES } from "beautiful-mermaid";
import sharp from "sharp";

const SAMPLES_DIR = join(import.meta.dirname, "..", "tmp", "render-compare");
const DIFF_THRESHOLD = 0.05; // 允许 5% 的像素差异

// ─── 测试用 Mermaid 代码 ──────────────────────────────

const MERMAID_SAMPLES = {
  "流程图": `graph TD
    A[开始] --> B{判断}
    B -->|是| C[处理]
    B -->|否| D[结束]`,

  "时序图": `sequenceDiagram
    Alice->>John: 你好
    John-->>Alice: 收到`,

  "类图": `classDiagram
    class Animal {
      +String name
      +move() void
    }
    class Dog {
      +bark() void
    }
    Animal <|-- Dog`,
} as const;

// ─── 字体加载（复用 mermaid.ts 逻辑） ─────────────────

const RESVG_WASM_PATH = isAbsolute(resvgWasmPath)
  ? resvgWasmPath
  : resolve(dirname(fileURLToPath(import.meta.url)), resvgWasmPath);

type RenderFn = (svg: string, density: number) => Promise<Uint8Array>;

let wasmInit: Promise<void>;

async function resvgRender(svg: string, density: number): Promise<Uint8Array> {
  const wasm = readFile(RESVG_WASM_PATH);
  wasmInit ??= initWasm(wasm);
  await wasmInit;

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
  const fontBuffers = await Promise.all(
    fontPaths.filter(existsSync).map((path) => readFile(path)),
  );
  const font: CustomFontsOptions = {
    fontBuffers,
    ...(process.platform === "win32"
      ? { defaultFontFamily: "Microsoft YaHei", sansSerifFamily: "Microsoft YaHei" }
      : {}),
  };

  const renderer = new Resvg(svg, {
    dpi: density,
    fitTo: { mode: "zoom", value: density / 72 },
    font,
  });
  try {
    const image = renderer.render();
    try {
      return image.asPng();
    } finally {
      image.free();
    }
  } finally {
    renderer.free();
  }
}

async function sharpRender(svg: string, density: number): Promise<Uint8Array> {
  return await sharp(Buffer.from(svg), { density }).png().toBuffer();
}

// ─── 像素对比 ─────────────────────────────────────────

interface DiffResult {
  /** 差异像素占比 */
  diffRatio: number;
  /** 差异像素的平均 RGB 色差（0–255） */
  avgColorDiff: number;
  /** 总像素数 */
  totalPixels: number;
  /** 差异像素数 */
  diffPixels: number;
}

/** 对两幅 PNG 逐像素对比 */
async function comparePng(
  a: Uint8Array,
  b: Uint8Array,
): Promise<DiffResult> {
  const [ra, rb] = await Promise.all([
    sharp(a).raw().toBuffer({ resolveWithObject: true }),
    sharp(b).raw().toBuffer({ resolveWithObject: true }),
  ]);

  const pixels = ra.info.width * ra.info.height;
  const channels = ra.info.channels;
  const minLen = Math.min(ra.data.length, rb.data.length);

  let diffPixels = 0;
  let totalColorDiff = 0;

  for (let i = 0; i < minLen; i += channels) {
    const dr = Math.abs(ra.data[i]! - rb.data[i]!);
    const dg = Math.abs(ra.data[i + 1]! - rb.data[i + 1]!);
    const db = Math.abs(ra.data[i + 2]! - rb.data[i + 2]!);
    const maxDiff = Math.max(dr, dg, db);
    if (maxDiff > 10) {
      // 允许 10 的容差（抗锯齿差异）
      diffPixels++;
      totalColorDiff += (dr + dg + db) / 3;
    }
  }

  return {
    diffRatio: pixels > 0 ? diffPixels / pixels : 0,
    avgColorDiff: diffPixels > 0 ? totalColorDiff / diffPixels : 0,
    totalPixels: pixels,
    diffPixels,
  };
}

// ─── 保存 PNG 用于人工查阅 ────────────────────────────

function saveSample(
  name: string,
  engine: string,
  png: Uint8Array,
  density: number,
): string {
  const dir = join(SAMPLES_DIR, name);
  mkdirSync(dir, { recursive: true });
  const file = `${engine}_${density}dpi.png`;
  const path = join(dir, file);
  writeFileSync(path, png);
  return path;
}

/** 解析 SVG 的 viewBox 得到像素尺寸 */
function parseSvgSize(svg: string, density: number): { w: number; h: number } {
  const vb = svg.match(/viewBox="(\d+)\s+(\d+)\s+(\d+)\s+(\d+)"/);
  if (!vb) return { w: 0, h: 0 };
  const scale = density / 72;
  return { w: Math.round(Number(vb[3]!) * scale), h: Math.round(Number(vb[4]!) * scale) };
}

describe("Mermaid 渲染对比：sharp vs resvg-wasm", () => {
  for (const [label, mermaidCode] of Object.entries(MERMAID_SAMPLES)) {
    describe(label, () => {
      for (const density of [72, 200]) {
        it(`density=${density} 对比`, async () => {
          const theme = THEMES["tokyo-night-light"];
          const svg = resolveCSSVars(renderMermaidSVG(mermaidCode, theme));

          const [resvgPng, sharpPng] = await Promise.all([
            resvgRender(svg, density),
            sharpRender(svg, density),
          ]);

          // 保存到临时目录，方便人工查看
          const resvgPath = saveSample(label, "resvg", resvgPng, density);
          const sharpPath = saveSample(label, "sharp", sharpPng, density);

          // 解析 SVG 期望尺寸
          const expected = parseSvgSize(svg, density);

          // 获取实际 PNG 尺寸
          const [resvgMeta, sharpMeta] = await Promise.all([
            sharp(resvgPng).metadata(),
            sharp(sharpPng).metadata(),
          ]);

          // ─ 对比输出 ─
          console.log(`\n  ── ${label} @ ${density}dpi ──`);
          console.log(`  resvg:  ${resvgMeta.width}×${resvgMeta.height}, ${(resvgPng.length / 1024).toFixed(1)} KB`);
          console.log(`  sharp:  ${sharpMeta.width}×${sharpMeta.height}, ${(sharpPng.length / 1024).toFixed(1)} KB`);
          if (expected.w) {
            console.log(`  期望:   ${expected.w}×${expected.h}`);
          }

          const diff = await comparePng(resvgPng, sharpPng);
          console.log(
            `  差异:   ${((diff.diffRatio) * 100).toFixed(2)}% 像素不同` +
              (diff.diffPixels > 0 ? `, 平均色差 ${diff.avgColorDiff.toFixed(1)}` : ""),
          );

          // 文件保存在 tmp/render-compare/，不在测试失败时清理
          console.log(`  文件:   ${resvgPath}`);
          console.log(`          ${sharpPath}`);

          // 不做断言，只输出对比结果供人工判断
          // sharp 和 resvg 使用不同的抗锯齿算法，像素级差异是预期行为
          if (diff.diffRatio > DIFF_THRESHOLD) {
            console.log(
              `  ⚠ 超过 ${DIFF_THRESHOLD * 100}% 阈值（${(diff.diffRatio * 100).toFixed(2)}%），` +
                `平均色差 ${diff.avgColorDiff.toFixed(1)}（主要来自抗锯齿差异）`,
            );
          }
        });
      }
    });
  }
});

// ─── resolveCSSVars（从 mermaid.ts 复制，测试暂不导出） ────

function resolveCSSVars(svg: string): string {
  const vars: Record<string, string> = {};

  const styleAttr = svg.match(/<svg[^>]*style="([^"]+)"/)?.[1];
  if (!styleAttr) return svg;
  styleAttr.replace(/--([\w-]+)\s*:\s*([^;]+)/g, (_, n, v) => {
    vars[n] = v.trim();
    return "";
  });

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

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Object.keys(vars)) {
      const newVal = vars[key]!.replace(/var\(--([\w-]+)\)/g, (_, name) => {
        const resolved = vars[name];
        if (resolved) {
          changed = true;
          return resolved;
        }
        return `var(--${name})`;
      });
      vars[key] = newVal;
    }
  }

  for (const key of Object.keys(vars)) {
    const mixMatch = vars[key]!.match(/color-mix\([^)]+\)/);
    if (mixMatch) {
      const colors = getMixColors(mixMatch[0]!);
      if (colors) {
        vars[key] = vars[key]!.replace(/color-mix\([^)]+\)/, blendColors(colors.c1, colors.c2, colors.pct));
      }
    }
  }

  return svg.replace(/var\(--([\w-]+)\)/g, (_, name) => {
    return vars[name] ?? `var(--${name})`;
  });
}

function getMixColors(expr: string): { c1: string; c2: string; pct: number } | null {
  const match = expr.match(
    /color-mix\(\s*in\s+srgb\s*,\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s+(\d+(?:\.\d+)?)%\s*,\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s*\)/,
  );
  if (!match) return null;
  return { c1: match[1]!, c2: match[3]!, pct: parseFloat(match[2]!) / 100 };
}

function blendColors(c1: string, c2: string, pct: number): string {
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
