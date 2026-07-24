import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import packageJson from "../package.json" with { type: "json" };

import frontendConfig from "../frontend/vite.config";

describe("Electron 前端构建", () => {
  test("使用相对资源路径以支持 file URL", () => {
    expect(frontendConfig.base).toBe("./");
  });

  test("标题栏组件加载专用样式", async () => {
    const component = await readFile(
      new URL("../frontend/components/AppTitleBar.vue", import.meta.url),
      "utf8",
    );

    expect(component).toContain('<style scoped src="../styles/titlebar.css"></style>');
  });

  test("Electron 加载构建后的主进程与 sandbox preload", () => {
    expect(packageJson.main).toBe("dist-electron/main.js");
    expect(packageJson.scripts["build:electron"]).toContain("dist-electron/preload.cjs");
  });

  test("转换记录面板展示历史并支持减少动态效果", async () => {
    const [app, manager, popover, item, flight, preload, styles] = await Promise.all([
      readFile(new URL("../frontend/App.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/composables/useConversionManager.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../frontend/components/ConversionHistoryPopover.vue", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../frontend/components/ConversionHistoryItem.vue", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../frontend/components/ConversionFlight.vue", import.meta.url), "utf8"),
      readFile(new URL("../electron/preload.ts", import.meta.url), "utf8"),
      readFile(new URL("../frontend/styles/base.css", import.meta.url), "utf8"),
    ]);

    expect(app).toContain("ConversionHistoryPopover");
    expect(app).not.toContain("@history-enter");
    expect(manager).toContain("removeHistoryRecord");
    expect(manager).toContain("crypto.randomUUID()");
    expect(popover).toContain("转换记录");
    expect(popover).toContain("show-in-folder");
    expect(item).toContain("regenerate");
    expect(flight).toContain("--flight-x");
    expect(preload).toContain('"history:remove"');
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("设置面板通过受控 IPC 管理 Pandoc、输出和预设", async () => {
    const [settings, presets, preload] = await Promise.all([
      readFile(new URL("../frontend/components/SettingsPanel.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/components/PresetManager.vue", import.meta.url), "utf8"),
      readFile(new URL("../electron/preload.ts", import.meta.url), "utf8"),
    ]);

    expect(settings).toContain("detectPandoc");
    expect(settings).toContain("selectOutputFolder");
    expect(settings).toContain("PresetManager");
    expect(presets).toContain("usePreset");
    expect(presets).toContain("renamePreset");
    expect(settings).toContain('aria-modal="true"');
    expect(preload).toContain('"settings:save"');
    expect(preload).toContain('"shell:openExternal"');
  });
});
