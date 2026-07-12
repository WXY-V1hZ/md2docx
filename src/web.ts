import { writeFile } from "fs/promises";
import { resolve } from "path";

import { getConfigOptions } from "./cli";
import { CONFIG_PATH, CONFIG_SCHEMA_PATH } from "./paths";

const HOSTNAME = "127.0.0.1";
const PORT = 3210;
const WEB_DIR = resolve(import.meta.dir, "web");

interface WebHandlerOptions {
  configPath?: string;
  schemaPath?: string;
  webDir?: string;
}

export function createWebHandler(
  options: WebHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const configPath = options.configPath ?? CONFIG_PATH;
  const schemaPath = options.schemaPath ?? CONFIG_SCHEMA_PATH;
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
        validateWebConfig(config, schema);
        const savedConfig = { $schema: "./config.schema.json", ...config };
        await writeFile(configPath, `${JSON.stringify(savedConfig, null, 2)}\n`, "utf-8");
        return Response.json({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ error: message }, { status: 400 });
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
  console.log(`配置编辑器已启动：${url}`);
  console.log("按 Ctrl+C 停止服务");
  openBrowser(url);
  await new Promise(() => undefined);
}

function validateWebConfig(config: unknown, schema: unknown): void {
  if (!isRecord(config) || !isRecord(schema)) throw new Error("配置必须是 JSON 对象");
  const properties = schema.properties;
  if (!isRecord(properties)) throw new Error("配置 schema 无效");
  assertKnownKeys(config, properties, "");
  const options = getConfigOptions(schema);
  for (const option of options) {
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
    if (option.enum && !option.enum.includes(value)) {
      throw new Error(`${option.path} 的值无效`);
    }
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
