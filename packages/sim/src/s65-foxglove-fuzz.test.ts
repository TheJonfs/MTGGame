import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
/** A card under study lives outside the pool (data/cards-proposed) until Chris adopts it. */
const withDose = <T extends Map<string, unknown>>(m: T): T => { m.set("foxglove_dose", JSON.parse(readFileSync(join(CARDS_DIR, "../cards-proposed/foxglove_dose.json"), "utf8"))); return m; };
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const expand = (d: { cardId: string; count: number }[]) => d.flatMap((e) => Array(e.count).fill(e.cardId) as string[]);
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));

/**
 * Post-S65 fuzz-before-fixtures — Foxglove Dose (R-112: an `if` clause on its target's power, read after the pump in the
 * same resolution). The lists put it beside everything that changes a power while it is on the stack or as it
 * resolves (Giant Growth, Rancor, anthems, the Chieftain's lord bonus, +1/+1 counters from the Cobra), a steal (Lumen),
 * creatures that leave something when destroyed (Penumbra Wurm, the Mentor's return, Dragon Fodder's tokens), and the
 * big bodies its kill reads on (Pelakka, Gaean, the Courser, the Brute).
 */
export const S65F_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "dose-goblins", decklist: D({ foxglove_dose: 4, goblin_chieftain: 4, raging_goblin: 4, dragon_fodder: 4, boggart_brute: 4, lightning_bolt: 4, giant_growth: 4, rancor: 4, taiga: 4, mountain: 14, forest: 6, llanowar_elves: 4 }) },
  { name: "dose-naya", decklist: D({ foxglove_dose: 4, lumen_the_hearth_fire: 4, rage_cobra: 4, manaba: 4, karmic_mentor: 4, restoration_angel: 4, glorious_anthem: 4, plateau: 4, taiga: 4, savannah: 4, mountain: 4, plains: 6, forest: 6, centaur_courser: 4 }) },
  { name: "fatties", decklist: D({ penumbra_wurm: 4, pelakka_wurm: 4, gaean_wurm: 4, centaur_courser: 4, llanowar_elves: 4, prey_upon: 4, giant_growth: 4, forest: 24, foxglove_dose: 4, taiga: 4 }) },
];

describe("Post-S65 fuzz — Foxglove Dose (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 16 : 4;
  it(`${games} games × every pair of the three lists (mirrors included) × 2 seats, random; heuristic at a half: zero exceptions, every game terminates`, async () => {
    const cards = withDose(loadCardPool(CARDS_DIR).cards), lists = S65F_LISTS();
    for (const l of lists) expect(l.decklist.reduce((n, e) => n + e.count, 0), l.name).toBe(60);
    let n = 0;
    for (const a of lists) for (const b of lists) for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
      const players: MatchSpec["players"] = seat === 0 ? [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }] : [{ name: b.name, decklist: b.decklist, agent: "x" }, { name: a.name, decklist: a.decklist, agent: "x" }];
      const s = seed * 41 + seat + 6550 + n;
      const r = await runMatch({ seed: s, players, rules: RULES, modifiers: [] }, cards, [new RandomAgent(s * 2 + 1), new RandomAgent(s * 2 + 2)]);
      expect(r.reason, `${a.name} v ${b.name} seat ${seat} seed ${seed}`).toBeTruthy();
      n += 1;
      if (seed % 2 === 0) {
        const h = await runMatch({ seed: s + 7, players, rules: RULES, modifiers: [] }, cards, [new HeuristicAgent(s * 2 + 3, cards, difficultyProfile("master", "midrange", players[1].decklist)), new HeuristicAgent(s * 2 + 4, cards, difficultyProfile("master", "midrange", players[0].decklist))]);
        expect(h.reason).toBeTruthy(); n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(games * lists.length * lists.length * 2);
    console.log(`Foxglove fuzz: ${n} games`);
  }, 1_800_000);

  it("replay determinism — the Foxglove lists replay byte-identical", async () => {
    const cards = withDose(loadCardPool(CARDS_DIR).cards), lists = S65F_LISTS();
    for (const [i, a] of lists.entries()) for (const seed of [56, 57, 58]) {
      const b = lists[(i + 1) % lists.length]!;
      const spec: MatchSpec = { seed: seed + i, players: [{ name: a.name, decklist: a.decklist, agent: "x" }, { name: b.name, decklist: b.decklist, agent: "x" }], rules: RULES, modifiers: [] };
      const r = await runMatch(spec, cards, [new RandomAgent(seed), new RandomAgent(seed + 1)]);
      const replayed = await replayGame(cards, [expand(a.decklist), expand(b.decklist)], r.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, `${a.name} v ${b.name} seed ${seed}`).toBe(r.finalStateSerialized);
    }
  }, 300_000);
});
