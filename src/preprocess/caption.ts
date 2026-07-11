import { type Image, type Paragraph, type Root, type Text } from "mdast";
import { type AppConfig, DEFAULT_CONFIG } from "../config";

export function numberTables(root: Root, config?: AppConfig) {
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

export function numberPictures(root: Root, config?: AppConfig) {
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
