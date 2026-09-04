import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { HEART_DECK } from "./heart-deck.js";
import { COROLLA_DECKS } from "./corolla-decks.js";
import { DECKS } from "./slice-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
/** ADR-096 (S28): the Heart's roots — the five basics on the Manafleur's side before turn one (the
 * world's heartRootModifiers, inlined: sim does not depend on world). */
const ROOTS = ["plains", "island", "swamp", "mountain", "forest"].map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 1 as const, cardId }));

/**
 * S27 fuzz-before-fixtures (the S3 protocol): the Manafleur's words — exile-by-scope (`laws`),
 * `createLaw` on the game-level sequence (sequence / random / accumulate) — under random play with
 * the sixty-card deck against a spread of references, the Manafleur in hand from turn one by the
 * entrance modifier so the cycle fires in real games. Replays byte-identical, random mode included.
 */
describe("S27 heart fuzz — the Manafleur under random play (fuzz-before-fixtures for Part 1)", () => {
  const games = process.env.FUZZ_FULL ? 60 : 12;
  const REFS: [string, { cardId: string; count: number }[]][] = [
    ["lumen", COROLLA_DECKS.lumen!.decklist], ["clio", COROLLA_DECKS.clio!.decklist], ["seraphina", COROLLA_DECKS.seraphina!.decklist],
    ["slice:C", [...DECKS.C.decklist]], ["slice:D", [...DECKS.D.decklist]],
  ];
  const MODES = ["sequence", "random", "accumulate"] as const;
  it(`${games} games x 5 references x 3 law modes: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [name, deck] of REFS) {
      for (const mode of MODES) {
        for (let seed = 1; seed <= games / 3 + 1; seed++) {
          const result = await runMatch(
            { seed: seed * 7 + (mode === "random" ? 1000 : mode === "accumulate" ? 2000 : 0), players: [{ name, decklist: deck, agent: "random" }, { name: "The Manafleur", decklist: HEART_DECK.decklist, agent: "random" }], rules: RULES, modifiers: [{ type: "signatureToHand", player: 1, cardId: "the_manafleur" }, ...ROOTS, { type: "lawSequence", mode }] },
            cards,
            [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)],
          );
          expect(result.reason, `${name}/${mode} seed ${seed}`).toBeTruthy();
        }
      }
    }
  }, 600_000);

  it("heart replay determinism — the law sequence (random mode included) replays byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [mode, seed] of [["sequence", 5], ["random", 9], ["accumulate", 13]] as const) {
      const modifiers = [{ type: "signatureToHand" as const, player: 1 as const, cardId: "the_manafleur" }, ...ROOTS, { type: "lawSequence" as const, mode }];
      const live = await runMatch(
        { seed, players: [{ name: "lumen", decklist: COROLLA_DECKS.lumen!.decklist, agent: "random" }, { name: "heart", decklist: HEART_DECK.decklist, agent: "random" }], rules: RULES, modifiers },
        cards,
        [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)],
      );
      const replayed = await replayGame(
        cards,
        [COROLLA_DECKS.lumen!.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), HEART_DECK.decklist.flatMap((d) => Array(d.count).fill(d.cardId))],
        live.log,
        { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 },
        modifiers,
      );
      expect(replayed, `mode ${mode}`).toBe(live.finalStateSerialized);
    }
  }, 120_000);
});
