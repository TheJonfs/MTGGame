import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { MAGE_DECKS } from "./mage-decks.js";
import { EXPANSION_DECKS } from "./expansion-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };

/**
 * S29 fuzz-before-fixtures (the S3 protocol): the fifteen mage decks (ADR-099) and the six adds
 * (ADR-101 — Soul Warden's observer, the Crab's landfall mill, the Pyromancer's cast trigger, Arc
 * Mage's MODAL activation, the Altar's sacrificedPower, Blanchwood's Forest count) under random play,
 * every deck both seats against a beast and against another mage; replays byte-identical.
 */
describe("S29 mage fuzz — the fifteen decks under random play (fuzz-before-fixtures for Part 6)", () => {
  const games = process.env.FUZZ_FULL ? 12 : 3;
  const keys = Object.keys(MAGE_DECKS);
  it(`${games} games × 15 mages × 2 references × 2 seats: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [k, mage] of Object.entries(MAGE_DECKS)) {
      for (const e of mage.decklist) expect(cards.has(e.cardId), `${mage.name}: ${e.cardId}`).toBe(true);
      expect(mage.decklist.reduce((n, e) => n + e.count, 0), mage.name).toBe(40);
      const other = MAGE_DECKS[keys[(keys.indexOf(k) + 7) % keys.length]!]!;
      const beast = Object.values(EXPANSION_DECKS)[keys.indexOf(k) % 16]!;
      for (const [refName, ref] of [[other.name, other.decklist], [beast.name, beast.decklist]] as const) {
        for (let seed = 1; seed <= games; seed++) {
          for (const seat of [0, 1] as const) {
            const players: MatchSpec["players"] = seat === 0
              ? [{ name: mage.name, decklist: mage.decklist, agent: "random" }, { name: refName, decklist: ref, agent: "random" }]
              : [{ name: refName, decklist: ref, agent: "random" }, { name: mage.name, decklist: mage.decklist, agent: "random" }];
            const result = await runMatch({ seed: seed * 13 + seat, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
            expect(result.reason, `${mage.name} vs ${refName} seat ${seat} seed ${seed}`).toBeTruthy();
          }
        }
      }
    }
  }, 900_000);

  it("mage replay determinism — three decks with the new words replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [k, seed] of [["brann", 3], ["tessaly", 5], ["hask", 8]] as const) {
      const mage = MAGE_DECKS[k]!;
      const ref = MAGE_DECKS.edric!;
      const live = await runMatch(
        { seed, players: [{ name: mage.name, decklist: mage.decklist, agent: "random" }, { name: ref.name, decklist: ref.decklist, agent: "random" }], rules: RULES, modifiers: [] },
        cards,
        [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)],
      );
      const replayed = await replayGame(cards, [mage.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), ref.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, k).toBe(live.finalStateSerialized);
    }
  });
});
