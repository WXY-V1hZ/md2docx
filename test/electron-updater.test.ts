import { describe, expect, mock, test } from "bun:test";

import { createUpdateManager, type UpdateClient, type UpdateSnapshot } from "../electron/updater";

function createHarness() {
  const listeners: {
    available?: (version: string) => void;
    notAvailable?: () => void;
    progress?: (percent: number, bytesPerSecond: number) => void;
    downloaded?: (version?: string) => void;
    error?: (error: Error) => void;
  } = {};
  const client: UpdateClient = {
    configure: mock(() => {}),
    check: mock(async () => listeners.notAvailable?.()),
    download: mock(async () => listeners.downloaded?.()),
    install: mock(() => {}),
    onAvailable: (listener) => {
      listeners.available = listener;
    },
    onNotAvailable: (listener) => {
      listeners.notAvailable = listener;
    },
    onProgress: (listener) => {
      listeners.progress = listener;
    },
    onDownloaded: (listener) => {
      listeners.downloaded = listener;
    },
    onError: (listener) => {
      listeners.error = listener;
    },
  };
  const published: UpdateSnapshot[] = [];
  const manager = createUpdateManager(
    client,
    () => true,
    (snapshot) => published.push(snapshot),
  );
  manager.setup();
  return { client, listeners, manager, published };
}

describe("Electron 自动更新管理", () => {
  test("无更新时不会误报为可用", async () => {
    const { manager } = createHarness();

    const result = await manager.check();

    expect(result).toMatchObject({ state: "idle" });
  });

  test("按可用、下载、完成顺序推进并限制进度范围", async () => {
    const { client, listeners, manager, published } = createHarness();
    client.check = mock(async () => listeners.available?.("2.7.0"));
    client.download = mock(async () => {
      listeners.progress?.(124, -10);
      listeners.downloaded?.("2.7.0");
    });

    expect(await manager.check()).toMatchObject({ state: "available", version: "2.7.0" });
    await manager.check();
    expect(client.check).toHaveBeenCalledTimes(1);
    await manager.download();
    expect(manager.getSnapshot()).toMatchObject({
      state: "downloaded",
      version: "2.7.0",
      progress: 100,
    });
    expect(published).toContainEqual(
      expect.objectContaining({
        state: "downloading",
        version: "2.7.0",
        progress: 100,
        bytesPerSecond: 0,
      }),
    );

    manager.install();
    expect(client.install).toHaveBeenCalledTimes(1);
  });

  test("静默检查失败不打扰用户，手动检查失败可重试", async () => {
    const { client, manager, published } = createHarness();
    client.check = mock(async () => {
      throw new Error("net::ERR_CONNECTION_REFUSED");
    });

    expect(await manager.check(true)).toMatchObject({ state: "idle" });
    expect(published.some(({ state }) => state === "error")).toBe(false);

    expect(await manager.check()).toMatchObject({
      state: "error",
      message: "无法连接更新服务器，请检查网络后重试。",
      retry: "check",
    });
  });

  test("未下载完成时拒绝安装和越过状态直接下载", async () => {
    const { manager } = createHarness();

    expect(manager.download()).rejects.toThrow("没有可下载的更新");
    expect(() => manager.install()).toThrow("更新尚未下载完成");
  });
});
