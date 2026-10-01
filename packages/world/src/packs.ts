/**
 * S47 (Part 3, ADR-145): the Convocation's Limited data — a SET is a pool subset (a filter over the card pool) and a
 * RECIPE is `slots × tier weights`; a pack is a seeded draw. Pure and browser-safe: the data (data/convocation) is
 * handed in. Never in a pack, whatever the filter says: basics, tokens, the laws, and the POWER (the data's list — the
 * Lotus, the Moxen, Time Walk, the High Grounds). The other prize cards — the legends — are in packs at tier R
 * (Chris, S47: a Clio or a Fordkeeper as pack one, pick one is a possibility). A pack holds no duplicate; two packs may share a card (Chris, S47 kickoff — tier 3 is nineteen cards, an event's worth of rare
 * slots is more).
 */
import { cardColors, type CardDef } from "@shandalar/cards";
import { LAW_IDS } from "./formats.js";
import { isBasic } from "./legality.js";
import { WorldRng } from "./rng.js";

export type PackTier = "1" | "2" | "3" | "R";
export const PACK_TIERS: readonly PackTier[] = ["1", "2", "3", "R"];
export type PackColor = "W" | "U" | "B" | "R" | "G";

export interface SetFilter {
  /** Card ids left out (a set that is "the Plane minus these"). */
  exclude?: string[];
  /** Every colour of the card inside these (a land's colours are those of its mana and its costs); colourless cards pass. */
  colorsWithin?: PackColor[];
  /** The highest tier in the set (1 = the Pauper set). */
  maxTier?: 1 | 2 | 3;
}
export interface SetDef { id: string; name: string; recipe: string; note?: string; filter: SetFilter }
export interface RecipeSlot { count: number; weights: Partial<Record<PackTier, number>> }
export interface Recipe { id: string; name: string; note?: string; slots: RecipeSlot[] }
export interface ConvocationPackData { /** Prize cards never in a pack. */ power: string[]; sets: SetDef[]; recipes: Recipe[] }

/** A card's tier in a pack: its shop tier; a prize card (no shop tier) is tier R. */
export const packTier = (d: CardDef): PackTier | undefined => (d.shopTier !== undefined ? (String(d.shopTier) as PackTier) : d.prizeOnly ? "R" : undefined);
const TIER_RANK: Record<PackTier, number> = { "1": 1, "2": 2, "3": 3, R: 4 };

/** A card's colours for a set's colour filter: its cost's, and — a land — every colour its abilities name. */
export function packColors(d: CardDef): PackColor[] {
  const out = new Set<PackColor>(cardColors(d));
  if (d.types.includes("Land")) { const s = JSON.stringify(d.abilities ?? []); for (const c of ["W", "U", "B", "R", "G"] as const) if (s.includes(`{${c}}`)) out.add(c); }
  return [...out];
}

/** Whether a card may ever sit in a pack: not a basic, a token, a law or the power, and it has a pack tier. */
export function packable(d: CardDef, power: readonly string[]): boolean {
  return !isBasic(d.id) && !d.isTokenDef && !power.includes(d.id) && !(LAW_IDS as readonly string[]).includes(d.id) && packTier(d) !== undefined;
}

/** The set's cards by tier (ids sorted — the draw is seed-stable across load orders). */
export function resolveSet(set: SetDef, pool: Map<string, CardDef>, power: readonly string[]): Record<PackTier, string[]> {
  const out: Record<PackTier, string[]> = { "1": [], "2": [], "3": [], R: [] };
  const exclude = new Set(set.filter.exclude ?? []);
  const within = set.filter.colorsWithin ? new Set<PackColor>(set.filter.colorsWithin) : undefined;
  for (const d of pool.values()) {
    if (!packable(d, power) || exclude.has(d.id)) continue;
    const t = packTier(d)!;
    if (set.filter.maxTier !== undefined && TIER_RANK[t] > set.filter.maxTier) continue;
    if (within && packColors(d).some((c) => !within.has(c))) continue;
    out[t].push(d.id);
  }
  for (const t of PACK_TIERS) out[t].sort();
  return out;
}

/** The data's own errors (shape; weights summing to one; a set's ids real and packable; a set able to fill its recipe). */
export function validatePackData(data: ConvocationPackData, pool: Map<string, CardDef>): string[] {
  const errors: string[] = [];
  const recipes = new Map(data.recipes.map((r) => [r.id, r]));
  for (const id of data.power) { const d = pool.get(id); if (!d) errors.push(`power: unknown card ${id}`); else if (!d.prizeOnly) errors.push(`power: ${id} is not a prize card`); }
  if (recipes.size !== data.recipes.length) errors.push("recipes: duplicate id");
  for (const r of data.recipes) {
    if (!r.slots.length) errors.push(`recipe ${r.id}: no slots`);
    r.slots.forEach((s, i) => {
      const sum = Object.values(s.weights).reduce((a, b) => a + (b ?? 0), 0);
      if (!Number.isInteger(s.count) || s.count < 1) errors.push(`recipe ${r.id} slot ${i}: count must be a positive integer`);
      if (Object.keys(s.weights).some((t) => !PACK_TIERS.includes(t as PackTier))) errors.push(`recipe ${r.id} slot ${i}: unknown tier`);
      if (Object.values(s.weights).some((w) => (w ?? 0) < 0) || Math.abs(sum - 1) > 1e-9) errors.push(`recipe ${r.id} slot ${i}: weights must be non-negative and sum to one (${sum})`);
    });
  }
  if (new Set(data.sets.map((s) => s.id)).size !== data.sets.length) errors.push("sets: duplicate id");
  for (const s of data.sets) {
    for (const id of s.filter.exclude ?? []) { const d = pool.get(id); if (!d) errors.push(`set ${s.id}: unknown card ${id}`); else if (!packable(d, data.power)) errors.push(`set ${s.id}: excludes ${id}, which is never in a pack`); }
    const r = recipes.get(s.recipe);
    if (!r) { errors.push(`set ${s.id}: unknown recipe ${s.recipe}`); continue; }
    errors.push(...fillErrors(s, r, pool, data.power));
  }
  return errors;
}

/** Why this set cannot fill this recipe: a tier a slot draws from must hold at least as many cards as the slots that
 * can draw from it (a pack holds no duplicate, so the worst roll must still fill). */
export function fillErrors(set: SetDef, recipe: Recipe, pool: Map<string, CardDef>, power: readonly string[]): string[] {
  const cards = resolveSet(set, pool, power);
  const errors: string[] = [];
  for (const t of PACK_TIERS) {
    const need = recipe.slots.reduce((n, s) => n + ((s.weights[t] ?? 0) > 0 ? s.count : 0), 0);
    if (need > cards[t].length) errors.push(`set ${set.id} × recipe ${recipe.id}: tier ${t} holds ${cards[t].length} cards, the pack may draw ${need}`);
  }
  return errors;
}

/** One pack: slot by slot, a tier by the slot's weights, then a card of that tier not already in the pack. */
export function rollPack(cards: Record<PackTier, string[]>, recipe: Recipe, rng: WorldRng): string[] {
  const pack: string[] = [];
  for (const slot of recipe.slots) for (let i = 0; i < slot.count; i++) {
    let roll = rng.float(), tier: PackTier | undefined;
    for (const t of PACK_TIERS) { const w = slot.weights[t] ?? 0; if (w <= 0) continue; tier = t; if (roll < w) break; roll -= w; }
    const left = cards[tier!].filter((id) => !pack.includes(id));
    if (!left.length) throw new Error(`rollPack: tier ${tier} exhausted (validate the set against the recipe first)`);
    pack.push(left[rng.int(left.length)]!);
  }
  return pack;
}

/** A Sealed pool: `packs` packs from one seed (the formats doc §2.3 — six Classic packs). */
export function rollSealedPool(set: SetDef, recipe: Recipe, pool: Map<string, CardDef>, power: readonly string[], seed: number, packs = 6): string[][] {
  const cards = resolveSet(set, pool, power), rng = new WorldRng(seed);
  return Array.from({ length: packs }, () => rollPack(cards, recipe, rng));
}
