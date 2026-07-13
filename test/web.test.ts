import { afterEach, describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { CONFIG_PATH, CONFIG_SCHEMA_PATH, STYLE_CONFIG } from "../src/paths";
import { createWebHandler } from "../src/web";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Web 配置编辑器", () => {
  it("提供页面和当前配置", async () => {
    const handler = createWebHandler();
    const page = await handler(new Request("http://localhost/"));
    const data = await handler(new Request("http://localhost/api/config"));

    expect(page.status).toBe(200);
    expect(page.headers.get("Content-Type")).toContain("text/html");
    expect(await page.text()).toContain("md2docx 文档设计台");
    expect(data.status).toBe(200);
    expect((await data.json()).config.figureCaption.enabled).toBe(true);
  });

  it("使用索引导航且不显示配置预览", async () => {
    const handler = createWebHandler();
    const page = await handler(new Request("http://localhost/"));
    const html = await page.text();
    const script = await (await handler(new Request("http://localhost/app.js"))).text();

    expect(html).toContain('id="config-index"');
    expect(html).not.toContain("配置预览");
    expect(script).not.toContain("field-path");
    expect(script).toContain("createConfigField");
  });

  it("提供文档样式编辑器和样式目录", async () => {
    const handler = createWebHandler();
    const page = await (await handler(new Request("http://localhost/"))).text();
    const response = await handler(new Request("http://localhost/api/styles"));
    const data = await response.json();

    expect(page).toContain('id="styles-view"');
    expect(page).toContain("即时校样");
    expect(response.status).toBe(200);
    expect(data.catalog.some((group: { id: string }) => group.id === "heading")).toBe(true);
    expect(data.styles.paragraphStyles.length).toBeGreaterThan(0);
    expect(typeof data.revision).toBe("string");
  });

  it("校验并保存样式，同时重建 Word 模板", async () => {
    const directory = mkdtempSync(join(tmpdir(), "md2docx-style-web-"));
    temporaryDirectories.push(directory);
    const stylePath = join(directory, "style.json");
    const templatePath = join(directory, "style.docx");
    cpSync(STYLE_CONFIG, stylePath);
    const handler = createWebHandler({ stylePath, templatePath });
    const initial = await (await handler(new Request("http://localhost/api/styles"))).json();
    const normal = initial.styles.paragraphStyles.find(
      (style: { name: string }) => style.name === "Normal",
    );
    normal.run.size = 22;
    const table = initial.styles.tableStyles.find(
      (style: { name: string }) => style.name === "Table",
    );
    table.run.font.eastAsia = "楷体";

    const response = await handler(
      new Request("http://localhost/api/styles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styles: initial.styles, revision: initial.revision }),
      }),
    );
    const saved = JSON.parse(readFileSync(stylePath, "utf-8"));

    expect(response.status).toBe(200);
    expect(
      saved.paragraphStyles.find((style: { name: string }) => style.name === "Normal").run.size,
    ).toBe(22);
    expect(saved.tableStylesXml).toContain('w:eastAsia="楷体"');
    expect(Bun.file(templatePath).size).toBeGreaterThan(0);
  });

  it("拒绝无效样式值和过期版本", async () => {
    const directory = mkdtempSync(join(tmpdir(), "md2docx-style-validation-"));
    temporaryDirectories.push(directory);
    const stylePath = join(directory, "style.json");
    cpSync(STYLE_CONFIG, stylePath);
    const handler = createWebHandler({ stylePath, templatePath: join(directory, "style.docx") });
    const initial = await (await handler(new Request("http://localhost/api/styles"))).json();
    const invalid = structuredClone(initial.styles);
    invalid.paragraphStyles[0].run = { color: "blue" };

    const invalidResponse = await handler(
      new Request("http://localhost/api/styles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styles: invalid, revision: initial.revision }),
      }),
    );
    const staleResponse = await handler(
      new Request("http://localhost/api/styles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styles: initial.styles, revision: "stale" }),
      }),
    );

    expect(invalidResponse.status).toBe(400);
    expect((await invalidResponse.json()).error).toContain("六位十六进制颜色");
    expect(staleResponse.status).toBe(400);
    expect((await staleResponse.json()).error).toContain("刷新页面");
  });

  it("校验并保存配置", async () => {
    const directory = mkdtempSync(join(tmpdir(), "md2docx-web-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, "config.json");
    cpSync(CONFIG_PATH, configPath);
    const handler = createWebHandler({ configPath, schemaPath: CONFIG_SCHEMA_PATH });
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    delete config.$schema;
    config.figureCaption.enabled = false;
    config.normalizeHeadings.enabled = false;
    config.numberHeadings.enabled = true;

    const response = await handler(
      new Request("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }),
    );
    const saved = JSON.parse(readFileSync(configPath, "utf-8"));

    expect(response.status).toBe(200);
    expect(saved.$schema).toBe("./config.schema.json");
    expect(saved.figureCaption.enabled).toBe(false);
    expect(saved.normalizeHeadings.enabled).toBe(true);
  });

  it("拒绝错误类型和未知配置项", async () => {
    const handler = createWebHandler();
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    delete config.$schema;
    config.renderMermaid.density = "high";
    config.unknown = true;

    const response = await handler(
      new Request("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("未知配置项：unknown");
  });
});
