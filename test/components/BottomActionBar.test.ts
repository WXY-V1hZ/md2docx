import { describe, expect, test } from "bun:test";
import { shallowMount } from "@vue/test-utils";
import BottomActionBar from "../../frontend/components/BottomActionBar.vue";

/**
 * Register window.md2docx as the Electron preload bridge.
 * The component calls getPresets() on mount to populate the preset selector.
 */
function mockMd2docx() {
  Object.defineProperty(window, "md2docx", {
    value: {
      getPresets: () =>
        Promise.resolve([
          { name: "default", current: true },
          { name: "academic", current: false },
        ]),
    },
    configurable: true,
  });
}

describe("BottomActionBar", () => {
  test("autoOpen 默认为 false（开关未切换）", () => {
    mockMd2docx();
    const wrapper = shallowMount(BottomActionBar, {
      props: { canConvert: false, fileCount: 0, isConverting: false },
    });

    const toggle = wrapper.find<HTMLInputElement>('input[type="checkbox"]');
    expect(toggle.exists()).toBe(true);
    expect(toggle.element.checked).toBe(false);
  });

  test("禁用状态：canConvert=false fileCount=0 → 按钮禁用，文字为『转换』", () => {
    mockMd2docx();
    const wrapper = shallowMount(BottomActionBar, {
      props: { canConvert: false, fileCount: 0, isConverting: false },
    });

    const btn = wrapper.find<HTMLButtonElement>(".action-bar__convert");
    expect(btn.exists()).toBe(true);
    expect(btn.element.disabled).toBe(true);
    expect(btn.text()).toContain("转换");
  });

  test("可转换状态：canConvert=true fileCount=3 → 按钮启用，文字含『转换 3 个文件』", () => {
    mockMd2docx();
    const wrapper = shallowMount(BottomActionBar, {
      props: { canConvert: true, fileCount: 3, isConverting: false },
    });

    const btn = wrapper.find<HTMLButtonElement>(".action-bar__convert");
    expect(btn.element.disabled).toBe(false);
    expect(btn.text()).toContain("转换 3 个文件");
  });

  test("转换中状态：isConverting=true → 按钮禁用，文字为『转换中…』", () => {
    mockMd2docx();
    const wrapper = shallowMount(BottomActionBar, {
      props: { canConvert: true, fileCount: 2, isConverting: true },
    });

    const btn = wrapper.find<HTMLButtonElement>(".action-bar__convert");
    expect(btn.element.disabled).toBe(true);
    expect(btn.text()).toContain("转换中…");
  });

  test("点击转换按钮触发 convert 事件，携带当前预设与 autoOpen 状态", async () => {
    mockMd2docx();
    const wrapper = shallowMount(BottomActionBar, {
      props: { canConvert: true, fileCount: 1, isConverting: false },
    });

    const btn = wrapper.find<HTMLButtonElement>(".action-bar__convert");
    await btn.trigger("click");

    const emitted = wrapper.emitted("convert");
    expect(emitted).toHaveLength(1);
    const payload = emitted![0]![0] as {
      preset: string;
      openAfterConvert: boolean;
    };
    expect(payload).toEqual({ preset: "default", openAfterConvert: false });
  });
});
