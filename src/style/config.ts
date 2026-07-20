export interface StyleConfig {
  $schema?: string;
  schemaVersion: 1;
  options?: StyleOptions;
}

export interface StyleOptions {
  body?: {
    firstLineIndent?: boolean;
    lineSpacing?: number;
  };
  headings?: {
    "1"?: {
      startOnNewPage?: boolean;
      alignment?: "left" | "center";
      bold?: boolean;
    };
    "2"?: {
      bold?: boolean;
    };
    "3"?: {
      bold?: boolean;
    };
    "4"?: {
      bold?: boolean;
      italic?: boolean;
    };
    "5"?: {
      bold?: boolean;
      italic?: boolean;
    };
    "6"?: {
      bold?: boolean;
      italic?: boolean;
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
    rejectUnknown(body, ["firstLineIndent", "lineSpacing"], path, "options.body");
    if (body.firstLineIndent !== undefined) {
      expectBoolean(body.firstLineIndent, path, "options.body.firstLineIndent");
    }
    if (body.lineSpacing !== undefined) {
      if (
        typeof body.lineSpacing !== "number" ||
        !Number.isFinite(body.lineSpacing) ||
        body.lineSpacing <= 0
      ) {
        invalidStyleConfig(path, "options.body.lineSpacing", "必须是大于 0 的有限数字");
      }
    }
  }

  if (options.headings !== undefined) {
    const headings = expectRecord(options.headings, path, "options.headings");
    rejectUnknown(headings, ["1", "2", "3", "4", "5", "6"], path, "options.headings");
    validateHeading(headings, "1", ["startOnNewPage", "alignment", "bold"], path);
    validateHeading(headings, "2", ["bold"], path);
    validateHeading(headings, "3", ["bold"], path);
    validateHeading(headings, "4", ["bold", "italic"], path);
    validateHeading(headings, "5", ["bold", "italic"], path);
    validateHeading(headings, "6", ["bold", "italic"], path);
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

function validateHeading(
  headings: Record<string, unknown>,
  level: string,
  allowed: string[],
  path: string,
): void {
  if (headings[level] === undefined) return;
  const field = `options.headings["${level}"]`;
  const heading = expectRecord(headings[level], path, field);
  rejectUnknown(heading, allowed, path, field);
  if (heading.startOnNewPage !== undefined) {
    expectBoolean(heading.startOnNewPage, path, `${field}.startOnNewPage`);
  }
  if (heading.alignment !== undefined) {
    expectEnum(heading.alignment, ["left", "center"], path, `${field}.alignment`);
  }
  if (heading.bold !== undefined) expectBoolean(heading.bold, path, `${field}.bold`);
  if (heading.italic !== undefined) expectBoolean(heading.italic, path, `${field}.italic`);
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

function expectEnum(value: unknown, allowed: string[], path: string, field: string): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    invalidStyleConfig(path, field, `必须是 ${allowed.join("、")} 之一`);
  }
}

function invalidStyleConfig(path: string, field: string, reason: string): never {
  throw new Error(`样式配置无效：${path}\n位置：${field}\n原因：${reason}`);
}
