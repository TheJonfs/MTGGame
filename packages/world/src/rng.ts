/**
 * World RNG (manifest principle 6): the same mulberry32 as `@shandalar/core`,
 * but with an EXPLICIT, serializable state so a world save resumes its random
 * stream exactly. Every world roll (generation, encounters, flee contests,
 * shop stock) comes from here; duel randomness stays inside the engine (its
 * own seeded RNG, logged per game).
 */
export interface WorldRngState {
  /** mulberry32 accumulator (uint32). */
  a: number;
  /** Draws made so far — diagnostics/replay assertions only. */
  draws: number;
}

export class WorldRng {
  private a: number;
  private draws: number;

  constructor(seed: number | WorldRngState) {
    if (typeof seed === "number") {
      this.a = seed >>> 0;
      this.draws = 0;
    } else {
      this.a = seed.a >>> 0;
      this.draws = seed.draws;
    }
  }

  state(): WorldRngState {
    return { a: this.a, draws: this.draws };
  }

  /** Uniform float in [0, 1). */
  float(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.draws += 1;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`WorldRng.int: n must be a positive integer, got ${n}`);
    return Math.floor(this.float() * n);
  }

  /** True with probability p (clamped to [0,1]). Always consumes one draw. */
  chance(p: number): boolean {
    const f = this.float();
    return f < Math.max(0, Math.min(1, p));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("WorldRng.pick: empty array");
    return items[this.int(items.length)]!;
  }

  /** Fisher-Yates; returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}
