import {
  type Heading,
  type Image,
  type Paragraph,
  type Root,
  type Text,
  type Yaml,
} from "mdast";

export function numberTables(root: Root) {
  let counter = 0;
  const inserts: { at: number; text: string }[] = [];
  const used = new Set<number>();

  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!;
    if (child?.type !== "table") continue;

    counter++;

    const prevIdx = i - 1;
    const prev = prevIdx >= 0 ? root.children[prevIdx] : undefined;
    if (prev && isCaption(prev) && !used.has(prevIdx)) {
      used.add(prevIdx);
      const existing = captionText(prev);
      const first = prev.children[0] as Text;
      first.value = `Table: 表 ${counter}${existing ? `：${existing}` : ""}`;
      continue;
    }

    const nextIdx = i + 1;
    const next =
      nextIdx < root.children.length ? root.children[nextIdx] : undefined;
    if (next && isCaption(next) && !used.has(nextIdx)) {
      used.add(nextIdx);
      const existing = captionText(next);
      const first = next.children[0] as Text;
      first.value = `Table: 表 ${counter}${existing ? `：${existing}` : ""}`;
      continue;
    }

    inserts.push({ at: i + 1, text: `Table: 表 ${counter}` });
  }

  for (let j = inserts.length - 1; j >= 0; j--) {
    const { at, text } = inserts[j]!;
    root.children.splice(at, 0, {
      type: "paragraph",
      children: [{ type: "text", value: text }],
    } as Paragraph);
  }
}

export function numberPictures(root: Root) {
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
      const label = (img.title || img.alt || fileNameFromUrl(img.url)) ?? "";
      img.alt = `图 ${counter}${label ? `：${label}` : ""}`;
    }
  }
}

export function addTitle(fileName: string, root: Root, headings: Heading[]) {
  const hasFrontmatterTitle = root.children.some(
    (c): c is Yaml => c.type === "yaml" && /^title:/m.test(c.value),
  );
  if (hasFrontmatterTitle) return;

  let titleExtracted = false;
  const depth1 = headings.filter((n) => n.depth === 1);
  const firstDepth1 = depth1[0];
  if (
    firstDepth1 != null &&
    depth1.length === 1 &&
    firstDepth1 === headings[0]
  ) {
    const titleText = firstDepth1.children
      .filter((c): c is Text => c.type === "text")
      .map((c) => c.value)
      .join("");

    const idx = root.children.indexOf(firstDepth1);
    if (idx !== -1) root.children.splice(idx, 1);

    headings.splice(headings.indexOf(firstDepth1), 1);

    root.children.unshift({ type: "yaml", value: `title: ${titleText}` });
    titleExtracted = true;
  }

  if (titleExtracted) return;

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

export function numberHeadings(nodes: Heading[]) {
  if (nodes.length === 0) return;
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
      first.value = first.value ? `${prefix} ${first.value}` : prefix;
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
    (node as { children?: { type?: string; value?: string }[] }).children
      ?.length === 1 &&
    (node as { children: { type?: string; value?: string }[] }).children[0]
      ?.type === "text" &&
    (
      (node as { children: { type?: string; value?: string }[] }).children[0]
        ?.value ?? ""
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
