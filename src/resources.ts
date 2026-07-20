import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import configText from "../config/default/config.json" with { type: "text" };
import imageSizeFilterText from "../config/lua/limit-image-size.lua" with { type: "text" };
import inlineCodeFilterText from "../config/lua/add-inline-code.lua" with { type: "text" };
import styleRawText from "../config/default/style-raw.json" with { type: "text" };
import styleConfigText from "../config/default/style-config.json" with { type: "text" };
import { TMP_DIR } from "./paths";

export const DEFAULT_CONFIG_TEXT = configText as unknown as string;
export const DEFAULT_STYLE_CONFIG_TEXT = styleConfigText as unknown as string;
export const DEFAULT_STYLE_RAW_TEXT = styleRawText as unknown as string;

function materializeResource(name: string, content: string): string {
  const directory = join(TMP_DIR, "resources");
  const path = join(directory, name);
  if (!existsSync(path) || readFileSync(path, "utf-8") !== content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf-8");
  }
  return path;
}

export function materializeDefaultConfig(): string {
  return materializeResource(join("default", "config.json"), DEFAULT_CONFIG_TEXT);
}

export function materializeDefaultStyleRaw(): string {
  return materializeResource(join("default", "style-raw.json"), DEFAULT_STYLE_RAW_TEXT);
}

export function materializeDefaultStyleConfig(): string {
  return materializeResource(join("default", "style-config.json"), DEFAULT_STYLE_CONFIG_TEXT);
}

export function materializeInlineCodeFilter(): string {
  return materializeResource("add-inline-code.lua", inlineCodeFilterText);
}

export function materializeImageSizeFilter(): string {
  return materializeResource("limit-image-size.lua", imageSizeFilterText);
}
