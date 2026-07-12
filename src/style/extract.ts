import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { useNamespaces } from "xpath";
import PizZip from "pizzip";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// 注册命名空间，创建带 w: 前缀的 xpath 选择器
const x = useNamespaces({ w: W });

type XmlNode = Node;

/** 选择单个元素 */
function one(node: XmlNode, expr: string): Element | null {
  const result = x(expr, node) as Node | Node[] | null;
  if (!result) return null;
  if (Array.isArray(result)) return (result[0] as Element) ?? null;
  return result as Element;
}

/** 选择元素列表 */
function all(node: XmlNode, expr: string): Element[] {
  const result = x(expr, node);
  if (!result) return [];
  if (Array.isArray(result)) return result as Element[];
  return [result as Element];
}

/** 取 w: 命名空间下的属性值 */
function wAttr(el: Element | null, local: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(W, local) ?? null;
}

function wNumber(el: Element | null, local = "val"): number | null {
  const value = wAttr(el, local);
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** 读取 OOXML ON/OFF 属性；省略 val 表示 true。 */
function wBool(el: Element | null, local: string): boolean | null {
  if (!el) return null;
  const found = one(el, `w:${local}`);
  if (!found) return null;
  const v = wAttr(found, "val");
  return v === null || !["0", "false", "off", "no"].includes(v.toLowerCase());
}

// ── 映射函数 ─────────────────────────────────────────────

function mapRunProps(rPr: Element | null): Record<string, unknown> {
  if (!rPr) return {};
  const out: Record<string, unknown> = {};

  // 字体
  const rFonts = one(rPr, "w:rFonts");
  if (rFonts) {
    const font: Record<string, string> = {};
    for (const a of ["ascii", "hAnsi", "cs", "eastAsia"]) {
      const v = wAttr(rFonts, a);
      if (v) font[a] = v;
    }
    if (Object.keys(font).length) out.font = font;
  }

  // 字号
  const sz = one(rPr, "w:sz");
  if (sz) {
    const v = wNumber(sz);
    if (v !== null) out.size = v;
  }
  const szCs = one(rPr, "w:szCs");
  if (szCs) {
    const v = wNumber(szCs);
    if (v !== null) out.sizeComplexScript = v;
  }

  // 颜色
  const color = one(rPr, "w:color");
  if (color) {
    const v = wAttr(color, "val");
    if (v) out.color = v.toUpperCase();
  }

  // 开关属性
  const boolMap: [string, string][] = [
    ["b", "bold"],
    ["bCs", "boldComplexScript"],
    ["i", "italics"],
    ["iCs", "italicsComplexScript"],
    ["strike", "strike"],
    ["dstrike", "doubleStrike"],
    ["smallCaps", "smallCaps"],
    ["caps", "allCaps"],
    ["vanish", "vanish"],
    ["emboss", "emboss"],
    ["imprint", "imprint"],
  ];
  for (const [tag, key] of boolMap) {
    const v = wBool(rPr, tag);
    if (v !== null) out[key] = v;
  }

  // 上标/下标
  const va = one(rPr, "w:vertAlign");
  if (va) {
    const v = wAttr(va, "val");
    if (v === "superscript") out.superScript = true;
    else if (v === "subscript") out.subScript = true;
  }

  // 下划线
  const u = one(rPr, "w:u");
  if (u) {
    const ul: Record<string, string> = {};
    const ut = wAttr(u, "val");
    if (ut) ul.type = ut;
    const uc = wAttr(u, "color");
    if (uc) ul.color = uc;
    out.underline = ul;
  }

  // 字符间距
  const sp = one(rPr, "w:spacing");
  if (sp) {
    const v = wNumber(sp);
    if (v !== null) out.characterSpacing = v;
  }

  // 语言
  const lang = one(rPr, "w:lang");
  if (lang) {
    const lo: Record<string, string> = {};
    for (const a of ["val", "eastAsia", "bidi"]) {
      const v = wAttr(lang, a);
      if (v) lo[a] = v;
    }
    if (Object.keys(lo).length) out.language = lo;
  }

  return out;
}

function mapParagraphProps(pPr: Element | null): Record<string, unknown> {
  if (!pPr) return {};
  const out: Record<string, unknown> = {};

  const ALIGN_MAP: Record<string, string> = {
    left: "left",
    center: "center",
    right: "right",
    both: "both",
    start: "start",
    end: "end",
  };

  // 对齐
  const jc = one(pPr, "w:jc");
  if (jc) {
    const v = wAttr(jc, "val");
    if (v && v in ALIGN_MAP) out.alignment = ALIGN_MAP[v];
  }

  // 间距
  const spacing = one(pPr, "w:spacing");
  if (spacing) {
    const sp: Record<string, number | string> = {};
    for (const [tag, key] of [
      ["before", "before"],
      ["after", "after"],
      ["line", "line"],
    ] as [string, string][]) {
      const v = wNumber(spacing, tag);
      if (v !== null) sp[key] = v;
    }
    const lr = wAttr(spacing, "lineRule");
    if (lr !== null) sp.lineRule = lr;
    if (Object.keys(sp).length) out.spacing = sp;
  }

  // 缩进
  const ind = one(pPr, "w:ind");
  if (ind) {
    const id: Record<string, number> = {};
    for (const a of ["left", "right", "firstLine", "hanging", "start", "end"]) {
      const v = wNumber(ind, a);
      if (v !== null) id[a] = v;
    }
    if (Object.keys(id).length) out.indent = id;
  }

  // 开关
  for (const tag of [
    "keepNext",
    "keepLines",
    "pageBreakBefore",
    "widowControl",
    "contextualSpacing",
  ]) {
    const v = wBool(pPr, tag);
    if (v !== null) out[tag] = v;
  }

  // 大纲级别
  const ol = one(pPr, "w:outlineLvl");
  if (ol) {
    const v = wNumber(ol);
    if (v !== null) out.outlineLevel = v;
  }

  return out;
}

// ── 导出类型 ─────────────────────────────────────────────

export interface StyleEntry {
  id: string;
  name: string;
  basedOn?: string;
  next?: string;
  link?: string;
  quickFormat?: boolean;
  semiHidden?: boolean;
  unhideWhenUsed?: boolean;
  uiPriority?: number;
  run?: Record<string, unknown>;
  paragraph?: Record<string, unknown>;
}

export interface ExtractedStyles {
  default?: Record<string, unknown>;
  paragraphStyles?: StyleEntry[];
  characterStyles?: StyleEntry[];
}

const BUILTIN_PARA: Record<string, string> = {
  Title: "title",
  Heading1: "heading1",
  Heading2: "heading2",
  Heading3: "heading3",
  Heading4: "heading4",
  Heading5: "heading5",
  Heading6: "heading6",
  Strong: "strong",
  ListParagraph: "listParagraph",
  FootnoteText: "footnoteText",
  EndnoteText: "endnoteText",
};

const BUILTIN_CHAR: Record<string, string> = {
  Hyperlink: "hyperlink",
  FootnoteReference: "footnoteReference",
  FootnoteTextChar: "footnoteTextChar",
  EndnoteReference: "endnoteReference",
  EndnoteTextChar: "endnoteTextChar",
};

/** 从 docx 提取 styles 配置，返回可直接给 `new Document({ styles })` 的对象 */
export function extractStylesFromDocx(docxPath: string): ExtractedStyles {
  const zip = new PizZip(readFileSync(docxPath));
  const stylesFile = zip.file("word/styles.xml");
  if (!stylesFile) throw new Error("word/styles.xml not found in docx");

  const xml = stylesFile.asText();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const parseError = doc.getElementsByTagName("parsererror").item(0);
  if (parseError) throw new Error(`Invalid word/styles.xml: ${parseError.textContent}`);

  const defaultDoc: Record<string, unknown> = {};
  const defaultOverrides: Record<string, unknown> = {};
  const paragraphStyles: StyleEntry[] = [];
  const characterStyles: StyleEntry[] = [];

  // 1. docDefaults
  const xmlDocument = doc as unknown as XmlNode;
  const dd = one(xmlDocument, "//w:docDefaults");
  if (dd) {
    const rPrDef = one(dd, "w:rPrDefault/w:rPr");
    if (rPrDef) {
      const run = mapRunProps(rPrDef);
      if (Object.keys(run).length) defaultDoc.run = run;
    }
    const pPrDef = one(dd, "w:pPrDefault/w:pPr");
    if (pPrDef) {
      const para = mapParagraphProps(pPrDef);
      if (Object.keys(para).length) defaultDoc.paragraph = para;
    }
  }

  // 2. 样式
  for (const style of all(xmlDocument, "//w:style")) {
    const styleId = wAttr(style, "styleId") ?? "";
    const styleType = wAttr(style, "type") ?? "";
    if (!styleId || !["paragraph", "character"].includes(styleType)) continue;
    const name = wAttr(one(style, "w:name"), "val") ?? styleId;

    // 跳过隐式样式和 token
    if (["Normal", "DefaultParagraphFont", "TableNormal"].includes(styleId)) continue;
    if (styleId.endsWith("Tok") && styleType === "character") continue;

    const entry: StyleEntry = { id: styleId, name };

    // basedOn
    const bo = one(style, "w:basedOn");
    if (bo) {
      const v = wAttr(bo, "val");
      if (v && !["Normal", "DefaultParagraphFont"].includes(v)) entry.basedOn = v;
    }

    // next
    const next = one(style, "w:next");
    if (next) {
      const v = wAttr(next, "val");
      if (v && v !== styleId) entry.next = v;
    }

    // link
    const link = one(style, "w:link");
    if (link) {
      const v = wAttr(link, "val");
      if (v) entry.link = v;
    }

    // 标志位
    if (one(style, "w:qFormat")) entry.quickFormat = true;
    if (one(style, "w:semiHidden")) entry.semiHidden = true;
    if (one(style, "w:unhideWhenUsed")) entry.unhideWhenUsed = true;

    const ui = one(style, "w:uiPriority");
    if (ui) {
      const v = wNumber(ui);
      if (v !== null) entry.uiPriority = v;
    }

    // run / paragraph
    const run = mapRunProps(one(style, "w:rPr"));
    if (Object.keys(run).length) entry.run = run;
    const para = mapParagraphProps(one(style, "w:pPr"));
    if (Object.keys(para).length) entry.paragraph = para;

    // 分发
    if (styleType === "paragraph") {
      const key = BUILTIN_PARA[styleId];
      if (key) {
        const { id: _, ...rest } = entry;
        defaultOverrides[key] = rest;
      } else {
        paragraphStyles.push(entry);
      }
    } else if (styleType === "character") {
      const key = BUILTIN_CHAR[styleId];
      if (key) {
        const { id: _, ...rest } = entry;
        defaultOverrides[key] = rest;
      } else {
        characterStyles.push(entry);
      }
    }
  }

  const result: ExtractedStyles = {};
  if (Object.keys(defaultDoc).length > 0 || Object.keys(defaultOverrides).length > 0) {
    result.default = {
      ...(Object.keys(defaultDoc).length > 0 ? { document: defaultDoc } : {}),
      ...defaultOverrides,
    };
  }
  if (paragraphStyles.length) result.paragraphStyles = paragraphStyles;
  if (characterStyles.length) result.characterStyles = characterStyles;

  return result;
}
