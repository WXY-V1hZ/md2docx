import { type AppConfig } from "./config";

type SchemaValueType = "boolean" | "integer" | "number" | "string";

interface SchemaNode {
  type?: SchemaValueType | "object";
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  properties?: Record<string, SchemaNode>;
  required?: string[];
}

export interface ConfigOption {
  path: string;
  type: SchemaValueType;
  description: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  required: boolean;
}

export interface CliOptions {
  help: boolean;
  web: boolean;
  mdPath?: string;
  outputPath?: string;
  configPath?: string;
  overrides: Map<string, unknown>;
}

export function getConfigOptions(schema: SchemaNode): ConfigOption[] {
  const options: ConfigOption[] = [];

  function walk(node: SchemaNode, prefix: string): void {
    if (node.type !== "object" || !node.properties) return;
    for (const [name, child] of Object.entries(node.properties)) {
      const path = prefix ? `${prefix}.${name}` : name;
      if (child.type === "object") {
        walk(child, path);
      } else if (isValueType(child.type)) {
        options.push({
          path,
          type: child.type,
          description: child.description ?? "",
          default: child.default,
          enum: child.enum,
          minimum: child.minimum,
          required: node.required?.includes(name) ?? false,
        });
      }
    }
  }

  walk(schema, "");
  return options;
}

export function parseCliArgs(args: string[], configOptions: ConfigOption[]): CliOptions {
  const optionsByName = new Map(configOptions.map((option) => [option.path, option]));
  const result: CliOptions = { help: false, web: false, overrides: new Map() };
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "-h" || arg === "--help") {
      result.help = true;
      continue;
    }
    if (arg === "--web") {
      result.web = true;
      continue;
    }
    if (arg === "-o" || arg === "--config") {
      const value = args[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} 缺少路径`);
      }
      if (arg === "-o") result.outputPath = value;
      else result.configPath = value;
      continue;
    }
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const option = optionsByName.get(name);
      if (!option) throw new Error(`未知参数：${arg}`);
      const value = args[++i];
      if (value === undefined) throw new Error(`${arg} 缺少值`);
      result.overrides.set(name, parseConfigValue(value, option));
      continue;
    }
    if (arg.startsWith("-") && !isNumericArgument(arg)) {
      throw new Error(`未知参数：${arg}`);
    }
    positional.push(arg);
  }

  if (!result.help && !result.web) {
    if (positional.length === 0) throw new Error("缺少 Markdown 文件路径");
    if (positional.length > 1) throw new Error("只能指定一个 Markdown 文件路径");
    result.mdPath = positional[0];
  }
  return result;
}

export function applyConfigOverrides(
  config: AppConfig,
  overrides: Map<string, unknown>,
): AppConfig {
  const merged = structuredClone(config) as unknown as Record<string, unknown>;
  for (const [path, value] of overrides) {
    const segments = path.split(".");
    let target = merged;
    for (const segment of segments.slice(0, -1)) {
      const next = target[segment];
      if (!isRecord(next)) throw new Error(`配置路径不存在：${path}`);
      target = next;
    }
    target[segments.at(-1)!] = value;
  }
  return merged as unknown as AppConfig;
}

export function formatHelp(configOptions: ConfigOption[]): string {
  const lines = [
    "用法:",
    "  md2docx <md-path> [选项]",
    "",
    "选项:",
    "  -o <path>                         输出 docx 路径",
    "  --config <path>                   配置文件路径，默认 config/config.json",
    "  --web                             打开默认配置的网页编辑器",
    "  -h, --help                        显示帮助",
    "",
    "配置覆盖:",
  ];

  for (const option of configOptions) {
    const constraints = [
      option.default === undefined ? undefined : `默认: ${String(option.default)}`,
      option.enum ? `可选: ${option.enum.join(" | ")}` : undefined,
      option.minimum === undefined ? undefined : `最小: ${option.minimum}`,
    ].filter(Boolean);
    lines.push(`  --${option.path} <${option.type}>`);
    lines.push(
      `      ${option.description}${constraints.length ? `（${constraints.join("；")}）` : ""}`,
    );
  }

  return lines.join("\n");
}

function parseConfigValue(value: string, option: ConfigOption): unknown {
  let parsed: unknown;
  switch (option.type) {
    case "boolean":
      if (value !== "true" && value !== "false") {
        throw new Error(`--${option.path} 需要 boolean（true 或 false），收到：${value}`);
      }
      parsed = value === "true";
      break;
    case "integer":
      if (!/^-?\d+$/.test(value)) {
        throw new Error(`--${option.path} 需要整数，收到：${value}`);
      }
      parsed = Number(value);
      break;
    case "number":
      parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`--${option.path} 需要数字，收到：${value}`);
      }
      break;
    case "string":
      parsed = value;
      break;
  }

  if (option.enum && !option.enum.includes(parsed)) {
    throw new Error(`--${option.path} 必须是以下值之一：${option.enum.join(", ")}`);
  }
  if (typeof parsed === "number" && option.minimum !== undefined && parsed < option.minimum) {
    throw new Error(`--${option.path} 不能小于 ${option.minimum}`);
  }
  return parsed;
}

function isValueType(type: SchemaNode["type"]): type is SchemaValueType {
  return type === "boolean" || type === "integer" || type === "number" || type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumericArgument(value: string): boolean {
  return /^-\d/.test(value);
}
