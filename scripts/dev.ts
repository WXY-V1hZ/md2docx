import { spawn } from "node:child_process";

const VITE_PORT = 5173;
const URL = `http://localhost:${VITE_PORT}`;

const vite = spawn("bun", ["run", "dev:frontend"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FORCE_COLOR: "1" },
});

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
    const electron = spawn("bun", ["run", "dev:electron"], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, VITE_DEV_SERVER_URL: URL, FORCE_COLOR: "1" },
    });

    electron.on("close", () => {
      vite.kill();
      process.exit();
    });
  })
  .catch((err) => {
    console.error(err.message);
    vite.kill();
    process.exit(1);
  });

process.on("SIGINT", () => {
  vite.kill();
  process.exit();
});
