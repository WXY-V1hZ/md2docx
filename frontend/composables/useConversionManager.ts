import { computed, onBeforeUnmount, onMounted, ref, type Ref } from "vue";

import type { FileEntry } from "../file-entry";
import { cloneJson, type ConversionWorkspaceSettings } from "../conversion-settings";

export interface HistoryRecord extends ConversionRecord {
  unread: boolean;
}

export interface FlightAnimation {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const MAX_HISTORY_RECORDS = 30;
const FLIGHT_DURATION_MS = 480;

export function useConversionManager(historyVisible: Ref<boolean>) {
  const queue = ref<FileEntry[]>([]);
  const history = ref<HistoryRecord[]>([]);
  const flights = ref<FlightAnimation[]>([]);

  let cleanupDone: (() => void) | undefined;
  let cleanupError: (() => void) | undefined;
  const flightTimers = new Set<ReturnType<typeof setTimeout>>();

  const readyCount = computed(() => queue.value.filter(({ status }) => status === "idle").length);
  const isConverting = computed(() => queue.value.some(({ status }) => status === "converting"));
  const unreadCount = computed(() => history.value.filter(({ unread }) => unread).length);

  function addFiles(paths: string[]) {
    const existing = new Set(queue.value.map(({ path }) => path));
    for (const path of paths) {
      if (existing.has(path)) continue;
      queue.value.push({
        path,
        name: path.split(/[/\\]/).pop() ?? path,
        status: "idle",
      });
      existing.add(path);
    }
  }

  function removeFile(index: number) {
    queue.value.splice(index, 1);
  }

  function clearQueue() {
    if (isConverting.value) return;
    queue.value = [];
  }

  function retryFile(index: number) {
    const file = queue.value[index];
    if (!file) return;
    file.status = "idle";
    file.recordId = undefined;
    file.error = undefined;
  }

  async function startConversion(settings: ConversionWorkspaceSettings, openAfterConvert: boolean) {
    const idle = queue.value.filter(({ status }) => status === "idle");
    if (idle.length === 0) return;

    const files = idle.map((file) => {
      const id = crypto.randomUUID();
      file.status = "converting";
      file.recordId = id;
      file.error = undefined;
      return { id, path: file.path };
    });

    const startedAt = Date.now();
    const pendingRecords = idle.map<HistoryRecord>((file, index) => ({
      id: files[index]!.id,
      sourcePath: file.path,
      sourceName: file.name,
      preset: settings.preset,
      status: "converting",
      startedAt,
      unread: false,
    }));
    history.value = [...pendingRecords, ...history.value].slice(0, MAX_HISTORY_RECORDS);

    if (!window.md2docx?.convert) {
      failPendingFiles(files, "桌面转换服务不可用");
      return;
    }

    try {
      await window.md2docx.convert({
        files,
        preset: settings.preset,
        config: cloneJson(settings.config),
        styleConfig: cloneJson(settings.styleConfig),
        openAfterConvert,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("已取消")) {
        cancelPendingFiles(files);
      } else {
        failPendingFiles(files, message);
      }
    }
  }

  function requeueRecord(recordId: string): boolean {
    const record = history.value.find(({ id }) => id === recordId);
    if (!record || record.status === "converting" || record.status === "missing") return false;
    addFiles([record.sourcePath]);
    return true;
  }

  function markHistoryRead() {
    for (const record of history.value) record.unread = false;
  }

  async function removeRecord(recordId: string) {
    const record = history.value.find(({ id }) => id === recordId);
    if (!record || record.status === "converting") return;
    try {
      await window.md2docx?.removeHistoryRecord(recordId);
      history.value = history.value.filter(({ id }) => id !== recordId);
    } catch {
      // 保留记录，避免界面与磁盘状态不一致。
    }
  }

  async function clearHistory() {
    try {
      await window.md2docx?.clearHistory();
      history.value = history.value.filter(({ status }) => status === "converting");
    } catch {
      // 保留当前列表，允许用户稍后重试。
    }
  }

  async function loadHistory() {
    try {
      const records = await window.md2docx?.getHistory();
      const merged = new Map<string, HistoryRecord>(
        (records ?? []).map((record) => [record.id, { ...record, unread: false }]),
      );
      for (const record of history.value) merged.set(record.id, record);
      history.value = [...merged.values()]
        .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
        .slice(0, MAX_HISTORY_RECORDS);
    } catch {
      // 保留可能已经开始转换的本地记录。
    }
  }

  function failPendingFiles(files: { id: string; path: string }[], message: string) {
    const completedAt = Date.now();
    for (const { id, path } of files) {
      const file = queue.value.find(
        (entry) => entry.recordId === id && entry.path === path && entry.status === "converting",
      );
      if (file) {
        file.status = "error";
        file.error = message;
      }
      updateRecord(id, {
        status: "error",
        error: message,
        completedAt,
        unread: !historyVisible.value,
      });
    }
  }

  function cancelPendingFiles(files: { id: string; path: string }[]) {
    const ids = new Set(files.map(({ id }) => id));
    for (const file of queue.value) {
      if (!file.recordId || !ids.has(file.recordId)) continue;
      file.status = "idle";
      file.recordId = undefined;
      file.error = undefined;
    }
    history.value = history.value.filter(({ id }) => !ids.has(id));
  }

  function updateRecord(recordId: string, update: Partial<HistoryRecord>): boolean {
    const record = history.value.find(({ id }) => id === recordId);
    if (!record) return false;
    Object.assign(record, update);
    return true;
  }

  function moveRecordToTop(recordId: string) {
    const index = history.value.findIndex(({ id }) => id === recordId);
    if (index <= 0) return;
    const [record] = history.value.splice(index, 1);
    if (record) history.value.unshift(record);
  }

  function queueFlight(recordId: string) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const row = document.querySelector<HTMLElement>(`[data-record-id="${recordId}"]`);
    const target = document.querySelector<HTMLElement>("[data-history-btn]");
    if (!row || !target) return;

    const rowRect = row.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    flights.value.push({
      id: recordId,
      startX: rowRect.right - 34,
      startY: rowRect.top + rowRect.height / 2 - 14,
      endX: targetRect.left + targetRect.width / 2 - 14,
      endY: targetRect.top + targetRect.height / 2 - 14,
    });

    const timer = setTimeout(() => {
      flights.value = flights.value.filter(({ id }) => id !== recordId);
      flightTimers.delete(timer);
    }, FLIGHT_DURATION_MS);
    flightTimers.add(timer);
  }

  onMounted(() => {
    cleanupDone = window.md2docx?.onFileDone((data) => {
      const queueIndex = queue.value.findIndex(
        (file) => file.recordId === data.recordId && file.path === data.path,
      );
      const file = queueIndex === -1 ? undefined : queue.value[queueIndex];
      if (queueIndex !== -1) {
        queueFlight(data.recordId);
        queue.value.splice(queueIndex, 1);
      }

      const updated = updateRecord(data.recordId, {
        status: "success",
        outputPath: data.outputPath,
        completedAt: Date.now(),
        error: undefined,
        unread: !historyVisible.value,
      });
      if (!updated && file) {
        const completedAt = Date.now();
        history.value.unshift({
          id: data.recordId,
          sourcePath: file.path,
          sourceName: file.name,
          outputPath: data.outputPath,
          preset: "default",
          status: "success",
          startedAt: completedAt,
          completedAt,
          unread: !historyVisible.value,
        });
        history.value = history.value.slice(0, MAX_HISTORY_RECORDS);
      }
      moveRecordToTop(data.recordId);
    });

    cleanupError = window.md2docx?.onFileError((data) => {
      const file = queue.value.find(
        (entry) => entry.recordId === data.recordId && entry.path === data.path,
      );
      if (file) {
        file.status = "error";
        file.error = data.error;
      }

      updateRecord(data.recordId, {
        status: data.missing ? "missing" : "error",
        error: data.missing ? undefined : data.error,
        completedAt: Date.now(),
        unread: !historyVisible.value,
      });
      moveRecordToTop(data.recordId);
    });

    void loadHistory();
  });

  onBeforeUnmount(() => {
    cleanupDone?.();
    cleanupError?.();
    for (const timer of flightTimers) clearTimeout(timer);
  });

  return {
    queue,
    history,
    flights,
    readyCount,
    isConverting,
    unreadCount,
    addFiles,
    removeFile,
    clearQueue,
    retryFile,
    startConversion,
    requeueRecord,
    markHistoryRead,
    removeRecord,
    clearHistory,
  };
}
