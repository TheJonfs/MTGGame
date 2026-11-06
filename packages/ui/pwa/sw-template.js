/* Post-S71 (Chris, the iPhone Duo): Cinquefoil's service worker — the offline copy.
 * scripts/pwa-build.mjs prepends `BUILD` (the version) and `SHELL` (the files the app needs to open).
 *
 * Two caches:
 *   cinq-shell-<BUILD>  the shell, stored whole at install; one per version, old ones dropped at activate.
 *   cinq-files          everything else (card art, portraits, audio), kept across versions. A file goes in
 *                       when it is first seen, or from the page's "Make available offline" download. Each
 *                       entry carries its content hash (x-cinq-hash); at activate, entries whose hash no
 *                       longer matches the new build's list are dropped, to be fetched fresh next time.
 *
 * Requests: page loads get the cached index.html (the app routes itself); /assets/ and every other
 * same-origin GET is answered from a cache when present, else from the network (and stored if it is a
 * listed file). Range requests (iOS <audio>) are answered by slicing the stored file. /__ dev endpoints
 * and anything cross-origin pass straight through. A new version waits until the page says to switch
 * (the "new version ready" banner), so a game in progress is never reloaded under the player. */

const SHELL_CACHE = "cinq-shell-" + BUILD;
const FILES_CACHE = "cinq-files";
const LIST_URL = "/offline-files.json";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Fresh from the network, past the HTTP cache, so the shell matches this BUILD.
    await cache.addAll(SHELL.concat([LIST_URL]).map((u) => new Request(u, { cache: "reload" })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("cinq-shell-") && k !== SHELL_CACHE) await caches.delete(k);
    await pruneFiles();
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

/** Drop stored files whose content changed (or that left the build). */
async function pruneFiles() {
  const list = await listing();
  if (!list) return;
  const want = new Map(list.files.map((f) => [f.u, f.h]));
  const cache = await caches.open(FILES_CACHE);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    const res = await cache.match(req);
    if (!want.has(path) || res?.headers.get("x-cinq-hash") !== want.get(path)) await cache.delete(req);
  }
}

let listed = null;
/** This version's file list, from the shell cache (the SW can be restarted at any time). */
async function listing() {
  if (listed) return listed;
  const res = await (await caches.open(SHELL_CACHE)).match(LIST_URL);
  if (!res) return null;
  const json = await res.json();
  listed = { files: json.files, hash: new Map(json.files.map((f) => [f.u, f.h])) };
  return listed;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/__") || url.pathname === "/sw.js") return;
  if (req.headers.get("x-cinq-download")) return; // the page's download stores the file itself
  if (req.mode === "navigate") { event.respondWith(page(req)); return; }
  event.respondWith(file(req, url));
});

async function page(req) {
  const hit = await (await caches.open(SHELL_CACHE)).match("/index.html");
  if (hit) return hit;
  return fetch(req);
}

async function file(req, url) {
  const range = req.headers.get("range");
  const key = url.origin + url.pathname; // query strings never vary a static file
  let hit = await (await caches.open(SHELL_CACHE)).match(key);
  if (!hit) hit = await (await caches.open(FILES_CACHE)).match(key);
  if (!hit) {
    let res;
    try {
      res = await fetch(range ? new Request(key) : req); // whole file even for a Range request, so it can be stored
    } catch (e) {
      return new Response("", { status: 504, statusText: "offline and not stored" });
    }
    const list = await listing();
    const h = list?.hash.get(url.pathname);
    // The host answers an unknown path with index.html (the app's rewrite); only listed files are stored.
    if (res.ok && res.status === 200 && h && !(res.headers.get("content-type") || "").includes("text/html")) {
      hit = await store(key, res, h);
    } else if (!range) {
      return res;
    } else {
      hit = res;
    }
  }
  return range ? ranged(hit, range) : hit;
}

/** Store a response with its content hash; return a fresh copy to serve. */
async function store(key, res, h) {
  const headers = new Headers(res.headers);
  headers.set("x-cinq-hash", h);
  const body = await res.blob();
  const copy = new Response(body, { status: 200, statusText: "OK", headers });
  await (await caches.open(FILES_CACHE)).put(key, copy.clone());
  return copy;
}

/** A 206 slice of a stored whole file (iOS plays <audio> through Range requests). */
async function ranged(res, range) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || res.status !== 200) return res;
  const blob = await res.blob();
  const size = blob.size;
  let start, end;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) {
    return new Response("", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const headers = new Headers(res.headers);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");
  return new Response(blob.slice(start, end + 1), { status: 206, statusText: "Partial Content", headers });
}
