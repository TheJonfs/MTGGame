import { describe, expect, it } from "vitest";
import type { CardDef } from "@shandalar/cards";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";
import { poolWithMentorAura } from "./s65-aura-lists.js";

const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Obj = { cardId: string; controller: number; zone: string; attachedTo: string | null };
type Final = { battlefield: string[]; objects: Record<string, Obj>; players: { graveyard: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const onField = (f: Final, cardId: string) => f.battlefield.map((id) => ({ id, ...f.objects[id]! })).filter((o) => o.cardId === cardId);

/** A test-only sorcery: the same return with no creature of its own (the Mentor is always a host for its own return). */
const raise: CardDef = { id: "test_raise", name: "Test Raise", source: "custom", manaCost: "{W}", types: ["Sorcery"], targets: [{ count: 1, predicate: "permanentCardInYourGraveyard", zone: "graveyard" }], spellEffect: [{ type: "returnFromGraveyard", target: 0, to: "battlefield" }] } as unknown as CardDef;
const cards = poolWithMentorAura(); cards.set("test_raise", raise);

/** Seat 0 casts `spell` in its first main phase; its graveyard target is the first `auraId`; the host it asks for is the
 * first creature of `hostCard` (logging what was offered). An Aura on the battlefield at the start has no host and
 * goes to the graveyard at once (704.5m) — the way these boards put one there. */
const caster = (spell: string, auraId: string, hostCard: string | null, offered: string[][]): Agent => {
  let cast = false;
  return { chooseAction: async (v: GameView, r) => {
    if (!cast && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
      const a = r.actions.find((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === spell && (x.targets.length === 0 || x.targets.some((t) => t.kind === "object" && v.graveyardObjects[0].some((g) => g.objectId === t.id && g.cardId === auraId))));
      if (a) { cast = true; return a; }
    }
    if (r.purpose === "chooseTarget") { const a = r.actions.find((x) => x.type === "chooseTriggerTargets" && x.targets.some((t) => t.kind === "object" && v.graveyardObjects[0].some((g) => g.objectId === t.id && g.cardId === auraId))); if (a) return a; }
    if (r.purpose === "chooseAttachHost") {
      offered.push(r.actions.map((x) => v.battlefield.find((b) => b.id === (x as { objectId: string }).objectId)!.cardId));
      const a = r.actions.find((x) => x.type === "chooseAttachHost" && v.battlefield.find((b) => b.id === x.objectId)?.cardId === hostCard);
      if (a) return a;
    }
    return pass(r);
  } };
};
const spec = (deck: Record<string, number>, mods: Modifier[]): MatchSpec =>
  ({ seed: 65, players: [{ name: "a", decklist: D(deck), agent: "x" }, { name: "b", decklist: D({ forest: 60 }), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"], modifiers: mods });
const plains = [perm(0, "plains"), perm(0, "plains"), perm(0, "plains")];

/**
 * Post-S65 — R-114: an Aura put onto the battlefield without being cast (CR 303.4f, verified 2026-10-17): "the player
 * putting it onto the battlefield chooses an object or player for the Aura to enchant even though no player is
 * targeting that object" — so hexproof does not stop it; CR 303.4g: with nothing it could legally enchant, it remains
 * in its current zone. The study's Mentor (Auras allowed) returns one; so does a test sorcery with no body of its own.
 */
describe("an Aura entering attached (R-114)", () => {
  it("the Mentor returns Pacifism onto the creature its controller chooses — theirs; every creature is offered", async () => {
    const offered: string[][] = [];
    const f = fin(await runMatch(spec({ karmic_mentor_aura: 60 }, [...plains, perm(0, "pacifism"), perm(1, "grizzly_bears")]), cards, [caster("karmic_mentor_aura", "pacifism", "grizzly_bears", offered), passer]));
    expect(offered[0]?.sort()).toEqual(["grizzly_bears", "karmic_mentor_aura"]); // every creature: the Mentor itself too
    const p = onField(f, "pacifism")[0]!, bear = onField(f, "grizzly_bears")[0]!;
    expect(p.attachedTo).toBe(bear.id);
  });
  it("hexproof does not stop it: a Gladecover Scout of theirs is offered and enchanted (not targeted)", async () => {
    const offered: string[][] = [];
    const f = fin(await runMatch(spec({ karmic_mentor_aura: 60 }, [...plains, perm(0, "pacifism"), perm(1, "gladecover_scout")]), cards, [caster("karmic_mentor_aura", "pacifism", "gladecover_scout", offered), passer]));
    expect(offered[0]).toContain("gladecover_scout");
    expect(onField(f, "pacifism")[0]!.attachedTo).toBe(onField(f, "gladecover_scout")[0]!.id);
  });
  it("Spirit Link returns onto our own creature (Rancor cannot be set up so: dying from the start board, it returns itself to hand)", async () => {
    const offered: string[][] = [];
    const f = fin(await runMatch(spec({ karmic_mentor_aura: 60 }, [...plains, perm(0, "spirit_link"), perm(0, "grizzly_bears")]), cards, [caster("karmic_mentor_aura", "spirit_link", "grizzly_bears", offered), passer]));
    expect(onField(f, "spirit_link")[0]!.attachedTo).toBe(onField(f, "grizzly_bears")[0]!.id);
  });
  it("with no creature on the battlefield it stays in the graveyard (CR 303.4g) — no host is asked for", async () => {
    const offered: string[][] = [];
    const f = fin(await runMatch(spec({ test_raise: 60 }, [...plains, perm(0, "pacifism")]), cards, [caster("test_raise", "pacifism", null, offered), passer]));
    expect(offered).toEqual([]);
    expect(onField(f, "pacifism")).toEqual([]);
    expect(f.players[0]!.graveyard.some((id) => f.objects[id]?.cardId === "pacifism")).toBe(true);
  });
  it("a non-Aura still returns as before (the Mentor's registered predicate is unchanged)", () => {
    expect(cards.get("karmic_mentor")!.abilities![0]!.kind === "triggered" && (cards.get("karmic_mentor")!.abilities![0] as { targets: { predicate: string }[] }).targets[0]!.predicate).toBe("nonAuraPermanentCardInYourGraveyard");
  });
});
