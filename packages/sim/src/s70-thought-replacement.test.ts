import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { objects: Record<string, { cardId: string }>; players: { hand: string[]; graveyard: string[]; library: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const names = (f: Final, ids: string[]) => ids.map((id) => f.objects[id]!.cardId);
/** Seat 0 casts Thought Replacement at `at` in its first main phase; the discard pick takes the first card offered. */
function caster(at: 0 | 1, seen: ActionRequest[]): Agent {
  let done = false;
  return { chooseAction: async (v: GameView, r) => {
    seen.push(r);
    if (r.purpose === "priority" && !done && v.step === "MAIN1" && v.stack.length === 0) {
      const a = r.actions.find((c) => c.type === "castSpell" && v.hand.find((h) => h.objectId === c.objectId)?.cardId === "thought_replacement" && c.targets.some((t) => t.kind === "player" && t.player === at));
      if (a) { done = true; return a; }
    }
    if (r.purpose === "discard") return r.actions.find((a) => a.type !== "declineOptional") ?? r.actions[0]!;
    return pass(r);
  } };
}
const run = async (at: 0 | 1, theirs: Record<string, number>, seen: ActionRequest[] = []) => fin(await runMatch(
  { seed: 71, players: [{ name: "a", decklist: D({ thought_replacement: 60 }), agent: "x" }, { name: "b", decklist: D(theirs), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 }, modifiers: [perm(0, "swamp")] } as MatchSpec,
  cards, [caster(at, seen), passer]));

/**
 * Post-S70 — Chris's Thought Replacement ({B} sorcery, custom, tier 2): "Target player reveals their hand. You choose a
 * nonland card from it. That player discards that card. Then that player draws a card." The caster's discard (ADR-029,
 * the Duress shape) with the `nonland` filter, then `draw` for the target player. A hand with no nonland card is
 * revealed, nothing is discarded, and the player still draws.
 */
describe("Post-S70 — Thought Replacement", () => {
  it("at the opponent: their hand is revealed, the caster takes a nonland card, they draw one", async () => {
    const seen: ActionRequest[] = [];
    const f = await run(1, { grizzly_bears: 30, forest: 30 }, seen);
    const pick = seen.find((r) => r.purpose === "discard")!;
    expect(pick).toBeTruthy();
    expect(pick.actions).toHaveLength(1); // one option a distinct card: the Bears — no Forest is offered
    expect(names(f, f.players[1]!.graveyard)).toEqual(["grizzly_bears"]);
    expect(f.players[1]!.hand).toHaveLength(7); // seven, one discarded, one drawn
    expect(f.players[1]!.library).toHaveLength(60 - 7 - 1);
  });

  it("a hand of lands: revealed, nothing discarded — and they still draw", async () => {
    const f = await run(1, { forest: 60 });
    expect(f.players[1]!.graveyard).toHaveLength(0);
    expect(f.players[1]!.hand).toHaveLength(8);
  });

  it("at our own head (a legal target — 'target player'): we discard one of our own nonland cards and draw", async () => {
    const f = await run(0, { forest: 60 });
    expect(names(f, f.players[0]!.graveyard)).toEqual(["thought_replacement", "thought_replacement"]); // the cast and the discard
    expect(f.players[0]!.hand).toHaveLength(6); // seven, one cast, one discarded, one drawn
  });
});
