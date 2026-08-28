/**
 * S23 audio scaffolding (ADR-083/084, step 1 of the three-step plan): CUE-FIRST.
 *
 * Game code speaks NAMED CUES, never file paths. A cue→file mapping
 * (data/audio/mapping.json, committed — authored by Chris + the planner in step 2) resolves
 * cues against a gitignored local mount (assets/audio/, dev-served at /audio). Every cue
 * SILENTLY NO-OPS when unmapped or unmounted — the deploy's natural state (ADR-083); step 3
 * repoints the same cues at a repo-safe library with zero code changes.
 *
 * Browser reality: sound can only start after the first user interaction, whatever the
 * toggle says — the manager retries the pending music cue on the first gesture.
 */
// The committed cue→file mapping (data/audio/mapping.json), loaded the engine-bridge way
// (import.meta.glob — vite-native, vitest-safe, no resolveJsonModule dance).
const mappingModules = import.meta.glob("../../../../data/audio/mapping.json", { eager: true }) as Record<string, { default: Record<string, string> }>;
const mapping: Record<string, string> = Object.values(mappingModules)[0]?.default ?? {};

/** The taxonomy — S23's initial set, revised by the S24 mapping v3 landing:
 * - `music.town` RESOLVES BY REGION (colour + ring → `music.town.W1` … `music.town.G3`) — the
 *   region is the musical identity unit (Chris); the bare key stays as a fallback lookup.
 * - `splash.stronghold.<id>` — the five castle themes, played at the seat's threshold splash.
 * - Stingers per v3: one crier for all news (`sting.news`), `sting.reward` / `sting.manalink`
 *   for quest payoffs, `sting.parley` at the stakes menu, `sting.treasure` at a cache.
 * - Deliberate silences are MAPPING facts, not code: menu (TBD, hook kept), overworld, in-duel,
 *   interiors — the cues stay registered and unmapped. */
export type RegionColor = "W" | "U" | "B" | "R" | "G";
export type TownMusicCue = `music.town.${RegionColor}${1 | 2 | 3}`;
export type StrongholdSplashCue = `splash.stronghold.${"argent_bastion" | "spiral_spire" | "charnel_court" | "furnace_gate" | "verdant_throne"}`;
export type MusicCue =
  | "music.menu" | "music.overworld" | "music.town" | "music.dungeon" | "music.stronghold" | "music.duel"
  | TownMusicCue
  | StrongholdSplashCue;
export type StingCue =
  | "sting.news" | "sting.reward" | "sting.manalink" | "sting.parley" | "sting.treasure"
  | "sting.duel-win" | "sting.duel-loss" | "sting.coin-flip";
export type Cue = MusicCue | StingCue;

export const RING_NUM = { civilized: 1, approach: 2, wild: 3 } as const;
/** The v3 town resolution: town → its region's colour+ring → track. */
export function townMusicCue(color: string, tier: keyof typeof RING_NUM): MusicCue {
  const c = (["W", "U", "B", "R", "G"] as const).includes(color as RegionColor) ? (color as RegionColor) : "W";
  return `music.town.${c}${RING_NUM[tier]}`;
}
/** The v3 stronghold resolution: seat id → its castle theme. */
export function strongholdSplashCue(id: string): MusicCue {
  return `splash.stronghold.${id}` as StrongholdSplashCue;
}

const STORE_KEY = "cinquefoil-audio-enabled";
const FADE_MS = 900;

export class AudioManager {
  private enabled: boolean;
  private current: { cue: MusicCue; el: HTMLAudioElement } | null = null;
  private pendingMusic: MusicCue | null = null;
  private unlocked = false;
  private listeners = new Set<() => void>();

  constructor(private readonly files: Record<string, string> = mapping as Record<string, string>) {
    let stored: string | null = null;
    try {
      stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORE_KEY) : null;
    } catch {
      /* storage unavailable: default on */
    }
    this.enabled = stored !== "0";
    // The autoplay unlock: the first gesture anywhere retries whatever music is pending.
    if (typeof window !== "undefined") {
      const unlock = () => {
        this.unlocked = true;
        if (this.pendingMusic) this.music(this.pendingMusic);
      };
      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(STORE_KEY, on ? "1" : "0");
    } catch {
      /* fine */
    }
    if (!on && this.current) {
      this.current.el.pause();
      this.current = null;
    }
    if (on && this.pendingMusic) this.music(this.pendingMusic);
    this.listeners.forEach((l) => l());
  }

  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Resolve a cue to a servable URL; null = unmapped (the silent no-op). Underscore-prefixed
   * KEYS in mapping.json are documentation — they are never valid Cue names, so lookups by
   * typed cue can't reach them. */
  private srcFor(cue: Cue): string | null {
    let file = this.files[cue];
    // v3: a region-resolved town cue falls back to the bare `music.town` key (a mapping that
    // wants ONE town track everywhere writes one line).
    if ((typeof file !== "string" || file.length === 0) && cue.startsWith("music.town.")) file = this.files["music.town"];
    return typeof file === "string" && file.length > 0 ? `/audio/${file}` : null;
  }

  /** Per-context music with crossfade. Re-asking for the playing cue is a no-op. */
  music(cue: MusicCue): void {
    this.pendingMusic = cue;
    if (!this.enabled || typeof Audio === "undefined" || !this.unlocked) return;
    if (this.current?.cue === cue) return;
    const src = this.srcFor(cue);
    const old = this.current;
    if (old) this.fadeOut(old.el);
    this.current = null;
    if (!src) return; // unmapped/unmounted: silence, by design
    const el = new Audio(src);
    el.loop = true;
    el.volume = 0;
    el.play().then(() => this.fadeIn(el)).catch(() => {
      /* 404 or autoplay refusal: stay silent */
    });
    this.current = { cue, el };
  }

  /** Fire-and-forget stinger over the music. */
  sting(cue: StingCue): void {
    if (!this.enabled || typeof Audio === "undefined" || !this.unlocked) return;
    const src = this.srcFor(cue);
    if (!src) return;
    const el = new Audio(src);
    el.volume = 0.9;
    el.play().catch(() => {
      /* silent */
    });
  }

  private fadeIn(el: HTMLAudioElement): void {
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / FADE_MS);
      el.volume = 0.8 * k;
      if (k < 1) setTimeout(tick, 60);
    };
    tick();
  }

  private fadeOut(el: HTMLAudioElement): void {
    const v0 = el.volume;
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / FADE_MS);
      el.volume = v0 * (1 - k);
      if (k < 1) setTimeout(tick, 60);
      else el.pause();
    };
    tick();
  }

  /** Test seam: what the manager would play for a cue right now (null = silence). */
  resolve(cue: Cue): string | null {
    return this.srcFor(cue);
  }

  /** Test seam: the currently pending music cue (set even while locked/disabled/unmapped). */
  pending(): MusicCue | null {
    return this.pendingMusic;
  }
}

/** The one instance (the UI is one page); tests construct their own with a custom mapping. */
export const audio = new AudioManager();
