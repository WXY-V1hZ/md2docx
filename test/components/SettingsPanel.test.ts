import { afterEach, describe, expect, mock, test } from "bun:test";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

import PresetManager from "../../frontend/components/PresetManager.vue";
import PresetEditor from "../../frontend/components/PresetEditor.vue";
import SettingsPanel from "../../frontend/components/SettingsPanel.vue";

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
    readPreset: mock(() => Promise.resolve(editablePreset("academic"))),
    updatePreset: mock((_input: { config: PresetAppConfig }) =>
      Promise.resolve(editablePreset("academic")),
    ),
    ...overrides,
  };
  Object.defineProperty(window, "md2docx", {
    configurable: true,
    value: bridge,
  });
  return bridge;
}

describe("SettingsPanel 预设管理", () => {
  test("只有 default 时新建会进入可视化自定义编辑", async () => {
    mockDesktopBridge({
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
    expect(wrapper.emitted("edit")).toEqual([["default", "copy"]]);
  });

  test("重命名使用模态弹窗并调用受控 IPC", async () => {
    const bridge = mockDesktopBridge();
    const wrapper = mount(PresetManager, {
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;
    await flushPromises();

    await wrapper.get('button[aria-label="更多 academic"]').trigger("click");
    await wrapper.get(".preset-more__menu button:nth-child(2)").trigger("click");
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

    await wrapper.get('button[aria-label="更多 academic"]').trigger("click");
    await wrapper.get(".preset-more__menu button:nth-child(3)").trigger("click");
    await wrapper.get(".app-button--destructive").trigger("click");
    await flushPromises();

    expect(wrapper.get("#preset-dialog-title").text()).toContain("删除预设");
    expect(wrapper.get(".preset-dialog__error").text()).toBe("预设正在使用");
  });

  test("用户预设可编辑实际配置并保存", async () => {
    const bridge = mockDesktopBridge();
    const wrapper = mount(PresetEditor, {
      props: { sourceName: "academic", mode: "edit" },
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;
    await flushPromises();

    const toggles = wrapper.findAll<HTMLInputElement>(".app-switch");
    await toggles[0]!.setValue(false);
    expect(wrapper.get(".preset-editor__footer .app-button--primary").attributes("disabled")).toBe(
      undefined,
    );
    await wrapper.get(".preset-editor__footer .app-button--primary").trigger("click");
    await flushPromises();

    expect(bridge.updatePreset).toHaveBeenCalledTimes(1);
    const input = bridge.updatePreset.mock.calls[0]![0] as { config: PresetAppConfig };
    expect(input.config.detectTitle.enabled).toBe(false);
    expect(wrapper.emitted("saved")?.[0]).toEqual(["academic"]);
  });

  test("自定义 default 保存为新预设并自动切换", async () => {
    const bridge = mockDesktopBridge({
      readPreset: mock(() => Promise.resolve(editablePreset("default", "builtin"))),
      updatePreset: mock((input: { targetName?: string }) =>
        Promise.resolve(editablePreset(input.targetName ?? "custom")),
      ),
    });
    const wrapper = mount(PresetEditor, {
      props: { sourceName: "default", mode: "copy" },
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;
    await flushPromises();

    await wrapper.findAll<HTMLInputElement>(".app-switch")[0]!.setValue(false);
    expect(wrapper.get(".preset-editor__footer .app-button--primary").attributes("disabled")).toBe(
      undefined,
    );
    await wrapper.get(".preset-editor__footer .app-button--primary").trigger("click");
    await wrapper.get(".editor-dialog input").setValue("custom");
    await wrapper.get(".editor-dialog .app-button--primary").trigger("click");
    await flushPromises();

    expect(bridge.usePreset).toHaveBeenCalledWith("custom");
    expect(wrapper.emitted("saved")?.[0]).toEqual(["custom"]);
  });

  test("关闭有未保存修改的编辑器前要求确认", async () => {
    mockDesktopBridge();
    const wrapper = mount(SettingsPanel, {
      global: { stubs: { Teleport: true } },
    });
    activeWrapper = wrapper;
    await flushPromises();

    await wrapper.findAll(".preset-edit-button").at(-1)!.trigger("click");
    await flushPromises();
    await wrapper.findAll<HTMLInputElement>(".app-switch")[0]!.setValue(false);
    await wrapper.get('button[aria-label="关闭设置"]').trigger("click");

    expect(wrapper.get('[role="alertdialog"]').text()).toContain("放弃更改");
    expect(wrapper.emitted("close")).toBeUndefined();
  });
});

function editablePreset(name: string, source: "builtin" | "user" = "user"): EditablePreset {
  return {
    name,
    source,
    config: {
      figureCaption: { enabled: true, format: "图 {n}", separator: " " },
      tableCaption: { enabled: true, format: "表 {n}", separator: " " },
      normalizeHeadings: { enabled: true },
      numberHeadings: { enabled: true, detectExisting: true, useBuiltinRules: true },
      renderMermaid: { enabled: true, theme: "zinc-light", density: 144 },
      imageSize: { enabled: true, maxWidthCm: 15, maxHeightCm: 20 },
      detectTitle: { enabled: true, strategy: "first-h1" },
      removeThematicBreaks: { enabled: true },
    },
    styleConfig: {
      schemaVersion: 1,
      options: {
        body: { firstLineIndent: true, lineSpacing: 1.5 },
        headings: {
          "1": { startOnNewPage: true, alignment: "left", bold: true },
          "2": { bold: true },
          "3": { bold: true },
          "4": { bold: true, italic: false },
          "5": { bold: true, italic: false },
          "6": { bold: true, italic: false },
        },
        inlineCode: { background: true },
        codeBlock: { border: true },
      },
    },
  };
}
