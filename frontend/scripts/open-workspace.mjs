import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";
import { LocalSessionStore, localOrigin } from "../src/features/local-workspace/localSessionStore.ts";

export async function openWorkspace() {
  const ready = await fetch(localOrigin + "/api/local-control/session", {
    headers: { "X-CacheSec-Workspace": "1", "Sec-Fetch-Site": "same-origin", Origin: localOrigin },
    redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (!ready.ok || typeof (await ready.json()).connected !== "boolean") throw new Error("WORKSPACE_NOT_READY");
  // This capability expires in 60 seconds and is consumed once. The human token never enters a URL/argv.
  const store = new LocalSessionStore(fileURLToPath(new URL("../../backend/.local", import.meta.url)));
  const launch = await store.issueLaunch();
  const url = `${localOrigin}/workspace#local-launch=${launch}`;
  if (process.platform !== "win32") throw new Error("Use the Windows local launcher.");
  await new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "Start-Process -FilePath $env:CACHESEC_WORKSPACE_URL"], {
      windowsHide: true, stdio: "ignore", env: { ...process.env, CACHESEC_WORKSPACE_URL: url },
    });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error("BROWSER_START_FAILED")));
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolvePath(process.argv[1])) {
  openWorkspace().catch(() => { console.error("Không mở được phiên local. Kiểm tra cấu hình và chạy npm run local."); process.exitCode = 1; });
}
