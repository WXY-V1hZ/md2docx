import { $ } from "bun";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";

import { getConfigOptions } from "./cli";
import {
  CONFIG_PATH,
  CONFIG_SCHEMA_PATH,
  PKG_DIR,
  STYLE_CONFIG,
  STYLE_TEMPLATE_DOCX,
} from "./paths";
import { generateTemplateDocx } from "./style/generate";

const HOSTNAME = "127.0.0.1";
const PORT = 3210;
const WEB_DIR = resolve(import.meta.dir, "web");

const STYLE_CATALOG = [
  {
    id: "document",
    label: "全局默认",
    description: "未被具体样式覆盖时使用的文档基础字体和段落设置。",
    collection: "default",
    name: "文档默认",
  },
  {
    id: "title",
    label: "文档信息",
    description: "文档标题、副标题、作者与日期。",
    collection: "paragraphStyles",
    names: ["Title", "Subtitle", "Author", "Date"],
  },
  {
    id: "heading",
    label: "章节标题",
    description: "一级至六级标题和目录标题。",
    collection: "paragraphStyles",
    names: [
      "heading 1",
      "heading 2",
      "heading 3",
      "heading 4",
      "heading 5",
      "heading 6",
      "TOC Heading",
    ],
  },
  {
    id: "body",
    label: "正文与摘要",
    description: "普通正文、首段、紧凑段落、引用和摘要。",
    collection: "paragraphStyles",
    names: ["Normal", "First Paragraph", "Body Text", "Compact", "Block Text", "Abstract"],
  },
  {
    id: "caption",
    label: "图片与题注",
    description: "图片段落以及图片、表格的题注样式。",
    collection: "paragraphStyles",
    names: ["Figure", "Captioned Figure", "caption", "Table Caption", "Image Caption", "图片"],
  },
  {
    id: "code",
    label: "代码与链接",
    description: "代码块、行内代码、超链接和脚注。",
    groups: [
      { collection: "paragraphStyles", names: ["Source Code", "footnote text"] },
      { collection: "characterStyles", names: ["Inline Code", "Hyperlink", "footnote reference"] },
    ],
  },
  {
    id: "table",
    label: "表格",
    description: "表格字体、对齐与单元格间距。",
    collection: "tableStyles",
    names: ["Table"],
  },
  {
    id: "header-footer",
    label: "页眉页脚",
    description: "页眉和页脚文字的基础外观。",
    collection: "paragraphStyles",
    names: ["header", "footer"],
  },
] as const;

const PREVIEW_MARKDOWN = `---
title: 文档样式校样
subtitle: md2docx preview
author: 示例作者
date: 2026 年 7 月
---

# 第一章 文档排版

这是一段用于检查中文字体、西文字体 Times New Roman、字号、行距和首行缩进的正文。良好的样式应当让结构清晰，也让长篇阅读保持舒适。

## 1.1 次级标题

正文中可以包含[超链接](https://example.com)和\`inline code\`，也可以使用脚注。[^1]

> 这是一段引用文字，用于检查块文本的缩进、字号和段落间距。

Table: 表 1：样式示例

| 项目 | 当前状态 |
| --- | --- |
| 标题 | 清晰 |
| 正文 | 易读 |

![图 1：示例图片](missing-preview-image.png)

\`\`\`ts
export function format(document: string): string {
  return document.trim();
}
\`\`\`

[^1]: 这是一条脚注，用于检查脚注正文和引用标记。
`;

interface WebHandlerOptions {
  configPath?: string;
  schemaPath?: string;
  stylePath?: string;
  templatePath?: string;
  webDir?: string;
}

export function createWebHandler(
  options: WebHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const configPath = options.configPath ?? CONFIG_PATH;
  const schemaPath = options.schemaPath ?? CONFIG_SCHEMA_PATH;
  const stylePath = options.stylePath ?? STYLE_CONFIG;
  const templatePath = options.templatePath ?? STYLE_TEMPLATE_DOCX;
  const webDir = options.webDir ?? WEB_DIR;

  return async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/api/config" && request.method === "GET") {
      const [schema, config] = await Promise.all([
        Bun.file(schemaPath).json(),
        Bun.file(configPath).json(),
      ]);
      return Response.json({ schema, config });
    }

    if (url.pathname === "/api/config" && request.method === "PUT") {
      try {
        const schema = await Bun.file(schemaPath).json();
        const config = await request.json();
        enforceConfigDependencies(config);
        validateWebConfig(config, schema);
        const savedConfig = { $schema: "./config.schema.json", ...config };
        await writeFile(configPath, `${JSON.stringify(savedConfig, null, 2)}\n`, "utf-8");
        return Response.json({ ok: true });
      } catch (error) {
        return errorResponse(error);
      }
    }

    if (url.pathname === "/api/styles" && request.method === "GET") {
      try {
        const source = await Bun.file(stylePath).text();
        return Response.json({
          styles: JSON.parse(source),
          catalog: STYLE_CATALOG,
          revision: styleRevision(source),
        });
      } catch (error) {
        return errorResponse(error);
      }
    }

    if (url.pathname === "/api/styles" && request.method === "PUT") {
      try {
        const body = await request.json();
        if (!isRecord(body)) throw new Error("请求内容必须是 JSON 对象");
        const styles = body.styles;
        const revision = body.revision;
        validateStyles(styles);
        synchronizeTableStylesXml(styles);
        if (typeof revision === "string") {
          const currentSource = await Bun.file(stylePath).text();
          if (revision !== styleRevision(currentSource)) {
            throw new Error("样式文件已被其他操作修改，请刷新页面后重试");
          }
        }
        const source = `${JSON.stringify(styles, null, 2)}\n`;
        await saveStylesAndTemplate(stylePath, templatePath, source);
        return Response.json({ ok: true, revision: styleRevision(source) });
      } catch (error) {
        return errorResponse(error);
      }
    }

    if (url.pathname === "/api/styles/preview" && request.method === "POST") {
      try {
        const body = await request.json();
        const styles = isRecord(body) && "styles" in body ? body.styles : body;
        validateStyles(styles);
        synchronizeTableStylesXml(styles);
        const preview = await createPreviewDocx(styles);
        return new Response(preview, {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": 'attachment; filename="md2docx-style-preview.docx"',
          },
        });
      } catch (error) {
        return errorResponse(error);
      }
    }

    const files: Record<string, { path: string; type: string }> = {
      "/": { path: "index.html", type: "text/html; charset=utf-8" },
      "/app.css": { path: "app.css", type: "text/css; charset=utf-8" },
      "/app.js": { path: "app.js", type: "text/javascript; charset=utf-8" },
    };
    const asset = files[url.pathname];
    if (!asset || request.method !== "GET") return new Response("Not found", { status: 404 });
    return new Response(Bun.file(resolve(webDir, asset.path)), {
      headers: { "Content-Type": asset.type },
    });
  };
}

export async function startWebEditor(): Promise<void> {
  const server = Bun.serve({ hostname: HOSTNAME, port: PORT, fetch: createWebHandler() });
  const url = `http://${server.hostname}:${server.port}`;
  console.log(`文档设计台已启动：${url}`);
  console.log("按 Ctrl+C 停止服务");
  openBrowser(url);
  await new Promise(() => undefined);
}

async function saveStylesAndTemplate(
  stylePath: string,
  templatePath: string,
  source: string,
): Promise<void> {
  const suffix = `${process.pid}-${Date.now()}`;
  const temporaryStyle = `${stylePath}.${suffix}.tmp`;
  const temporaryTemplate = `${templatePath}.${suffix}.tmp`;
  const previousStyle = await readFile(stylePath);
  const previousTemplate = await readFile(templatePath).catch(() => null);

  try {
    await mkdir(dirname(stylePath), { recursive: true });
    await writeFile(temporaryStyle, source, "utf-8");
    await generateTemplateDocx(temporaryStyle, temporaryTemplate);
    await rename(temporaryStyle, stylePath);
    await mkdir(dirname(templatePath), { recursive: true });
    await rm(templatePath, { force: true });
    await rename(temporaryTemplate, templatePath);
  } catch (error) {
    await writeFile(stylePath, previousStyle).catch(() => undefined);
    if (previousTemplate) await writeFile(templatePath, previousTemplate).catch(() => undefined);
    throw error;
  } finally {
    await Promise.all([
      rm(temporaryStyle, { force: true }).catch(() => undefined),
      rm(temporaryTemplate, { force: true }).catch(() => undefined),
    ]);
  }
}

async function createPreviewDocx(styles: unknown): Promise<ArrayBuffer> {
  const directory = join(tmpdir(), `md2docx-preview-${process.pid}-${Date.now()}`);
  const stylePath = join(directory, "style.json");
  const referencePath = join(directory, "reference.docx");
  const markdownPath = join(directory, "preview.md");
  const outputPath = join(directory, "preview.docx");
  try {
    await mkdir(directory, { recursive: true });
    await Promise.all([
      writeFile(stylePath, `${JSON.stringify(styles, null, 2)}\n`, "utf-8"),
      writeFile(markdownPath, PREVIEW_MARKDOWN, "utf-8"),
    ]);
    await generateTemplateDocx(stylePath, referencePath);
    const luaFilter = resolve(PKG_DIR, "config/lua/add-inline-code.lua");
    const result =
      await $`pandoc ${markdownPath} --from=gfm+yaml_metadata_block -o ${outputPath} --reference-doc=${referencePath} --lua-filter=${luaFilter}`.nothrow();
    if (result.exitCode !== 0) {
      const detail = result.stderr.toString().trim();
      throw new Error(`预览 DOCX 生成失败${detail ? `：${detail}` : "，请确认已安装 pandoc"}`);
    }
    return await Bun.file(outputPath).arrayBuffer();
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

function validateStyles(styles: unknown): asserts styles is Record<string, unknown> {
  if (!isRecord(styles)) throw new Error("样式配置必须是 JSON 对象");
  for (const collection of ["paragraphStyles", "characterStyles", "tableStyles"] as const) {
    const entries = styles[collection];
    if (entries !== undefined && !Array.isArray(entries)) {
      throw new Error(`${collection} 必须是数组`);
    }
    if (!Array.isArray(entries)) continue;
    const ids = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      if (!isRecord(entry)) throw new Error(`${collection}[${index}] 必须是对象`);
      if (typeof entry.id !== "string" || !entry.id) {
        throw new Error(`${collection}[${index}].id 必须是非空字符串`);
      }
      if (typeof entry.name !== "string" || !entry.name) {
        throw new Error(`${collection}[${index}].name 必须是非空字符串`);
      }
      if (ids.has(entry.id)) throw new Error(`${collection} 中存在重复样式 ID：${entry.id}`);
      ids.add(entry.id);
      validateStyleValues(entry, `${collection}.${entry.name}`);
    }
  }
  if (styles.default !== undefined && !isRecord(styles.default)) {
    throw new Error("default 必须是对象");
  }
  if (styles.tableStylesXml !== undefined && typeof styles.tableStylesXml !== "string") {
    throw new Error("tableStylesXml 必须是字符串");
  }
}

function validateStyleValues(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => validateStyleValues(child, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if ((key === "size" || key === "sizeComplexScript") && child !== undefined) {
      if (typeof child !== "number" || !Number.isFinite(child) || child <= 0) {
        throw new Error(`${childPath} 必须是大于 0 的数字`);
      }
    }
    if ((key === "color" || key === "fill") && typeof child === "string") {
      if (child !== "auto" && !/^[0-9a-fA-F]{6}$/.test(child)) {
        throw new Error(`${childPath} 必须是六位十六进制颜色或 auto`);
      }
    }
    validateStyleValues(child, childPath);
  }
}

function synchronizeTableStylesXml(styles: Record<string, unknown>): void {
  const xml = styles.tableStylesXml;
  const tableStyles = styles.tableStyles;
  if (typeof xml !== "string" || !Array.isArray(tableStyles)) return;
  const tableStyle = tableStyles.find(
    (entry): entry is Record<string, unknown> => isRecord(entry) && entry.name === "Table",
  );
  if (!tableStyle) return;
  const match = xml.match(/<w:style\b[^>]*w:styleId="Table"[\s\S]*?<\/w:style>/);
  if (!match) return;

  let fragment = match[0];
  const run = isRecord(tableStyle.run) ? tableStyle.run : {};
  const font = isRecord(run.font) ? run.font : {};
  fragment = replaceFirstXmlTag(fragment, "w:rFonts", {
    "w:ascii": font.ascii,
    "w:hAnsi": font.hAnsi,
    "w:eastAsia": font.eastAsia,
  });
  fragment = replaceFirstXmlTag(fragment, "w:sz", { "w:val": run.size });
  fragment = replaceFirstXmlTag(fragment, "w:szCs", {
    "w:val": run.sizeComplexScript ?? run.size,
  });

  const paragraph = isRecord(tableStyle.paragraph) ? tableStyle.paragraph : {};
  const table = isRecord(tableStyle.table) ? tableStyle.table : {};
  fragment = replaceXmlTagInSection(fragment, "w:pPr", "w:jc", {
    "w:val": paragraph.alignment,
  });
  fragment = replaceXmlTagInSection(fragment, "w:tblPr", "w:jc", {
    "w:val": table.alignment,
  });
  const cellMargin = isRecord(table.cellMargin) ? table.cellMargin : {};
  for (const side of ["top", "left", "bottom", "right"] as const) {
    fragment = replaceXmlTagInSection(fragment, "w:tblCellMar", `w:${side}`, {
      "w:w": cellMargin[side],
    });
  }
  styles.tableStylesXml = xml.replace(match[0], fragment);
}

function replaceXmlTagInSection(
  xml: string,
  sectionName: string,
  tagName: string,
  attributes: Record<string, unknown>,
): string {
  const sectionPattern = new RegExp(`(<${sectionName}\\b[^>]*>)([\\s\\S]*?)(<\\/${sectionName}>)`);
  return xml.replace(sectionPattern, (_, open: string, body: string, close: string) => {
    return `${open}${replaceFirstXmlTag(body, tagName, attributes)}${close}`;
  });
}

function replaceFirstXmlTag(
  xml: string,
  tagName: string,
  attributes: Record<string, unknown>,
): string {
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*/>`);
  return xml.replace(tagPattern, (tag) => {
    let updated = tag;
    for (const [name, value] of Object.entries(attributes)) {
      if (value === undefined) continue;
      const encoded = String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
      const attributePattern = new RegExp(`${name}="[^"]*"`);
      updated = attributePattern.test(updated)
        ? updated.replace(attributePattern, `${name}="${encoded}"`)
        : updated.replace("/>", ` ${name}="${encoded}"/>`);
    }
    return updated;
  });
}

function styleRevision(source: string): string {
  return Bun.hash(source).toString(16);
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status: 400 });
}

function enforceConfigDependencies(config: unknown): void {
  if (!isRecord(config)) return;
  const numberHeadings = config.numberHeadings;
  const normalizeHeadings = config.normalizeHeadings;
  if (!isRecord(numberHeadings) || !isRecord(normalizeHeadings)) return;
  if (numberHeadings.enabled === true) normalizeHeadings.enabled = true;
}

function validateWebConfig(config: unknown, schema: unknown): void {
  if (!isRecord(config) || !isRecord(schema)) throw new Error("配置必须是 JSON 对象");
  const properties = schema.properties;
  if (!isRecord(properties)) throw new Error("配置 schema 无效");
  assertKnownKeys(config, properties, "");
  const configOptions = getConfigOptions(schema);
  for (const option of configOptions) {
    const value = getPath(config, option.path);
    if (value === undefined) {
      if (option.required) throw new Error(`缺少配置项：${option.path}`);
      continue;
    }
    if (option.type === "integer" && !Number.isInteger(value)) {
      throw new Error(`${option.path} 必须是整数`);
    }
    if (option.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`${option.path} 必须是数字`);
    }
    if (option.type !== "integer" && option.type !== "number" && typeof value !== option.type) {
      throw new Error(`${option.path} 必须是 ${option.type}`);
    }
    if (option.enum && !option.enum.includes(value)) throw new Error(`${option.path} 的值无效`);
    if (typeof value === "number" && option.minimum !== undefined && value < option.minimum) {
      throw new Error(`${option.path} 不能小于 ${option.minimum}`);
    }
  }
}

function assertKnownKeys(
  config: Record<string, unknown>,
  properties: Record<string, unknown>,
  prefix: string,
): void {
  for (const key of Object.keys(config)) {
    if (!(key in properties)) throw new Error(`未知配置项：${prefix}${key}`);
  }
  for (const [key, childSchema] of Object.entries(properties)) {
    if (!isRecord(childSchema) || childSchema.type !== "object") continue;
    const childConfig = config[key];
    if (!isRecord(childConfig)) throw new Error(`${prefix}${key} 必须是对象`);
    const childProperties = childSchema.properties;
    if (!isRecord(childProperties)) throw new Error("配置 schema 无效");
    assertKnownKeys(childConfig, childProperties, `${prefix}${key}.`);
  }
}

function getPath(source: Record<string, unknown>, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function openBrowser(url: string): void {
  const command =
    process.platform === "win32"
      ? ["cmd", "/c", "start", "", url]
      : process.platform === "darwin"
        ? ["open", url]
        : ["xdg-open", url];
  Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
}

if (import.meta.main) {
  await startWebEditor();
}
