import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards";
import { expandDecklist, replayGame } from "@shandalar/engine";
import { fuzz, runSliceMatch, sliceMatchSpec } from "./fuzz.js";
import { DECK_A_MONO_RED, DECK_B_WU_SKIES } from "./slice-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

describe("replay determinism (permanent fixture, brief §3.12)", () => {
  it("replay(log) reproduces byte-identical final state across seeds", async () => {
    const pool = loadCardPool(CARDS_DIR);
    for (const seed of [42, 1337, 900913]) {
      const live = await runSliceMatch(pool.cards, seed);
      const replayed = await replayGame(
        pool.cards,
        [expandDecklist(DECK_A_MONO_RED), expandDecklist(DECK_B_WU_SKIES)],
        live.log,
        { startingLife: 20, handSize: 7, maxTurns: 100 },
        sliceMatchSpec(seed).modifiers,
      );
      expect(replayed).toBe(live.finalStateSerialized);
    }
  });

  it("same seed twice produces identical games", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const a = await runSliceMatch(pool.cards, 7);
    const b = await runSliceMatch(pool.cards, 7);
    expect(a.finalStateSerialized).toBe(b.finalStateSerialized);
    expect(a.log).toEqual(b.log);
  });
});

describe("fuzz (brief fixture 12)", () => {
  it("1,000 random-vs-random games: zero exceptions, every game terminates", async () => {
    const report = await fuzz(CARDS_DIR, 1000, 1);
    expect(report.errors).toEqual([]);
    const total = Object.values(report.terminations).reduce((a, b) => a + b, 0);
    expect(total).toBe(1000);
  }, 120_000);
});
