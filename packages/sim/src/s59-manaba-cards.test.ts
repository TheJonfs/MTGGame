import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard, isManaAbility, isChoiceManaAbility } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const manaba = cards.get("manaba")!;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const cardOf = (v: GameView, id: string | undefined) => (id ? (v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId) : undefined);

/**
 * Post-S59 — the Manaba (Chris's card; R-107). {G} Creature — Snake 1/1 (tried at 0/1 and at 1/1 giving two life; Chris took the 1/1 for one).
 * "Tap an untapped Snake you control: Add one mana of any color. Each opponent gains 1 life."
 * Rules: 605.1a (an activated ability with no target that could add mana is a mana ability, whatever else it does),
 * 605.3b (it resolves at once; no stack), 302.6 / 602.5a (summoning sickness stops only a cost with the {T} symbol —
 * a creature that came in this turn may be tapped for another kind of cost).
 */
describe("Post-S59 — the Manaba (R-107)", () => {
  it("the def is valid, and its ability is a mana ability activated deliberately", () => {
    expect(validateCard(manaba).errors).toEqual([]);
    expect([manaba.manaCost, manaba.types, manaba.subtypes, manaba.power, manaba.toughness, manaba.source]).toEqual(["{G}", ["Creature"], ["Snake"], 1, 1, "custom"]);
    expect(manaba.text).toBe("Tap an untapped Snake you control: Add one mana of any color. Each opponent gains 1 life.");
    expect([isManaAbility(manaba.abilities![0]!), isChoiceManaAbility(manaba.abilities![0]!)]).toEqual([true, true]);
  });

  it("cast and tapped the turn it comes in (302.6: no {T} in the cost): the mana is in the pool at once, the opponent gains 1, and a Rage Cobra's trigger sees the gain; another Snake pays the cost too", async () => {
    const seen: { pool: number; life: number; stack: number; tapped: string[] }[] = []; let step = 0;
    const me: Agent = { chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
      if (r.purpose === "chooseTarget") return r.actions.find((a) => ((a as { targets?: { id?: string }[] }).targets ?? []).some((t) => v.battlefield.some((o) => o.id === t.id && o.cardId === "rage_cobra"))) ?? r.actions[0]!;
      if (r.purpose !== "priority") { const snakeToTap = r.actions.find((a) => a.type === "tapCreature" && cardOf(v, (a as { objectId: string }).objectId) === (step === 2 ? "manaba" : "rage_cobra")); return snakeToTap ?? r.actions[0]!; }
      if (v.activePlayer !== 0 || v.step !== "MAIN1" || v.stack.length > 0) return r.actions.find((a) => a.type === "pass")!;
      if (step === 0) { const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === "manaba"); if (a) { step = 1; return a; } }
      const act = (color: string) => r.actions.find((x) => x.type === "activateAbility" && cardOf(v, x.objectId) === "manaba" && (x as { color?: string }).color === color);
      if (step === 1 && v.battlefield.some((o) => o.cardId === "manaba")) { const a = act("R"); expect(a).toBeDefined(); step = 2; return a!; }
      if (step === 2) { seen.push({ pool: Object.values(v.manaPool).reduce((x, y) => x + y, 0), life: v.life[1], stack: v.stack.length, tapped: v.battlefield.filter((o) => o.tapped).map((o) => o.cardId).sort() }); const a = act("G"); if (a) { step = 3; return a; } }
      if (step === 3) { seen.push({ pool: Object.values(v.manaPool).reduce((x, y) => x + y, 0), life: v.life[1], stack: v.stack.length, tapped: v.battlefield.filter((o) => o.tapped).map((o) => o.cardId).sort() }); step = 4; expect(act("G")).toBeUndefined(); /* no untapped Snake left */ }
      return r.actions.find((a) => a.type === "pass")!;
    } };
    const them: Agent = { chooseAction: async (_v, r) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]! };
    const spec: MatchSpec = { seed: 5, players: [{ name: "a", decklist: D({ manaba: 40, forest: 20 }), agent: "x" }, { name: "b", decklist: D({ mountain: 60 }), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"], modifiers: [perm(0, "forest"), perm(0, "rage_cobra")] };
    const r = await runMatch(spec, cards, [me, them]);
    expect(step).toBe(4);
    // after the first tap (the Manaba itself, summoning-sick): one mana floating, the opponent at 21; the Cobra's trigger has been put on the stack and resolved by the time we have priority with an empty stack
    expect(seen[0]).toMatchObject({ pool: 1, life: 21, stack: 0, tapped: ["forest", "manaba"] });
    // the second tap is paid with the Cobra: two floating, 22
    expect(seen[1]).toMatchObject({ pool: 2, life: 22, tapped: ["forest", "manaba", "rage_cobra"] });
    const final = JSON.parse(r.finalStateSerialized) as { objects: Record<string, { cardId: string; zone: string; counters?: Record<string, number> }> };
    const cobra = Object.values(final.objects).find((o) => o.cardId === "rage_cobra" && o.zone === "battlefield")!;
    expect(cobra.counters?.["+1/+1"]).toBe(2); // one counter a life gained
  });
});
