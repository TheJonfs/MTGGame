import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";
import { OPEN_DECKS } from "./open-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const expand = (d: { cardId: string; count: number }[]) => d.flatMap((e) => Array(e.count).fill(e.cardId) as string[]);

/**
 * S55 fuzz-before-fixtures. Part 1 (R-103, the mandatory-loop draw): the Usher lists against each other and
 * themselves — the mirrors are where two players' drains can cancel — under random and heuristic play; every game
 * terminates, and replays byte-exact (the draw rule is a function of the position alone). Part 3's cards and the Pall
 * join the lists below as they are added.
 */
/** Part 3 (ADR-162): Tormod's Crypt (tap, sacrifice: exile a player's graveyard) and Faerie Macabre (discard it from
 * the hand: exile up to two cards from graveyards — any card, either graveyard, at instant speed) in a graveyard-heavy
 * sixty, so both have targets on both sides. */
export const S55_HATE = Object.entries({ tormods_crypt: 4, faerie_macabre: 4, the_usher: 4, zombify: 4, buried_alive: 4, reassembling_skeleton: 4, vampire_nighthawk: 4, typhoid_rats: 4, doom_blade: 4, badlands: 4, scrubland: 4, swamp: 16 }).map(([cardId, count]) => ({ cardId, count }));
export const S55_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] =>
  [...["loop", "coin", "hearth", "pall"].flatMap((k) => (OPEN_DECKS[k] ? [{ name: k, decklist: OPEN_DECKS[k]!.decklist }] : [])), { name: "hate", decklist: S55_HATE }];

describe("S55 fuzz — the Usher lists and the loop draw (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 20 : 5;
  it(`${games} games × every pair of the Usher lists (mirrors included) × 2 seats, random; heuristic at a half: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S55_LISTS();
    expect(lists.length).toBeGreaterThanOrEqual(3);
    let n = 0, draws = 0;
    for (const a of lists) for (const b of lists) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const players: MatchSpec["players"] = seat === 0 ? [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }] : [{ name: b.name, decklist: b.decklist, agent: "x" }, { name: a.name, decklist: a.decklist, agent: "x" }];
      const s = seed * 37 + seat + 5500 + n;
      const r = await runMatch({ seed: s, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(s * 2 + 1), new RandomAgent(s * 2 + 2)]);
      expect(r.reason, `${a.name} v ${b.name} seat ${seat} seed ${seed}`).toBeTruthy();
      if (r.reason === "DRAW") draws += 1;
      n += 1;
      if (seed % 2 === 0) {
        const h = await runMatch({ seed: s + 7, players, rules: RULES, modifiers: [] }, cards, [new HeuristicAgent(s * 2 + 3, cards, difficultyProfile("master", "midrange", players[1].decklist)), new HeuristicAgent(s * 2 + 4, cards, difficultyProfile("master", "midrange", players[0].decklist))]);
        expect(h.reason).toBeTruthy(); if (h.reason === "DRAW") draws += 1; n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(games * lists.length * lists.length * 2);
    console.log(`S55 fuzz: ${n} games, ${draws} drawn`);
  }, 1_800_000);

  it("replay determinism — the Usher lists replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S55_LISTS();
    for (const [i, a] of lists.entries()) for (const seed of [55, 56]) {
      const b = lists[(i + 1) % lists.length]!;
      const spec: MatchSpec = { seed: seed + i, players: [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }], rules: RULES, modifiers: [] };
      const r = await runMatch(spec, cards, [new RandomAgent(seed), new RandomAgent(seed + 1)]);
      const replayed = await replayGame(cards, [expand(a.decklist), expand(b.decklist)], r.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, `${a.name} v ${b.name} seed ${seed}`).toBe(r.finalStateSerialized);
    }
  }, 300_000);
});
