import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { readFileSync } from "node:fs";
import { MAGE_DECKS } from "./mage-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const CARDS_DIR = join(ROOT, "data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };

/**
 * S31 fuzz-before-fixtures (the S3 protocol): the retexted Traumatizer (ADR-107 — the controller-wide
 * creature trigger, who:"eventPlayer"), Artisan of Kozilek (the stack-zone cast trigger, the edict
 * word — annihilator 2), Grazing Gladehart, the four amended mage lists and the five amended starters
 * (ADR-106) under random play: every mage against a starter and against another mage, both seats;
 * the starters against each other; replays byte-identical.
 */
describe("S31 fuzz — the Traumatizer's new shape, the Artisan's words, the amended lists (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 12 : 3;
  const keys = Object.keys(MAGE_DECKS);
  it(`${games} games × 15 mages × 2 references × 2 seats + the starters' round-robin: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    // The starters straight from the catalog file (sim never imports world — the dependency runs the other way).
    const starters = (JSON.parse(readFileSync(join(ROOT, "data/world/starters.json"), "utf8")) as { starters: { id: string; name: string; decklist: { cardId: string; count: number }[] }[] }).starters;
    for (const s of starters) {
      for (const e of s.decklist) expect(cards.has(e.cardId), `${s.name}: ${e.cardId}`).toBe(true);
      expect(s.decklist.reduce((n, e) => n + e.count, 0), s.name).toBe(30);
    }
    for (const [k, mage] of Object.entries(MAGE_DECKS)) {
      for (const e of mage.decklist) expect(cards.has(e.cardId), `${mage.name}: ${e.cardId}`).toBe(true);
      expect(mage.decklist.reduce((n, e) => n + e.count, 0), mage.name).toBe(40);
      const other = MAGE_DECKS[keys[(keys.indexOf(k) + 5) % keys.length]!]!;
      const starter = starters[keys.indexOf(k) % starters.length]!;
      for (const [refName, ref] of [[other.name, other.decklist], [`starter:${starter.id}`, starter.decklist]] as const) {
        for (let seed = 1; seed <= games; seed++) {
          for (const seat of [0, 1] as const) {
            const players: MatchSpec["players"] = seat === 0
              ? [{ name: mage.name, decklist: mage.decklist, agent: "random" }, { name: refName, decklist: ref, agent: "random" }]
              : [{ name: refName, decklist: ref, agent: "random" }, { name: mage.name, decklist: mage.decklist, agent: "random" }];
            const result = await runMatch({ seed: seed * 17 + seat + 3100, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
            expect(result.reason, `${mage.name} vs ${refName} seat ${seat} seed ${seed}`).toBeTruthy();
          }
        }
      }
    }
    for (let i = 0; i < starters.length; i++) {
      for (let j = i + 1; j < starters.length; j++) {
        for (let seed = 1; seed <= games; seed++) {
          const a = starters[i]!, b = starters[j]!;
          const result = await runMatch({ seed: seed * 19 + i * 5 + j, players: [{ name: a.name, decklist: a.decklist, agent: "random" }, { name: b.name, decklist: b.decklist, agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
          expect(result.reason, `${a.name} vs ${b.name} seed ${seed}`).toBeTruthy();
        }
      }
    }
  }, 900_000);

  it("replay determinism — the decks with the new words (Tessaly, Pell, Corvane) replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const [k, seed] of [["tessaly", 31], ["pell", 32], ["corvane", 33], ["quill", 34]] as const) {
      const mage = MAGE_DECKS[k]!;
      const ref = MAGE_DECKS.ysolde!;
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
