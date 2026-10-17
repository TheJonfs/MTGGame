import { describe, expect, it } from "vitest";
import { validateCard } from "@shandalar/cards";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";
import { poolWithProposed } from "./s66-hallow-lists.js";

const cards = poolWithProposed();
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const mill = (player: 0 | 1, count: number): Modifier => ({ type: "effectAtStart", player, effects: [{ type: "mill", count, who: "you" }] } as Modifier);
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Obj = { cardId: string; controller: number; owner: number; zone: string };
type Final = { battlefield: string[]; objects: Record<string, Obj>; players: { life: number; graveyard: string[]; library: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const spec = (deck0: Record<string, number>, deck1: Record<string, number>, mods: Modifier[], maxTurns = 1): MatchSpec =>
  ({ seed: 66, players: [{ name: "a", decklist: D(deck0), agent: "x" }, { name: "b", decklist: D(deck1), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns, startingPlayer: 0 } as MatchSpec["rules"], modifiers: mods });
const yardCard = (v: GameView, id: string) => [...v.graveyardObjects[0], ...v.graveyardObjects[1]].find((g) => g.objectId === id)?.cardId;
/** Seat 0 in its first main phase: casts `spell` (or activates `source`'s ability) at the first graveyard card named `aim`. */
const user = (aim: string, spell?: string, source?: string): Agent => {
  let done = false;
  return { chooseAction: async (v: GameView, r) => {
    if (!done && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
      const a = r.actions.find((x) => (spell ? x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === spell : x.type === "activateAbility" && v.battlefield.find((b) => b.id === x.objectId)?.cardId === source) && (x as { targets: { kind: string; id?: string }[] }).targets.some((t) => t.kind === "object" && yardCard(v, t.id!) === aim));
      if (a) { done = true; return a; }
    }
    return pass(r);
  } };
};

/**
 * S66 — R-115 (Chris's white graveyard answer, under study): "Put target card from a graveyard on the bottom of its
 * owner's library." Hallowed Rites ({1}{W} instant; a 1/1 flying Spirit too) and the Sexton of the Vale (four cost
 * variants; "you gain life equal to its mana value" — its mana value read before it moves). Answering a return: an
 * opposing spell or trigger whose only target has left the graveyard does nothing (CR 608.2b).
 */
describe("R-115 — a graveyard card to the bottom of its owner's library", () => {
  it("the study's five are valid", () => {
    for (const id of ["hallowed_rites", "sexton_sac", "sexton_tap", "sexton_tap_nolife", "sexton_paid"]) expect(validateCard(cards.get(id)!).errors, id).toEqual([]);
  });
  it("Hallowed Rites: the card goes to the bottom of its OWNER's library, and a Spirit is made", async () => {
    const f = fin(await runMatch(spec({ hallowed_rites: 60 }, { grizzly_bears: 60 }, [perm(0, "plains"), perm(0, "plains"), mill(1, 3)]), cards, [user("grizzly_bears", "hallowed_rites"), passer]));
    expect(f.players[1]!.graveyard.length).toBe(2); // one of the three milled Bears left
    const bottom = f.players[1]!.library[f.players[1]!.library.length - 1]!;
    expect(f.objects[bottom]!.cardId).toBe("grizzly_bears");
    expect(f.battlefield.some((id) => f.objects[id]!.cardId === "spirit_1_1_w_flying" && f.objects[id]!.controller === 0)).toBe(true);
  });
  it("the Sexton gains life equal to the card's mana value — an Usher (5), read before it moves", async () => {
    const f = fin(await runMatch(spec({ plains: 60 }, { the_usher: 60 }, [perm(0, "sexton_tap"), mill(1, 2)], 1), cards, [user("the_usher", undefined, "sexton_tap"), passer]));
    expect(f.players[0]!.life).toBe(25);
    expect(f.players[1]!.graveyard.length).toBe(1);
  });
  it("in answer to a Zombify, the Rites fizzle it: its only target has left the graveyard (CR 608.2b)", async () => {
    // seat 0 raises a Bear with Zombify; seat 1 answers with the Rites on that Bear while the Zombify is on the stack
    let zombified = false;
    const raiser: Agent = { chooseAction: async (v: GameView, r) => {
      if (!zombified && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
        const a = r.actions.find((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === "zombify");
        if (a) { zombified = true; return a; }
      }
      return pass(r);
    } };
    const answerer: Agent = { chooseAction: async (v: GameView, r) => {
      const z = v.stack.find((s) => s.cardId === "zombify");
      if (z && r.purpose === "priority") {
        const id = (z.targets ?? [])[0] && (z.targets![0] as { id?: string }).id;
        const a = r.actions.find((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === "hallowed_rites" && x.targets.some((t) => t.kind === "object" && t.id === id));
        if (a) return a;
      }
      return pass(r);
    } };
    const mods = [perm(0, "swamp"), perm(0, "swamp"), perm(0, "swamp"), perm(0, "swamp"), mill(0, 10), perm(1, "plains"), perm(1, "plains")];
    const f = fin(await runMatch(spec({ zombify: 30, grizzly_bears: 30 }, { hallowed_rites: 60 }, mods), cards, [raiser, answerer]));
    expect(zombified).toBe(true);
    expect(f.battlefield.some((id) => f.objects[id]!.cardId === "grizzly_bears")).toBe(false); // nothing returned
    const bottom = f.players[0]!.library[f.players[0]!.library.length - 1]!;
    expect(f.objects[bottom]!.cardId).toBe("grizzly_bears"); // the Bear, on the bottom of its owner's library
  });
});
