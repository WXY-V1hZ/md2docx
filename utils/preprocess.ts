import { type Heading, type Root, type Text, type Yaml } from "mdast";

export function addTitle(fileName: string, root: Root, headings: Heading[]) {
  const hasFrontmatterTitle = root.children.some(
    (c): c is Yaml => c.type === "yaml" && /^title:/m.test(c.value),
  );
  if (hasFrontmatterTitle) return;

  let titleExtracted = false;
  const depth1 = headings.filter((n) => n.depth === 1);
  const firstDepth1 = depth1[0];
  if (firstDepth1 != null && depth1.length === 1 && firstDepth1 === headings[0]) {
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
