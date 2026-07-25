import { type ChildProcess, spawn } from "node:child_process";

const VITE_PORT = 5173;
const URL = `http://localhost:${VITE_PORT}`;

let electron: ChildProcess | undefined;
let stopping = false;

const vite = spawn(process.execPath, ["run", "dev:frontend"], {
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: "1" },
});

function stop(exitCode: number) {
  if (stopping) return;
  stopping = true;
  electron?.kill();
  vite.kill();
  process.exitCode = exitCode;
}

async function waitForVite() {
  for (let i = 0; i < 30; i++) {
    try {
      await fetch(URL);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Vite 开发服务器启动超时");
}

waitForVite()
  .then(() => {
    electron = spawn(process.execPath, ["run", "dev:electron"], {
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: URL,
        MD2DOCX_DEV_SESSION_ID: String(process.pid),
        FORCE_COLOR: "1",
      },
    });

    electron.on("error", (error) => {
      console.error(error.message);
      stop(1);
    });
    electron.on("close", (code) => {
      stop(code ?? 0);
    });
  })
  .catch((err) => {
    console.error(err.message);
    stop(1);
  });

process.on("SIGINT", () => {
  stop(0);
});
process.on("SIGTERM", () => stop(0));
