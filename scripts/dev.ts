import { spawn, type ChildProcess } from "node:child_process";
import { watch } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const VITE_PORT = 5173;
const URL = `http://localhost:${VITE_PORT}`;

let viteProcess: ChildProcess | undefined;
let electronProcess: ChildProcess | undefined;
let buildTimeout: ReturnType<typeof setTimeout> | undefined;

function startVite(): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    viteProcess = spawn("bun", ["run", "dev:frontend"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, FORCE_COLOR: "1" },
    });
    viteProcess.on("error", reject);
    // Vite 会在就绪后打印 local URL，轮询等待即可
    pollVite(0).then(resolvePromise).catch(reject);
  });
}

async function pollVite(attempt: number): Promise<void> {
  if (attempt > 30) throw new Error("Vite 开发服务器启动超时");
  try {
    await fetch(URL);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    return pollVite(attempt + 1);
  }
}

function buildElectron(): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const build = spawn("bun", ["run", "build:electron"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, FORCE_COLOR: "1" },
    });
    build.on("error", reject);
    build.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`build:electron 退出码 ${code}`));
    });
  });
}

function startElectron() {
  if (electronProcess) {
    electronProcess.removeAllListeners();
    electronProcess.kill();
    electronProcess = undefined;
  }

  electronProcess = spawn("electron", ["."], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, VITE_DEV_SERVER_URL: URL, FORCE_COLOR: "1" },
  });

  electronProcess.on("close", () => {
    electronProcess = undefined;
    // 如果是用户手动关了 Electron（非热重载导致的 kill），不退出 Vite
    // 保持 Vite 运行等待下次启动
  });
}

function onElectronFileChange(event: string, file: string | null) {
  if (!file?.endsWith(".ts") && !file?.endsWith(".cjs")) return;
  // 忽略 preload.ts 源码（由 build:electron 编译 preload.ts → preload.cjs）
  if (file.endsWith("preload.ts")) return;
  // preload.cjs 编译产物由 build:electron 重新生成，不通过 watch 触发
  if (file.endsWith(".cjs")) return;

  clearTimeout(buildTimeout);
  buildTimeout = setTimeout(async () => {
    console.log(`\n检测到文件变化：${file}，重新构建 Electron...`);
    try {
      await buildElectron();
      startElectron();
      console.log("Electron 已重启\n");
    } catch (err) {
      console.error("Electron 构建失败：", err instanceof Error ? err.message : String(err));
    }
  }, 300);
}

async function main() {
  console.log("启动 Vite 开发服务器...");
  await startVite();
  console.log("Vite 已就绪，启动 Electron...");

  // 首次构建并启动 Electron
  try {
    await buildElectron();
    startElectron();
  } catch (err) {
    console.error("首次 Electron 构建失败：", err instanceof Error ? err.message : String(err));
    cleanup();
    process.exit(1);
  }

  // 监听 Electron 源文件变化
  const electronDir = resolve(ROOT, "electron");
  watch(electronDir, { recursive: true }, onElectronFileChange);
  console.log("监听 electron/**/*.ts 文件变化...");
}

function cleanup() {
  if (electronProcess) {
    electronProcess.removeAllListeners();
    electronProcess.kill();
    electronProcess = undefined;
  }
  if (viteProcess) {
    viteProcess.kill();
    viteProcess = undefined;
  }
}

process.on("SIGINT", () => {
  console.log("\n正在退出...");
  cleanup();
  process.exit();
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit();
});

main().catch((err) => {
  console.error(err.message);
  cleanup();
  process.exit(1);
});
