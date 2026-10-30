import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
/** Each card in the lists of its colour; the extras are what it wants beside it (the Quartermaster's Equipment). */
const SEATS: Record<string, { lists: [string, string][]; extra?: { cardId: string; count: number }[] }> = {
  shevelport_quartermaster: { lists: [["peasant", "wskies"], ["open", "muster"], ["naya", "tokens"], ["abzan", "wskies"]], extra: [{ cardId: "bonesplitter", count: 2 }, { cardId: "loxodon_warhammer", count: 2 }] },
  burnfallow_exuberant: { lists: [["open", "rabble"], ["mardu", "burn"], ["naya", "warband"], ["grixis", "kindling"]] },
  notion_flayer: { lists: [["esper", "tempo"], ["sultai", "mill"], ["open", "writ"], ["bant", "skies"]] },
  den_of_vipers: { lists: [["open", "reaperclio"], ["jund", "emeraldsnakes"], ["sultai", "massocrafts"], ["jund", "bfh"]] },
  sapwell_dryad: { lists: [["open", "wurmspeaker"], ["temur", "ramp"], ["jund", "stompy"], ["bant", "sower"]] },
};
function withFour(f: string, k: string, card: string, cards: Map<string, { types: string[] }>, extra: { cardId: string; count: number }[] = []) {
  const l = FORMAT_FIELD[f]?.[k]; if (!l) throw new Error(`no list ${f}:${k}`);
  const fours = l.decklist.filter((e) => e.count >= 2 && !cards.get(e.cardId)!.types.includes("Land") && !extra.some((x) => x.cardId === e.cardId));
  let need = 4 + extra.reduce((n, e) => n + e.count, 0);
  const list = l.decklist.map((e) => ({ ...e }));
  for (const f4 of fours) { if (need <= 0) break; const e = list.find((x) => x.cardId === f4.cardId)!, t = Math.min(e.count, need); e.count -= t; need -= t; }
  const decklist = [...list.filter((e) => e.count > 0 && !extra.some((x) => x.cardId === e.cardId)), { cardId: card, count: 4 }, ...extra];
  return { name: l.name, decklist };
}
/** Counts the casts, and the Dryad's activations. */
class Counter implements Agent {
  casts = 0; acts = 0;
  constructor(private readonly inner: RandomAgent, private readonly card: string) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, request);
    if (a.type === "castSpell" && view.hand.find((h) => h.objectId === a.objectId)?.cardId === this.card) this.casts++;
    if (a.type === "activateAbility" && view.battlefield.find((o) => o.id === a.objectId)?.cardId === this.card) this.acts++;
    return a;
  }
}

/** Post-S70 fuzz-before-fixtures (Chris's five tier-2 creatures): four copies in four lists of each card's colour, against
 * the next list along, both seats. Zero exceptions, every game terminates, cast; replays byte-identical. FUZZ_FULL: 8 seeds (160 games). */
describe("Post-S70 fuzz — the five tier-2 creatures (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 8 : 1;
  it(`${games} games × 5 cards × 4 lists × 2 seats`, async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    for (const [card, { lists, extra }] of Object.entries(SEATS)) {
      let casts = 0, acts = 0;
      for (let i = 0; i < lists.length; i++) {
        const me = withFour(...lists[i]!, card, cards, extra), [of, ok] = lists[(i + 1) % lists.length]!, o = FORMAT_FIELD[of]![ok]!;
        expect(me.decklist.reduce((n, e) => n + e.count, 0), me.name).toBe(l60(lists[i]!));
        for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
          const a = { name: me.name, decklist: me.decklist, agent: "random" as const }, b = { name: o.name, decklist: o.decklist, agent: "random" as const };
          const c = new Counter(new RandomAgent(seed * 2 + 1 + seat), card);
          const agents: [Agent, Agent] = seat === 0 ? [c, new RandomAgent(seed * 2 + 2)] : [new RandomAgent(seed * 2 + 2), c];
          const r = await runMatch({ seed: seed * 61 + seat + 7700 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: [] }, cards, agents);
          expect(r.reason, `${card} in ${me.name} seat ${seat} seed ${seed}`).toBeTruthy();
          casts += c.casts; acts += c.acts;
        }
      }
      if (process.env.FUZZ_FULL) console.log(`${card}: ${casts} casts, ${acts} activations in ${lists.length * games * 2} games`);
      expect(casts, card).toBeGreaterThan(0);
    }
  }, 1_800_000);
  it("replay determinism — a game of each replays byte-identical", async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    for (const [i, [card, { lists, extra }]] of Object.entries(SEATS).entries()) {
      const me = withFour(...lists[0]!, card, cards, extra), o = FORMAT_FIELD[lists[1]![0]]![lists[1]![1]]!, seed = 110 + i;
      const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: o.name, decklist: o.decklist, agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), o.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, card).toBe(live.finalStateSerialized);
    }
  }, 600_000);
});
const l60 = ([f, k]: [string, string]) => FORMAT_FIELD[f]![k]!.decklist.reduce((n, e) => n + e.count, 0);
