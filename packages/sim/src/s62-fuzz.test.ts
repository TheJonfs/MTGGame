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
 * S62 fuzz-before-fixtures — the ten cards of ADR-177 (Peasant's round). The lists put each beside what it touches:
 * Wave of Reckoning (R-108: each creature damages itself by its power) among deathtouch and lifelink creatures, pumps
 * (Giant Growth in response, the Anthem, the Marshal's team pump), a 0-power wall and a creature whose power is a
 * count (Dungrove Elder, Gaean Wurm); Penumbra Wurm with sacrifice outlets, sweepers and reanimation (the token dies
 * for good); Captain of the Watch among other Soldiers and token makers; Moaning Wall's cycling; Tome Scour and Sign
 * in Blood at either player; Harmonize; Longbow Archer's first strike and reach against fliers.
 */
export const S62_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "wave", decklist: D({ wave_of_reckoning: 4, typhoid_rats: 4, child_of_night: 4, vampire_nighthawk: 4, moaning_wall: 4, wall_of_blossoms: 3, dawnwing_marshal: 4, glorious_anthem: 3, sign_in_blood: 4, swords_to_plowshares: 2, godless_shrine: 4, temple_garden: 2, plains: 9, swamp: 9 }) },
  { name: "green", decklist: D({ dungrove_elder: 4, penumbra_wurm: 4, harmonize: 4, gaean_wurm: 3, llanowar_elves: 4, birds_of_paradise: 4, giant_growth: 4, rancor: 3, blanchwood_armor: 2, altar_of_dementia: 3, wall_of_blossoms: 3, forest: 22 }) },
  { name: "soldiers", decklist: D({ captain_of_the_watch: 4, longbow_archer: 4, dawnwing_marshal: 4, raise_the_alarm: 4, savannah_lions: 4, soul_warden: 4, wave_of_reckoning: 3, pyroclasm: 2, lightning_bolt: 4, restoration_angel: 3, sacred_foundry: 4, plains: 14, mountain: 6 }) },
  { name: "mill-rise", decklist: D({ tome_scour: 4, hedron_crab: 4, thought_scour: 4, sign_in_blood: 4, moaning_wall: 4, penumbra_wurm: 3, zombify: 4, buried_alive: 3, unearth: 2, doom_blade: 3, traumatizer: 3, watery_grave: 4, island: 9, swamp: 9 }) },
  // post-S62 (Chris's two for the Elder round): Dazzling Angel's gain on our own creatures entering (tokens, a blinked
  // Angel, a returned Skeleton) beside Soul Warden's, the Valkyrie and the Vitalist that grow on it; Wall of Reverence's
  // optional end-step gain by a target creature's power — pumped, enchanted, shrunk by a Protocol, or gone in response
  { name: "sisters", decklist: D({ dazzling_angel: 4, wall_of_reverence: 4, soul_warden: 4, youthful_valkyrie: 4, vitalist: 3, raise_the_alarm: 4, restoration_angel: 3, blood_artist: 3, reassembling_skeleton: 3, child_of_night: 3, swords_to_plowshares: 2, godless_shrine: 4, plains: 11, swamp: 8 }) },
];

describe("S62 fuzz — the ten cards of ADR-177 and the two after (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 20 : 4;
  it(`${games} games × every pair of the five lists (mirrors included) × 2 seats, random; heuristic at a half: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S62_LISTS();
    for (const l of lists) expect(l.decklist.reduce((n, e) => n + e.count, 0), l.name).toBe(60);
    let n = 0;
    for (const a of lists) for (const b of lists) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const players: MatchSpec["players"] = seat === 0 ? [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }] : [{ name: b.name, decklist: b.decklist, agent: "x" }, { name: a.name, decklist: a.decklist, agent: "x" }];
      const s = seed * 41 + seat + 6200 + n;
      const r = await runMatch({ seed: s, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(s * 2 + 1), new RandomAgent(s * 2 + 2)]);
      expect(r.reason, `${a.name} v ${b.name} seat ${seat} seed ${seed}`).toBeTruthy();
      n += 1;
      if (seed % 2 === 0) {
        const h = await runMatch({ seed: s + 7, players, rules: RULES, modifiers: [] }, cards, [new HeuristicAgent(s * 2 + 3, cards, difficultyProfile("master", "midrange", players[1].decklist)), new HeuristicAgent(s * 2 + 4, cards, difficultyProfile("master", "midrange", players[0].decklist))]);
        expect(h.reason).toBeTruthy(); n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(games * lists.length * lists.length * 2);
    console.log(`S62 fuzz: ${n} games`);
  }, 1_800_000);

  it("replay determinism — the S62 lists replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S62_LISTS();
    for (const [i, a] of lists.entries()) for (const seed of [62, 63, 64]) {
      const b = lists[(i + 1) % lists.length]!;
      const spec: MatchSpec = { seed: seed + i, players: [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }], rules: RULES, modifiers: [] };
      const r = await runMatch(spec, cards, [new RandomAgent(seed), new RandomAgent(seed + 1)]);
      const replayed = await replayGame(cards, [expand(a.decklist), expand(b.decklist)], r.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, `${a.name} v ${b.name} seed ${seed}`).toBe(r.finalStateSerialized);
    }
  }, 300_000);
});
