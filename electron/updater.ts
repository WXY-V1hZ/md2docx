export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateSnapshot {
  state: UpdateState;
  revision?: number;
  supported?: boolean;
  version?: string;
  progress?: number;
  bytesPerSecond?: number;
  message?: string;
  retry?: "check" | "download";
}

export interface UpdateClient {
  configure(): void;
  check(): Promise<void>;
  download(): Promise<void>;
  install(): void;
  onAvailable(listener: (version: string) => void): void;
  onNotAvailable(listener: () => void): void;
  onProgress(listener: (percent: number, bytesPerSecond: number) => void): void;
  onDownloaded(listener: (version?: string) => void): void;
  onError(listener: (error: Error) => void): void;
}

export interface UpdateManager {
  setup(): void;
  getSnapshot(): UpdateSnapshot;
  check(silent?: boolean): Promise<UpdateSnapshot>;
  download(): Promise<void>;
  install(): void;
}

export function createUpdateManager(
  client: UpdateClient,
  supported: () => boolean,
  publish: (snapshot: UpdateSnapshot) => void,
  reportError: (error: Error) => void = () => {},
): UpdateManager {
  let snapshot: UpdateSnapshot = { state: "idle", revision: 0 };
  let operation: "auto-check" | "manual-check" | "download" | null = null;
  let setupComplete = false;
  let checkPromise: Promise<UpdateSnapshot> | null = null;
  let availableVersion = "";

  function setSnapshot(next: UpdateSnapshot, notify = true) {
    snapshot = { ...next, revision: (snapshot.revision ?? 0) + 1 };
    if (notify) publish({ ...snapshot });
  }

  function setup() {
    if (setupComplete) return;
    setupComplete = true;
    client.configure();

    client.onAvailable((version) => {
      availableVersion = version;
      setSnapshot({ state: "available", version });
    });
    client.onNotAvailable(() => {
      availableVersion = "";
      setSnapshot({ state: "idle" });
    });
    client.onProgress((percent, bytesPerSecond) => {
      setSnapshot({
        state: "downloading",
        ...(availableVersion ? { version: availableVersion } : {}),
        progress: clampProgress(percent),
        bytesPerSecond: Math.max(0, finiteOrZero(bytesPerSecond)),
      });
    });
    client.onDownloaded((version) => {
      availableVersion = version || availableVersion;
      setSnapshot({
        state: "downloaded",
        ...(availableVersion ? { version: availableVersion } : {}),
        progress: 100,
      });
    });
    client.onError((error) => {
      reportError(error);
      if (operation === "auto-check") {
        setSnapshot({ state: "idle" }, false);
        return;
      }
      setSnapshot({
        state: "error",
        ...(availableVersion ? { version: availableVersion } : {}),
        message: friendlyUpdateError(error),
        retry: operation === "download" ? "download" : "check",
      });
    });
  }

  function getSnapshot(): UpdateSnapshot {
    return { ...snapshot, supported: supported() };
  }

  async function check(silent = false): Promise<UpdateSnapshot> {
    if (!supported()) return getSnapshot();
    if (["available", "downloading", "downloaded"].includes(snapshot.state)) {
      return getSnapshot();
    }
    if (checkPromise) return checkPromise;

    checkPromise = (async () => {
      operation = silent ? "auto-check" : "manual-check";
      setSnapshot({ state: "checking" }, !silent);
      try {
        await client.check();
        if (snapshot.state === "checking") setSnapshot({ state: "idle" }, !silent);
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        reportError(normalized);
        if (snapshot.state !== "error") {
          if (silent) setSnapshot({ state: "idle" }, false);
          else {
            setSnapshot({
              state: "error",
              message: friendlyUpdateError(normalized),
              retry: "check",
            });
          }
        }
      } finally {
        operation = null;
        checkPromise = null;
      }
      return getSnapshot();
    })();
    return checkPromise;
  }

  async function download(): Promise<void> {
    if (!supported()) throw new Error("当前环境不支持自动更新");
    const canDownload =
      snapshot.state === "available" ||
      (snapshot.state === "error" && snapshot.retry === "download");
    if (!canDownload || !availableVersion) throw new Error("没有可下载的更新");

    operation = "download";
    setSnapshot({
      state: "downloading",
      version: availableVersion,
      progress: snapshot.progress ?? 0,
      bytesPerSecond: 0,
    });
    try {
      await client.download();
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      reportError(normalized);
      if (snapshot.state !== "error") {
        setSnapshot({
          state: "error",
          version: availableVersion,
          message: friendlyUpdateError(normalized),
          retry: "download",
        });
      }
      throw normalized;
    } finally {
      operation = null;
    }
  }

  function install() {
    if (!supported() || snapshot.state !== "downloaded") {
      throw new Error("更新尚未下载完成");
    }
    client.install();
  }

  return { setup, getSnapshot, check, download, install };
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, finiteOrZero(value)));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function friendlyUpdateError(error: Error): string {
  const message = error.message.toLowerCase();
  if (
    message.includes("net::") ||
    message.includes("network") ||
    message.includes("enotfound") ||
    message.includes("econn")
  ) {
    return "无法连接更新服务器，请检查网络后重试。";
  }
  return "更新未完成，请稍后重试。";
}
