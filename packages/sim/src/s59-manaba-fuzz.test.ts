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
 * Post-S59 fuzz-before-fixtures — the Manaba (R-107: a mana ability that taps a creature of a kind and carries an effect
 * beyond its mana). The lists put it beside every other Snake (its own cost's fuel: tokens, deathtouchers, the hasty
 * Thundersnake that sacrifices itself), everything that triggers on life gained by either player (Rage Cobra, Vitalist,
 * Soul Warden), the other tap-a-creature cost (Glare of Subdual), an untapper (Seedborn Muse), X spells to pay into
 * and bounce and removal in response.
 */
export const S59M_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "snakes", decklist: D({ manaba: 4, rage_cobra: 4, moss_viper: 4, reapers_forerunner: 4, voracious_cobra: 3, thundersnake: 3, the_reaper: 2, savage_twister: 4, blaze: 3, treetop_snarespinner: 3, lightning_bolt: 4, taiga: 4, stomping_ground: 4, forest: 8, mountain: 6 }) },
  { name: "snake-glare", decklist: D({ manaba: 4, moss_viper: 4, reapers_forerunner: 4, glare_of_subdual: 4, seedborn_muse: 3, vitalist: 4, soul_warden: 4, wall_of_blossoms: 4, swords_to_plowshares: 3, giant_growth: 2, savannah: 4, temple_garden: 4, forest: 10, plains: 6 }) },
  { name: "lifegain", decklist: D({ vitalist: 4, soul_warden: 4, rage_cobra: 4, manaba: 4, grazing_gladehart: 4, spirit_link: 3, lightning_bolt: 4, savannah_lions: 4, serra_angel: 2, boomerang: 3, plateau: 4, taiga: 4, savannah: 4, forest: 4, plains: 4, mountain: 4 }) },
  { name: "burn-bounce", decklist: D({ lightning_bolt: 4, boomerang: 4, man_o_war: 4, manaba: 4, rage_cobra: 4, llanowar_elves: 4, terror: 2, doom_blade: 2, serra_angel: 2, giant_growth: 4, rancor: 4, taiga: 4, stomping_ground: 4, tropical_island: 4, breeding_pool: 2, forest: 8 }) },
];

describe("Post-S59 fuzz — the Manaba (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 16 : 2; // (random play taps Snakes at every priority and the games run long: two by default)
  it(`${games} games × every pair of the four lists (mirrors included) × 2 seats, random; heuristic at a half: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S59M_LISTS();
    for (const l of lists) expect(l.decklist.reduce((n, e) => n + e.count, 0), l.name).toBe(60);
    let n = 0;
    for (const a of lists) for (const b of lists) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const players: MatchSpec["players"] = seat === 0 ? [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }] : [{ name: b.name, decklist: b.decklist, agent: "x" }, { name: a.name, decklist: a.decklist, agent: "x" }];
      const s = seed * 41 + seat + 5950 + n;
      const r = await runMatch({ seed: s, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(s * 2 + 1), new RandomAgent(s * 2 + 2)]);
      expect(r.reason, `${a.name} v ${b.name} seat ${seat} seed ${seed}`).toBeTruthy();
      n += 1;
      if (seed % 2 === 0) {
        const h = await runMatch({ seed: s + 7, players, rules: RULES, modifiers: [] }, cards, [new HeuristicAgent(s * 2 + 3, cards, difficultyProfile("master", "midrange", players[1].decklist)), new HeuristicAgent(s * 2 + 4, cards, difficultyProfile("master", "midrange", players[0].decklist))]);
        expect(h.reason).toBeTruthy(); n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(games * lists.length * lists.length * 2);
    console.log(`Manaba fuzz: ${n} games`);
  }, 1_800_000);

  it("replay determinism — the Manaba lists replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S59M_LISTS();
    for (const [i, a] of lists.entries()) for (const seed of [56, 57, 58]) {
      const b = lists[(i + 1) % lists.length]!;
      const spec: MatchSpec = { seed: seed + i, players: [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }], rules: RULES, modifiers: [] };
      const r = await runMatch(spec, cards, [new RandomAgent(seed), new RandomAgent(seed + 1)]);
      const replayed = await replayGame(cards, [expand(a.decklist), expand(b.decklist)], r.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, `${a.name} v ${b.name} seed ${seed}`).toBe(r.finalStateSerialized);
    }
  }, 300_000);
});
