import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { objects: Record<string, { cardId: string }>; battlefield: string[]; players: { life: number }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;

/** Seat 0 takes `step` once in its first main phase; Valakut's "may" is accepted and aimed at the opponent; a search
 * finds; a sacrifice takes a Forest. */
function actor(step: (v: GameView, r: ActionRequest) => Action | undefined): Agent {
  let done = false;
  return { chooseAction: async (v, r) => {
    if (r.purpose === "priority") {
      if (!done && v.step === "MAIN1" && v.stack.length === 0) { const a = step(v, r); if (a) { done = true; return a; } }
      return pass(r);
    }
    if (r.purpose === "chooseTarget") return r.actions.find((a) => (a as { targets?: { kind: string; player?: number }[] }).targets?.some((t) => t.kind === "player" && t.player === 1)) ?? r.actions[0]!;
    if (r.purpose === "chooseSacrifice") return r.actions.find((a) => a.type === "sacrifice" && v.battlefield.find((o) => o.id === a.objectId)?.cardId === "forest") ?? r.actions[0]!;
    return r.actions.find((a) => a.type === "acceptOptional") ?? r.actions.find((a) => a.type !== "declineSearch") ?? r.actions[0]!;
  } };
}
const playMountain = (v: GameView, r: ActionRequest) => r.actions.find((a) => a.type === "playLand" && v.hand.find((h) => h.objectId === a.objectId)?.cardId === "mountain");
const run = async (mods: Modifier[], step: (v: GameView, r: ActionRequest) => Action | undefined) => fin(await runMatch(
  { seed: 72, players: [{ name: "a", decklist: D({ mountain: 60 }), agent: "x" }, { name: "b", decklist: D({ forest: 60 }), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 }, modifiers: [perm(0, "valakut_the_molten_pinnacle"), ...mods] } as MatchSpec,
  cards, [actor(step), passer]));
const mountains = (n: number) => Array.from({ length: n }, () => perm(0, "mountain"));

/**
 * Post-S70 — R-120, Valakut, the Molten Pinnacle (Scryfall ZEN #228; Chris's tier 2, the payoff for Burnfallow): "This
 * land enters tapped. Whenever a Mountain you control enters, if you control at least five other Mountains, you may
 * have this land deal 3 damage to any target." The intervening if (CR 603.4) counts the OTHER Mountains, is read once
 * the event's batch is done, and again on resolution. A dual with the Mountain type counts; Valakut is not a Mountain.
 */
describe("R-120 — Valakut, the Molten Pinnacle", () => {
  it("the sixth Mountain: five others — 3 damage", async () => {
    expect((await run(mountains(5), playMountain)).players[1]!.life).toBe(17);
  });

  it("the fifth Mountain: four others — nothing (Valakut itself is not a Mountain)", async () => {
    expect((await run(mountains(4), playMountain)).players[1]!.life).toBe(20);
  });

  it("a Taiga is a Mountain: four Mountains and a Taiga, then a Mountain — 3 damage", async () => {
    expect((await run([...mountains(4), perm(0, "taiga")], playMountain)).players[1]!.life).toBe(17);
  });

  it("Burnfallow's two basics enter together and each sees the other: four Mountains, then two — two triggers, 6 damage", async () => {
    const mods = [...mountains(4), perm(0, "forest"), perm(0, "forest"), perm(0, "burnfallow")];
    const f = await run(mods, (v, r) => r.actions.find((a) => a.type === "activateAbility" && v.battlefield.find((o) => o.id === a.objectId)?.cardId === "burnfallow" && a.abilityIndex === 2));
    expect(f.battlefield.filter((id) => f.objects[id]!.cardId === "mountain")).toHaveLength(6);
    expect(f.players[1]!.life).toBe(14);
  });
});
