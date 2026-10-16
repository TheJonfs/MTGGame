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
 * Post-S65 fuzz-before-fixtures — Tidal Shackle (R-113: a stun counter replaces an untap, CR 122.1d — the one untap
 * helper). The lists put it beside everything that untaps or taps: Seedborn Muse (an untap on the other's step), Little
 * Bear and Lumen (effects that untap), mana creatures and Manaba's tapped Snakes, vigilance (Serra), the Tactician's
 * tap, bounce and blink that reset a stunned creature (Man-o'-War, Restoration Angel), and a steal (Lumen) of a stunned one.
 */
export const S65S_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "shackle-ug", decklist: D({ tidal_shackle: 4, little_bear: 4, seedborn_muse: 2, llanowar_elves: 4, birds_of_paradise: 4, man_o_war: 4, air_elemental: 2, counterspell: 2, tropical_island: 4, island: 12, forest: 10, centaur_courser: 4, giant_growth: 4 }) },
  { name: "shackle-naya", decklist: D({ tidal_shackle: 4, lumen_the_hearth_fire: 4, manaba: 4, rage_cobra: 4, restoration_angel: 4, cunning_tactician: 4, serra_angel: 4, plateau: 4, volcanic_island: 4, tropical_island: 4, savannah: 4, island: 4, mountain: 4, plains: 4, forest: 4 }) },
  { name: "fatties", decklist: D({ pelakka_wurm: 4, centaur_courser: 4, llanowar_elves: 4, giant_growth: 4, seedborn_muse: 2, little_bear: 4, forest: 24, tidal_shackle: 4, tropical_island: 4, island: 6 }) },
];

describe("Post-S65 fuzz — Tidal Shackle (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 16 : 4;
  it(`${games} games × every pair of the three lists (mirrors included) × 2 seats, random; heuristic at a half: zero exceptions, every game terminates`, async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S65S_LISTS();
    for (const l of lists) expect(l.decklist.reduce((n, e) => n + e.count, 0), l.name).toBe(60);
    let n = 0;
    for (const a of lists) for (const b of lists) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const players: MatchSpec["players"] = seat === 0 ? [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }] : [{ name: b.name, decklist: b.decklist, agent: "x" }, { name: a.name, decklist: a.decklist, agent: "x" }];
      const s = seed * 41 + seat + 6560 + n;
      const r = await runMatch({ seed: s, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(s * 2 + 1), new RandomAgent(s * 2 + 2)]);
      expect(r.reason, `${a.name} v ${b.name} seat ${seat} seed ${seed}`).toBeTruthy();
      n += 1;
      if (seed % 2 === 0) {
        const h = await runMatch({ seed: s + 7, players, rules: RULES, modifiers: [] }, cards, [new HeuristicAgent(s * 2 + 3, cards, difficultyProfile("master", "midrange", players[1].decklist)), new HeuristicAgent(s * 2 + 4, cards, difficultyProfile("master", "midrange", players[0].decklist))]);
        expect(h.reason).toBeTruthy(); n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(games * lists.length * lists.length * 2);
    console.log(`Shackle fuzz: ${n} games`);
  }, 1_800_000);

  it("replay determinism — the Shackle lists replay byte-identical", async () => {
    const cards = loadCardPool(CARDS_DIR).cards, lists = S65S_LISTS();
    for (const [i, a] of lists.entries()) for (const seed of [56, 57, 58]) {
      const b = lists[(i + 1) % lists.length]!;
      const spec: MatchSpec = { seed: seed + i, players: [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }], rules: RULES, modifiers: [] };
      const r = await runMatch(spec, cards, [new RandomAgent(seed), new RandomAgent(seed + 1)]);
      const replayed = await replayGame(cards, [expand(a.decklist), expand(b.decklist)], r.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, `${a.name} v ${b.name} seed ${seed}`).toBe(r.finalStateSerialized);
    }
  }, 300_000);
});
