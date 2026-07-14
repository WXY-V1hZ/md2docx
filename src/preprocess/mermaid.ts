import { type Root } from "mdast";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { renderMermaidSVG, THEMES } from "beautiful-mermaid";
import sharp from "sharp";

export async function renderMermaid(
  root: Root,
  outDir: string,
  theme: string,
  density: number,
  assetUrlDir: string = outDir,
) {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

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
      const png = await sharp(Buffer.from(svg), {
        density,
      })
        .png()
        .toBuffer();
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
 * sharp/librsvg 能理解的具体十六进制颜色值。
 */
function resolveCSSVars(svg: string): string {
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

  // 3. 解析所有 var() 引用和 color-mix()
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
  return svg.replace(/var\(--([\w-]+)\)/g, (_, name) => {
    return vars[name] ?? `var(--${name})`;
  });
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
