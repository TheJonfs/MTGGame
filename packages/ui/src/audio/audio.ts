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
const mappingModules = import.meta.glob("../../../../data/audio/mapping.json", { eager: true }) as Record<string, { default: Record<string, MappingEntry> }>;
const mapping: Record<string, MappingEntry> = Object.values(mappingModules)[0]?.default ?? {};

/** S24 r2: a mapping value — a bare file name, or {file, volume} (volume 0..1 on the channel baseline). */
export type MappingEntry = string | { file: string; volume?: number };

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
/** S24 r2–r3 (the SFX package): per-action duel sounds — a THIRD channel, fire-and-forget and
 * freely overlapping (rapid plays must not cut each other or the sting voice).
 *
 * The r3 sequencing (Chris): CASTING rings the card's TYPE (Summon for creatures, Artifact,
 * Enchant, Instant, Sorcery); ENTERING PLAY rings the permanent's COLOUR (a resolved creature,
 * a played or fetched land — anything through the one zone-move event). So a Grizzly Bears is
 * Summon at cast, then Green as it lands. Colour keys are sorted WUBRG strings (sfx.enter.WU —
 * the package has all ten guild pairs), plus artifact/colorless. Unmapped = silence, as ever. */
export type SfxCue = `sfx.${string}`;
export type Cue = MusicCue | StingCue | SfxCue;

const WUBRG = ["W", "U", "B", "R", "G"] as const;
/** Cast rings the TYPE (priority: creature > artifact > enchantment > instant > sorcery). */
export function castTypeSfxCue(types: string[]): SfxCue | null {
  if (types.includes("Creature")) return "sfx.cast.creature";
  if (types.includes("Artifact")) return "sfx.cast.artifact";
  if (types.includes("Enchantment")) return "sfx.cast.enchantment";
  if (types.includes("Instant")) return "sfx.cast.instant";
  if (types.includes("Sorcery")) return "sfx.cast.sorcery";
  return null;
}
/** Entering play rings the COLOUR identity (sorted WUBRG; artifact/colorless fallbacks). */
export function enterSfxCue(colors: string[], types: string[]): SfxCue {
  const c = WUBRG.filter((x) => colors.includes(x)).join("");
  if (c) return `sfx.enter.${c}`;
  return types.includes("Artifact") ? "sfx.enter.artifact" : "sfx.enter.colorless";
}

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

  constructor(private readonly files: Record<string, MappingEntry> = mapping) {
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

  /** Resolve a cue to {src, volume}; null = unmapped (the silent no-op). S24 r2: a mapping
   * value may be a bare file name OR `{ "file": "...", "volume": 0.5 }` — volume is a 0..1
   * multiplier on the channel's baseline (Chris's SFX-level tuning knob). Underscore-prefixed
   * KEYS in mapping.json are documentation — they are never valid Cue names. */
  private srcFor(cue: Cue): { src: string; volume: number } | null {
    let entry = this.files[cue];
    // v3: a region-resolved town cue falls back to the bare `music.town` key (a mapping that
    // wants ONE town track everywhere writes one line).
    if (entry === undefined && cue.startsWith("music.town.")) entry = this.files["music.town"];
    const file = typeof entry === "string" ? entry : entry && typeof entry === "object" ? (entry as { file?: string }).file : undefined;
    if (typeof file !== "string" || file.length === 0) return null;
    const vRaw = entry && typeof entry === "object" ? (entry as { volume?: number }).volume : undefined;
    const volume = typeof vRaw === "number" ? Math.max(0, Math.min(1, vRaw)) : 1;
    return { src: `/audio/${file}`, volume };
  }

  /** Per-context music with crossfade. Re-asking for the playing cue is a no-op. */
  music(cue: MusicCue): void {
    this.pendingMusic = cue;
    if (!this.enabled || typeof Audio === "undefined" || !this.unlocked) return;
    if (this.current?.cue === cue) return;
    const resolved = this.srcFor(cue);
    const old = this.current;
    if (old) this.fadeOut(old.el);
    this.current = null;
    if (!resolved) return; // unmapped/unmounted: silence, by design
    const el = new Audio(resolved.src);
    el.loop = true;
    el.volume = 0;
    el.play().then(() => this.fadeIn(el, 0.8 * resolved.volume)).catch(() => {
      // S24 r1 (the failed-to-fire report): a refused/404'd element must not SQUAT on its cue —
      // clear it so the next request for this context retries instead of no-opping forever.
      if (this.current?.el === el) this.current = null;
    });
    this.current = { cue, el };
  }

  private currentSting: { cue: StingCue; el: HTMLAudioElement } | null = null;

  /** Stinger over the music — ONE sting voice (S24 r1, Chris: Dueltune and Winduel stacked):
   * a new sting fades whatever sting still rings; long pieces (Dueltune) get cut off by the
   * next moment's sting instead of layering under it. */
  sting(cue: StingCue): void {
    if (!this.enabled || typeof Audio === "undefined" || !this.unlocked) return;
    const resolved = this.srcFor(cue);
    if (!resolved) return;
    this.fadeSting();
    const el = new Audio(resolved.src);
    el.volume = 0.9 * resolved.volume;
    el.onended = () => {
      if (this.currentSting?.el === el) this.currentSting = null;
    };
    el.play().catch(() => {
      /* silent */
    });
    this.currentSting = { cue, el };
  }

  /** S24 r2: the SFX channel — fire-and-forget and freely OVERLAPPING (rapid card plays layer
   * naturally; they never touch the sting voice or the music). Volume = the mapping's per-cue
   * multiplier on a full baseline — Chris's tuning knob lives in the data. */
  sfx(cue: SfxCue, volumeOverride?: number): void {
    if (!this.enabled || typeof Audio === "undefined" || !this.unlocked) return;
    const resolved = this.srcFor(cue);
    if (!resolved) return;
    const el = new Audio(resolved.src);
    el.volume = Math.max(0, Math.min(1, volumeOverride ?? resolved.volume));
    el.play().catch(() => {
      /* silent */
    });
  }

  /** Dev seam (the /sound board): every mapped cue with its file and volume. */
  entries(): { cue: string; file: string; volume: number }[] {
    return Object.entries(this.files)
      .filter(([k]) => !k.startsWith("_"))
      .map(([cue, e]) => ({
        cue,
        file: typeof e === "string" ? e : e.file,
        volume: typeof e === "string" ? 1 : Math.max(0, Math.min(1, e.volume ?? 1)),
      }));
  }

  /** Fade the ringing sting (optionally only when it IS the named cue) — S24 r1: the parley's
   * Dueltune fades the moment the player makes a stakes choice. */
  fadeSting(cue?: StingCue): void {
    if (!this.currentSting) return;
    if (cue && this.currentSting.cue !== cue) return;
    this.fadeOut(this.currentSting.el, 300);
    this.currentSting = null;
  }

  private fadeIn(el: HTMLAudioElement, target = 0.8): void {
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / FADE_MS);
      el.volume = target * k;
      if (k < 1) setTimeout(tick, 60);
    };
    tick();
  }

  private fadeOut(el: HTMLAudioElement, ms: number = FADE_MS): void {
    const v0 = el.volume;
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      el.volume = v0 * (1 - k);
      if (k < 1) setTimeout(tick, 60);
      else el.pause();
    };
    tick();
  }

  /** Test seam: what the manager would play for a cue right now (null = silence). */
  resolve(cue: Cue): string | null {
    return this.srcFor(cue)?.src ?? null;
  }

  /** Test seam: the cue's effective per-cue volume multiplier (1 for bare-string entries). */
  resolveVolume(cue: Cue): number | null {
    return this.srcFor(cue)?.volume ?? null;
  }

  /** Test seam: the currently pending music cue (set even while locked/disabled/unmapped). */
  pending(): MusicCue | null {
    return this.pendingMusic;
  }
}

/** The one instance (the UI is one page); tests construct their own with a custom mapping. */
export const audio = new AudioManager();
