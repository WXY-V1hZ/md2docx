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

  test("转换完成后保留可操作提示并支持减少动态效果", async () => {
    const [app, notice, styles] = await Promise.all([
      readFile(new URL("../frontend/App.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/components/CompletionBanner.vue", import.meta.url), "utf8"),
      readFile(new URL("../frontend/styles/base.css", import.meta.url), "utf8"),
    ]);

    expect(app).toContain("<CompletionBanner");
    expect(notice).toContain('aria-label="关闭完成提示"');
    expect(notice).toContain('emit("reveal", props.lastOutputPath)');
    expect(notice).toContain("watch(");
    expect(notice).toContain("clearTimeout");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
