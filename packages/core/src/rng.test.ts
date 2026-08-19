import { describe, expect, it } from "vitest";
import { ArrayLog } from "./log.js";
import { ReplayRng, SeededRng } from "./rng.js";

describe("SeededRng", () => {
  it("is deterministic for the same seed", () => {
    const a = new SeededRng(42, new ArrayLog());
    const b = new SeededRng(42, new ArrayLog());
    for (let i = 0; i < 100; i++) {
      expect(a.int(1000, "coin")).toBe(b.int(1000, "coin"));
    }
  });

  it("differs across seeds", () => {
    const a = new SeededRng(1, new ArrayLog());
    const b = new SeededRng(2, new ArrayLog());
    const seqA = Array.from({ length: 20 }, () => a.int(1_000_000, "coin"));
    const seqB = Array.from({ length: 20 }, () => b.int(1_000_000, "coin"));
    expect(seqA).not.toEqual(seqB);
  });

  it("logs every draw", () => {
    const log = new ArrayLog();
    const rng = new SeededRng(7, log);
    rng.int(10, "coin");
    rng.shuffle([1, 2, 3, 4], "shuffle");
    rng.pick(["a", "b"], "pick");
    expect(log.entries).toHaveLength(3);
    expect(log.entries.every((e) => e.t === "RNG")).toBe(true);
  });

  it("shuffle returns a permutation of the input", () => {
    const rng = new SeededRng(9, new ArrayLog());
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(input, "shuffle");
    expect([...out].sort((x, y) => x - y)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // input untouched
  });
});

describe("ReplayRng", () => {
  it("reproduces the draws of a SeededRng from its log", () => {
    const log = new ArrayLog();
    const rng = new SeededRng(123, log);
    const original = [rng.int(6, "coin"), rng.int(52, "discard")];
    const originalShuffle = rng.shuffle(["a", "b", "c", "d"], "shuffle");

    const draws = log.entries.flatMap((e) => (e.t === "RNG" ? [e] : []));
    const replay = new ReplayRng(draws, new ArrayLog());
    expect(replay.int(6, "coin")).toBe(original[0]);
    expect(replay.int(52, "discard")).toBe(original[1]);
    expect(replay.shuffle(["a", "b", "c", "d"], "shuffle")).toEqual(originalShuffle);
  });

  it("throws on divergence", () => {
    const log = new ArrayLog();
    new SeededRng(1, log).int(10, "coin");
    const draws = log.entries.flatMap((e) => (e.t === "RNG" ? [e] : []));
    const replay = new ReplayRng(draws, new ArrayLog());
    expect(() => replay.int(10, "discard")).toThrow(/divergence/);
  });

  it("throws when the log is exhausted", () => {
    const replay = new ReplayRng([], new ArrayLog());
    expect(() => replay.int(2, "coin")).toThrow(/exhausted/);
  });
});
