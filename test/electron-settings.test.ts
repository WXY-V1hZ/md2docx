import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  availableOutputPath,
  loadDesktopSettings,
  pathKey,
  saveDesktopSettings,
} from "../electron/settings";
import { readCurrentPresetName, usePreset } from "../src/preset";

const tempDirs: string[] = [];

function createStorage() {
  const root = mkdtempSync(join(tmpdir(), "md2docx-desktop-settings-"));
  tempDirs.push(root);
  return {
    root,
    settingsPath: join(root, "settings.json"),
    presetsDir: join(root, "presets"),
  };
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Electron 桌面设置", () => {
  test("读取旧版扁平设置并在保存时迁移", () => {
    const storage = createStorage();
    const legacy = {
      outputMode: "folder" as const,
      outputFolder: storage.root,
      conflictAction: "rename" as const,
    };
    writeFileSync(storage.settingsPath, JSON.stringify(legacy), "utf-8");

    expect(loadDesktopSettings(storage.settingsPath)).toEqual(legacy);
    saveDesktopSettings(legacy, storage.settingsPath);
    expect(JSON.parse(readFileSync(storage.settingsPath, "utf-8"))).toEqual({
      schemaVersion: 1,
      preset: "default",
      desktop: legacy,
    });
  });

  test("保存输出设置时保留 CLI 当前预设", () => {
    const storage = createStorage();
    writeFileSync(
      storage.settingsPath,
      JSON.stringify({ schemaVersion: 1, preset: "academic" }),
      "utf-8",
    );

    saveDesktopSettings(
      {
        outputMode: "folder",
        outputFolder: storage.root,
        conflictAction: "rename",
      },
      storage.settingsPath,
    );

    expect(
      readCurrentPresetName({
        settingsPath: storage.settingsPath,
        presetsDir: storage.presetsDir,
      }),
    ).toBe("academic");
    expect(loadDesktopSettings(storage.settingsPath)).toEqual({
      outputMode: "folder",
      outputFolder: storage.root,
      conflictAction: "rename",
    });
  });

  test("切换预设时保留桌面输出设置", async () => {
    const storage = createStorage();
    mkdirSync(join(storage.presetsDir, "academic"), { recursive: true });
    saveDesktopSettings(
      {
        outputMode: "ask",
        outputFolder: "",
        conflictAction: "ask",
      },
      storage.settingsPath,
    );

    await usePreset("academic", {
      settingsPath: storage.settingsPath,
      presetsDir: storage.presetsDir,
    });

    expect(loadDesktopSettings(storage.settingsPath)).toEqual({
      outputMode: "ask",
      outputFolder: "",
      conflictAction: "ask",
    });
  });

  test("拒绝未知设置字段", () => {
    const storage = createStorage();
    expect(() =>
      saveDesktopSettings(
        {
          outputMode: "source",
          outputFolder: "",
          conflictAction: "overwrite",
          unexpected: true,
        },
        storage.settingsPath,
      ),
    ).toThrow("未知字段");
  });

  test("自动重命名同时避开磁盘文件和同批次保留路径", () => {
    const storage = createStorage();
    const output = join(storage.root, "report.docx");
    const firstRenamed = join(storage.root, "report (1).docx");
    writeFileSync(output, "existing", "utf-8");

    expect(availableOutputPath(output, new Set([pathKey(firstRenamed)]))).toBe(
      join(storage.root, "report (2).docx"),
    );
  });

  test("设置文件保持可读的完整文档结构", () => {
    const storage = createStorage();
    saveDesktopSettings(
      {
        outputMode: "source",
        outputFolder: "",
        conflictAction: "overwrite",
      },
      storage.settingsPath,
    );

    expect(JSON.parse(readFileSync(storage.settingsPath, "utf-8"))).toEqual({
      schemaVersion: 1,
      preset: "default",
      desktop: {
        outputMode: "source",
        outputFolder: "",
        conflictAction: "overwrite",
      },
    });
  });
});
