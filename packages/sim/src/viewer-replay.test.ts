import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayToDecision, sameAction, stableStringify } from "@shandalar/engine";
import { matchSpec, runPairingMatch } from "./fuzz.js";
import { DECKS } from "./slice-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * The viewer's state source (S6): replayToDecision must agree with the
 * engine at every decision index — final state byte-identical to a full
 * replay, and the taken action always among the request's alternatives.
 */
describe("viewer prefix replay (permanent fixture, S6)", () => {
  it("replayToDecision: final state matches, every sampled decision offers the taken action", async () => {
    const pool = loadCardPool(CARDS_DIR);
    const spec = matchSpec(4242, "B", "D");
    const live = await runPairingMatch(pool.cards, 4242, "B", "D");
    const decklists: [string[], string[]] = [
      expandDecklist(spec.players[0].decklist),
      expandDecklist(spec.players[1].decklist),
    ];
    const total = live.log.filter((e) => e.t === "ACTION").length;

    // Index == total runs to completion: byte-identical to the live game.
    const final = await replayToDecision(pool.cards, decklists, live.log, total);
    expect(final.gameOver).toBe(true);
    expect(stableStringify(final.state)).toBe(live.finalStateSerialized);

    // Sampled interior decisions: the logged action is always one of the
    // enumerated alternatives, and the request is addressed to its player.
    const actionEntries = live.log.filter((e) => e.t === "ACTION");
    const step = Math.max(1, Math.floor(total / 23));
    for (let k = 0; k < total; k += step) {
      const point = await replayToDecision(pool.cards, decklists, live.log, k);
      const entry = actionEntries[k]!;
      expect(point.request, `decision ${k}`).not.toBeNull();
      expect(point.request!.player, `decision ${k}`).toBe(entry.player);
      expect(
        point.request!.actions.some((a) => sameAction(a, entry.action)),
        `decision ${k}: taken action among alternatives`,
      ).toBe(true);
      expect(sameAction(point.taken!, entry.action)).toBe(true);
    }
  }, 120_000);
});
