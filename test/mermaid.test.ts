import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Root } from "mdast";
import sharp from "sharp";
import { renderMermaid, resolveCSSVars, setPngDensity } from "../src/preprocess/mermaid";

const hasLinuxCjkFont =
  process.platform === "linux" &&
  spawnSync("fc-match", ["-f", "%{lang}", "sans-serif:lang=zh-cn"], {
    encoding: "utf8",
    timeout: 3000,
  })
    .stdout?.split("|")
    .includes("zh-cn");

describe("Mermaid SVG 渲染", () => {
  it.skipIf(!hasLinuxCjkFont)("使用 Fontconfig 发现的字体渲染中文和数字标签", async () => {
    const directory = await mkdtemp(join(tmpdir(), "md2docx-mermaid-"));
    try {
      const root: Root = {
        type: "root",
        children: [{ type: "code", lang: "mermaid", value: "flowchart TD\nA[中文 123]" }],
      };
      await renderMermaid(root, directory, "tokyo-night-light", 200);

      const png = sharp(join(directory, "mermaid_1.png"));
      const { width, height } = await png.metadata();
      // 节点内部颜色均匀。分别检查标签左右两半，避开节点边框。
      for (const left of [0.36, 0.5]) {
        const pixels = await png
          .clone()
          .extract({
            left: Math.floor(width * left),
            top: Math.floor(height * 0.43),
            width: Math.floor(width * 0.14),
            height: Math.floor(height * 0.14),
          })
          .greyscale()
          .raw()
          .toBuffer();
        expect(pixels.some((pixel) => pixel < 150)).toBe(true);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("解析带嵌套回退值的 CSS 变量", () => {
    const svg = `<svg style="--fg:#112233;--bg:#fff">
      <style>svg { --_line: var(--line, color-mix(in srgb, var(--fg) 50%, var(--bg))); }</style>
      <line stroke="var(--_line)" />
    </svg>`;

    const resolved = resolveCSSVars(svg);

    expect(resolved).toContain('stroke="#889199"');
  });

  it("CSS 变量存在时优先于回退值", () => {
    const svg = `<svg style="--line:#123456;--fg:#000000;--bg:#ffffff">
      <style>svg { --_line: var(--line, color-mix(in srgb, var(--fg) 50%, var(--bg))); }</style>
      <line stroke="var(--_line)" />
    </svg>`;

    expect(resolveCSSVars(svg)).toContain('stroke="#123456"');
  });

  it("写入与渲染密度一致的 PNG pHYs 块", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+AvzZbgAAAABJRU5ErkJggg==",
      "base64",
    );
    const output = setPngDensity(png, 200);
    const type = Buffer.from("pHYs");
    const offset = Buffer.from(output).indexOf(type);

    expect(offset).toBeGreaterThan(0);
    const view = new DataView(output.buffer, output.byteOffset + offset + 4, 9);
    expect(view.getUint32(0)).toBe(7874);
    expect(view.getUint32(4)).toBe(7874);
    expect(view.getUint8(8)).toBe(1);
  });
});
