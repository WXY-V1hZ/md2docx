import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const IDLE_UPDATE: UpdateSnapshot = { state: "idle" };

export function useAutoUpdate(options: { preview?: boolean } = {}) {
  const update = ref<UpdateSnapshot>({ ...IDLE_UPDATE });
  const dismissed = ref(false);
  let removeStateListener: (() => void) | undefined;
  let previewTimer: ReturnType<typeof setInterval> | undefined;

  const visible = computed(
    () =>
      !dismissed.value &&
      ["available", "downloading", "downloaded", "error"].includes(update.value.state),
  );

  function applySnapshot(next: UpdateSnapshot) {
    if ((next.revision ?? 0) < (update.value.revision ?? 0)) return;
    const isNewNotice =
      next.version !== update.value.version ||
      (next.state !== update.value.state && next.state !== "downloading");
    update.value = normalizeSnapshot(next);
    if (isNewNotice) dismissed.value = false;
  }

  async function download() {
    dismissed.value = false;
    if (update.value.preview) {
      startPreviewDownload();
      return;
    }
    update.value = {
      ...update.value,
      state: "downloading",
      progress: update.value.progress ?? 0,
      bytesPerSecond: 0,
    };
    try {
      await window.md2docx?.downloadUpdate();
    } catch {
      if (update.value.state === "downloading") {
        update.value = {
          ...update.value,
          state: "error",
          message: "更新未完成，请稍后重试。",
          retry: "download",
        };
      }
    }
  }

  async function retry() {
    if (update.value.preview) {
      showPreview();
      return;
    }
    if (update.value.retry === "download") {
      await download();
      return;
    }
    try {
      const next = await window.md2docx?.checkUpdate();
      if (next) applySnapshot(next);
    } catch {
      update.value = {
        state: "error",
        message: "无法连接更新服务器，请检查网络后重试。",
        retry: "check",
      };
    }
  }

  async function install() {
    if (update.value.preview) {
      clearPreviewTimer();
      dismissed.value = true;
      update.value = { state: "idle", preview: true };
      return;
    }
    try {
      await window.md2docx?.installUpdate();
    } catch {
      update.value = {
        ...update.value,
        state: "error",
        message: "无法启动安装程序，请重新下载更新。",
        retry: "download",
      };
    }
  }

  function dismiss() {
    dismissed.value = true;
  }

  function showPreview() {
    clearPreviewTimer();
    dismissed.value = false;
    update.value = {
      state: "available",
      preview: true,
      supported: false,
      version: "3.0.0",
    };
  }

  function startPreviewDownload() {
    clearPreviewTimer();
    let progress = 0;
    update.value = {
      ...update.value,
      state: "downloading",
      progress,
      bytesPerSecond: 2_400_000,
    };
    previewTimer = setInterval(() => {
      progress = Math.min(100, progress + 8);
      update.value = {
        ...update.value,
        state: progress === 100 ? "downloaded" : "downloading",
        progress,
        bytesPerSecond: progress === 100 ? 0 : 2_400_000,
      };
      if (progress === 100) clearPreviewTimer();
    }, 180);
  }

  function clearPreviewTimer() {
    if (previewTimer === undefined) return;
    clearInterval(previewTimer);
    previewTimer = undefined;
  }

  onMounted(() => {
    if (options.preview) {
      showPreview();
      return;
    }
    const bridge = window.md2docx;
    if (!bridge) return;
    removeStateListener = bridge.onUpdateState(applySnapshot);
    void bridge
      .getUpdateState()
      .then(applySnapshot)
      .catch(() => {});
  });

  onBeforeUnmount(() => {
    removeStateListener?.();
    clearPreviewTimer();
  });

  return { update, visible, download, retry, install, dismiss, showPreview };
}

function normalizeSnapshot(snapshot: UpdateSnapshot): UpdateSnapshot {
  if (snapshot.state !== "downloading") return { ...snapshot };
  const progress = Number.isFinite(snapshot.progress) ? (snapshot.progress ?? 0) : 0;
  const bytesPerSecond = Number.isFinite(snapshot.bytesPerSecond)
    ? (snapshot.bytesPerSecond ?? 0)
    : 0;
  return {
    ...snapshot,
    progress: Math.min(100, Math.max(0, progress)),
    bytesPerSecond: Math.max(0, bytesPerSecond),
  };
}
