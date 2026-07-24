import { beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { HistoryRecord } from "../../frontend/composables/useConversionManager";

// ---------------------------------------------------------------------------
// 编译 ConversionHistoryItem.vue — bun test 不能直接 import .vue 文件，所以用
// @vue/compiler-sfc 预编译为组件对象再挂载。
// ---------------------------------------------------------------------------

let mountComponent: (props: {
  record: HistoryRecord;
}) => ReturnType<typeof import("@vue/test-utils").shallowMount>;

beforeAll(async () => {
  const { parse, compileScript, compileTemplate } = await import("@vue/compiler-sfc");
  const { readFileSync } = await import("node:fs");
  const { shallowMount } = await import("@vue/test-utils");

  const source = readFileSync(
    new URL("../../frontend/components/ConversionHistoryItem.vue", import.meta.url),
    "utf-8",
  );
  const { descriptor } = parse(source, { filename: "ConversionHistoryItem.vue" });

  const script = compileScript(descriptor, { id: "test" });
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename: "ConversionHistoryItem.vue",
    id: "test",
    compilerOptions: { bindingMetadata: script.bindings },
  });

  // 清理 TS 类型语法
  let scriptContent = script.content
    .replace(/^import\s+type\s+.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^export default /m, "const __sfc_main = ");

  const renderCode = template.code.replace(/^export function render/, "function render");

  const fullCode =
    scriptContent +
    "\n\n" +
    renderCode +
    "\n\n__sfc_main.render = render;\nexport default __sfc_main;\n";

  // 写入项目内的临时文件再动态 import（避免 eval 不支持顶级 import）
  const testDir = fileURLToPath(new URL(".", import.meta.url));
  const tmpDir = join(testDir, "..", "tmp", "vue-compiled");
  mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, "ConversionHistoryItem.mts");
  writeFileSync(tmpFile, "// @ts-nocheck\n" + fullCode);
  const mod = await import(tmpFile);
  const Component = mod.default;

  mountComponent = (props: { record: HistoryRecord }) => shallowMount(Component, { props });
});

// ---------------------------------------------------------------------------
// 环境 mock
// ---------------------------------------------------------------------------

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    writable: true,
  });

  Object.defineProperty(window, "md2docx", {
    value: {},
    configurable: true,
    writable: true,
  });
});

function createRecord(overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  return {
    id: "rec-1",
    sourcePath: "source.md",
    sourceName: "source.md",
    preset: "default",
    status: "success",
    startedAt: Date.now() - 120_000,
    completedAt: Date.now(),
    unread: false,
    outputPath: "output.docx",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe("ConversionHistoryItem", () => {
  test("success status: renders FileCheck2 icon, filename is a clickable button, clicking emits openFile", async () => {
    const record = createRecord({ status: "success", outputPath: "/dir/output.docx" });
    const wrapper = mountComponent({ record });

    expect(wrapper.classes()).toContain("item--success");

    const nameBtn = wrapper.find(".item__name--button");
    expect(nameBtn.exists()).toBe(true);
    expect(nameBtn.text()).toBe("output.docx");
    expect(nameBtn.element.tagName).toBe("BUTTON");

    await nameBtn.trigger("click");
    expect(wrapper.emitted("openFile")).toHaveLength(1);
    expect(wrapper.emitted("openFile")![0]).toEqual(["/dir/output.docx"]);
  });

  test("error status: renders CircleAlert icon, shows error text in meta, filename is NOT a button", () => {
    const record = createRecord({
      status: "error",
      error: "Pandoc 退出码 2",
      outputPath: undefined,
    });
    const wrapper = mountComponent({ record });

    expect(wrapper.classes()).toContain("item--error");

    expect(wrapper.find(".item__name--button").exists()).toBe(false);
    expect(wrapper.find("span.item__name").exists()).toBe(true);
    expect(wrapper.find("span.item__name").text()).toBe("source.md");

    expect(wrapper.find(".item__meta").text()).toContain("Pandoc 退出码 2");
  });

  test("missing status: renders FileQuestion icon, shows '源文件不存在' in meta", () => {
    const record = createRecord({
      status: "missing",
      outputPath: undefined,
    });
    const wrapper = mountComponent({ record });

    expect(wrapper.classes()).toContain("item--missing");
    expect(wrapper.find(".item__meta").text()).toContain("源文件不存在");
  });

  test("converting status: renders spinner, no action buttons", () => {
    const record = createRecord({
      status: "converting",
      outputPath: undefined,
      completedAt: undefined,
    });
    const wrapper = mountComponent({ record });

    expect(wrapper.classes()).toContain("item--converting");
    expect(wrapper.find(".item__spinner").exists()).toBe(true);

    expect(wrapper.find('[aria-label="显示文件位置"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="重新生成"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="删除记录"]').exists()).toBe(false);
  });

  test('clicking FolderOpen button emits "showInFolder" with outputPath', async () => {
    const record = createRecord({ status: "success", outputPath: "/out/report.docx" });
    const wrapper = mountComponent({ record });

    const btn = wrapper.find('[aria-label="显示文件位置"]');
    expect(btn.exists()).toBe(true);

    await btn.trigger("click");
    expect(wrapper.emitted("showInFolder")).toHaveLength(1);
    expect(wrapper.emitted("showInFolder")![0]).toEqual(["/out/report.docx"]);
  });

  test('clicking RefreshCw button emits "regenerate" with record.id', async () => {
    const record = createRecord({ status: "success", id: "rec-42" });
    const wrapper = mountComponent({ record });

    const btn = wrapper.find('[aria-label="重新生成"]');
    expect(btn.exists()).toBe(true);

    await btn.trigger("click");
    expect(wrapper.emitted("regenerate")).toHaveLength(1);
    expect(wrapper.emitted("regenerate")![0]).toEqual(["rec-42"]);
  });

  test('clicking X button emits "remove" with record.id', async () => {
    const record = createRecord({ status: "error", id: "rec-99", outputPath: undefined });
    const wrapper = mountComponent({ record });

    const btn = wrapper.find('[aria-label="删除记录"]');
    expect(btn.exists()).toBe(true);

    await btn.trigger("click");
    expect(wrapper.emitted("remove")).toHaveLength(1);
    expect(wrapper.emitted("remove")![0]).toEqual(["rec-99"]);
  });

  test("success record with outputPath shows FolderOpen and RefreshCw buttons", () => {
    const record = createRecord({ status: "success", outputPath: "/out/result.docx" });
    const wrapper = mountComponent({ record });

    expect(wrapper.find('[aria-label="显示文件位置"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="重新生成"]').exists()).toBe(true);
  });

  test("missing record does NOT show RefreshCw button", () => {
    const record = createRecord({
      status: "missing",
      outputPath: undefined,
    });
    const wrapper = mountComponent({ record });

    expect(wrapper.find('[aria-label="重新生成"]').exists()).toBe(false);
    // 删除按钮仍应显示（status !== "converting"）
    expect(wrapper.find('[aria-label="删除记录"]').exists()).toBe(true);
  });
});
