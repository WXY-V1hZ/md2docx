import { type Heading, type Root, type Text, type Yaml } from "mdast";
import { type HeadingNumberingConfig, type TitleConfig } from "../config";

export function addTitle(fileName: string, root: Root, headings: Heading[], config: TitleConfig) {
  const { enabled, strategy } = config;
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

  // strategy === "first-h1"
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

export function numberHeadings(nodes: Heading[], config: HeadingNumberingConfig) {
  if (nodes.length === 0) return;
  const { detectExisting, existingPattern } = config;
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

function buildPrefix(counter: number[]): string {
  const end = counter.findLastIndex((x) => x !== 0);
  return counter.slice(0, end + 1).join(".");
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
