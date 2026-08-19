import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards";
import { expandDecklist, replayGame } from "@shandalar/engine";
import { fuzz, matchSpec, runPairingMatch } from "./fuzz.js";
import { DECKS, PAIRINGS, type DeckKey } from "./slice-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

describe("replay determinism (permanent fixture; S2 fixture 15)", () => {
  it("replay(log) reproduces byte-identical final state, x3 seeds on all three pairings", async () => {
    const pool = loadCardPool(CARDS_DIR);
    for (const [a, b] of PAIRINGS) {
      for (const seed of [42, 1337, 900913]) {
        const live = await runPairingMatch(pool.cards, seed, a, b);
        const replayed = await replayGame(
          pool.cards,
          [expandDecklist(DECKS[a].decklist as never), expandDecklist(DECKS[b].decklist as never)],
          live.log,
          { startingLife: 20, handSize: 7, maxTurns: 100 },
          matchSpec(seed, a, b).modifiers,
        );
        expect(replayed, `pairing ${a}-${b} seed ${seed}`).toBe(live.finalStateSerialized);
      }
    }
  });

  it("same seed twice produces identical games", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const a = await runPairingMatch(pool.cards, 7);
    const b = await runPairingMatch(pool.cards, 7);
    expect(a.finalStateSerialized).toBe(b.finalStateSerialized);
    expect(a.log).toEqual(b.log);
  });
});

describe("fuzz (S2 fixture 15)", () => {
  it("1,000 games per pairing: zero exceptions, every game terminates", async () => {
    const report = await fuzz(CARDS_DIR, 1000, 1);
    expect(report.totalErrors).toBe(0);
    for (const p of report.pairings) {
      const total = Object.values(p.terminations).reduce((x, y) => x + y, 0);
      expect(total, p.pairing).toBe(1000);
    }
  }, 300_000);
});
