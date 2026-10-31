import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const SEATS: [string, string][] = [["open", "rabble"], ["mardu", "burn"], ["naya", "warband"], ["jund", "kindling"]];
const pool = () => loadCardPool(join(ROOT, "data/cards")).cards as Map<string, CardDef>;
function withFour(f: string, k: string, cards: Map<string, CardDef>) {
  const l = FORMAT_FIELD[f]![k]!;
  const out = l.decklist.find((e) => e.count === 4 && !cards.get(e.cardId)!.types.includes("Land"))!;
  return { name: l.name, decklist: [...l.decklist.filter((e) => e !== out), { cardId: "highland_ritual", count: 4 }] };
}
class CastCounter implements Agent {
  casts = 0;
  constructor(private readonly inner: RandomAgent) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, request);
    if ((a.type === "castSpell" || a.type === "activateAbility") && view.hand.find((h) => h.objectId === a.objectId)?.cardId === "highland_ritual") this.casts++;
    return a;
  }
}

/**
 * Post-S70 fuzz-before-fixtures (R-122, Highland Ritual): four copies in four red lists, against the next along,
 * both seats — zero exceptions, every game terminates, the card is cast or cycled, replays byte-identical. FUZZ_FULL: 8 seeds.
 */
describe("Post-S70 fuzz — Highland Ritual (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 8 : 1;

  it(`${games} games × 4 lists × 2 seats: zero exceptions, every game terminates, the card is used`, async () => {
    const cards = pool();
    let casts = 0;
    for (let i = 0; i < SEATS.length; i++) {
      const me = withFour(...SEATS[i]!, cards), [of, ok] = SEATS[(i + 1) % SEATS.length]!, o = FORMAT_FIELD[of]![ok]!;
      for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
        const a = { name: me.name, decklist: me.decklist, agent: "random" as const }, b = { name: o.name, decklist: o.decklist, agent: "random" as const };
        const counter = new CastCounter(new RandomAgent(seed * 2 + 1 + seat));
        const agents: [Agent, Agent] = seat === 0 ? [counter, new RandomAgent(seed * 2 + 2)] : [new RandomAgent(seed * 2 + 2), counter];
        const result = await runMatch({ seed: seed * 59 + seat + 9700 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: [] }, cards, agents);
        expect(result.reason, `${me.name} vs ${o.name} seat ${seat} seed ${seed}`).toBeTruthy();
        casts += counter.casts;
      }
    }
    if (process.env.FUZZ_FULL) console.log(`Highland Ritual: ${casts} casts in ${SEATS.length * games * 2} games`);
    expect(casts).toBeGreaterThan(0);
  }, 1_800_000);

  it("replay determinism — a game replays byte-identical", async () => {
    const cards = pool();
    const me = withFour("open", "rabble", cards), o = FORMAT_FIELD.mardu!.burn!, seed = 107;
    const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: o.name, decklist: o.decklist, agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
    const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), o.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
    expect(replayed).toBe(live.finalStateSerialized);
  }, 600_000);
});
