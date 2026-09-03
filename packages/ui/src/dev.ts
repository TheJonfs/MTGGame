/** S27 r4 (Chris: the Dev tab shipped to the deploy): dev affordances show in the dev server, and on
 * a built deploy only with `?dev=1` on the URL — the escape hatch for testing the live build. */
export function devMenuEnabled(): boolean {
  const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
  if (env?.DEV) return true;
  try { return new URLSearchParams(window.location.search).get("dev") === "1"; } catch { return false; }
}
