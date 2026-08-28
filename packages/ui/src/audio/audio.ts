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

/** The initial taxonomy (brief Part 3) — extend as wiring reveals wants; escalate if it balloons. */
export type MusicCue = "music.menu" | "music.overworld" | "music.town" | "music.dungeon" | "music.stronghold" | "music.duel";
export type StingCue = "sting.quest-complete" | "sting.siege-news" | "sting.duel-win" | "sting.duel-loss" | "sting.coin-flip";
export type Cue = MusicCue | StingCue;

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
    const file = this.files[cue];
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
