import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const n = (k: number, p: 0 | 1, id: string) => Array.from({ length: k }, () => perm(p, id));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { objects: Record<string, { cardId: string; controller: number }>; battlefield: string[]; players: { life: number; graveyard: string[] }[] };
const rules = { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"];
/** Casts Molten Rain in the first main phase at the first land named `at` (of `whose`), then passes. */
const rain = (at: string, whose: 0 | 1): Agent => { let done = false; return { chooseAction: async (v: GameView, r) => {
  if (r.purpose === "priority" && !done && v.step === "MAIN1" && v.stack.length === 0) {
    const a = r.actions.find((c) => c.type === "castSpell" && v.hand.find((h) => h.objectId === c.objectId)?.cardId === "molten_rain"
      && c.targets[0]?.kind === "object" && v.battlefield.some((o) => o.id === (c.targets[0] as { id: string }).id && o.cardId === at && o.controller === whose));
    if (a) { done = true; return a; }
  }
  return pass(r);
} }; };
const run = async (mods: Modifier[], agent: Agent) => JSON.parse((await runMatch({ seed: 23, players: [{ name: "a", decklist: [{ cardId: "molten_rain", count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules, modifiers: mods } as MatchSpec, cards, [agent, passer])).finalStateSerialized) as Final;
const on = (f: Final, id: string, p: number) => f.battlefield.filter((o) => f.objects[o]!.cardId === id && f.objects[o]!.controller === p).length;
const mana = n(3, 0, "mountain");

/** Post-S70 — Molten Rain (R-123): "Destroy target land. If that land was nonbasic, Molten Rain deals 2 damage to the
 * land's controller." The condition reads the land as it last existed (CR 608.2h) — after the destroy has taken it. */
describe("Post-S70 — Molten Rain (R-123)", () => {
  it("a nonbasic land: destroyed, and 2 damage to its controller", async () => {
    const f = await run([...mana, perm(1, "valakut_the_molten_pinnacle"), perm(1, "forest")], rain("valakut_the_molten_pinnacle", 1));
    expect(on(f, "valakut_the_molten_pinnacle", 1)).toBe(0);
    expect(f.players[1]!.life).toBe(18);
    expect(f.players[0]!.life).toBe(20);
  });

  it("a basic land: destroyed, no damage", async () => {
    const f = await run([...mana, perm(1, "valakut_the_molten_pinnacle"), perm(1, "forest")], rain("forest", 1));
    expect(on(f, "forest", 1)).toBe(0);
    expect(on(f, "valakut_the_molten_pinnacle", 1)).toBe(1);
    expect(f.players[1]!.life).toBe(20);
  });

  it("a dual with basic land types is still nonbasic (Taiga): 2 damage", async () => {
    const f = await run([...mana, perm(1, "taiga")], rain("taiga", 1));
    expect(on(f, "taiga", 1)).toBe(0);
    expect(f.players[1]!.life).toBe(18);
  });

  it("the land's controller takes it — our own nonbasic land damages us", async () => {
    const f = await run([...mana, perm(0, "hearthspire"), perm(1, "forest")], rain("hearthspire", 0));
    expect(on(f, "hearthspire", 0)).toBe(0);
    expect(f.players[0]!.life).toBe(18);
    expect(f.players[1]!.life).toBe(20);
  });
});
