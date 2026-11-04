import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
/** Four black lists, against walls, small squares, large squares and a ramp list. */
const LISTS: [string, string][] = [["peasant", "mbc"], ["peasant", "br"], ["peasant", "bw"], ["open", "reaperclio"]];
const FOES: [string, string][] = [["peasant", "skieswall"], ["peasant", "rabble"], ["peasant", "stompy"], ["open", "wurmspeaker"]];
function withFour(f: string, k: string, cards: Map<string, { types: string[] }>) {
  const l = FORMAT_FIELD[f]?.[k]; if (!l) throw new Error(`no list ${f}:${k}`);
  const list = l.decklist.map((e) => ({ ...e }));
  let need = 4;
  for (const e of list) { if (need <= 0) break; if (e.count < 2 || cards.get(e.cardId)!.types.includes("Land")) continue; const t = Math.min(e.count, need); e.count -= t; need -= t; }
  return { name: l.name, decklist: [...list.filter((e) => e.count > 0), { cardId: "confession", count: 4 }] };
}
/** Counts the casts, and what they were aimed at. */
class Counter implements Agent {
  casts = 0; tall = 0; // casts at a creature with more toughness than power
  constructor(private readonly inner: Agent, private readonly _defs: unknown) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, request);
    if (a.type === "castSpell" && view.hand.find((h) => h.objectId === a.objectId)?.cardId === "confession") {
      this.casts++;
      const t = a.targets[0], o = t?.kind === "object" ? view.battlefield.find((b) => b.id === t.id) : undefined;
      if (o && (o.toughness ?? 0) > (o.power ?? 0)) this.tall++;
    }
    return a;
  }
}

/** Post-S70 fuzz-before-fixtures (Confession, R-124): four copies in four black lists against walls, small and large squares, and a ramp list, both
 * seats, random agents and the heuristic. Zero exceptions, every game terminates, casts (some at a body of more toughness than power); replays
 * byte-identical. Smoke: 4 pairings × 2 seats × 2 agent kinds × 1 seed (16 games); FUZZ_FULL: 20 seeds (320 games). */
describe("Post-S70 fuzz — Confession (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 20 : 1;
  it(`${games} games × 4 pairings × 2 seats × 2 agents`, async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    let casts = 0, tall = 0;
    for (let i = 0; i < LISTS.length; i++) {
      const me = withFour(...LISTS[i]!, cards), [of, ok] = FOES[i]!, o = FORMAT_FIELD[of]![ok]!;
      expect(me.decklist.reduce((n, e) => n + e.count, 0), me.name).toBe(60);
      for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) for (const kind of ["random", "heuristic"] as const) {
        const mk = (s: number): Agent => (kind === "random" ? new RandomAgent(s) : new HeuristicAgent(s, cards, difficultyProfile("master", "aggro", [])));
        const c = new Counter(mk(seed * 2 + 1 + seat), cards);
        const a = { name: me.name, decklist: me.decklist, agent: kind }, b = { name: o.name, decklist: o.decklist, agent: kind };
        const agents: [Agent, Agent] = seat === 0 ? [c, mk(seed * 2 + 2)] : [mk(seed * 2 + 2), c];
        const r = await runMatch({ seed: seed * 67 + seat + 8100 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: [] }, cards, agents);
        expect(r.reason, `${me.name} seat ${seat} seed ${seed} ${kind}`).toBeTruthy();
        casts += c.casts; tall += c.tall;
      }
    }
    if (process.env.FUZZ_FULL) console.log(`confession: ${casts} casts, ${tall} at toughness over power, in ${LISTS.length * games * 4} games`);
    expect(casts).toBeGreaterThan(0);
  }, 1_800_000);
  it("replay determinism — a game of each pairing replays byte-identical", async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    for (let i = 0; i < LISTS.length; i++) {
      const me = withFour(...LISTS[i]!, cards), o = FORMAT_FIELD[FOES[i]![0]]![FOES[i]![1]]!, seed = 130 + i;
      const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: o.name, decklist: o.decklist, agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), o.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, me.name).toBe(live.finalStateSerialized);
    }
  }, 600_000);
});
