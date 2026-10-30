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
/** Every choice (a sacrifice, a discard) takes the first offered. */
const chooser = (r: ActionRequest) => (r.purpose === "priority" ? pass(r) : r.actions[0]!);
const passer: Agent = { chooseAction: async (_v, r) => chooser(r) };
type Final = { objects: Record<string, { cardId: string; controller: number }>; battlefield: string[]; players: { hand: string[]; graveyard: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const on = (f: Final, p: number, id: string) => f.battlefield.filter((o) => f.objects[o]!.controller === p && f.objects[o]!.cardId === id).length;
/** Seat 0 casts `card` once in its first main phase. */
const caster = (card: string): Agent => { let done = false; return { chooseAction: async (v: GameView, r) => {
  if (!done && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
    const a = r.actions.find((c) => c.type === "castSpell" && v.hand.find((h) => h.objectId === c.objectId)?.cardId === card);
    if (a) { done = true; return a; }
  }
  return chooser(r);
} }; };
const run = async (card: string, mods: Modifier[], deck1: Record<string, number> = { forest: 60 }) => fin(await runMatch(
  { seed: 73, players: [{ name: "a", decklist: D({ [card]: 60 }), agent: "x" }, { name: "b", decklist: D(deck1), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 }, modifiers: mods } as MatchSpec,
  cards, [caster(card), passer]));
const n = (k: number, p: 0 | 1, id: string) => Array.from({ length: k }, () => perm(p, id));

/**
 * Post-S70 — R-121, Balance (Scryfall LEB #3): "Each player chooses a number of lands they control equal to the number
 * of lands controlled by the player who controls the fewest, then sacrifices the rest. Players discard cards and
 * sacrifice creatures the same way." Three steps, each counted as it happens (the 2016 ruling): lands, then hands, then
 * creatures. And Wheel of Fortune (LEB #184): "Each player discards their hand, then draws seven cards."
 */
describe("R-121 — Balance; Wheel of Fortune", () => {
  it("Balance from behind: their three extra lands, their one extra card, their three creatures", async () => {
    const f = await run("balance", [...n(2, 0, "plains"), ...n(5, 1, "forest"), ...n(3, 1, "grizzly_bears")]);
    expect(on(f, 1, "forest")).toBe(2);
    expect(on(f, 1, "grizzly_bears")).toBe(0);
    expect(f.players[1]!.hand).toHaveLength(6); // seven, down to our six (Balance itself has left our hand)
    expect(on(f, 0, "plains")).toBe(2);
    expect(f.players[0]!.hand).toHaveLength(6);
  });

  it("Balance cuts both ways: our three Bears to their one; their extra land, our none", async () => {
    const f = await run("balance", [...n(3, 0, "plains"), ...n(3, 0, "grizzly_bears"), ...n(4, 1, "forest"), perm(1, "grizzly_bears")]);
    expect(on(f, 0, "grizzly_bears")).toBe(1);
    expect(on(f, 1, "grizzly_bears")).toBe(1);
    expect(on(f, 1, "forest")).toBe(3);
    expect(on(f, 0, "plains")).toBe(3);
  });

  it("Balance with no creatures on one side: every creature goes (the fewest is zero)", async () => {
    const f = await run("balance", [...n(2, 0, "plains"), ...n(2, 1, "forest"), ...n(2, 1, "grizzly_bears")]);
    expect(on(f, 1, "grizzly_bears")).toBe(0);
    expect(on(f, 1, "forest")).toBe(2);
  });

  it("Wheel of Fortune: both hands to the graveyard, seven cards each", async () => {
    const f = await run("wheel_of_fortune", n(3, 0, "mountain"));
    expect(f.players[0]!.hand).toHaveLength(7);
    expect(f.players[1]!.hand).toHaveLength(7);
    expect(f.players[0]!.graveyard).toHaveLength(6 + 1); // the six left in hand, and the Wheel
    expect(f.players[1]!.graveyard).toHaveLength(7);
  });
});
