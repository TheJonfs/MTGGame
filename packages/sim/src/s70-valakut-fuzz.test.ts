import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
/** Lists with Mountains, each given Valakut and Burnfallow for two of them (and a Forest for a third, so Burnfallow has green). */
const SEATS: [string, string][] = [["open", "rabble"], ["mardu", "burn"], ["naya", "warband"], ["jund", "kindling"]];
function withValakut(f: string, k: string) {
  const l = FORMAT_FIELD[f]![k]!;
  const m = l.decklist.find((e) => e.cardId === "mountain");
  if (!m || m.count < 6) throw new Error(`${f}:${k} has too few Mountains`);
  return { name: l.name, decklist: [...l.decklist.filter((e) => e !== m), { cardId: "mountain", count: m.count - 3 }, { cardId: "valakut_the_molten_pinnacle", count: 1 }, { cardId: "burnfallow", count: 1 }, { cardId: "forest", count: 1 }] };
}
class TriggerCounter implements Agent {
  asked = 0;
  constructor(private readonly inner: RandomAgent) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    if (request.purpose === "optionalTrigger" && request.source?.cardId === "valakut_the_molten_pinnacle") this.asked++;
    return this.inner.chooseAction(view, request);
  }
}

/**
 * Post-S70 fuzz (R-120, Valakut, the Molten Pinnacle, with Burnfallow): each list with Valakut and Burnfallow, the
 * Valakut seat starting with five Mountains so the trigger is in reach, against the next list along, both seats. Zero
 * exceptions, every game terminates, the trigger is offered, replays byte-identical. FUZZ_FULL: 8 seeds (64 games).
 */
describe("Post-S70 fuzz — Valakut, the Molten Pinnacle with Burnfallow", () => {
  const games = process.env.FUZZ_FULL ? 8 : 1;
  const start = (seat: 0 | 1): MatchSpec["modifiers"] => Array.from({ length: 5 }, () => ({ type: "permanentOnBattlefield" as const, player: seat, cardId: "mountain" }));

  it(`${games} games × 4 lists × 2 seats: zero exceptions, every game terminates, the trigger is offered`, async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    let asked = 0;
    for (let i = 0; i < SEATS.length; i++) {
      const me = withValakut(...SEATS[i]!), o = FORMAT_FIELD[SEATS[(i + 1) % SEATS.length]![0]]![SEATS[(i + 1) % SEATS.length]![1]]!;
      for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
        const a = { name: me.name, decklist: me.decklist, agent: "random" as const }, b = { name: o.name, decklist: o.decklist, agent: "random" as const };
        const counter = new TriggerCounter(new RandomAgent(seed * 2 + 1 + seat));
        const agents: [Agent, Agent] = seat === 0 ? [counter, new RandomAgent(seed * 2 + 2)] : [new RandomAgent(seed * 2 + 2), counter];
        const result = await runMatch({ seed: seed * 47 + seat + 9000 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: start(seat) }, cards, agents);
        expect(result.reason, `${me.name} vs ${o.name} seat ${seat} seed ${seed}`).toBeTruthy();
        asked += counter.asked;
      }
    }
    if (process.env.FUZZ_FULL) console.log(`Valakut: ${asked} triggers offered in ${SEATS.length * games * 2} games`);
    expect(asked).toBeGreaterThan(0);
  }, 1_800_000);

  it("replay determinism — a Valakut game replays byte-identical", async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    const me = withValakut("open", "rabble"), o = FORMAT_FIELD.mardu!.burn!;
    const seed = 99, modifiers = start(0);
    const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: o.name, decklist: o.decklist, agent: "random" }], rules: RULES, modifiers }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
    const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), o.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, modifiers);
    expect(replayed).toBe(live.finalStateSerialized);
  }, 600_000);
});
