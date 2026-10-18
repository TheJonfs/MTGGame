import { describe, expect, it } from "vitest";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";
import { poolWithProposed } from "./s66-hallow-lists.js";

const cards = poolWithProposed();
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Obj = { cardId: string; controller: number; owner: number };
type Final = { battlefield: string[]; objects: Record<string, Obj>; players: { life: number; graveyard: string[]; exile: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const names = (f: Final, ids: string[]) => ids.map((id) => f.objects[id]!.cardId);
const spec = (deck0: Record<string, number>, deck1: Record<string, number>, mods: Modifier[], startingPlayer: 0 | 1 = 0): MatchSpec =>
  ({ seed: 66, players: [{ name: "a", decklist: D(deck0), agent: "x" }, { name: "b", decklist: D(deck1), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer } as MatchSpec["rules"], modifiers: mods });
/** The active player casts `spell` once in its first main phase (at the first creature of `aim` when it targets). */
const caster = (spell: string, aim?: string): Agent => {
  let done = false;
  return { chooseAction: async (v: GameView, r) => {
    if (r.purpose === "legendRule") return r.actions[r.actions.length - 1]!; // keep the newest
    if (!done && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
      const a = r.actions.find((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === spell && (!aim || x.targets.some((t) => t.kind === "object" && v.battlefield.some((b) => b.id === t.id && b.cardId === aim))));
      if (a) { done = true; return a; }
    }
    return pass(r);
  } };
};

/**
 * S66 — R-116 (Chris's Hallowed Warder and Vigil Keeper, under study): "If a creature an opponent controls would die,
 * exile it instead." A replacement (CR 614.1a): the creature goes to exile and does not die — no "dies" trigger fires.
 * In a batch (a Wrath) the replacement is decided for every creature before anything moves, so a Warder that dies in the
 * same event still exiles the others (it is on the battlefield as the event occurs).
 */
describe("R-116 — a creature an opponent controls that would die is exiled instead", () => {
  it("a Bolted Bear of theirs goes to exile, not their graveyard — and their Blood Artist does not drain", async () => {
    const f = fin(await runMatch(spec({ lightning_bolt: 60 }, { forest: 60 }, [perm(0, "mountain"), perm(0, "hallowed_warder_14"), perm(1, "grizzly_bears"), perm(1, "blood_artist")]), cards, [caster("lightning_bolt", "grizzly_bears"), passer]));
    expect(names(f, f.players[1]!.exile)).toContain("grizzly_bears");
    expect(names(f, f.players[1]!.graveyard)).not.toContain("grizzly_bears");
    expect(f.players[0]!.life).toBe(20); // no Blood Artist drain: nothing died
  });
  it("a Wrath that kills the Warder beside their creatures still exiles theirs (simultaneous); ours die as ever", async () => {
    const mods = [perm(0, "plains"), perm(0, "plains"), perm(0, "plains"), perm(0, "plains"), perm(0, "hallowed_warder_23"), perm(0, "savannah_lions"), perm(1, "grizzly_bears"), perm(1, "centaur_courser")];
    const f = fin(await runMatch(spec({ wrath_of_god: 60 }, { forest: 60 }, mods), cards, [caster("wrath_of_god"), passer]));
    expect(names(f, f.players[1]!.exile).sort()).toEqual(["centaur_courser", "grizzly_bears"]);
    expect(names(f, f.players[0]!.graveyard)).toEqual(expect.arrayContaining(["hallowed_warder_23", "savannah_lions", "wrath_of_god"]));
  });
  it("the loop's step: their second Usher under our Warder — the legend rule's death is an exile, and no drain fires", async () => {
    const lands = ["swamp", "swamp", "plains", "mountain", "badlands"].map((c) => perm(1, c));
    const f = fin(await runMatch(spec({ plains: 60 }, { the_usher: 60 }, [perm(0, "vigil_keeper_22"), perm(1, "the_usher"), ...lands], 1), cards, [passer, caster("the_usher")]));
    expect(names(f, f.players[1]!.exile)).toContain("the_usher");
    expect(names(f, f.players[1]!.graveyard)).not.toContain("the_usher");
    expect(f.players[0]!.life).toBe(20); // the Usher's "whenever a creature dies" never saw a death
  });
});
