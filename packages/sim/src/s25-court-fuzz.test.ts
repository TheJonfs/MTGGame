import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { COURT_DECKS } from "./court-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * S25 fuzz-before-fixtures (the S3 protocol): the five Mox-court cards carry the session's five
 * small words — double-X announce ({X}{X} charging 2X), the xPaid ref (LKI through the ETB
 * eventContext), life as an activation cost (CR 118.4's floor), exile-top-as-cost (library-depth
 * gating), and the resolved grantKeyword-until-EOT — plus the two quarter-words the bill missed
 * (damage to:"you"; permanentYou[Dont]Control predicates). Random play over the court's own v1
 * decks exercises cost/payment/enumeration territory before any fixture exists.
 *
 * Pairings: every court deck appears at least twice, and every court card meets a board where
 * its word can fire (the Sage's two-sided bounce, the Keeper's X ladder, the Witch's blood).
 */
const DECKS = Object.fromEntries(Object.entries(COURT_DECKS).map(([k, v]) => [k, v.decklist]));

describe("S25 court fuzz — the Mox court under random play (fuzz-before-fixtures for Part 1)", () => {
  const games = process.env.FUZZ_FULL ? 60 : 12; // per pairing; five pairings cover all five decks
  const PAIRS: [string, string][] = [
    ["pearl_cleric", "jet_witch"],
    ["sapphire_sage", "emerald_keeper"],
    ["ruby_tyrant", "pearl_cleric"],
    ["jet_witch", "sapphire_sage"],
    ["emerald_keeper", "ruby_tyrant"],
  ];
  it(`${games} games x 5 court-deck pairings: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [a, b] of PAIRS) {
      for (let seed = 1; seed <= games; seed++) {
        const result = await runMatch(
          { seed, players: [{ name: a, decklist: DECKS[a]!, agent: "random" }, { name: b, decklist: DECKS[b]!, agent: "random" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] },
          cards,
          [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)],
        );
        expect(result.reason, `${a}-${b} seed ${seed}`).toBeTruthy();
      }
    }
  }, 600_000);

  it("court-deck replay determinism (the new cost picks and X announces replay byte-identical)", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [a, b, seed] of [["pearl_cleric", "jet_witch", 5], ["sapphire_sage", "emerald_keeper", 9], ["emerald_keeper", "ruby_tyrant", 13]] as const) {
      const live = await runMatch(
        { seed, players: [{ name: a, decklist: DECKS[a]!, agent: "random" }, { name: b, decklist: DECKS[b]!, agent: "random" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] },
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
