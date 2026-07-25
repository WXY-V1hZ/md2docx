import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { createApp, ref, type Ref } from "vue";
import { useConversionManager } from "../../frontend/composables/useConversionManager";
import type { FileEntry } from "../../frontend/file-entry";
import defaultConfig from "../../config/default/config.json" with { type: "json" };
import defaultStyleConfig from "../../config/default/style-config.json" with { type: "json" };

function workspace(preset: string) {
  return {
    schemaVersion: 1 as const,
    preset,
    config: structuredClone(defaultConfig) as PresetAppConfig,
    styleConfig: structuredClone(defaultStyleConfig) as PresetStyleConfig,
    collapsed: false,
  };
}

let onFileDoneCb: ((data: any) => void) | undefined;
let onFileErrorCb: ((data: any) => void) | undefined;

function createManager(historyVisible?: Ref<boolean>) {
  const hv = historyVisible ?? ref(false);
  let result: ReturnType<typeof useConversionManager>;
  createApp({
    setup() {
      result = useConversionManager(hv);
      return () => {};
    },
  }).mount(document.createElement("div"));
  return { ...result!, historyVisible: hv };
}

/** Reset `crypto.randomUUID` so it returns deterministic values. */
let uuidCounter = 0;
const origRandomUUID = crypto.randomUUID;

beforeEach(() => {
  uuidCounter = 0;
  crypto.randomUUID = () => `00000000-0000-0000-0000-${String(uuidCounter++).padStart(12, "0")}`;

  onFileDoneCb = undefined;
  onFileErrorCb = undefined;

  Object.defineProperty(window, "md2docx", {
    value: {
      convert: mock(() => Promise.resolve()),
      getHistory: mock(() => Promise.resolve([])),
      clearHistory: mock(() => Promise.resolve()),
      removeHistoryRecord: mock(() => Promise.resolve()),
      onFileDone: mock((cb: any) => {
        onFileDoneCb = cb;
        return () => {
          onFileDoneCb = undefined;
        };
      }),
      onFileError: mock((cb: any) => {
        onFileErrorCb = cb;
        return () => {
          onFileErrorCb = undefined;
        };
      }),
    },
    configurable: true,
  });
});

afterEach(() => {
  crypto.randomUUID = origRandomUUID;
  delete (window as any).md2docx;
});

// ---------------------------------------------------------------------------

describe("useConversionManager", () => {
  test("addFiles adds files and deduplicates by path", () => {
    const { queue, addFiles } = createManager();

    addFiles(["a.md", "b.md"]);
    expect(queue.value).toHaveLength(2);
    expect(queue.value[0]).toEqual({
      path: "a.md",
      name: "a.md",
      status: "idle",
    });
    expect(queue.value[1]).toEqual({
      path: "b.md",
      name: "b.md",
      status: "idle",
    });

    addFiles(["a.md"]);
    expect(queue.value).toHaveLength(2);
  });

  test("removeFile removes the queue item at the given index", () => {
    const { queue, addFiles, removeFile } = createManager();

    addFiles(["a.md", "b.md", "c.md"]);
    removeFile(1);
    expect(queue.value).toHaveLength(2);
    expect(queue.value[0]!.path).toBe("a.md");
    expect(queue.value[1]!.path).toBe("c.md");
  });

  test("retryFile resets status to idle and clears recordId and error", () => {
    const { queue, addFiles, retryFile } = createManager();

    addFiles(["a.md"]);
    const entry = queue.value[0]!;
    entry.status = "error" as FileEntry["status"];
    entry.recordId = "some-id";
    entry.error = "something went wrong";

    retryFile(0);
    expect(queue.value[0]!.status).toBe("idle");
    expect(queue.value[0]!.recordId).toBeUndefined();
    expect(queue.value[0]!.error).toBeUndefined();
  });

  test("startConversion marks idle files as converting and calls convert", async () => {
    const { queue, history, addFiles, startConversion } = createManager();

    addFiles(["a.md", "b.md"]);
    await startConversion(workspace("my-preset"), true);

    // queue items are now converting
    expect(queue.value[0]!.status).toBe("converting");
    expect(queue.value[1]!.status).toBe("converting");

    // each file has a unique recordId
    expect(queue.value[0]!.recordId).toBeDefined();
    expect(queue.value[1]!.recordId).toBeDefined();
    expect(queue.value[0]!.recordId).not.toBe(queue.value[1]!.recordId);

    // history has converting records
    expect(history.value).toHaveLength(2);
    expect(history.value[0]!.status).toBe("converting");
    expect(history.value[1]!.status).toBe("converting");

    // window.md2docx.convert was called with the correct payload
    expect(window.md2docx!.convert).toHaveBeenCalledTimes(1);
    const callArg = (window.md2docx!.convert as any).mock.calls[0][0];
    expect(callArg).toEqual({
      files: [
        { id: queue.value[0]!.recordId, path: "a.md" },
        { id: queue.value[1]!.recordId, path: "b.md" },
      ],
      preset: "my-preset",
      config: defaultConfig,
      styleConfig: defaultStyleConfig,
      openAfterConvert: true,
    });
  });

  test("onFileDone removes queue item and updates history", async () => {
    const { queue, history, addFiles, startConversion } = createManager();
    expect(onFileDoneCb).toBeDefined();

    addFiles(["a.md"]);
    await startConversion(workspace("preset"), false);

    const recordId = queue.value[0]!.recordId!;

    // simulate file-done callback
    onFileDoneCb!({
      recordId,
      path: "a.md",
      outputPath: "/out/a.docx",
    });

    // queue item is removed
    expect(queue.value).toHaveLength(0);

    // history record updated to success
    const record = history.value.find((r) => r.id === recordId);
    expect(record).toBeDefined();
    expect(record!.status).toBe("success");
    expect(record!.outputPath).toBe("/out/a.docx");

    // record moved to top of history
    expect(history.value[0]!.id).toBe(recordId);
  });

  test("onFileError marks queue as error and updates history", async () => {
    const { queue, history, addFiles, startConversion } = createManager();
    expect(onFileErrorCb).toBeDefined();

    addFiles(["a.md"]);
    await startConversion(workspace("preset"), false);

    const recordId = queue.value[0]!.recordId!;

    // simulate file-error callback
    onFileErrorCb!({
      recordId,
      path: "a.md",
      error: "Pandoc crashed",
    });

    // queue item is in error state
    expect(queue.value[0]!.status).toBe("error");
    expect(queue.value[0]!.error).toBe("Pandoc crashed");

    // history record updated
    const record = history.value.find((r) => r.id === recordId);
    expect(record).toBeDefined();
    expect(record!.status).toBe("error");
    expect(record!.error).toBe("Pandoc crashed");
  });

  test("history is truncated at 30 records", async () => {
    const { history, addFiles, startConversion } = createManager();
    const paths = Array.from({ length: 35 }, (_, i) => `${i}.md`);

    addFiles(paths);
    await startConversion(workspace("preset"), false);

    // startConversion already slices pending to 30 — verify
    expect(history.value.length).toBe(30);

    // simulate completion for each surviving record
    for (let i = 0; i < 30; i++) {
      const file = history.value.find((r) => r.sourcePath === `${i}.md`);
      if (!file) break;
      onFileDoneCb!({
        recordId: file.id,
        path: `${i}.md`,
        outputPath: `/out/${i}.docx`,
      });
    }

    // history should still be at 30 (no overflow from completions)
    expect(history.value.length).toBe(30);
  });

  test("markHistoryRead sets all unread to false", () => {
    const { history, markHistoryRead } = createManager();

    // push a few unread records directly
    history.value.push(
      {
        id: "1",
        sourcePath: "a.md",
        sourceName: "a.md",
        preset: "p",
        status: "success",
        startedAt: 1,
        completedAt: 2,
        unread: true,
      },
      {
        id: "2",
        sourcePath: "b.md",
        sourceName: "b.md",
        preset: "p",
        status: "error",
        startedAt: 1,
        completedAt: 2,
        unread: true,
      },
    );

    markHistoryRead();
    expect(history.value.every((r) => r.unread === false)).toBe(true);
  });

  test("requeueRecord 将历史源文件去重放回列表且不立即转换", () => {
    const { history, queue, requeueRecord } = createManager();
    history.value.push({
      id: "history-1",
      sourcePath: "report.md",
      sourceName: "report.md",
      preset: "academic",
      status: "success",
      startedAt: Date.now(),
      unread: false,
    });

    expect(requeueRecord("history-1")).toBe(true);
    expect(queue.value.map(({ path }) => path)).toEqual(["report.md"]);
    expect(requeueRecord("history-1")).toBe(true);
    expect(queue.value).toHaveLength(1);
    expect(window.md2docx!.convert).not.toHaveBeenCalled();
  });

  test("removeRecord calls window.md2docx.removeHistoryRecord and removes from history", async () => {
    const { history, removeRecord } = createManager();

    history.value.push(
      {
        id: "rec-1",
        sourcePath: "a.md",
        sourceName: "a.md",
        preset: "p",
        status: "success",
        startedAt: 1,
        completedAt: 2,
        unread: false,
      },
      {
        id: "rec-2",
        sourcePath: "b.md",
        sourceName: "b.md",
        preset: "p",
        status: "success",
        startedAt: 1,
        completedAt: 2,
        unread: false,
      },
    );

    await removeRecord("rec-1");
    expect(window.md2docx!.removeHistoryRecord).toHaveBeenCalledWith("rec-1");
    expect(history.value).toHaveLength(1);
    expect(history.value[0]!.id).toBe("rec-2");
  });

  test("clearHistory calls window.md2docx.clearHistory and keeps converting records", async () => {
    const { history, clearHistory } = createManager();

    history.value.push(
      {
        id: "1",
        sourcePath: "a.md",
        sourceName: "a.md",
        preset: "p",
        status: "converting",
        startedAt: 1,
        unread: false,
      },
      {
        id: "2",
        sourcePath: "b.md",
        sourceName: "b.md",
        preset: "p",
        status: "success",
        startedAt: 1,
        completedAt: 2,
        unread: false,
      },
      {
        id: "3",
        sourcePath: "c.md",
        sourceName: "c.md",
        preset: "p",
        status: "error",
        startedAt: 1,
        completedAt: 2,
        unread: false,
      },
    );

    await clearHistory();
    expect(window.md2docx!.clearHistory).toHaveBeenCalled();
    expect(history.value).toHaveLength(1);
    expect(history.value[0]!.id).toBe("1");
    expect(history.value[0]!.status).toBe("converting");
  });
});
