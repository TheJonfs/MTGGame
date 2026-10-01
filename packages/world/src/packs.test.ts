import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors } from "@shandalar/cards";
import { LAW_IDS } from "./formats.js";
import { isBasic } from "./legality.js";
import { PACK_TIERS, fillErrors, resolveSet, rollPack, rollSealedPool, validatePackData, type ConvocationPackData } from "./packs.js";
import { WorldRng } from "./rng.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const set = (id: string) => data.sets.find((s) => s.id === id)!;
const recipe = (id: string) => data.recipes.find((r) => r.id === id)!;

/** S47 (Part 3): the Convocation's sets and pack recipes — the data validates, and a pack obeys its recipe. */
describe("the Convocation's packs (S47 Part 3)", () => {
  it("the data is valid: weights sum to one, every set fills its recipe, the brief's nine sets and four recipes are there", () => {
    expect(validatePackData(data, pool)).toEqual([]);
    expect(data.sets.map((s) => s.id)).toEqual(["plane", "first_bloom", "flood", "pair_wu", "pair_ub", "pair_wr", "pair_bg", "pair_rg", "pauper"]);
    expect(data.recipes.map((r) => r.id)).toEqual(["classic", "flat", "rich", "pauper"]);
  });

  it("the validator refuses: weights off one, an unknown card, a set too thin for its recipe", () => {
    const bad = (d: ConvocationPackData) => validatePackData(d, pool).length > 0;
    expect(bad({ ...data, recipes: [...data.recipes.slice(1), { id: "classic", name: "x", slots: [{ count: 15, weights: { "1": 0.7 } }] }] })).toBe(true);
    expect(bad({ ...data, sets: [{ id: "x", name: "x", recipe: "classic", filter: { exclude: ["no_such_card"] } }] })).toBe(true);
    expect(bad({ ...data, sets: [{ id: "x", name: "x", recipe: "classic", filter: { exclude: ["black_lotus_token", "plains"] } }] })).toBe(true);
    expect(fillErrors(set("pauper"), recipe("classic"), pool).length).toBeGreaterThan(0); // no tier 2, 3 or R in a Pauper set
  });

  it("no set holds a basic, a token, a law or a prize card; the pair sets stay in their colours; Pauper is tier 1", () => {
    for (const s of data.sets) {
      const cards = resolveSet(s, pool);
      for (const t of PACK_TIERS) for (const id of cards[t]) {
        const d = pool.get(id)!;
        expect(isBasic(id) || d.isTokenDef || d.prizeOnly || (LAW_IDS as readonly string[]).includes(id), `${s.id}: ${id}`).toBeFalsy();
        expect(String(d.shopTier)).toBe(t);
        if (s.filter.colorsWithin) expect(cardColors(d).every((c) => s.filter.colorsWithin!.includes(c)), `${s.id}: ${id}`).toBe(true);
      }
    }
    const p = resolveSet(set("pauper"), pool);
    expect(p["2"].length + p["3"].length + p.R.length).toBe(0);
    const wu = resolveSet(set("pair_wu"), pool), all = [...wu["1"], ...wu["2"], ...wu["3"], ...wu.R];
    expect(all).toContain("tundra");
    expect(all).not.toContain("bayou");
    expect(resolveSet(set("first_bloom"), pool)["3"]).not.toContain("dragon_mage");
    expect(resolveSet(set("flood"), pool)).toEqual(resolveSet(set("plane"), pool)); // Chris, S47: the Flood is a superset of the First Bloom
  });

  it("a Classic pack: fifteen distinct cards — one from {3,R}, three from {2,3}, eleven from {1,2}; the seed is the pack", () => {
    const cards = resolveSet(set("plane"), pool);
    for (let seed = 1; seed <= 200; seed++) {
      const pack = rollPack(cards, recipe("classic"), new WorldRng(seed));
      const tiers = pack.map((id) => String(pool.get(id)!.shopTier));
      expect(pack).toHaveLength(15);
      expect(new Set(pack).size).toBe(15);
      expect(["3", "R"]).toContain(tiers[0]);
      for (const t of tiers.slice(1, 4)) expect(["2", "3"]).toContain(t);
      for (const t of tiers.slice(4)) expect(["1", "2"]).toContain(t);
    }
    expect(rollPack(cards, recipe("classic"), new WorldRng(11))).toEqual(rollPack(cards, recipe("classic"), new WorldRng(11)));
  });

  it("a Sealed pool is six packs from one seed; packs may share a card, a pack never repeats one", () => {
    const packs = rollSealedPool(set("plane"), recipe("classic"), pool, 7);
    expect(packs).toHaveLength(6);
    for (const p of packs) expect(new Set(p).size).toBe(15);
    expect(rollSealedPool(set("plane"), recipe("classic"), pool, 7)).toEqual(packs);
    expect(rollSealedPool(set("plane"), recipe("classic"), pool, 8)).not.toEqual(packs);
  });

  it("the slot weights hold over many packs (Classic's rare slot: about one R in five)", () => {
    const cards = resolveSet(set("plane"), pool), rng = new WorldRng(47);
    let r = 0; const N = 4000;
    for (let i = 0; i < N; i++) if (String(pool.get(rollPack(cards, recipe("classic"), rng)[0]!)!.shopTier) === "R") r++;
    expect(r / N).toBeGreaterThan(0.17);
    expect(r / N).toBeLessThan(0.23);
  });
});

describe("the card rating, v0 (S47 Part 2)", () => {
  it("every row is a real, ratable card with a finite rating; a card outside the table reads its tier's prior", async () => {
    const { cardRating, ratingPrior } = await import("./rating.js");
    const table = read("card-rating.json") as { cards: Record<string, { rating: number; prior: number }> };
    expect(Object.keys(table.cards).length).toBeGreaterThan(200);
    for (const [id, row] of Object.entries(table.cards)) {
      const d = pool.get(id);
      expect(d, id).toBeDefined();
      expect(isBasic(id) || d!.isTokenDef).toBeFalsy();
      expect(Number.isFinite(row.rating)).toBe(true);
      expect(row.prior).toBe(ratingPrior(d!));
    }
    expect(cardRating(pool.get("savannah_lions")!, { cards: {} })).toBe(1.0);
    expect(cardRating(pool.get("black_lotus")!, { cards: {} })).toBe(2.5);
    expect(cardRating(pool.get("savannah_lions")!, table as never)).toBe(table.cards.savannah_lions!.rating);
  });
});
