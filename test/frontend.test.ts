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
});
