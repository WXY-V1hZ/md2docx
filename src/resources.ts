import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import configText from "../config/config.json" with { type: "text" };
import luaFilterText from "../config/lua/add-inline-code.lua" with { type: "text" };
import styleConfigText from "../config/style-config.json" with { type: "text" };
import styleText from "../config/style.json" with { type: "text" };
import { TMP_DIR } from "./paths";

export const DEFAULT_CONFIG_TEXT = configText as unknown as string;
export const DEFAULT_STYLE_CONFIG_TEXT = styleConfigText as unknown as string;
export const DEFAULT_STYLE_TEXT = styleText as unknown as string;

function materializeResource(name: string, content: string): string {
  const directory = join(TMP_DIR, "resources");
  const path = join(directory, name);
  if (!existsSync(path) || readFileSync(path, "utf-8") !== content) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, content, "utf-8");
  }
  return path;
}

export function materializeDefaultConfig(): string {
  return materializeResource("config.json", DEFAULT_CONFIG_TEXT);
}

export function materializeDefaultStyle(): string {
  return materializeResource("style.json", DEFAULT_STYLE_TEXT);
}

export function materializeDefaultStyleConfig(): string {
  materializeDefaultStyle();
  return materializeResource("style-config.json", DEFAULT_STYLE_CONFIG_TEXT);
}

export function materializeLuaFilter(): string {
  return materializeResource("add-inline-code.lua", luaFilterText);
}
