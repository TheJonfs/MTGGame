import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { COROLLA_DECKS } from "./corolla-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * S26 fuzz-before-fixtures (the S3 protocol): the five still-pair signatures carry the session's
 * words — the resolved gainControl (Lumen's threaten), named counter kinds + the countersOnSelf ref
 * + remove-counters-as-cost (Clio's accumulator), the tappedCreature predicate (Seraphina), the
 * LAND_ENTERS collector (Yuloke), and the DRAW collector (Faldor). Random play over the Corolla's
 * own v1 decks exercises cost/payment/enumeration/control territory before any fixture exists.
 */
const DECKS = Object.fromEntries(Object.entries(COROLLA_DECKS).map(([k, v]) => [k, v.decklist]));
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };

describe("S26 Corolla fuzz — the still-pair court under random play (fuzz-before-fixtures for Part 1)", () => {
  const games = process.env.FUZZ_FULL ? 60 : 12; // per pairing; five pairings cover all five decks twice
  const PAIRS: [string, string][] = [
    ["lumen", "clio"],
    ["seraphina", "yuloke"],
    ["faldor", "lumen"],
    ["clio", "seraphina"],
    ["yuloke", "faldor"],
  ];
  it(`${games} games x 5 Corolla-deck pairings: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [a, b] of PAIRS) {
      for (let seed = 1; seed <= games; seed++) {
        const result = await runMatch(
          { seed, players: [{ name: a, decklist: DECKS[a]!, agent: "random" }, { name: b, decklist: DECKS[b]!, agent: "random" }], rules: RULES, modifiers: [] },
          cards,
          [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)],
        );
        expect(result.reason, `${a}-${b} seed ${seed}`).toBeTruthy();
      }
    }
  }, 600_000);

  it("Corolla-deck replay determinism (control changes, counter costs, draw and landfall triggers replay byte-identical)", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [a, b, seed] of [["lumen", "clio", 5], ["seraphina", "yuloke", 9], ["yuloke", "faldor", 13]] as const) {
      const live = await runMatch(
        { seed, players: [{ name: a, decklist: DECKS[a]!, agent: "random" }, { name: b, decklist: DECKS[b]!, agent: "random" }], rules: RULES, modifiers: [] },
        cards,
        [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)],
      );
      const replayed = await replayGame(
        cards,
        [DECKS[a]!.flatMap((d) => Array(d.count).fill(d.cardId)), DECKS[b]!.flatMap((d) => Array(d.count).fill(d.cardId))],
        live.log,
        { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 },
        [],
      );
      expect(replayed, `${a}-${b} seed ${seed}`).toBe(live.finalStateSerialized);
    }
  }, 120_000);
});
