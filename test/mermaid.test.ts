import { describe, expect, it } from "bun:test";
import { resolveCSSVars, setPngDensity } from "../src/preprocess/mermaid";

describe("Mermaid SVG 渲染", () => {
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
