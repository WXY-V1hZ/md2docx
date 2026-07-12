import { afterEach, describe, expect, it } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { CONFIG_PATH, CONFIG_SCHEMA_PATH } from "../src/paths";
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
    expect(await page.text()).toContain("md2docx 配置台");
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
    expect(script).toContain("enumDescriptions");
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
