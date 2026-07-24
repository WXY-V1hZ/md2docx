import { afterEach, describe, expect, mock, test } from "bun:test";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

import PresetManager from "../../frontend/components/PresetManager.vue";

let activeWrapper: VueWrapper | undefined;

afterEach(() => {
  activeWrapper?.unmount();
  activeWrapper = undefined;
  document.body.replaceChildren();
});

function mockDesktopBridge(overrides: Record<string, unknown> = {}) {
  const bridge = {
    detectPandoc: mock(() =>
      Promise.resolve({ available: true, version: "3.6", path: "C:\\Pandoc\\pandoc.exe" }),
    ),
    getPresets: mock(() =>
      Promise.resolve([
        {
          name: "default",
          source: "builtin" as const,
          current: false,
          customFiles: ["config.json", "style-raw.json", "style-config.json"],
          valid: true,
        },
        {
          name: "academic",
          source: "user" as const,
          current: true,
          customFiles: ["config.json"],
          valid: true,
        },
      ]),
    ),
    loadSettings: mock(() =>
      Promise.resolve({
        outputMode: "source" as const,
        outputFolder: "",
        conflictAction: "overwrite" as const,
      }),
    ),
    saveSettings: mock(() => Promise.resolve()),
    usePreset: mock(() => Promise.resolve()),
    renamePreset: mock(() => Promise.resolve()),
    copyPreset: mock(() => Promise.resolve()),
    deletePreset: mock(() => Promise.resolve()),
    ...overrides,
  };
  Object.defineProperty(window, "md2docx", {
    configurable: true,
    value: bridge,
  });
  return bridge;
}

describe("SettingsPanel 预设管理", () => {
  test("只有 default 时可以基于它新建用户预设", async () => {
    const bridge = mockDesktopBridge({
      getPresets: mock(() =>
        Promise.resolve([
          {
            name: "default",
            source: "builtin" as const,
            current: true,
            customFiles: ["config.json", "style-raw.json", "style-config.json"],
            valid: true,
          },
        ]),
      ),
    });
    const wrapper = mount(PresetManager, {
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;
    await flushPromises();

    await wrapper.get(".preset-manager__create").trigger("click");
    const dialog = wrapper.get('[role="dialog"][aria-labelledby="preset-dialog-title"]');
    expect(dialog.text()).toContain("基于「default」创建用户预设");
    await dialog.get("input").setValue("custom");
    await dialog.get(".app-button--primary").trigger("click");
    await flushPromises();

    expect(bridge.copyPreset).toHaveBeenCalledWith("default", "custom");
    expect(bridge.usePreset).toHaveBeenCalledWith("custom");
  });

  test("重命名使用模态弹窗并调用受控 IPC", async () => {
    const bridge = mockDesktopBridge();
    const wrapper = mount(PresetManager, {
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;
    await flushPromises();

    await wrapper.get('button[aria-label="重命名预设 academic"]').trigger("click");
    const dialog = wrapper.get('[role="dialog"][aria-labelledby="preset-dialog-title"]');
    expect(dialog.text()).toContain("重命名预设");

    await dialog.get("input").setValue("paper");
    await dialog.get(".app-button--primary").trigger("click");
    await flushPromises();

    expect(bridge.renamePreset).toHaveBeenCalledWith("academic", "paper");
    expect(wrapper.find("#preset-dialog-title").exists()).toBe(false);
  });

  test("删除失败时保留弹窗并显示具体错误", async () => {
    mockDesktopBridge({
      deletePreset: mock(() => Promise.reject(new Error("预设正在使用"))),
    });
    const wrapper = mount(PresetManager, {
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;
    await flushPromises();

    await wrapper.get('button[aria-label="删除预设 academic"]').trigger("click");
    await wrapper.get(".app-button--destructive").trigger("click");
    await flushPromises();

    expect(wrapper.get("#preset-dialog-title").text()).toContain("删除预设");
    expect(wrapper.get(".preset-dialog__error").text()).toBe("预设正在使用");
  });
});
