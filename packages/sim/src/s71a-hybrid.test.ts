import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, colourPips, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { payableBy } from "@shandalar/agents";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
const rules = { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"];

/** A Bolt with the cost under test — a hybrid card made for the fixture only. */
const withCost = (cost: string): Map<string, CardDef> => {
  const cards = new Map(pool);
  cards.set("hy_test", { ...pool.get("lightning_bolt")!, id: "hy_test", name: "Hybrid Test", manaCost: cost } as CardDef);
  return cards;
};
/** In the first main phase: optionally tap these lands first (floating mana), then report whether the test card's cast is offered. */
async function offered(cost: string, lands: string[], tapFirst: string[] = []): Promise<boolean> {
  let seen = false, done = false;
  const toTap = [...tapFirst];
  const agent: Agent = { chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    if (r.purpose === "priority" && v.step === "MAIN1" && !done) {
      if (toTap.length) {
        const want = toTap[0]!;
        const tap = r.actions.find((a) => a.type === "tapForMana" && v.battlefield.find((o) => o.id === (a as { objectId: string }).objectId)?.cardId === want);
        if (tap) { toTap.shift(); return tap; }
      }
      done = true;
      seen = r.actions.some((a) => a.type === "castSpell" && v.hand.find((h) => h.objectId === (a as { objectId: string }).objectId)?.cardId === "hy_test");
    }
    return pass(r);
  } };
  await runMatch({ seed: 7, players: [{ name: "a", decklist: [{ cardId: "hy_test", count: 60 }], agent: "x" }, { name: "b", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules, modifiers: lands.map((l) => perm(0, l)) } as MatchSpec, withCost(cost), [agent, passer]);
  return seen;
}

/** Post-S71a — R-125, two-colour hybrid mana (Chris's Correspondence, {1}{U/R}{U/R}). CR 107.4e: a hybrid symbol is
 * paid with either of its colours; CR 202.2d: a hybrid card is both colours; CR 202.3f: each hybrid symbol counts one
 * toward mana value. */
describe("Post-S71a — hybrid mana (R-125)", () => {
  it("parses {U/R}: one toward mana value each, both colours, half a pip to each colour for counting; other slash forms refuse", () => {
    const c = parseManaCost("{1}{U/R}{U/R}");
    expect(c.generic).toBe(1);
    expect(c.hybrid).toEqual([["U", "R"], ["U", "R"]]);
    expect(manaValue(c)).toBe(3);
    expect(colourPips(c)).toMatchObject({ U: 1, R: 1, W: 0 });
    expect(cardColors({ manaCost: "{1}{U/R}{U/R}" } as CardDef)).toEqual(["U", "R"]);
    expect(cardColors({ manaCost: "{2}{U}{R}" } as CardDef)).toEqual(["U", "R"]);
    expect(() => parseManaCost("{2/W}")).toThrow(/two-colour hybrid/);
    expect(() => parseManaCost("{W/P}")).toThrow(/two-colour hybrid/);
    expect(() => parseManaCost("{U/U}")).toThrow(/two-colour hybrid/);
  });

  it("pays a hybrid pip with either colour, and matches it against the coloured pips (a dual is one mana)", async () => {
    expect(await offered("{U/R}{U}", ["island", "mountain"])).toBe(true);
    expect(await offered("{U/R}{U}", ["island", "island"])).toBe(true);
    expect(await offered("{U/R}{U}", ["mountain", "mountain"])).toBe(false); // no U for the {U}
    expect(await offered("{U/R}{U}", ["tundra", "plains"])).toBe(false); // Tundra pays one pip, Plains neither
    expect(await offered("{U/R}{U}", ["tundra", "mountain"])).toBe(true);
    expect(await offered("{1}{U/R}{U/R}", ["mountain", "mountain", "forest"])).toBe(true); // red alone casts it
    expect(await offered("{1}{U/R}{U/R}", ["mountain", "forest", "forest"])).toBe(false);
  });

  it("floating mana joins the matching: a floating U goes to the {W/U}, the Mountain to the {U/R}", async () => {
    expect(await offered("{U/R}{W/U}", ["island", "mountain"], ["island"])).toBe(true);
    expect(await offered("{U/R}{W/U}", ["island", "forest"], ["island"])).toBe(false); // one U for two pips that both need it
  });

  it("the AI's affordability check reads a hybrid pip as either colour", () => {
    const src = (id: string, colors: string[]) => ({ id, colors, creature: false });
    expect(payableBy([src("m", ["R"]), src("i", ["U"])], "{U/R}{U}")).toBe(true);
    expect(payableBy([src("m", ["R"]), src("m2", ["R"])], "{U/R}{U}")).toBe(false);
    expect(payableBy([src("m", ["R"]), src("m2", ["R"]), src("f", ["G"])], "{1}{U/R}{U/R}")).toBe(true);
  });
});
