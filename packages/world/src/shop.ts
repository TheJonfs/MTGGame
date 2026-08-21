import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import type { KnobValues } from "./knobs.js";
import type { Town } from "./map.js";
import { WorldRng } from "./rng.js";
import type { WorldState } from "./state.js";

/**
 * Town shops (S13 Part 3; the one headless piece S12 left): stock is a pure
 * function of (world seed, town index, epoch) — epoch = floor(steps /
 * shopRefreshSteps) — so the save needs no shop state and stock refreshes
 * with the clock. Slice rule: stock does not deplete (buy repeats cost gold
 * only); depletion and selling are M6b and will want a `shops` field in a
 * versioned save. Stock is drawn from the pool by the region's colour:
 * cards whose colours ⊆ {region colour} plus colourless artifacts; basics
 * never (free and infinite); tokens never.
 */

export interface ShopItem {
  cardId: string;
  price: number;
}

const BASICS = ["plains", "island", "swamp", "mountain", "forest"];

export function shopEpoch(world: WorldState, knobs: KnobValues): number {
  return Math.floor(world.player.stepsTaken / Math.max(1, knobs.shopRefreshSteps));
}

export function shopPrice(def: CardDef, knobs: KnobValues): number {
  const mv = manaValue(parseManaCost(def.manaCost));
  return Math.max(1, Math.round(knobs.shopPriceMultiplier * knobs.shopBasePrice * (1 + mv)));
}

/** Cards a region's shop may carry: mono/colourless within the region colour. */
export function shopPoolFor(pool: Map<string, CardDef>, regionColor: string): CardDef[] {
  const out: CardDef[] = [];
  for (const def of pool.values()) {
    if ((def as { isTokenDef?: boolean }).isTokenDef) continue;
    if (def.types.includes("Land")) continue; // basics free; nonbasic lands are future collectible content
    const colors = cardColors(def);
    const within = colors.every((c) => regionColor.includes(c));
    if (within) out.push(def);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id)); // deterministic order before the seeded shuffle
}

export function rollShopStock(world: WorldState, town: Town, pool: Map<string, CardDef>, knobs: KnobValues): ShopItem[] {
  const region = world.map.regions[town.region]!;
  const candidates = shopPoolFor(pool, region.color === "C" ? "WUBRG" : region.color);
  const epoch = shopEpoch(world, knobs);
  // Independent stream per (seed, town, epoch): never touches the journey RNG.
  const rng = new WorldRng(((world.seed * 1_000_003) ^ (town.index * 7919) ^ (epoch * 104_729)) >>> 0);
  const picked = rng.shuffle(candidates).slice(0, Math.min(knobs.shopStockSize, candidates.length));
  return picked.map((def) => ({ cardId: def.id, price: shopPrice(def, knobs) }));
}

export type BuyOutcome = { ok: true; price: number } | { ok: false; reason: string };

/** Buy one copy (slice: stock never depletes). Mutates world. */
export function buyCard(world: WorldState, item: ShopItem): BuyOutcome {
  if (BASICS.includes(item.cardId)) return { ok: false, reason: "basics are free — add them in the deck editor (M6b)" };
  if (world.player.gold < item.price) return { ok: false, reason: `costs ${item.price} gold; you have ${world.player.gold}` };
  world.player.gold -= item.price;
  world.player.collection[item.cardId] = (world.player.collection[item.cardId] ?? 0) + 1;
  return { ok: true, price: item.price };
}
