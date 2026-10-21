import { describe, expect, it } from "vitest";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";
import { poolWithProposed } from "./s66-hallow-lists.js";

const cards = poolWithProposed();
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Obj = { cardId: string; controller: number };
type Final = { battlefield: string[]; objects: Record<string, Obj & { power?: number; toughness?: number }>; players: { life: number; graveyard: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const names = (f: Final, ids: string[]) => ids.map((id) => f.objects[id]!.cardId);
/** Seat 0 casts the Massacre once in its first main phase, at the X given. */
const caster = (x: number): Agent => { let done = false; return { chooseAction: async (v: GameView, r) => {
  if (!done && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
    const a = r.actions.find((c) => c.type === "castSpell" && v.hand.find((h) => h.objectId === c.objectId)?.cardId === "the_meathook_massacre" && (c as { x?: number }).x === x);
    if (a) { done = true; return a; }
  }
  return pass(r);
} }; };

/**
 * Post-S68 — R-117 (The Meathook Massacre, under study; Scryfall INR #387): "When The Meathook Massacre enters, each
 * creature gets −X/−X until end of turn. Whenever a creature you control dies, each opponent loses 1 life. Whenever a
 * creature an opponent controls dies, you gain 1 life." The X announced on the cast reaches the enters trigger
 * (`xPaid`, ADR-088) and is negated (`times: −1`); the deaths it causes trigger its own two abilities (it is on the
 * battlefield when the state-based actions put them in the graveyard).
 */
describe("R-117 — The Meathook Massacre", () => {
  it("X=2: their Bears and our Rats die (we gain 1, they lose 1); our Nighthawk lives as a 0/1 until the turn ends", async () => {
    const mods = [...["swamp", "swamp", "swamp", "swamp"].map((c) => perm(0, c)), perm(0, "typhoid_rats"), perm(0, "vampire_nighthawk"), perm(1, "grizzly_bears")];
    const spec = { seed: 68, players: [{ name: "a", decklist: D({ the_meathook_massacre: 60 }), agent: "x" }, { name: "b", decklist: D({ forest: 60 }), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"], modifiers: mods } as MatchSpec;
    const f = fin(await runMatch(spec, cards, [caster(2), passer]));
    expect(names(f, f.players[1]!.graveyard)).toContain("grizzly_bears");
    expect(names(f, f.players[0]!.graveyard)).toContain("typhoid_rats");
    expect(names(f, f.battlefield)).toEqual(expect.arrayContaining(["vampire_nighthawk", "the_meathook_massacre"]));
    expect(f.players[0]!.life).toBe(21); // their Bears died: +1
    expect(f.players[1]!.life).toBe(19); // our Rats died: −1
  });
});
