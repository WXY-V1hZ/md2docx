export interface StyleConfig {
  $schema?: string;
  schemaVersion: 1;
  options?: StyleOptions;
}

export interface StyleOptions {
  body?: {
    firstLineIndent?: boolean;
  };
  headings?: {
    "1"?: {
      startOnNewPage?: boolean;
    };
  };
  inlineCode?: {
    background?: boolean;
  };
  codeBlock?: {
    border?: boolean;
  };
}

export function validateStyleConfig(value: unknown, path: string): StyleConfig {
  const root = expectRecord(value, path, "样式配置");
  rejectUnknown(root, ["$schema", "schemaVersion", "options"], path, "样式配置");

  if (root.$schema !== undefined) expectString(root.$schema, path, "$schema");
  if (root.schemaVersion !== 1) invalidStyleConfig(path, "schemaVersion", "目前只支持版本 1");

  if (root.options !== undefined) validateOptions(root.options, path);
  return root as unknown as StyleConfig;
}

function validateOptions(value: unknown, path: string): void {
  const options = expectRecord(value, path, "options");
  rejectUnknown(options, ["body", "headings", "inlineCode", "codeBlock"], path, "options");

  if (options.body !== undefined) {
    const body = expectRecord(options.body, path, "options.body");
    rejectUnknown(body, ["firstLineIndent"], path, "options.body");
    if (body.firstLineIndent !== undefined) {
      expectBoolean(body.firstLineIndent, path, "options.body.firstLineIndent");
    }
  }

  if (options.headings !== undefined) {
    const headings = expectRecord(options.headings, path, "options.headings");
    rejectUnknown(headings, ["1"], path, "options.headings");
    if (headings["1"] !== undefined) {
      const heading1 = expectRecord(headings["1"], path, 'options.headings["1"]');
      rejectUnknown(heading1, ["startOnNewPage"], path, 'options.headings["1"]');
      if (heading1.startOnNewPage !== undefined) {
        expectBoolean(heading1.startOnNewPage, path, 'options.headings["1"].startOnNewPage');
      }
    }
  }

  if (options.inlineCode !== undefined) {
    const inlineCode = expectRecord(options.inlineCode, path, "options.inlineCode");
    rejectUnknown(inlineCode, ["background"], path, "options.inlineCode");
    if (inlineCode.background !== undefined) {
      expectBoolean(inlineCode.background, path, "options.inlineCode.background");
    }
  }

  if (options.codeBlock !== undefined) {
    const codeBlock = expectRecord(options.codeBlock, path, "options.codeBlock");
    rejectUnknown(codeBlock, ["border"], path, "options.codeBlock");
    if (codeBlock.border !== undefined) {
      expectBoolean(codeBlock.border, path, "options.codeBlock.border");
    }
  }
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
  field: string,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined) invalidStyleConfig(path, `${field}.${unknown}`, "不是支持的配置项");
}

function expectRecord(value: unknown, path: string, field: string): Record<string, unknown> {
  if (!isRecord(value)) invalidStyleConfig(path, field, "必须是对象");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectBoolean(value: unknown, path: string, field: string): void {
  if (typeof value !== "boolean") invalidStyleConfig(path, field, "必须是 boolean");
}

function expectString(value: unknown, path: string, field: string): void {
  if (typeof value !== "string") invalidStyleConfig(path, field, "必须是字符串");
}

function invalidStyleConfig(path: string, field: string, reason: string): never {
  throw new Error(`样式配置无效：${path}\n位置：${field}\n原因：${reason}`);
}
