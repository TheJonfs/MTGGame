import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const n = (k: number, p: 0 | 1, id: string) => Array.from({ length: k }, () => perm(p, id));
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { objects: Record<string, { cardId: string; controller: number; tapped?: boolean; counters?: Record<string, number> }>; battlefield: string[]; players: { hand: string[]; graveyard: string[]; library: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const onBf = (f: Final, id: string, p = 0) => f.battlefield.filter((o) => f.objects[o]!.cardId === id && f.objects[o]!.controller === p);
const rules = (maxTurns: number) => ({ startingLife: 20, handSize: 7, mulligan: "london", maxTurns, startingPlayer: 0 }) as MatchSpec["rules"];
const run = async (deck: Record<string, number>, mods: Modifier[], agent: Agent, maxTurns = 1, theirs: Record<string, number> = { forest: 60 }) =>
  fin(await runMatch({ seed: 75, players: [{ name: "a", decklist: D(deck), agent: "x" }, { name: "b", decklist: D(theirs), agent: "x" }], rules: rules(maxTurns), modifiers: mods } as MatchSpec, cards, [agent, passer]));
/** Casts `card` in the first main phase; every other request takes its first action that is not a decline. */
const caster = (card: string): Agent => { let done = false; return { chooseAction: async (v: GameView, r) => {
  if (r.purpose === "priority") {
    if (!done && v.step === "MAIN1" && v.stack.length === 0) { const a = r.actions.find((c) => c.type === "castSpell" && v.hand.find((h) => h.objectId === c.objectId)?.cardId === card); if (a) { done = true; return a; } }
    return pass(r);
  }
  return r.actions.find((a) => a.type === "acceptOptional") ?? r.actions.find((a) => a.type !== "declineSearch") ?? r.actions[0]!;
} }; };

/**
 * Post-S70 — Chris's five tier-2 creatures: Shevelport Quartermaster, Burnfallow Exuberant, Notion Flayer, Den of Vipers
 * and Sapwell Dryad. The only new word is the target predicate `land` (the Dryad). Fuzz: `s70-tier2-five-fuzz.test.ts`.
 */
describe("Post-S70 — the five tier-2 creatures", () => {
  it("Shevelport Quartermaster: an Equipment from the library to the hand", async () => {
    const f = await run({ shevelport_quartermaster: 30, bonesplitter: 30 }, n(2, 0, "plains"), caster("shevelport_quartermaster"));
    expect(onBf(f, "shevelport_quartermaster")).toHaveLength(1);
    const inHand = f.players[0]!.hand.filter((id) => f.objects[id]!.cardId === "bonesplitter").length;
    expect(f.players[0]!.library.length).toBe(60 - 7 - 1); // the search took one
    expect(inHand).toBeGreaterThan(0);
  });

  it("Burnfallow Exuberant: a Mountain card — a Taiga counts — onto the battlefield tapped", async () => {
    const f = await run({ burnfallow_exuberant: 30, taiga: 30 }, n(2, 0, "mountain"), caster("burnfallow_exuberant"));
    const t = onBf(f, "taiga");
    expect(t).toHaveLength(1);
    expect(f.objects[t[0]!]!.tapped).toBe(true);
  });

  it("Notion Flayer: attacks and mills its power, blocked or not", async () => {
    let declared = false;
    const attacker: Agent = { chooseAction: async (_v, r) => {
      if (r.purpose === "declareAttacker" && !declared) { const a = r.actions.find((x) => x.type === "declareAttacker"); if (a) { declared = true; return a; } }
      return pass(r);
    } };
    const f = await run({ island: 60 }, [{ ...perm(0, "notion_flayer") }], attacker);
    expect(declared).toBe(true);
    expect(f.players[1]!.graveyard).toHaveLength(2);
  });

  it("Den of Vipers: a counter on each Snake we control — itself included; theirs and our non-Snakes not", async () => {
    const f = await run({ den_of_vipers: 60 }, [...n(2, 0, "swamp"), perm(0, "reapers_forerunner"), perm(0, "grizzly_bears"), perm(1, "reapers_forerunner")], caster("den_of_vipers"));
    const c = (id: string, p = 0) => f.objects[onBf(f, id, p)[0]!]!.counters?.["+1/+1"] ?? 0;
    expect(c("den_of_vipers")).toBe(1); // a 2/2 deathtouch for BB
    expect(c("reapers_forerunner")).toBe(1);
    expect(c("grizzly_bears")).toBe(0);
    expect(c("reapers_forerunner", 1)).toBe(0);
  });

  it("Sapwell Dryad: a land tapped for mana, untapped, and tapped again — and the Dryad's target is a land only", async () => {
    let taps = 0, done = false, targets: unknown[] = [];
    const a: Agent = { chooseAction: async (v, r) => {
      if (r.purpose !== "priority" || v.step !== "MAIN1") return pass(r);
      const land = v.battlefield.find((o) => o.cardId === "forest" && o.controller === 0);
      if (taps === 0) { const t = r.actions.find((x) => x.type === "tapForMana" && x.objectId === land?.id); if (t) { taps = 1; return t; } }
      if (!done) { const acts = r.actions.filter((x): x is Action & { type: "activateAbility" } => x.type === "activateAbility"); targets = acts.map((x) => v.battlefield.find((o) => o.id === (x.targets[0] as { id: string }).id)?.cardId); const u = acts.find((x) => (x.targets[0] as { id: string }).id === land?.id); if (u) { done = true; return u; } }
      return pass(r);
    } };
    const f = await run({ island: 60 }, [perm(0, "forest"), perm(0, "sapwell_dryad"), perm(1, "grizzly_bears")], a);
    expect(done).toBe(true);
    expect(f.objects[onBf(f, "forest")[0]!]!.tapped ?? false).toBe(false);
    expect(f.objects[onBf(f, "sapwell_dryad")[0]!]!.tapped).toBe(true);
    expect(targets).not.toContain("grizzly_bears");
    expect(targets).not.toContain("sapwell_dryad");
  });
});
