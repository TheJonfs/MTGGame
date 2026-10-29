import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { validateCard, type CardDef } from "@shandalar/cards";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
/** A study def (data/cards-study — never in the pool), validated as the loader would. */
const studyDef = (id: string): CardDef => { const d = JSON.parse(readFileSync(join(ROOT, `data/cards-study/${id}.json`), "utf8")) as CardDef; const v = validateCard(d); if (v.errors.length) throw new Error(v.errors.join("; ")); return d; };
const cards = new Map(loadCardPool(join(ROOT, "data/cards")).cards);
cards.set("burnfallow_ping", studyDef("burnfallow_ping"));
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { battlefield: string[]; objects: Record<string, { cardId: string; controller: number; tapped?: boolean; isToken?: boolean; basePT?: unknown; counters?: Record<string, number> }>; players: { life: number; graveyard: string[]; library: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const names = (f: Final, ids: string[]) => ids.map((id) => f.objects[id]!.cardId);
const rules = { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"];
const spec = (mods: Modifier[], deck0: Record<string, number> = { plains: 60 }, deck1: Record<string, number> = { forest: 60 }): MatchSpec =>
  ({ seed: 70, players: [{ name: "a", decklist: D(deck0), agent: "x" }, { name: "b", decklist: D(deck1), agent: "x" }], rules, modifiers: mods }) as MatchSpec;

/** Seat 0 plays `steps` in its first main phase, one per empty-stack priority, each picking from the offered actions;
 * every other request takes its first non-decline action (a search finds; a sacrifice takes the first offered). */
function actor(steps: ((v: GameView, r: ActionRequest) => Action | undefined)[], seen: ActionRequest[] = []): Agent {
  let i = 0;
  return { chooseAction: async (v, r) => {
    seen.push(r);
    if (r.purpose === "priority") {
      if (i < steps.length && v.step === "MAIN1" && v.stack.length === 0) { const a = steps[i]!(v, r); if (a) { i++; return a; } }
      return pass(r);
    }
    return r.actions.find((a) => a.type !== "declineSearch") ?? r.actions[0]!;
  } };
}
const groundId = (v: GameView, cardId: string) => v.battlefield.find((o) => o.cardId === cardId)?.id;
const activation = (cardId: string, pred: (a: Action & { type: "activateAbility" }) => boolean = () => true) => (v: GameView, r: ActionRequest) =>
  r.actions.find((a) => a.type === "activateAbility" && a.objectId === groundId(v, cardId) && a.abilityIndex === 2 && pred(a)) as Action | undefined;
const targetsObject = (v: GameView, cardId: string) => (a: { targets: unknown[] }) => a.targets.some((t) => (t as { kind: string; id?: string }).kind === "object" && v.battlefield.find((o) => o.id === (t as { id: string }).id)?.cardId === cardId);

/**
 * S70 (ADR-192) — the still-pair High Grounds, nominal text. Fixtures after the fuzz (384 games, `s70-grounds-fuzz`).
 */
describe("S70 — the still-pair High Grounds", () => {
  it("Hearthspire: {2}{R}{W}, {T}: 2 damage to any target, and we gain 2 — the Bears die", async () => {
    const mods = [...["mountain", "mountain", "plains", "plains"].map((c) => perm(0, c)), perm(0, "hearthspire"), perm(1, "grizzly_bears")];
    let v0: GameView | undefined;
    const f = fin(await runMatch(spec(mods), cards, [actor([(v, r) => { v0 = v; return activation("hearthspire", targetsObject(v, "grizzly_bears"))(v, r); }]), passer]));
    expect(v0).toBeTruthy();
    expect(names(f, f.players[1]!.graveyard)).toContain("grizzly_bears");
    expect(f.players[0]!.life).toBe(22);
  });

  it("Volmaw: {2}{U}{B}, {T}: target player mills six", async () => {
    const mods = [...["island", "island", "swamp", "swamp"].map((c) => perm(0, c)), perm(0, "volmaw")];
    const f = fin(await runMatch(spec(mods), cards, [actor([(v, r) => r.actions.find((a) => a.type === "activateAbility" && a.objectId === groundId(v, "volmaw") && a.abilityIndex === 2 && a.targets.some((t) => t.kind === "player" && t.player === 1))]), passer]));
    expect(f.players[1]!.graveyard).toHaveLength(6);
    expect(f.players[1]!.library).toHaveLength(60 - 7 - 6);
  });

  it("Nightbower ({X}{B}{G}): the ceiling is the X announced — the Bears (mana value 2) are a target at X=2 and not at X=1; a land never is", async () => {
    const mods = [...["swamp", "swamp", "forest", "forest", "forest"].map((c) => perm(0, c)), perm(0, "nightbower"), perm(1, "grizzly_bears"), perm(1, "forest")];
    const seen: ActionRequest[] = [];
    let offered: { x: number | undefined; bears: boolean; land: boolean }[] = [];
    const f = fin(await runMatch(spec(mods), cards, [actor([(v, r) => {
      offered = r.actions.filter((a) => a.type === "activateAbility" && a.objectId === groundId(v, "nightbower")).map((a) => ({ x: (a as { x?: number }).x, bears: targetsObject(v, "grizzly_bears")(a as { targets: unknown[] }), land: targetsObject(v, "forest")(a as { targets: unknown[] }) }));
      return activation("nightbower", (a) => a.x === 2 && targetsObject(v, "grizzly_bears")(a))(v, r);
    }], seen), passer]));
    expect(offered.some((o) => o.x === 1 && o.bears)).toBe(false);
    expect(offered.some((o) => o.x === 2 && o.bears)).toBe(true);
    expect(offered.some((o) => o.land)).toBe(false);
    expect(Math.max(...offered.map((o) => o.x ?? 0))).toBe(3); // five lands: {B}{G} and X up to 3
    expect(names(f, f.players[1]!.graveyard)).toContain("grizzly_bears");
  });

  it("Ranksmere: a copy of a creature token we control (the Goblin from Dragon Fodder) — a nontoken creature is never a target", async () => {
    const mods = [...["mountain", "mountain", "mountain", "plains", "island"].map((c) => perm(0, c)), perm(0, "ranksmere"), perm(0, "grizzly_bears")];
    let bearsOffered = false;
    const f = fin(await runMatch(spec(mods, { dragon_fodder: 60 }), cards, [actor([
      (v, r) => r.actions.find((a) => a.type === "castSpell" && v.hand.find((h) => h.objectId === a.objectId)?.cardId === "dragon_fodder"),
      (v, r) => { bearsOffered = r.actions.some((a) => a.type === "activateAbility" && a.objectId === groundId(v, "ranksmere") && targetsObject(v, "grizzly_bears")(a)); return activation("ranksmere")(v, r); },
    ]), passer]));
    const goblins = f.battlefield.filter((id) => f.objects[id]!.cardId === "goblin_1_1");
    expect(goblins).toHaveLength(3);
    expect(goblins.every((id) => f.objects[id]!.isToken && f.objects[id]!.controller === 0)).toBe(true);
    expect(bearsOffered).toBe(false);
  });

  it("Burnfallow (a), the study card: {2}{G}{R}, {T}: a basic onto the battlefield tapped, then 1 damage to any target", async () => {
    const mods = [...["mountain", "mountain", "forest", "forest"].map((c) => perm(0, c)), perm(0, "burnfallow_ping")];
    const f = fin(await runMatch(spec(mods, { mountain: 60 }), cards, [actor([(v, r) => r.actions.find((a) => a.type === "activateAbility" && a.objectId === groundId(v, "burnfallow_ping") && a.abilityIndex === 2 && a.targets.some((t) => t.kind === "player" && t.player === 1))]), passer]));
    const mountains = f.battlefield.filter((id) => f.objects[id]!.cardId === "mountain" && f.objects[id]!.controller === 0);
    expect(mountains).toHaveLength(3);
    expect(f.players[1]!.life).toBe(19);
  });

  it("Burnfallow (the nominal, card (b)): {1}{G}{R}, {T}, sacrifice ANOTHER land: two basics onto the battlefield tapped — never itself as the cost", async () => {
    const mods = [...["mountain", "forest", "forest"].map((c) => perm(0, c)), perm(0, "burnfallow")];
    const seen: ActionRequest[] = [];
    let ground: string | undefined;
    const f = fin(await runMatch(spec(mods, { mountain: 60 }), cards, [actor([(v, r) => { ground = groundId(v, "burnfallow"); return r.actions.find((a) => a.type === "activateAbility" && a.objectId === ground && a.abilityIndex === 2); }], seen), passer]));
    const sac = seen.find((r) => r.purpose === "chooseSacrifice");
    expect(sac).toBeTruthy();
    expect(sac!.actions).toHaveLength(3); // the three other lands
    expect(sac!.actions.some((a) => a.type === "sacrifice" && a.objectId === ground)).toBe(false);
    expect(f.battlefield.map((id) => f.objects[id]!.cardId)).toContain("burnfallow");
    expect(f.battlefield.filter((id) => f.objects[id]!.cardId === "mountain" && f.objects[id]!.controller === 0).length + f.battlefield.filter((id) => f.objects[id]!.cardId === "forest").length).toBe(4); // three lands − one sacrificed + two found
    expect(f.players[0]!.graveyard).toHaveLength(1);
  });
});
