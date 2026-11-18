import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { rollSealedPool, type ConvocationPackData } from "./packs.js";
import { buildForcedDeck, buildLimitedDeck } from "./limited-builder.js";
import { limitedView, type CardRatingTable } from "./rating.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const set = data.sets.find((s) => s.id === "plane")!, recipe = data.recipes.find((r) => r.id === set.recipe)!;
const rating = limitedView(read("card-rating.json") as CardRatingTable);
const poolOf = (i: number) => rollSealedPool(set, recipe, cards, data.power, 7300003 + i, 6).flat();
const size = (d: { count: number }[]) => d.reduce((n, e) => n + e.count, 0);

/** S73 Part 2 (concern 54): forced inclusion — a deck built with a named card played, for the cards the Limited table
 * rates too low to be played and so never re-measures. */
describe("S73: the forced build", () => {
  it("a low-rated one-colour card is played in a deck of its colour, and the deck keeps its size", () => {
    for (let i = 0; i < 12; i++) {
      const pool = [...poolOf(i), "entomb"], plain = buildLimitedDeck(poolOf(i), rating, cards), forced = buildForcedDeck(pool, "entomb", rating, cards);
      expect(forced, `pool ${i}`).not.toBeNull();
      expect(forced!.deck.find((e) => e.cardId === "entomb")?.count ?? 0, `pool ${i}`).toBeGreaterThanOrEqual(1); // a pool that rolled its own copy plays both
      expect(size(forced!.deck)).toBe(size(plain.deck));
      expect(forced!.colors).toContain("B");
    }
  });
  it("a colourless card is played whatever the pair", () => {
    const pool = [...poolOf(3), "altar_of_dementia"], forced = buildForcedDeck(pool, "altar_of_dementia", rating, cards)!;
    expect(forced.deck.some((e) => e.cardId === "altar_of_dementia")).toBe(true);
  });
  it("a card the deck cannot cast is not forced: the three-colour Bailiff in a two-colour deck returns null", () => {
    const got = Array.from({ length: 12 }, (_, i) => buildForcedDeck([...poolOf(i), "the_bailiff"], "the_bailiff", rating, cards));
    expect(got.some((b) => b === null)).toBe(true);
    for (const b of got) if (b) { const cs = [...b.colors, ...(b.splash ? [b.splash] : [])]; for (const c of ["W", "U", "R"]) expect(cs).toContain(c); }
  });
  it("the pool must hold the card", () => { expect(() => buildForcedDeck(poolOf(0).filter((id) => id !== "entomb"), "entomb", rating, cards)).toThrow(/does not hold/); });
});
