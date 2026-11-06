/** Post-S71 (Chris, the iPhone Duo): the page's side of the offline copy (the service worker is
 * packages/ui/pwa/sw-template.js; the file list is written by scripts/pwa-build.mjs at build).
 *  - registerOffline(): registers /sw.js on the deployed build (never in dev) and watches for a new version.
 *  - a new version waits; `updateReady` turns true and the banner's Reload calls applyUpdate().
 *  - offlineStatus() / downloadAll(): how much of the art and audio is stored, and the "Make available
 *    offline" download, which stores every listed file not already stored at its current hash. */

export type OfflineFile = { u: string; s: number; h: string; shell?: boolean };
export type OfflineStatus = { files: number; stored: number; bytes: number; storedBytes: number };

const FILES_CACHE = "cinq-files";

let updateReady = false;
let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const f of listeners) f(); };

export function subscribeOffline(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
export const isUpdateReady = () => updateReady;
/** True where the offline copy can exist (a deployed build in a browser with service workers). */
export const offlineSupported = () => import.meta.env.PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof caches !== "undefined";

export function registerOffline(): void {
  if (!offlineSupported()) return;
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const offer = (w: ServiceWorker | null) => {
        // Only an update: the very first install has no controller and simply takes over.
        if (!w || !navigator.serviceWorker.controller) return;
        waiting = w; updateReady = true; emit();
      };
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => { if (w.state === "installed") offer(w); });
      });
      // A home-screen app can stay open for days: look for a new version when it comes back to the front.
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void reg.update().catch(() => {}); });
    } catch {
      /* no offline copy: the app works online as before */
    }
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateReady || reloading) return; // the first install's claim is not a reason to reload
    reloading = true;
    window.location.reload();
  });
}

/** Switch to the waiting version (the page reloads when it takes over). */
export function applyUpdate(): void {
  if (waiting) waiting.postMessage("skip-waiting");
  else window.location.reload();
}

async function fileList(): Promise<OfflineFile[]> {
  const res = await fetch("/offline-files.json");
  if (!res.ok) throw new Error("no file list");
  return ((await res.json()) as { files: OfflineFile[] }).files;
}

/** The art and audio (everything outside the shell, which is always stored once the app is installed). */
async function bulkFiles(): Promise<OfflineFile[]> {
  return (await fileList()).filter((f) => !f.shell);
}

async function isStored(cache: Cache, f: OfflineFile): Promise<boolean> {
  const hit = await cache.match(f.u);
  return !!hit && hit.headers.get("x-cinq-hash") === f.h;
}

export async function offlineStatus(): Promise<OfflineStatus> {
  const files = await bulkFiles();
  const cache = await caches.open(FILES_CACHE);
  let stored = 0, storedBytes = 0, bytes = 0;
  for (const f of files) {
    bytes += f.s;
    if (await isStored(cache, f)) { stored++; storedBytes += f.s; }
  }
  return { files: files.length, stored, bytes, storedBytes };
}

/** Store every art and audio file not already stored. Resumable: a stop or a lost connection keeps what
 * arrived, and the next run fetches only the rest. */
export async function downloadAll(onProgress: (s: OfflineStatus) => void, signal: AbortSignal): Promise<OfflineStatus> {
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
  const files = await bulkFiles();
  const cache = await caches.open(FILES_CACHE);
  const status: OfflineStatus = { files: files.length, stored: 0, bytes: files.reduce((a, f) => a + f.s, 0), storedBytes: 0 };
  const todo: OfflineFile[] = [];
  for (const f of files) {
    if (await isStored(cache, f)) { status.stored++; status.storedBytes += f.s; } else todo.push(f);
  }
  onProgress({ ...status });
  let next = 0, failed = 0;
  const worker = async () => {
    while (next < todo.length && !signal.aborted) {
      const f = todo[next++]!;
      try {
        const res = await fetch(f.u, { cache: "no-store", signal, headers: { "x-cinq-download": "1" } });
        if (!res.ok || (res.headers.get("content-type") || "").includes("text/html")) { failed++; continue; }
        const headers = new Headers(res.headers);
        headers.set("x-cinq-hash", f.h);
        await cache.put(f.u, new Response(await res.blob(), { status: 200, statusText: "OK", headers }));
        status.stored++; status.storedBytes += f.s;
        onProgress({ ...status });
      } catch {
        if (signal.aborted) break;
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (failed && !signal.aborted) throw new Error(`${failed} file${failed === 1 ? "" : "s"} did not download`);
  return status;
}

export const mb = (n: number) => `${Math.round(n / 1048576)} MB`;
