/** Post-S71 (Chris, the iPhone Duo): a compact layout for short or narrow windows. The setting is per device
 * (localStorage), not per journey — it is about the screen, not the game. "auto" follows the window live (an
 * unfold, a rotation, a resize); "compact" and "full" force one side. The layout itself is CSS under
 * `html.layout-compact` (theme.css, "Compact layout"); this module only decides the class. */

export type LayoutSetting = "auto" | "compact" | "full";

const KEY = "cinquefoil.layout";
/** The Duo unfolded in Safari is about 890–951 × 543–626 CSS px. Laptop windows are taller than 640 and wider
 * than 1000, so "auto" leaves them on the full layout. */
export const COMPACT_QUERY = "(max-height: 640px), (max-width: 1000px)";

const listeners = new Set<() => void>();

export function getLayoutSetting(): LayoutSetting {
  try {
    const v = localStorage.getItem(KEY);
    return v === "compact" || v === "full" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function setLayoutSetting(s: LayoutSetting): void {
  try {
    if (s === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, s);
  } catch {
    /* storage refused: the choice lasts this page only */
  }
  apply();
  for (const f of listeners) f();
}

export function subscribeLayout(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Whether the compact layout is on, for this setting and window. */
export function isCompact(setting: LayoutSetting = getLayoutSetting(), mq: { matches: boolean } | null = query()): boolean {
  if (setting !== "auto") return setting === "compact";
  return mq?.matches ?? false;
}

function query(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(COMPACT_QUERY) : null;
}

function apply(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("layout-compact", isCompact());
}

/** Once, at start: set the class and follow the window. */
export function installLayoutMode(): void {
  apply();
  let last = isCompact();
  const follow = () => {
    const now = isCompact();
    if (now === last) return;
    last = now;
    apply();
    for (const f of listeners) f();
  };
  // The query's change event, and resize as a backstop (some engines and emulators skip the former).
  query()?.addEventListener?.("change", follow);
  window.addEventListener("resize", follow);
  subscribeLayout(() => { last = isCompact(); });
}

export const LAYOUT_LABEL: Record<LayoutSetting, string> = { auto: "auto (by window size)", compact: "compact", full: "full" };
