import { afterEach, describe, expect, mock, test } from "bun:test";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

import ConversionInspector from "../../frontend/components/ConversionInspector.vue";
import defaultConfig from "../../config/default/config.json" with { type: "json" };
import defaultStyleConfig from "../../config/default/style-config.json" with { type: "json" };

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.replaceChildren();
  delete (window as { md2docx?: unknown }).md2docx;
});

function preset(name: string): EditablePreset {
  return {
    name,
    source: name === "default" ? "builtin" : "user",
    config: structuredClone(defaultConfig) as PresetAppConfig,
    styleConfig: structuredClone(defaultStyleConfig) as PresetStyleConfig,
  };
}

function bridge(saved?: DesktopConversionSettings) {
  const value = {
    getPresets: mock(() =>
      Promise.resolve([
        {
          name: "default",
          source: "builtin" as const,
          current: true,
          customFiles: [],
          valid: true,
        },
        {
          name: "academic",
          source: "user" as const,
          current: false,
          customFiles: [],
          valid: true,
        },
      ]),
    ),
    readPreset: mock((name: string) => Promise.resolve(preset(name))),
    usePreset: mock(() => Promise.resolve()),
    loadConversionSettings: mock(() => Promise.resolve(saved)),
    saveConversionSettings: mock((settings: DesktopConversionSettings) =>
      Promise.resolve(settings),
    ),
  };
  Object.defineProperty(window, "md2docx", { configurable: true, value });
  return value;
}

describe("ConversionInspector", () => {
  test("恢复收起状态并交给主界面按钮控制", async () => {
    bridge({
      schemaVersion: 1,
      preset: "default",
      config: structuredClone(defaultConfig) as PresetAppConfig,
      styleConfig: structuredClone(defaultStyleConfig) as PresetStyleConfig,
      collapsed: true,
    });
    wrapper = mount(ConversionInspector);
    await flushPromises();

    expect(wrapper.emitted("update:collapsed")?.at(-1)).toEqual([true]);
    await wrapper.setProps({ collapsed: true });
    expect(wrapper.classes()).toContain("conversion-inspector--collapsed");
    await wrapper.setProps({ collapsed: false });
    expect(wrapper.classes()).not.toContain("conversion-inspector--collapsed");
  });

  test("直接调整只自动保存工作区，不修改预设", async () => {
    const api = bridge();
    wrapper = mount(ConversionInspector, {
      props: { collapsed: false },
      global: { stubs: { Teleport: true } },
    });
    await flushPromises();

    const spacing = wrapper.get<HTMLInputElement>('input[type="number"][step="0.05"]');
    await spacing.setValue("1.8");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await flushPromises();

    expect(api.saveConversionSettings).toHaveBeenCalled();
    const saved = api.saveConversionSettings.mock.calls.at(-1)?.[0];
    expect(saved?.styleConfig.options?.body?.lineSpacing).toBe(1.8);
    expect((api as Record<string, unknown>).updatePreset).toBeUndefined();
  });

  test("无效数值通过 change 事件阻止转换", async () => {
    bridge();
    wrapper = mount(ConversionInspector, { props: { collapsed: false } });
    await flushPromises();

    const density = wrapper.get<HTMLInputElement>('input[type="number"][step="1"]');
    await density.setValue("60");
    await flushPromises();

    expect(wrapper.text()).toContain("图表清晰度必须是不小于 72 的整数");
    expect(wrapper.emitted("change")?.at(-1)?.[1]).toBe(false);
  });
});
