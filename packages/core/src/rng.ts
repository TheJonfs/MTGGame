import type { LogSink, RngPurpose } from "./log.js";

/**
 * The RNG service (engine-design §14, brief Part 1). All game randomness goes
 * through this interface. Every draw is appended to the action log, which lets
 * `replay(log)` reproduce games by feeding logged values back in (ReplayRng)
 * instead of re-running the PRNG.
 */
export interface Rng {
  /** Uniform integer in [0, n). */
  int(n: number, purpose: RngPurpose): number;
  /** Fisher-Yates shuffle; returns a new array. */
  shuffle<T>(items: readonly T[], purpose: RngPurpose): T[];
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[], purpose: RngPurpose): T;
}

/** mulberry32 — small, fast, deterministic across platforms. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRng implements Rng {
  private readonly next: () => number;

  constructor(
    seed: number,
    private readonly log: LogSink<unknown>,
  ) {
    this.next = mulberry32(seed);
  }

  int(n: number, purpose: RngPurpose): number {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`Rng.int: n must be a positive integer, got ${n}`);
    }
    const value = Math.floor(this.next() * n);
    this.log.append({ t: "RNG", purpose, value: { kind: "int", value } });
    return value;
  }

  shuffle<T>(items: readonly T[], purpose: RngPurpose): T[] {
    // Build the permutation first so it can be logged as one entry.
    const perm = items.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [perm[i], perm[j]] = [perm[j]!, perm[i]!];
    }
    this.log.append({ t: "RNG", purpose, value: { kind: "permutation", value: perm } });
    return perm.map((i) => items[i]!);
  }

  pick<T>(items: readonly T[], purpose: RngPurpose): T {
    if (items.length === 0) throw new Error("Rng.pick: empty array");
    return items[this.int(items.length, purpose)]!;
  }
}

/**
 * Replays logged RNG draws in order. Throws if the game requests randomness
 * in a different order/shape than the log recorded — that means the replay
 * diverged, which is a bug worth failing loudly on.
 */
export class ReplayRng implements Rng {
  private cursor = 0;

  constructor(
    private readonly draws: { purpose: RngPurpose; value: { kind: string; value: number | number[] } }[],
    private readonly log: LogSink<unknown>,
  ) {}

  private take(purpose: RngPurpose, kind: "int" | "permutation") {
    const draw = this.draws[this.cursor];
    if (!draw) throw new Error(`ReplayRng: log exhausted at draw ${this.cursor} (wanted ${purpose})`);
    if (draw.purpose !== purpose || draw.value.kind !== kind) {
      throw new Error(
        `ReplayRng: divergence at draw ${this.cursor}: log has ${draw.purpose}/${draw.value.kind}, game asked for ${purpose}/${kind}`,
      );
    }
    this.cursor++;
    return draw.value.value;
  }

  int(n: number, purpose: RngPurpose): number {
    const value = this.take(purpose, "int") as number;
    if (value < 0 || value >= n) {
      throw new Error(`ReplayRng: logged value ${value} out of range [0, ${n})`);
    }
    this.log.append({ t: "RNG", purpose, value: { kind: "int", value } });
    return value;
  }

  shuffle<T>(items: readonly T[], purpose: RngPurpose): T[] {
    const perm = this.take(purpose, "permutation") as number[];
    if (perm.length !== items.length) {
      throw new Error(`ReplayRng: permutation length ${perm.length} != items length ${items.length}`);
    }
    this.log.append({ t: "RNG", purpose, value: { kind: "permutation", value: perm } });
    return perm.map((i) => items[i]!);
  }

  pick<T>(items: readonly T[], purpose: RngPurpose): T {
    if (items.length === 0) throw new Error("ReplayRng.pick: empty array");
    return items[this.int(items.length, purpose)]!;
  }
}
