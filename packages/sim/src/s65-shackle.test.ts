import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard } from "@shandalar/cards";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { battlefield: string[]; objects: Record<string, { cardId: string; controller: number; tapped: boolean; counters: Record<string, number> }>; players: { life: number }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const find = (f: Final, cardId: string, controller: number) => f.battlefield.map((id) => f.objects[id]!).find((o) => o.cardId === cardId && o.controller === controller)!;
const spec = (deck0: Record<string, number>, mods: Modifier[], maxTurns: number): MatchSpec =>
  ({ seed: 65, players: [{ name: "a", decklist: D(deck0), agent: "x" }, { name: "b", decklist: D({ island: 60 }), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns, startingPlayer: 0 } as MatchSpec["rules"], modifiers: mods });
/** Seat 0, in its first main phase: sacrifices the Shackle at the first `cardId` controlled by `who`, then casts `then` if given. */
const shackler = (cardId: string, who: 0 | 1, then?: string): Agent => {
  let used = false, cast = false;
  return { chooseAction: async (v: GameView, r) => {
    if (r.purpose === "priority" && v.turn === 1 && v.step === "MAIN1" && v.stack.length === 0) {
      if (!used) {
        const a = r.actions.find((x) => x.type === "activateAbility" && v.battlefield.find((b) => b.id === x.objectId)?.cardId === "tidal_shackle" && (x.targets ?? []).some((t) => t.kind === "object" && v.battlefield.some((b) => b.id === t.id && b.cardId === cardId && b.controller === who)));
        if (a) { used = true; return a; }
      } else if (then && !cast) {
        const a = r.actions.find((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === then);
        if (a) { cast = true; return a; }
      }
    }
    if (r.purpose === "chooseTarget" && then) { const a = r.actions.find((x) => (x as { targets?: { kind: string; id?: string }[] }).targets?.some((t) => t.kind === "object" && v.battlefield.some((b) => b.id === t.id && b.cardId === cardId))); if (a) return a; }
    return pass(r);
  } };
};

/**
 * Post-S65 — Tidal Shackle (Chris's card, tier 1): {U} Artifact, "Sacrifice Tidal Shackle: Tap target creature and put a
 * stun counter on it." R-113: CR 122.1d (verified 2026-10-16) — one or more stun counters are a single replacement
 * effect: if the permanent would become untapped, a stun counter is removed from it instead. Every untap goes through
 * `untapPermanent`; the Warden's law ("whenever a creature untaps, it deals 1 damage to its controller") reads it.
 */
describe("Tidal Shackle", () => {
  it("is valid", () => {
    const d = cards.get("tidal_shackle")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{U}", types: ["Artifact"], source: "custom", shopTier: 1 });
  });
  it("taps and stuns; their next untap step removes the counter instead — still tapped, and the Warden sees no untap", async () => {
    const mods = [perm(0, "tidal_shackle"), perm(0, "the_warden"), perm(1, "centaur_courser")];
    const now = fin(await runMatch(spec({ island: 60 }, mods, 1), cards, [shackler("centaur_courser", 1), passer]));
    expect(find(now, "centaur_courser", 1)).toMatchObject({ tapped: true, counters: { stun: 1 } });
    expect(now.battlefield.some((id) => now.objects[id]!.cardId === "tidal_shackle")).toBe(false); // sacrificed
    const after = fin(await runMatch(spec({ island: 60 }, mods, 2), cards, [shackler("centaur_courser", 1), passer]));
    const c = find(after, "centaur_courser", 1);
    expect(c.tapped).toBe(true);
    expect(c.counters.stun ?? 0).toBe(0);
    expect(after.players[1]!.life).toBe(20); // no untap, no Warden damage
    const later = fin(await runMatch(spec({ island: 60 }, mods, 4), cards, [shackler("centaur_courser", 1), passer]));
    expect(find(later, "centaur_courser", 1).tapped).toBe(false); // the untap after: a real one
    expect(later.players[1]!.life).toBe(19); // — and the Warden pings it
  });
  it("an effect's untap is replaced too: Little Bear's on-entry untap of a stunned creature of ours removes the counter, and it stays tapped", async () => {
    const mods = [perm(0, "tidal_shackle"), perm(0, "centaur_courser"), perm(0, "forest"), perm(0, "forest"), perm(0, "forest")];
    const f = fin(await runMatch(spec({ little_bear: 60 }, mods, 1), cards, [shackler("centaur_courser", 0, "little_bear"), passer]));
    expect(f.battlefield.some((id) => f.objects[id]!.cardId === "little_bear")).toBe(true);
    const c = find(f, "centaur_courser", 0);
    expect(c.tapped).toBe(true);
    expect(c.counters.stun ?? 0).toBe(0);
  });
});
