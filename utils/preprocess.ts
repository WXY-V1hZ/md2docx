import { type Heading, type Root } from "mdast";
import { visit } from "unist-util-visit";

export function normalizeHeadings(ast: Root) {
  let minDepth = 6;
  visit(ast, "heading", (node: Heading) => {
    if (node.depth < minDepth) {
      minDepth = node.depth;
    }
  });
  visit(ast, "heading", (node: Heading) => {
    node.depth -= minDepth - 1;
  });
}
