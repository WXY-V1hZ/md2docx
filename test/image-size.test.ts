import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import PizZip from "pizzip";

const FILTER_PATH = join(import.meta.dir, "..", "config", "lua", "limit-image-size.lua");
const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "md2docx-image-size-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("图片尺寸 Lua filter", () => {
  it("等比缩小宽图和长图，不放大小图，并保留显式尺寸", () => {
    const dir = createTempDir();
    writeSvg(join(dir, "wide.svg"), 960, 480);
    writeSvg(join(dir, "tall.svg"), 480, 960);
    writeSvg(join(dir, "small.svg"), 96, 48);

    const markdown = [
      "![wide](wide.svg)",
      "![tall](tall.svg)",
      "![small](small.svg)",
      "![explicit](wide.svg){width=20cm}",
    ].join("\n\n");
    const result = spawnSync(
      "pandoc",
      [
        "-f",
        "markdown",
        "-t",
        "json",
        "--metadata=md2docx-image-max-width-cm:10",
        "--metadata=md2docx-image-max-height-cm:8",
        `--lua-filter=${FILTER_PATH}`,
      ],
      { cwd: dir, input: markdown, encoding: "utf-8", windowsHide: true },
    );

    expect(result.status).toBe(0);
    const images = findImageNodes(JSON.parse(result.stdout) as unknown);
    expect(images).toHaveLength(4);
    expect(imageAttributes(images[0]!)).toEqual({ width: "10.0000cm", height: "5.0000cm" });
    expect(imageAttributes(images[1]!)).toEqual({ width: "4.0000cm", height: "8.0000cm" });
    expect(imageAttributes(images[2]!)).toEqual({});
    expect(imageAttributes(images[3]!)).toEqual({ width: "20cm" });

    const output = join(dir, "output.docx");
    const docxResult = spawnSync(
      "pandoc",
      [
        "-f",
        "markdown",
        "-o",
        output,
        "--metadata=md2docx-image-max-width-cm:10",
        "--metadata=md2docx-image-max-height-cm:8",
        `--lua-filter=${FILTER_PATH}`,
      ],
      { cwd: dir, input: markdown, encoding: "utf-8", windowsHide: true },
    );
    expect(docxResult.status).toBe(0);

    const documentXml = new PizZip(readFileSync(output)).file("word/document.xml")?.asText();
    expect(documentXml).toBeDefined();
    const extents = Array.from(
      documentXml!.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"\s*\/>/g),
      (match) => [Number(match[1]), Number(match[2])],
    );
    const expectedExtents = [
      [3_600_000, 1_800_000],
      [1_440_000, 2_880_000],
      [914_400, 457_200],
    ];
    expect(extents).toHaveLength(4);
    for (let index = 0; index < expectedExtents.length; index++) {
      expect(Math.abs(extents[index]![0]! - expectedExtents[index]![0]!)).toBeLessThanOrEqual(1);
      expect(Math.abs(extents[index]![1]! - expectedExtents[index]![1]!)).toBeLessThanOrEqual(1);
    }
  });

  it("单张图片读取失败时警告一次并继续处理", () => {
    const dir = createTempDir();
    const result = spawnSync(
      "pandoc",
      [
        "-f",
        "markdown",
        "-t",
        "json",
        "--metadata=md2docx-image-max-width-cm:10",
        "--metadata=md2docx-image-max-height-cm:8",
        `--lua-filter=${FILTER_PATH}`,
      ],
      {
        cwd: dir,
        input: "![first](missing.png)\n\n![second](missing.png)",
        encoding: "utf-8",
        windowsHide: true,
      },
    );

    expect(result.status).toBe(0);
    expect(findImageNodes(JSON.parse(result.stdout) as unknown)).toHaveLength(2);
    expect(result.stderr.match(/无法限制图片尺寸 missing\.png/g)).toHaveLength(1);
  });
});

function writeSvg(path: string, width: number, height: number): void {
  writeFileSync(
    path,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="black"/></svg>`,
    "utf-8",
  );
}

function findImageNodes(
  value: unknown,
  found: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    for (const item of value) findImageNodes(item, found);
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.t === "Image") found.push(record);
    for (const item of Object.values(record)) findImageNodes(item, found);
  }
  return found;
}

function imageAttributes(image: Record<string, unknown>): Record<string, string> {
  const content = image.c as unknown[];
  const attr = content[0] as unknown[];
  return Object.fromEntries(attr[2] as [string, string][]);
}
