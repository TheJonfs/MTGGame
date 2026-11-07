import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyUpdate, downloadAll, isUpdateReady, mb, offlineStatus, offlineSupported, subscribeOffline, type OfflineStatus } from "../pwa";

/** Post-S71 (Chris, the iPhone Duo): the front page's offline line — how much art and audio is stored,
 * and "Make available offline" (about 450 MB; resumable). Hidden in dev and where service workers are missing. */
export function OfflinePanel() {
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!offlineSupported()) return;
    let live = true;
    offlineStatus().then((s) => { if (live) setStatus(s); }).catch(() => {});
    return () => { live = false; abort.current?.abort(); };
  }, []);

  if (!offlineSupported() || !status) return null;
  const done = status.stored === status.files;

  const start = async () => {
    setBusy(true); setError(null);
    const c = new AbortController(); abort.current = c;
    try { setStatus(await downloadAll(setStatus, c.signal)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); abort.current = null; }
  };

  return (
    <div className="offline-panel">
      <span>
        Offline: {done ? "everything stored" : `art and audio ${status.stored} of ${status.files} files (${mb(status.storedBytes)} of ${mb(status.bytes)})`}
      </span>
      {!done && !busy && <button type="button" onClick={start}>Make available offline</button>}
      {busy && <button type="button" onClick={() => abort.current?.abort()}>Stop</button>}
      {busy && <progress max={status.bytes} value={status.storedBytes} />}
      {error && <span className="offline-error">{error} — try again to fetch the rest.</span>}
    </div>
  );
}

/** The "new version ready" banner, on every page; Reload switches to it (a game in progress is never
 * reloaded without the player choosing it). */
export function UpdateBanner() {
  const ready = useSyncExternalStore(subscribeOffline, isUpdateReady, () => false);
  const [updating, setUpdating] = useState(false);
  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      {updating ? "Updating Cinquefoil…" : <>A new version of Cinquefoil is ready. <button type="button" onClick={() => { setUpdating(true); applyUpdate(); }}>Reload</button></>}
    </div>
  );
}
