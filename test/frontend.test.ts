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
    expect(component).not.toContain("PanelRight");
    expect(component).toContain("'app-titlebar__btn--active': settingsExpanded");
  });

  test("转换侧边栏常驻并由主界面固定按钮控制", async () => {
    const app = await readFile(new URL("../frontend/App.vue", import.meta.url), "utf8");

    expect(app).toContain('v-model:collapsed="inspectorCollapsed"');
    expect(app).toContain('class="workspace-inspector-toggle"');
    expect(app).toContain("PanelRight");
    expect(app).toContain("Ctrl+Alt+B");
    expect(app).toContain("border: none");
    expect(app).toContain("position: absolute");
    expect(app).toContain("right: 12px");
    expect(app).not.toContain('v-if="queue.length > 0"');
  });

  test("主界面可切换 Markdown 编辑器且编辑按钮随文件区移动", async () => {
    const [app, editor, preload, main] = await Promise.all([
      readFile(new URL("../frontend/App.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/components/MarkdownEditor.vue", import.meta.url), "utf8"),
      readFile(new URL("../electron/preload.ts", import.meta.url), "utf8"),
      readFile(new URL("../electron/main.ts", import.meta.url), "utf8"),
    ]);

    expect(app).toContain("MarkdownEditor");
    expect(app).toContain('class="workspace-editor-toggle"');
    expect(app).toContain("right: 44px");
    expect(app).toContain("startEditorConversion");
    expect(app).not.toContain('{{ editorMode ? "文件" : "编辑" }}');
    expect(editor).toContain('aria-label="Markdown 内容"');
    expect(editor).toContain("SFMono-Regular");
    expect(editor).toContain("font-size: 15px");
    expect(editor).not.toContain("文本仅保留在当前窗口");
    expect(app).toMatch(
      /function handleRequeue[\s\S]*?editorMode\.value = false;[\s\S]*?closeHistory\(\);/,
    );
    expect(preload).toContain('"editor:create-source"');
    expect(main).toContain("createEditorSource");
    expect(main).toContain("showSaveDialog");
  });

  test("开发会话使用隔离的 Chromium 缓存目录", async () => {
    const [script, main] = await Promise.all([
      readFile(new URL("../scripts/dev.ts", import.meta.url), "utf8"),
      readFile(new URL("../electron/main.ts", import.meta.url), "utf8"),
    ]);

    expect(script).toContain("MD2DOCX_DEV_SESSION_ID");
    expect(script).toContain("process.execPath");
    expect(main).toContain('app.setPath("sessionData"');
    expect(main).toContain('app.getPath("temp")');
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
    expect(item).toContain("requeue");
    expect(flight).toContain("--flight-x");
    expect(preload).toContain('"history:remove"');
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("设置面板通过受控 IPC 管理 Pandoc、输出和预设", async () => {
    const [settings, presets, editor, form, inspector, preload] = await Promise.all([
      readFile(new URL("../frontend/components/SettingsPanel.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/components/PresetManager.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/components/PresetEditor.vue", import.meta.url), "utf8"),
      readFile(
        new URL("../frontend/components/ConversionSettingsForm.vue", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../frontend/components/ConversionInspector.vue", import.meta.url), "utf8"),
      readFile(new URL("../electron/preload.ts", import.meta.url), "utf8"),
    ]);

    expect(settings).toContain("detectPandoc");
    expect(settings).toContain("selectOutputFolder");
    expect(settings).toContain("PresetManager");
    expect(presets).toContain("usePreset");
    expect(presets).toContain("renamePreset");
    expect(editor).toContain("updatePreset");
    expect(editor).toContain("ConversionSettingsForm");
    expect(form).toContain("标题细节");
    expect(form).toContain("AppSelect");
    expect(inspector).toContain("ConversionSettingsForm");
    expect(inspector).toContain("saveConversionSettings");
    expect(inspector).toContain("prefers-reduced-motion");
    expect(editor).not.toContain("<select");
    expect(form).not.toContain("<select");
    expect(settings).toContain('aria-modal="true"');
    expect(settings).toContain('id="settings-dialog"');
    expect(settings).toContain("justify-content: center");
    expect(settings).toContain("width: min(640px");
    expect(settings).toContain("border-radius: 16px");
    expect(settings).not.toContain("transform: translateX(100%)");
    expect(settings).toContain("animation: panel-in 0.32s cubic-bezier(0.22, 1, 0.36, 1)");
    expect(settings).toContain("@keyframes panel-in");
    expect(settings).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;/);
    expect(settings).toContain("放弃更改");
    expect(settings).not.toContain("<select");
    expect(preload).toContain('"settings:save"');
    expect(preload).toContain('"shell:openExternal"');
    expect(preload).toContain('"preset:read"');
    expect(preload).toContain('"preset:update"');
    expect(preload).toContain('"conversion-settings:save"');
  });

  test("自动更新使用可恢复状态、安装版发布和可清理监听", async () => {
    const [app, banner, updater, main, preload, builderConfig] = await Promise.all([
      readFile(new URL("../frontend/App.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/components/UpdateBanner.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/composables/useAutoUpdate.ts", import.meta.url), "utf8"),
      readFile(new URL("../electron/main.ts", import.meta.url), "utf8"),
      readFile(new URL("../electron/preload.ts", import.meta.url), "utf8"),
      readFile(new URL("../electron-builder.yml", import.meta.url), "utf8"),
    ]);

    expect(packageJson.dependencies).toHaveProperty("electron-updater");
    expect(packageJson.scripts.pack).toContain("--win nsis");
    expect(builderConfig).toContain("- nsis");
    expect(app).toContain('class="flex min-h-0 flex-col"');
    expect(banner).toContain('role="progressbar"');
    expect(banner).toContain("@media (prefers-reduced-motion: reduce)");
    expect(updater).toContain("removeStateListener?.()");
    expect(main).toContain('"did-finish-load"');
    expect(main).toContain('"update:state"');
    expect(preload).toContain('"update:state-changed"');
    expect(preload).not.toContain('"update:available"');
  });
});
