import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard, type CardDef } from "@shandalar/cards";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards as Map<string, CardDef>;
const card = JSON.parse(readFileSync(join(ROOT, "data/cards/highland_ritual.json"), "utf8")) as CardDef;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const n = (k: number, p: 0 | 1, id: string) => Array.from({ length: k }, () => perm(p, id));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
/** Casts the ritual in the first main phase, then reports the pool it sees with an empty stack. */
const run = async (mods: Modifier[]) => {
  let cast = false, pool = -1;
  const a: Agent = { chooseAction: async (v: GameView, r) => {
    if (r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) {
      if (cast && pool < 0) pool = v.manaPool.R;
      const c = r.actions.find((x) => x.type === "castSpell");
      if (!cast && c) { cast = true; return c; }
    }
    return pass(r);
  } };
  const D = (id: string) => [{ cardId: id, count: 60 }];
  const spec = { seed: 77, players: [{ name: "a", decklist: D("highland_ritual"), agent: "x" }, { name: "b", decklist: D("forest"), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 }, modifiers: mods } as MatchSpec;
  await runMatch(spec, cards, [a, passer]);
  return { cast, pool };
};

/**
 * Post-S70 — R-122: `addMana.times`, Highland Ritual. Koth of the Hammer's −2 as a spell ("Add {R} for each Mountain you control",
 * Scryfall). Counted as it resolves, on the subtype: a Taiga is a Mountain, a Forest is not, an opponent's does not
 * count. Mana is not a mana ability here: a spell uses the stack (CR 605.1). Fuzz: `s70-highland-ritual-fuzz.test.ts`.
 */
describe("R-122 — mana for each Mountain", () => {
  it("the card validates, and a `times` that is not a value ref does not", () => {
    expect(validateCard(card).errors).toEqual([]);
    expect(validateCard({ ...card, spellEffect: [{ type: "addMana", mana: "{R}", times: 3 }] }).errors.length).toBeGreaterThan(0);
  });
  it("four Mountains: paid with two, four back, two net", async () => {
    expect(await run(n(4, 0, "mountain"))).toEqual({ cast: true, pool: 4 });
  });
  it("a Taiga is a Mountain; a Forest is not; the opponent's Mountains are not ours", async () => {
    expect(await run([...n(2, 0, "taiga"), ...n(2, 0, "forest"), ...n(3, 1, "mountain")])).toEqual({ cast: true, pool: 2 });
  });
  it("Mountaincycling: {2} and the card, for a Mountain from the library to the hand", async () => {
    let cycled = false, hand = 0, mountains = 0;
    const a: Agent = { chooseAction: async (v: GameView, r) => {
      if (r.purpose === "priority" && v.step === "MAIN1" && !cycled) { const c = r.actions.find((x) => x.type === "activateAbility"); if (c) { cycled = true; hand = v.hand.length; return c; } }
      if (r.purpose === "priority" && cycled && !mountains && v.step === "MAIN1" && v.stack.length === 0) mountains = v.hand.filter((h) => h.cardId === "mountain").length;
      return r.actions.find((x) => x.type !== "declineSearch" && r.purpose !== "priority") ?? pass(r);
    } };
    const spec = { seed: 77, players: [{ name: "a", decklist: [{ cardId: "highland_ritual", count: 56 }, { cardId: "mountain", count: 4 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 }, modifiers: n(3, 0, "mountain") } as MatchSpec;
    await runMatch(spec, cards, [a, passer]);
    expect(cycled).toBe(true);
    expect(hand).toBeGreaterThan(0);
    expect(mountains).toBeGreaterThan(0);
  });

  it("one Mountain among three lands: a net loss", async () => {
    expect(await run([perm(0, "taiga"), ...n(2, 0, "forest")])).toEqual({ cast: true, pool: 1 });
  });
});
