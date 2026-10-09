import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const expand = (d: { cardId: string; count: number }[]) => d.flatMap((e) => Array(e.count).fill(e.cardId) as string[]);
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));

/**
 * Post-S58 fuzz-before-fixtures — Reaper's Forerunner (R-106: a modal enters trigger whose first mode is the source
 * fighting a target). The lists put it beside everything that moves the source or the target while the trigger is on
 * the stack (bounce, removal, a blink), everything that fills and uses a graveyard (Buried Alive, Entomb, Zombify,
 * Unearth, Gravedigger, the Usher), the other graveyard exiles, anthems and pumps on the fighters, and a flash save.
 */
export const S58F_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "forerunner-rock", decklist: D({ reapers_forerunner: 4, the_reaper: 2, llanowar_elves: 4, wall_of_blossoms: 4, gravedigger: 3, unearth: 3, doom_blade: 3, rancor: 3, giant_growth: 3, prey_upon: 3, tormods_crypt: 2, bayou: 4, overgrown_tomb: 4, forest: 10, swamp: 8 }) },
  { name: "forerunner-tempo", decklist: D({ reapers_forerunner: 4, man_o_war: 4, boomerang: 4, restoration_angel: 3, plumecreed_escort: 3, glorious_anthem: 3, llanowar_elves: 4, elvish_visionary: 4, swords_to_plowshares: 3, giant_growth: 2, tropical_island: 4, savannah: 4, temple_garden: 4, breeding_pool: 4, forest: 6, island: 2, plains: 2 }) },
  { name: "reanimator", decklist: D({ buried_alive: 4, entomb: 4, zombify: 4, unearth: 4, dark_ritual: 4, the_usher: 3, artisan_of_kozilek: 2, serra_angel: 2, gravedigger: 4, faerie_macabre: 3, terror: 3, lightning_bolt: 3, swamp: 20 }) },
  { name: "burn-bounce", decklist: D({ lightning_bolt: 4, boomerang: 4, man_o_war: 4, reapers_forerunner: 4, llanowar_elves: 4, terror: 2, doom_blade: 2, serra_angel: 2, restoration_angel: 2, giant_growth: 4, rancor: 4, taiga: 4, stomping_ground: 4, tropical_island: 4, breeding_pool: 4, forest: 8 }) },
];

describe("Post-S58 fuzz — Reaper's Forerunner (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 16 : 4;
  it(`${games} games × every pair of the four lists (mirrors included) × 2 seats, random; heuristic at a half: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S58F_LISTS();
    for (const l of lists) expect(l.decklist.reduce((n, e) => n + e.count, 0), l.name).toBe(60);
    let n = 0;
    for (const a of lists) for (const b of lists) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const players: MatchSpec["players"] = seat === 0 ? [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }] : [{ name: b.name, decklist: b.decklist, agent: "x" }, { name: a.name, decklist: a.decklist, agent: "x" }];
      const s = seed * 41 + seat + 5850 + n;
      const r = await runMatch({ seed: s, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(s * 2 + 1), new RandomAgent(s * 2 + 2)]);
      expect(r.reason, `${a.name} v ${b.name} seat ${seat} seed ${seed}`).toBeTruthy();
      n += 1;
      if (seed % 2 === 0) {
        const h = await runMatch({ seed: s + 7, players, rules: RULES, modifiers: [] }, cards, [new HeuristicAgent(s * 2 + 3, cards, difficultyProfile("master", "midrange", players[1].decklist)), new HeuristicAgent(s * 2 + 4, cards, difficultyProfile("master", "midrange", players[0].decklist))]);
        expect(h.reason).toBeTruthy(); n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(games * lists.length * lists.length * 2);
    console.log(`Forerunner fuzz: ${n} games`);
  }, 1_800_000);

  it("replay determinism — the Forerunner lists replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S58F_LISTS();
    for (const [i, a] of lists.entries()) for (const seed of [56, 57, 58]) {
      const b = lists[(i + 1) % lists.length]!;
      const spec: MatchSpec = { seed: seed + i, players: [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }], rules: RULES, modifiers: [] };
      const r = await runMatch(spec, cards, [new RandomAgent(seed), new RandomAgent(seed + 1)]);
      const replayed = await replayGame(cards, [expand(a.decklist), expand(b.decklist)], r.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, `${a.name} v ${b.name} seed ${seed}`).toBe(r.finalStateSerialized);
    }
  }, 300_000);
});
