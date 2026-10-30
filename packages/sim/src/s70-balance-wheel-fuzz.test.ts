import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const SEATS: Record<string, [string, string][]> = {
  balance: [["esper", "wbcontrol"], ["open", "levy"], ["esper", "locks"], ["abzan", "chancel"]],
  wheel_of_fortune: [["open", "rabble"], ["mardu", "burn"], ["grixis", "kindling"], ["open", "warband"]],
};
/** The list with four of the card for its first four-of nonland card (the fuzz wants it drawn; the Open holds one). */
function withFour(f: string, k: string, card: string, cards: Map<string, { types: string[] }>) {
  const l = FORMAT_FIELD[f]?.[k]; if (!l) throw new Error(`no list ${f}:${k}`);
  const out = l.decklist.find((e) => e.count === 4 && !cards.get(e.cardId)!.types.includes("Land"))!;
  return { name: l.name, decklist: [...l.decklist.filter((e) => e !== out), { cardId: card, count: 4 }] };
}
class CastCounter implements Agent {
  casts = 0;
  constructor(private readonly inner: RandomAgent, private readonly card: string) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, request);
    if (a.type === "castSpell" && view.hand.find((h) => h.objectId === a.objectId)?.cardId === this.card) this.casts++;
    return a;
  }
}

/**
 * Post-S70 fuzz-before-fixtures (Chris: Balance and Wheel of Fortune, LEB): four copies in four lists of each card's
 * colour, against the next list along, both seats — zero exceptions, every game terminates, the card is cast, replays
 * byte-identical. FUZZ_FULL: 8 seeds a pairing (128 games).
 */
describe("Post-S70 fuzz — Balance and Wheel of Fortune (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 8 : 1;

  it(`${games} games × 2 cards × 4 lists × 2 seats: zero exceptions, every game terminates, the card is cast`, async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    for (const [card, seats] of Object.entries(SEATS)) {
      let casts = 0;
      for (let i = 0; i < seats.length; i++) {
        const me = withFour(...seats[i]!, card, cards), [of, ok] = seats[(i + 1) % seats.length]!, o = FORMAT_FIELD[of]![ok]!;
        for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
          const a = { name: me.name, decklist: me.decklist, agent: "random" as const }, b = { name: o.name, decklist: o.decklist, agent: "random" as const };
          const counter = new CastCounter(new RandomAgent(seed * 2 + 1 + seat), card);
          const agents: [Agent, Agent] = seat === 0 ? [counter, new RandomAgent(seed * 2 + 2)] : [new RandomAgent(seed * 2 + 2), counter];
          const result = await runMatch({ seed: seed * 53 + seat + 9500 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: [] }, cards, agents);
          expect(result.reason, `${card} in ${me.name} vs ${o.name} seat ${seat} seed ${seed}`).toBeTruthy();
          casts += counter.casts;
        }
      }
      if (process.env.FUZZ_FULL) console.log(`${card}: ${casts} casts in ${seats.length * games * 2} games`);
      expect(casts, card).toBeGreaterThan(0);
    }
  }, 1_800_000);

  it("replay determinism — a game of each replays byte-identical", async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    for (const [card, seats] of Object.entries(SEATS)) {
      const me = withFour(...seats[0]!, card, cards), o = FORMAT_FIELD[seats[1]![0]]![seats[1]![1]]!;
      const seed = card === "balance" ? 101 : 103;
      const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: o.name, decklist: o.decklist, agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), o.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, card).toBe(live.finalStateSerialized);
    }
  }, 600_000);
});
