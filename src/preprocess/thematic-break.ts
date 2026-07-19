import { type Root } from "mdast";

/**
 * 移除文档中所有分隔符（thematicBreak，即 ---、***、___ 等）。
 */
export function removeThematicBreaks(root: Root): void {
  root.children = root.children.filter((node) => node.type !== "thematicBreak");
}
