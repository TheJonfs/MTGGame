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
 * S56 fuzz-before-fixtures — Protocol (R-105: a control static conditional on the enchanted creature's power). The
 * lists put it beside everything that moves a creature's power or its control while it is attached: anthems on both
 * sides (a creature's power differs by who controls it), pump Auras and Giant Growth, Control Magic and Lumen's
 * threaten (control from another source), bounce and Aura removal (the Aura leaves), and small and large bodies.
 */
export const S56_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "protocol-anthem", decklist: D({ protocol: 4, control_magic: 2, glorious_anthem: 4, savannah_lions: 4, soul_warden: 4, suntail_hawk: 4, serra_angel: 2, boomerang: 4, counterspell: 2, disenchant: 2, tundra: 4, hallowed_fountain: 4, island: 10, plains: 10 }) },
  { name: "protocol-pump", decklist: D({ protocol: 4, rancor: 4, blanchwood_armor: 3, giant_growth: 4, llanowar_elves: 4, grizzly_bears: 4, gaean_wurm: 2, wall_of_blossoms: 4, man_o_war: 3, tropical_island: 4, breeding_pool: 4, forest: 12, island: 8 }) },
  { name: "anthem-weenie", decklist: D({ glorious_anthem: 4, savannah_lions: 4, soul_warden: 4, suntail_hawk: 4, fencing_ace: 4, raise_the_alarm: 4, lumen_the_hearth_fire: 3, lightning_bolt: 4, disenchant: 3, swords_to_plowshares: 2, plateau: 4, sacred_foundry: 4, plains: 10, mountain: 6 }) },
  { name: "goblins", decklist: D({ goblin_chieftain: 4, goblin_piker: 4, boggart_brute: 4, skirk_prospector: 4, siege_gang_commander: 3, hordeling_outburst: 4, goblin_grenade: 4, lightning_bolt: 4, protocol: 4, volcanic_island: 4, steam_vents: 4, mountain: 12, island: 5 }) },
];

describe("S56 fuzz — Protocol (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 16 : 4;
  it(`${games} games × every pair of the four lists (mirrors included) × 2 seats, random; heuristic at a half: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S56_LISTS();
    for (const l of lists) expect(l.decklist.reduce((n, e) => n + e.count, 0), l.name).toBe(60);
    let n = 0;
    for (const a of lists) for (const b of lists) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const players: MatchSpec["players"] = seat === 0 ? [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }] : [{ name: b.name, decklist: b.decklist, agent: "x" }, { name: a.name, decklist: a.decklist, agent: "x" }];
      const s = seed * 41 + seat + 5600 + n;
      const r = await runMatch({ seed: s, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(s * 2 + 1), new RandomAgent(s * 2 + 2)]);
      expect(r.reason, `${a.name} v ${b.name} seat ${seat} seed ${seed}`).toBeTruthy();
      n += 1;
      if (seed % 2 === 0) {
        const h = await runMatch({ seed: s + 7, players, rules: RULES, modifiers: [] }, cards, [new HeuristicAgent(s * 2 + 3, cards, difficultyProfile("master", "midrange", players[1].decklist)), new HeuristicAgent(s * 2 + 4, cards, difficultyProfile("master", "midrange", players[0].decklist))]);
        expect(h.reason).toBeTruthy(); n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(games * lists.length * lists.length * 2);
    console.log(`S56 fuzz: ${n} games`);
  }, 1_800_000);

  it("replay determinism — the Protocol lists replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S56_LISTS();
    for (const [i, a] of lists.entries()) for (const seed of [56, 57, 58]) {
      const b = lists[(i + 1) % lists.length]!;
      const spec: MatchSpec = { seed: seed + i, players: [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }], rules: RULES, modifiers: [] };
      const r = await runMatch(spec, cards, [new RandomAgent(seed), new RandomAgent(seed + 1)]);
      const replayed = await replayGame(cards, [expand(a.decklist), expand(b.decklist)], r.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, `${a.name} v ${b.name} seed ${seed}`).toBe(r.finalStateSerialized);
    }
  }, 300_000);
});
