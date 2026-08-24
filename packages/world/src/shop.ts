import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { addCopy, deckCount, isBasic } from "./deck-edit.js";
import { deckLegal } from "./journey.js";
import type { KnobValues } from "./knobs.js";
import type { Town } from "./map.js";
import { WorldRng } from "./rng.js";
import { activeDeck, type WorldState } from "./state.js";

/**
 * Town shops. S13: stock is a pure function of (world seed, town index, epoch),
 * epoch = floor(steps / shopRefreshSteps) — refresh with the clock (ADR-064).
 * S14 (Part 3, save v2): stock rows carry remaining counts; `world.shops[town]`
 * remembers the epoch and what was sold; a new epoch restocks. Sell at
 * floor(price/2): never basics, never cards the active deck still uses
 * (remove them in the editor first). "Buy → add to deck" when legal.
 */

export interface ShopItem {
  cardId: string;
  price: number;
  /** Copies rolled for this epoch. */
  stock: number;
  /** Copies still available (stock − sold this epoch). */
  remaining: number;
}

export function shopEpoch(world: WorldState, knobs: KnobValues): number {
  return Math.floor(world.player.stepsTaken / Math.max(1, knobs.shopRefreshSteps));
}

/** ADR-078 (S19): price carries the shop-tier factor. R cards never stock; when one is *sold* from the
 * collection the tier-3 factor prices it (interim, flagged in the S19 handoff — the R economy is planner-side). */
export function shopPrice(def: CardDef, knobs: KnobValues): number {
  const mv = manaValue(parseManaCost(def.manaCost));
  const tier = def.shopTier === "R" ? 3 : def.shopTier ?? 1;
  const factor = knobs.shopTierMultiplier[tier as 1 | 2 | 3] ?? 1;
  return Math.max(1, Math.round(knobs.shopPriceMultiplier * knobs.shopBasePrice * (1 + mv) * factor));
}

export function sellPrice(def: CardDef, knobs: KnobValues): number {
  return Math.floor(shopPrice(def, knobs) / 2);
}

/** Cards a region's shop may carry: mono/colourless within the region colour; ADR-078 — shopTier ≤ the
 * region's ring (civilized 1, approach 2, wild 3), R never. */
export const RING_OF_TIER: Record<string, 1 | 2 | 3> = { civilized: 1, approach: 2, wild: 3 };
export function shopPoolFor(pool: Map<string, CardDef>, regionColor: string, ring: 1 | 2 | 3 = 3): CardDef[] {
  const out: CardDef[] = [];
  for (const def of pool.values()) {
    if ((def as { isTokenDef?: boolean }).isTokenDef) continue;
    if (def.types.includes("Land")) continue; // basics free; nonbasic lands are future collectible content
    if (def.prizeOnly) continue; // ADR-068: Lotus is treasure, never stock
    if (def.shopTier === "R") continue; // ADR-078: R circulates by ante/quest/treasure, never a shelf
    if ((def.shopTier ?? 1) > ring) continue;
    const colors = cardColors(def);
    if (colors.every((c) => regionColor.includes(c))) out.push(def);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Ensure the town's shop state matches the current epoch (restock on change). Mutates world. */
export function syncShopState(world: WorldState, town: Town, knobs: KnobValues): void {
  const epoch = shopEpoch(world, knobs);
  const st = world.shops[town.index];
  if (!st || st.epoch !== epoch) world.shops[town.index] = { epoch, sold: {} };
}

export function rollShopStock(world: WorldState, town: Town, pool: Map<string, CardDef>, knobs: KnobValues): ShopItem[] {
  const region = world.map.regions[town.region]!;
  const candidates = shopPoolFor(pool, region.color === "C" ? "WUBRG" : region.color, RING_OF_TIER[region.tier] ?? 3);
  const epoch = shopEpoch(world, knobs);
  const rng = new WorldRng(((world.seed * 1_000_003) ^ (town.index * 7919) ^ (epoch * 104_729)) >>> 0);
  const picked = rng.shuffle(candidates).slice(0, Math.min(knobs.shopStockSize, candidates.length));
  const sold = world.shops[town.index]?.epoch === epoch ? world.shops[town.index]!.sold : {};
  return picked.map((def) => {
    const stock = 1 + rng.int(Math.max(1, knobs.shopRowCopies)); // 1..shopRowCopies copies per row this epoch
    const remaining = Math.max(0, stock - (sold[def.id] ?? 0));
    return { cardId: def.id, price: shopPrice(def, knobs), stock, remaining };
  });
}

export type BuyOutcome = { ok: true; price: number; addedToDeck: boolean; note?: string } | { ok: false; reason: string };

/** Buy one copy (depletes the row; persists in world.shops). Optionally add straight to the deck when legal. */
export function buyCard(world: WorldState, town: Town, item: ShopItem, knobs: KnobValues, toDeck = false): BuyOutcome {
  if (isBasic(item.cardId)) return { ok: false, reason: "basics are free — add them in the deck editor" };
  if (item.remaining <= 0) return { ok: false, reason: "sold out until the stock refreshes" };
  if (world.player.gold < item.price) return { ok: false, reason: `costs ${item.price} gold; you have ${world.player.gold}` };
  syncShopState(world, town, knobs);
  world.player.gold -= item.price;
  world.player.collection[item.cardId] = (world.player.collection[item.cardId] ?? 0) + 1;
  world.provenance.push({ cardId: item.cardId, source: "shop", step: world.player.stepsTaken });
  const st = world.shops[town.index]!;
  st.sold[item.cardId] = (st.sold[item.cardId] ?? 0) + 1;
  if (toDeck) {
    const r = addCopy(world.player.collection, activeDeck(world), item.cardId);
    if (r.ok && deckLegal(r.deck).ok) {
      world.decks[world.activeDeckName] = r.deck;
      return { ok: true, price: item.price, addedToDeck: true };
    }
    return { ok: true, price: item.price, addedToDeck: false, note: r.ok ? "deck would be illegal — bought to collection" : `${r.reason} — bought to collection` };
  }
  return { ok: true, price: item.price, addedToDeck: false };
}

export type SellOutcome = { ok: true; gold: number } | { ok: false; reason: string };

/** Sell one spare copy (not in the active deck; never basics). */
export function sellCard(world: WorldState, pool: Map<string, CardDef>, cardId: string, knobs: KnobValues): SellOutcome {
  if (isBasic(cardId)) return { ok: false, reason: "basics have no sale value" };
  const owned = world.player.collection[cardId] ?? 0;
  const inDeck = deckCount(activeDeck(world), cardId);
  if (owned - inDeck <= 0) return { ok: false, reason: inDeck > 0 ? "all copies are in your deck — remove one in the editor first" : "you own none" };
  const def = pool.get(cardId);
  if (!def) return { ok: false, reason: "unknown card" };
  const gold = sellPrice(def, knobs);
  world.player.gold += gold;
  world.player.collection[cardId] = owned - 1;
  if (world.player.collection[cardId] === 0) delete world.player.collection[cardId];
  return { ok: true, gold };
}
