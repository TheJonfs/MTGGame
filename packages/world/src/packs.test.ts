import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors } from "@shandalar/cards";
import { LAW_IDS } from "./formats.js";
import { isBasic } from "./legality.js";
import { PACK_TIERS, fillErrors, packTier, resolveSet as resolveSetRaw, rollPack, rollSealedPool as rollSealedRaw, validatePackData, type ConvocationPackData, type SetDef, type Recipe } from "./packs.js";
import { WorldRng } from "./rng.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const resolveSet = (s: SetDef, p: typeof pool) => resolveSetRaw(s, p, data.power);
const rollSealedPool = (s: SetDef, r: Recipe, p: typeof pool, seed: number) => rollSealedRaw(s, r, p, data.power, seed);
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
    expect(fillErrors(set("pauper"), recipe("classic"), pool, data.power)).toEqual([]); // S48: every slot rolls down to tier 1
    expect(fillErrors(set("pauper"), { id: "x", name: "x", slots: [{ count: 80, weights: { "1": 1 } }] }, pool, data.power).length).toBeGreaterThan(0); // 73 cards, 80 slots
  });

  it("no set holds a basic, a token, a law or the power; the legends are in at tier R; the pair sets stay in their colours; Pauper is tier 1", () => {
    for (const s of data.sets) {
      const cards = resolveSet(s, pool);
      for (const t of PACK_TIERS) for (const id of cards[t]) {
        const d = pool.get(id)!;
        expect(isBasic(id) || d.isTokenDef || data.power.includes(id) || (LAW_IDS as readonly string[]).includes(id), `${s.id}: ${id}`).toBeFalsy();
        expect(packTier(d)).toBe(t);
        if (d.prizeOnly) expect(t).toBe("R");
        if (s.filter.colorsWithin) expect(cardColors(d).every((c) => s.filter.colorsWithin!.includes(c)), `${s.id}: ${id}`).toBe(true);
      }
    }
    const p = resolveSet(set("pauper"), pool);
    expect(p["2"].length + p["3"].length + p.R.length).toBe(0);
    const wu = resolveSet(set("pair_wu"), pool), all = [...wu["1"], ...wu["2"], ...wu["3"], ...wu.R];
    expect(all).toContain("tundra");
    expect(all).not.toContain("bayou");
    expect(resolveSet(set("first_bloom"), pool)["3"]).not.toContain("dragon_mage");
    // Chris, S47: a Clio or a Fordkeeper as pack one, pick one — the legends draft; the power does not.
    const plane = resolveSet(set("plane"), pool);
    expect(plane.R).toEqual(expect.arrayContaining(["clio_lady_of_the_depths", "the_fordkeeper", "the_usher"]));
    for (const id of ["black_lotus", "mox_jet", "time_walk", "wrackroot", "tallyflame_court"]) expect(plane.R).not.toContain(id);
    expect(data.power).toHaveLength(14); // ADR-146: the Manafleur and the Cinquefont never draft
    expect(plane.R).not.toContain("the_manafleur");
    expect(fillErrors(set("first_bloom"), recipe("flat"), pool, data.power)).toEqual([]); // S48: a spent tier rolls down
    expect(resolveSet(set("pair_ub"), pool).R).toContain("clio_lady_of_the_depths");
    expect(resolveSet(set("first_bloom"), pool).R).not.toContain("the_fordkeeper"); // a flood legend
    expect(resolveSet(set("first_bloom"), pool).R).toEqual(expect.arrayContaining(["the_usher", "clio_lady_of_the_depths"]));
    expect(resolveSet(set("flood"), pool)).toEqual(resolveSet(set("plane"), pool)); // Chris, S47: the Flood is a superset of the First Bloom
  });

  it("a Classic pack: fifteen distinct cards — one from {3,R}, three from {2,3}, eleven from {1,2}; the seed is the pack", () => {
    const cards = resolveSet(set("plane"), pool);
    for (let seed = 1; seed <= 200; seed++) {
      const pack = rollPack(cards, recipe("classic"), new WorldRng(seed));
      const tiers = pack.map((id) => String(packTier(pool.get(id)!)));
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
    for (let i = 0; i < N; i++) if (String(packTier(pool.get(rollPack(cards, recipe("classic"), rng)[0]!)!)) === "R") r++;
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
