import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

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
});
