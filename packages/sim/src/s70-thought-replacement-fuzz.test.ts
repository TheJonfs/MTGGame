import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const SEATS: [string, string][] = [["grixis", "mbclio"], ["open", "writ"], ["esper", "mbc"], ["mardu", "witch"]];

/** The list with four Thought Replacements for its four-of nonland card that comes first (never a land). */
function withFour(f: string, k: string, cards: Map<string, { types: string[] }>) {
  const l = FORMAT_FIELD[f]![k]!;
  const out = l.decklist.find((e) => e.count === 4 && !cards.get(e.cardId)!.types.includes("Land") && e.cardId !== "thought_replacement")!;
  return { name: l.name, decklist: [...l.decklist.filter((e) => e !== out), { cardId: "thought_replacement", count: 4 }] };
}
class CastCounter implements Agent {
  casts = 0;
  constructor(private readonly inner: RandomAgent) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, request);
    if (a.type === "castSpell" && view.hand.find((h) => h.objectId === a.objectId)?.cardId === "thought_replacement") this.casts++;
    return a;
  }
}

/**
 * Post-S70 fuzz-before-fixtures (Chris's Thought Replacement, {B} sorcery: "Target player reveals their hand. You
 * choose a nonland card from it. That player discards that card. Then that player draws a card."): four copies in four
 * black lists, against the next list along, both seats. Zero exceptions, every game terminates, the card is cast,
 * replays byte-identical. FUZZ_FULL: 8 seeds a pairing (64 games).
 */
describe("Post-S70 fuzz — Thought Replacement (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 8 : 1;

  it(`${games} games × 4 lists × 2 seats: zero exceptions, every game terminates, the card is cast`, async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    let casts = 0;
    for (let i = 0; i < SEATS.length; i++) {
      const me = withFour(...SEATS[i]!, cards), o = FORMAT_FIELD[SEATS[(i + 1) % SEATS.length]![0]]![SEATS[(i + 1) % SEATS.length]![1]]!;
      for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
        const a = { name: me.name, decklist: me.decklist, agent: "random" as const }, b = { name: o.name, decklist: o.decklist, agent: "random" as const };
        const counter = new CastCounter(new RandomAgent(seed * 2 + 1 + seat));
        const agents: [Agent, Agent] = seat === 0 ? [counter, new RandomAgent(seed * 2 + 2)] : [new RandomAgent(seed * 2 + 2), counter];
        const result = await runMatch({ seed: seed * 43 + seat + 8000 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: [] }, cards, agents);
        expect(result.reason, `${me.name} vs ${o.name} seat ${seat} seed ${seed}`).toBeTruthy();
        casts += counter.casts;
      }
    }
    if (process.env.FUZZ_FULL) console.log(`Thought Replacement: ${casts} casts in ${SEATS.length * games * 2} games`);
    expect(casts).toBeGreaterThan(0);
  }, 1_800_000);

  it("replay determinism — a Thought Replacement game replays byte-identical", async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    const me = withFour("grixis", "mbclio", cards), o = FORMAT_FIELD.open!.writ!;
    const seed = 97;
    const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: o.name, decklist: o.decklist, agent: "random" }], rules: RULES, modifiers: [] } as MatchSpec, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
    const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), o.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
    expect(replayed).toBe(live.finalStateSerialized);
  }, 600_000);
});
