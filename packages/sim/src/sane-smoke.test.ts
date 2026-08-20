import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fuzz } from "./fuzz.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * SanePolicyAgent smoke (S7 brief Part 1, ADR-045). The engine-correctness
 * fuzz suites keep RandomAgent — this suite only proves the policy agent
 * plays whole games cleanly. Replay determinism needs no sane-specific
 * test: replay feeds logged actions back and never calls agents.
 */
describe("sane-vs-sane smoke (permanent; ADR-045)", () => {
  it("100 games x 10 pairings: zero exceptions, every game terminates, none by MAX_TURNS", async () => {
    const report = await fuzz(CARDS_DIR, 100, 1, undefined, undefined, ["sane", "sane"]);
    expect(report.totalErrors).toBe(0);
    for (const p of report.pairings) {
      const total = Object.values(p.terminations).reduce((x, y) => x + y, 0);
      expect(total, p.pairing).toBe(100);
      // A policy that plays lands and casts spells should never stall out.
      expect(p.terminations["MAX_TURNS"] ?? 0, p.pairing).toBe(0);
    }
  }, 600_000);
});
