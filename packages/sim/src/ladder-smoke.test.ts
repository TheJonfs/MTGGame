import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runLadder } from "./ladder.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * Ladder smoke (ADR-049; S8 brief Part 3): 100 games/cell committed; the
 * 1,000/cell CLI run (`pnpm ladder`) is the ship-gate authority. The smoke
 * asserts flake-resistant bounds rather than the exact gate: at 100 games a
 * true 55% cell fails a >50% check ~16% of the time, which would make the
 * suite unreliable — the bounds below are ~3σ below the measured rates.
 */
describe("ladder smoke (permanent; ADR-049)", () => {
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
