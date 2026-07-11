import { type Heading, type Image, type Paragraph, type Root, type Text, type Yaml } from "mdast";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { renderMermaidSVG, THEMES } from "beautiful-mermaid";
import sharp from "sharp";
import {
  type NumberingConfig,
  DEFAULT_CONFIG,
  type HeadingNumberingConfig,
  type TitleConfig,
} from "./config";

export async function renderMermaid(
  root: Root,
  mdPath: string,
  outputDir: string,
  theme: string,
  density: number,
  fileNameTemplate: string,
) {
  const resolvedDir = outputDir.replace(
    "{file_name}",
    mdPath.replace(/.*[/\\]/, "").replace(/\.[^.]*$/, ""),
  );
  const outDir = join(dirname(mdPath), resolvedDir);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const mermaidTheme = THEMES[theme as keyof typeof THEMES] ?? THEMES["tokyo-night-light"];

  let counter = 0;
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!;
    if (child?.type !== "code" || child.lang !== "mermaid") continue;

    counter++;
    const pngFile = join(outDir, fileNameTemplate.replace("{n}", String(counter)) + ".png");
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
          url: pngFile,
          title: title ?? undefined,
          alt: title ?? "",
        },
      ],
    } as unknown as never;
  }
}

export function numberTables(root: Root, config?: NumberingConfig) {
  const {
    tableCaption: { format, separator },
  } = config ?? DEFAULT_CONFIG;
  let counter = 0;
  const inserts: { at: number; text: string }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!;
    if (child?.type !== "table") continue;

    counter++;
    const label = format.replace("{n}", String(counter));

    const prevIdx = i - 1;
    const prev = prevIdx >= 0 ? root.children[prevIdx] : undefined;
    if (prev && isCaption(prev) && !used.has(prevIdx)) {
      used.add(prevIdx);
      const existing = stripTableNum(captionText(prev), format);
      const first = prev.children[0] as Text;
      first.value = `Table: ${label}${existing ? `${separator}${existing}` : ""}`;
      continue;
    }

    const nextIdx = i + 1;
    const next = nextIdx < root.children.length ? root.children[nextIdx] : undefined;
    if (next && isCaption(next) && !used.has(nextIdx)) {
      used.add(nextIdx);
      const existing = stripTableNum(captionText(next), format);
      const first = next.children[0] as Text;
      first.value = `Table: ${label}${existing ? `${separator}${existing}` : ""}`;
      continue;
    }

    inserts.push({ at: i + 1, text: `Table: ${label}` });
  }

  for (let j = inserts.length - 1; j >= 0; j--) {
    const { at, text } = inserts[j]!;
    root.children.splice(at, 0, {
      type: "paragraph",
      children: [{ type: "text", value: text }],
    } as Paragraph);
  }
}

export function numberPictures(root: Root, config?: NumberingConfig) {
  const {
    figureCaption: { format, separator },
  } = config ?? DEFAULT_CONFIG;
  let counter = 0;
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!;
    if (
      child?.type === "paragraph" &&
      child.children.length === 1 &&
      child.children[0]?.type === "image"
    ) {
      counter++;
      const img = child.children[0] as Image;
      const cleaned = stripPictureNum(img.title ?? img.alt ?? "", format);
      const label = cleaned || fileNameFromUrl(img.url) || "";
      const prefix = format.replace("{n}", String(counter));
      img.alt = `${prefix}${label ? `${separator}${label}` : ""}`;
    }
  }
}

export function addTitle(fileName: string, root: Root, headings: Heading[], config?: TitleConfig) {
  const { enabled, strategy } = config ?? DEFAULT_CONFIG.title;
  if (!enabled || strategy === "none") return;

  const hasFrontmatterTitle = root.children.some(
    (c): c is Yaml => c.type === "yaml" && /^title:/m.test(c.value),
  );
  if (hasFrontmatterTitle) return;

  if (strategy === "filename") {
    const fallbackTitle = fileName.replace(/\.\w+$/, "");
    root.children.unshift({ type: "yaml", value: `title: ${fallbackTitle}` });
    return;
  }

  const depth1 = headings.filter((n) => n.depth === 1);
  const firstDepth1 = depth1[0];

  if (strategy === "single-h1") {
    if (firstDepth1 != null && depth1.length === 1) {
      const titleText = firstDepth1.children
        .filter((c): c is Text => c.type === "text")
        .map((c) => c.value)
        .join("");

      const idx = root.children.indexOf(firstDepth1);
      if (idx !== -1) root.children.splice(idx, 1);
      headings.splice(headings.indexOf(firstDepth1), 1);

      root.children.unshift({ type: "yaml", value: `title: ${titleText}` });
      return;
    }
  }

  // strategy === "first-h1"：唯一 H1 且在首位才提取，否则 fallback 到文件名
  if (firstDepth1 != null && depth1.length === 1 && firstDepth1 === headings[0]) {
    const titleText = firstDepth1.children
      .filter((c): c is Text => c.type === "text")
      .map((c) => c.value)
      .join("");

    const idx = root.children.indexOf(firstDepth1);
    if (idx !== -1) root.children.splice(idx, 1);
    headings.splice(headings.indexOf(firstDepth1), 1);

    root.children.unshift({ type: "yaml", value: `title: ${titleText}` });
    return;
  }

  const fallbackTitle = fileName.replace(/\.\w+$/, "");
  root.children.unshift({ type: "yaml", value: `title: ${fallbackTitle}` });
}

export function normalizeHeadings(nodes: Heading[]) {
  if (nodes.length === 0) return;

  let minDepth = 6;
  for (const node of nodes) {
    minDepth = Math.min(minDepth, node.depth);
  }

  const offset = minDepth - 1;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i]!.depth -= offset;
  }

  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i]!.depth > nodes[i - 1]!.depth + 1) {
      nodes[i]!.depth = (nodes[i - 1]!.depth + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }
}

export function numberHeadings(nodes: Heading[], config?: HeadingNumberingConfig) {
  if (nodes.length === 0) return;
  const { detectExisting, existingPattern } = config ?? DEFAULT_CONFIG.numberHeadings;
  const counter: number[] = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i <= nodes[0]!.depth - 2; ++i) {
    counter[i] = 1;
  }
  for (const node of nodes) {
    const d = node.depth;
    counter[d - 1]!++;
    counter.fill(0, d);
    const prefix = buildPrefix(counter);
    const first = node.children[0];
    if (first?.type === "text") {
      const text = detectExisting
        ? stripHeadingNum(first.value, existingPattern, config?.useBuiltinRules)
        : first.value;
      first.value = text ? `${prefix} ${text}` : prefix;
    } else {
      node.children.unshift({
        type: "text",
        value: prefix,
      });
    }
  }
}

/** 从 mermaid code 的 meta 中提取 title="..." */
function getMermaidTitle(meta: string | null | undefined): string | null {
  if (!meta) return null;
  const match = meta.match(/title\s*=\s*["']([^"']+)["']/);
  return match ? match[1]! : null;
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
  // 先解析掉所有 var() 引用（多层）
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

  // 现在所有 var() 应该被解析完了，只剩下可能包含 color-mix() 的值
  // 4. 解析 color-mix(in srgb, <color> X%, <color>)
  function resolveColorMix(expr: string): string {
    const colors = getMixColors(expr);
    if (!colors) return expr;
    return blendColors(colors.c1, colors.c2, colors.pct);
  }

  // 对所有变量中的 color-mix 进行解析
  for (const key of Object.keys(vars)) {
    vars[key] = vars[key]!.replace(/color-mix\([^)]+\)/g, (m) => resolveColorMix(m));
  }

  // 5. 全局替换所有剩余的 var() 为具体值
  return svg.replace(/var\(--([\w-]+)\)/g, (_, name) => {
    return vars[name] ?? `var(--${name})`;
  });
}

interface MixColors {
  c1: string;
  c2: string;
  pct: number;
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

function buildPrefix(counter: number[]): string {
  const end = counter.findLastIndex((x) => x !== 0);
  return counter.slice(0, end + 1).join(".");
}

/** 从 URL/路径中提取不带扩展名的文件名 */
function fileNameFromUrl(url: string): string | null {
  const match = url.match(/\/([^/]+?)(?:\.[^/.]+)?$/);
  return match ? match[1]! : null;
}

function isCaption(node: unknown): node is Paragraph {
  return (
    node != null &&
    typeof node === "object" &&
    (node as { type?: string }).type === "paragraph" &&
    (node as { children?: { type?: string; value?: string }[] }).children?.length === 1 &&
    (node as { children: { type?: string; value?: string }[] }).children[0]?.type === "text" &&
    (
      (node as { children: { type?: string; value?: string }[] }).children[0]?.value ?? ""
    ).startsWith("Table: ")
  );
}

function captionText(node: Paragraph): string {
  const first = node.children[0];
  if (first?.type === "text") {
    return first.value.replace(/^Table: /, "");
  }
  return "";
}

function stripTableNum(text: string, format: string): string {
  const escaped = format.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&").replace("{n}", "\\d+");
  return text.replace(new RegExp(`^${escaped}`), "");
}

function stripPictureNum(text: string, format: string): string {
  const escaped = format.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&").replace("{n}", "\\d+");
  return text.replace(new RegExp(`^${escaped}`), "");
}

/**
 * 匹配形如 "1.2.3"、"1.2.3." 的数字序号前缀，末尾可选空格。
 * 注意：只匹配至少两段或带结尾点的，避免与公共版本号冲突。
 */
const RE_DOT_NUM = /^\d+(\.\d+)+\.?\s*/;

/** 匹配形如 "(一)"、"（一）" 的中文括号序号前缀 */
const RE_CN_PAREN = /^[（(][一二三四五六七八九十百千]+[）)]\s*/;

/** 匹配形如 "一、"、"一." 的中文数字单级序号前缀 */
const RE_CN_NUM = /^[一二三四五六七八九十百千]+[、.]\s*/;

/**
 * 匹配形如 "一、二、三" 或 "一、二、三、" 的中文顿号多级序号前缀。
 * 注意此正则须在 RE_CN_NUM 之后测试，以避免单级被优先匹配。
 */
const RE_CN_DUN = /^[一二三四五六七八九十百千]+(?:、[一二三四五六七八九十百千]+)+、?\s*/;

/** 去掉 heading 文本中已有的编号前缀 */
function stripHeadingNum(text: string, customPattern?: string, useBuiltinRules?: boolean): string {
  let result = text;
  if (customPattern) {
    result = result.replace(new RegExp(`^${customPattern}`), "");
  }
  if (useBuiltinRules !== false) {
    result = result.replace(
      new RegExp(
        `^(?:${[RE_CN_DUN.source, RE_CN_PAREN.source, RE_CN_NUM.source, RE_DOT_NUM.source].join(
          "|",
        )})`,
      ),
      "",
    );
  }
  return result;
}
