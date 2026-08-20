import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runLadder } from "./ladder.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * Ladder smokes (ADR-049/-055): the 1,000/cell CLI run (`pnpm ladder`) is
 * the ship-gate authority; committed smokes assert flake-resistant bounds
 * (at small n a true-55% cell fails a >50% check far too often for a suite).
 *
 * ADR-055 tiers: the default suite runs a 20/cell mirror sanity check
 * (~2.5s, loose bounds); FUZZ_FULL adds the 100/cell smoke.
 */
describe("ladder mirror sanity (default tier; ADR-055)", () => {
  it("heuristic vs sane, 20/cell mirrors: overall majority, no cell collapses", async () => {
    const report = await runLadder(CARDS_DIR, "heuristic", "sane", 20, 42, undefined, { mirrorsOnly: true });
    const wins = report.mirrors.reduce((n, m) => n + m.challengerWins, 0);
    const games = report.mirrors.reduce((n, m) => n + m.games, 0);
    expect(wins * 2).toBeGreaterThan(games);
    for (const m of report.mirrors) {
      expect(m.challengerWins, `${m.pairing} seat${m.challengerSeat}`).toBeGreaterThanOrEqual(5); // 25% floor at n=20
    }
  }, 120_000);
});

(process.env.FUZZ_FULL ? describe : describe.skip)("ladder smoke (FUZZ_FULL tier; ADR-049/-055)", () => {
  it("heuristic vs sane, 100/cell: every mirror cell > 40%, overall mirror majority, zero surprises", async () => {
    const report = await runLadder(CARDS_DIR, "heuristic", "sane", 100, 42);
    for (const m of report.mirrors) {
      expect(m.challengerWins, `${m.pairing} seat${m.challengerSeat}`).toBeGreaterThan(40);
      expect(m.draws, `${m.pairing} seat${m.challengerSeat} draws`).toBeLessThan(10);
    }
    const totalMirrorWins = report.mirrors.reduce((n, m) => n + m.challengerWins, 0);
    const totalMirrorGames = report.mirrors.reduce((n, m) => n + m.games, 0);
    expect(totalMirrorWins * 2).toBeGreaterThan(totalMirrorGames);
  }, 600_000);
});
