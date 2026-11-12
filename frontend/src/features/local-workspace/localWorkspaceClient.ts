const endpoint = "/api/local-control/session";
let bootstrap: Promise<boolean> | null = null;

async function request(method: string, launch?: string) {
  const response = await fetch(endpoint, {
    method, credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "X-CacheSec-Workspace": "1", ...(launch ? { "Content-Type": "application/json" } : {}) },
    body: launch ? JSON.stringify({ launch }) : undefined,
  });
  if (!response.ok) throw new Error("Không mở được phiên local. Hãy chạy lại npm run workspace.");
  const value: unknown = await response.json();
  return !!value && typeof value === "object" && "connected" in value && value.connected === true;
}

export function initializeLocalWorkspace() {
  if (location.hash.startsWith("#local-launch=")) {
    const launch = location.hash.slice("#local-launch=".length);
    // Erase the one-use capability before any network operation; never browser storage.
    history.replaceState(history.state, "", location.pathname + location.search);
    bootstrap = /^[a-f0-9]{64}$/.test(launch) ? request("POST", launch) : Promise.reject(new Error("Liên kết mở project không hợp lệ."));
    return bootstrap;
  }
  // Share bootstrap across StrictMode's effect replay, then return to fresh session checks.
  if (bootstrap) return bootstrap;
  return request("GET");
}
export function clearLocalBootstrap() { bootstrap = null; }
export async function closeLocalWorkspace() { clearLocalBootstrap(); await request("DELETE"); }
