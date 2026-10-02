import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";
import { MAGE_DECKS } from "./mage-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));

/**
 * S50 fuzz-before-fixtures (ADR-149, red for Limited): Flametongue Kavu (a mandatory enters-damage at any creature —
 * its own side's or itself when the board is otherwise empty), Furnace Whelp (a repeatable self-pump), Shocking
 * Sharpshooter (an own-side enters-watcher pinging the opponent — tokens count), Dragon Fodder, Seasoned Pyromancer
 * (discard two, draw two, a token per nonland discarded — R-102; the graveyard activation) and Rage Cobra (the
 * opponent's life gain) — in two mixed forty-card lists, one with the lifegain the Cobra watches, against each other
 * and against four mages, under random and heuristic play.
 */
export const S50_RED = D({ mountain: 17, flametongue_kavu: 4, furnace_whelp: 4, shocking_sharpshooter: 4, dragon_fodder: 4, seasoned_pyromancer: 4, rage_cobra: 3 });
export const S50_MIXED = D({ mountain: 9, plains: 8, flametongue_kavu: 3, furnace_whelp: 2, shocking_sharpshooter: 3, dragon_fodder: 3, seasoned_pyromancer: 3, rage_cobra: 3, soul_warden: 4, spirit_link: 2 });

describe("S50 fuzz — red for Limited: the Kavu, the Whelp, the Sharpshooter, the Fodder, the Pyromancer, the Cobra (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 40 : 10;
  const refs = ["oriel", "tessaly", "edric", "hask"].map((k) => MAGE_DECKS[k]!).filter(Boolean);
  const lists = [{ name: "red", decklist: S50_RED }, { name: "mixed", decklist: S50_MIXED }, ...refs.map((m) => ({ name: m.name, decklist: m.decklist }))];
  it(`${games} games × the two lists × six opponents × 2 seats, random; and heuristic at a third: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const l of lists.slice(0, 2)) { expect(l.decklist.reduce((n, e) => n + e.count, 0)).toBe(40); for (const e of l.decklist) expect(cards.has(e.cardId), e.cardId).toBe(true); }
    let n = 0;
    for (const a of lists.slice(0, 2)) for (const b of lists) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const players: MatchSpec["players"] = seat === 0 ? [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }] : [{ name: b.name, decklist: b.decklist, agent: "x" }, { name: a.name, decklist: a.decklist, agent: "x" }];
      const s = seed * 31 + seat + 5000 + n;
      const r = await runMatch({ seed: s, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(s * 2 + 1), new RandomAgent(s * 2 + 2)]);
      expect(r.reason, `${a.name} v ${b.name} seat ${seat} seed ${seed}`).toBeTruthy();
      n += 1;
      if (seed % 3 === 0) {
        const h = await runMatch({ seed: s + 7, players, rules: RULES, modifiers: [] }, cards, [new HeuristicAgent(s * 2 + 3, cards, difficultyProfile("master", "midrange", players[1].decklist)), new HeuristicAgent(s * 2 + 4, cards, difficultyProfile("master", "midrange", players[0].decklist))]);
        expect(h.reason).toBeTruthy(); n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(games * 24);
  }, 900_000);

  it("replay determinism — the two lists replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards;
    for (const seed of [50, 51, 52]) {
      const spec: MatchSpec = { seed, players: [{ name: "red", decklist: S50_RED, agent: "x" }, { name: "mixed", decklist: S50_MIXED, agent: "x" }], rules: RULES, modifiers: [] };
      const r = await runMatch(spec, cards, [new RandomAgent(seed), new RandomAgent(seed + 1)]);
      const expand = (d: { cardId: string; count: number }[]) => d.flatMap((e) => Array(e.count).fill(e.cardId) as string[]);
      const replayed = await replayGame(cards, [expand(S50_RED), expand(S50_MIXED)], r.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed).toBe(r.finalStateSerialized);
    }
  }, 120_000);
});
