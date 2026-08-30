/**
 * S25 — the five powers (five-powers-design.md, ADR-088; brief Parts 2–3).
 *
 * Powers are KNOWLEDGE, not items: unlock flags in the save, no inventory. Fuel is
 * colour-matched spare cards — count-denominated, the active deck never fuel, gold cards fuel
 * either of their colours (the shop-stocking rule reapplied), lands fuel what they tap for.
 * `prizeOnly` cards are burnable (torching a dual for a desperate Crossing is a story — though
 * duals are NOT prizeOnly; what is prizeOnly is sole-mechanism, and those double-confirm:
 * "there is exactly one, and it was yours"). The picker rides the auto-pay philosophy:
 * cheapest spares auto-suggested (shopTier ascending, then price), deliberate override always.
 *
 * Forms are COMPUTED, never stored (the S24 maxWorldLife precedent): a power is advanced iff
 * its colour's stronghold seal is held — each lord's fall upgrades its colour's power
 * automatically, retroactively for already-fallen lords on migration BY CONSTRUCTION (there is
 * no migration step to forget: the read asks the seal, and the seal was already won).
 */
import { cardColors, type CardDef } from "@shandalar/cards";
import { spares } from "./deck-edit.js";
import type { KnobValues } from "./knobs.js";
import { shopPrice } from "./shop.js";
import { activeDeck, worldKnobs, type PowerColor, type WorldState } from "./state.js";
import { lordSealed } from "./stronghold.js";

export type { PowerColor, PowersState } from "./state.js";
export { emptyPowersState } from "./state.js";
export const POWER_COLORS: readonly PowerColor[] = ["W", "U", "B", "R", "G"];

/** The five, by colour (design §2). */
export const POWER_NAMES: Record<PowerColor, string> = {
  W: "the Balm",
  U: "the Crossing",
  B: "the Quietus",
  R: "the Barrage",
  G: "the Stride",
};

export function powerUnlocked(world: WorldState, color: PowerColor): boolean {
  return world.powers.unlocked.includes(color);
}

/** Idempotent — the prize room calls it under escrow law; future grant paths ride free. */
export function unlockPower(world: WorldState, color: PowerColor): void {
  if (!world.powers.unlocked.includes(color)) world.powers.unlocked.push(color);
}

/** A power is advanced iff its lord's seal is held (computed, never stored). */
export function powerAdvanced(world: WorldState, color: PowerColor): boolean {
  return lordSealed(world, color);
}

/** The resolved rates for one power at its current form. */
export interface PowerRates {
  color: PowerColor;
  name: string;
  unlocked: boolean;
  advanced: boolean;
  /** G: cards → doubled steps. */
  stride?: { cost: number; cells: number; durationSteps: number };
  /** U: cards → instant travel, zero clock. */
  crossing?: { cost: number };
  /** W: cards per life. */
  balm?: { costPerLife: number };
  /** B: cards by roamer tier. */
  quietus?: { costs: Record<1 | 2 | 3, number> };
  /** R: cards per damage, capped. */
  barrage?: { costPerDamage: number; cap: number };
}

export function powerRates(world: WorldState, color: PowerColor, knobs: KnobValues = worldKnobs(world)): PowerRates {
  const advanced = powerAdvanced(world, color);
  const base: PowerRates = { color, name: POWER_NAMES[color], unlocked: powerUnlocked(world, color), advanced };
  switch (color) {
    case "G":
      return { ...base, stride: { cost: knobs.strideCost, cells: knobs.strideCells, durationSteps: advanced ? knobs.strideDurationAdvanced : knobs.strideDuration } };
    case "U":
      return { ...base, crossing: { cost: advanced ? knobs.crossingCostAdvanced : knobs.crossingCost } };
    case "W":
      return { ...base, balm: { costPerLife: advanced ? knobs.balmCostPerLifeAdvanced : knobs.balmCostPerLife } };
    case "B":
      return { ...base, quietus: { costs: advanced ? knobs.quietusCostsAdvanced : knobs.quietusCosts } };
    case "R":
      return { ...base, barrage: { costPerDamage: knobs.barrageCostPerDamage, cap: advanced ? knobs.barrageCapAdvanced : knobs.barrageCap } };
  }
}

// ---------- Fuel ----------

/** A card's fuel colours: a land fuels what it taps for (the S20 shop-stocking rule — defs carry
 * no colors for lands); anything else fuels its colour identity; gold fuels EITHER. Colourless
 * (artifacts, the Moxen's {0}) fuels nothing — fuel is colour-matched by design. */
export function fuelColorsOf(def: CardDef): PowerColor[] {
  if (def.types.includes("Land")) {
    const produced = new Set<PowerColor>();
    for (const ab of def.abilities ?? []) {
      if (ab.kind !== "activated") continue;
      for (const e of ab.effects) if (e.type === "addMana" && e.mana) for (const ch of e.mana.replace(/[^WUBRG]/g, "")) produced.add(ch as PowerColor);
    }
    return [...produced];
  }
  return cardColors(def) as PowerColor[];
}

export interface FuelCandidate {
  cardId: string;
  name: string;
  /** Spare copies available (collection minus the ACTIVE deck — the S16 rule). */
  available: number;
  /** Sort key 1: shopTier ascending; tierless (prizeOnly, exempt classes) sorts LAST — the
   * auto-suggest never proposes burning what has no price. */
  tier: number;
  /** Sort key 2: the shop-price shadow (the arbitrage floor, embraced). */
  price: number;
  /** prizeOnly = sole-mechanism in this pool (there is exactly one) — the UI double-confirms. */
  soleMechanism: boolean;
}

/** Every spare that can fuel `color`, sorted shopTier-then-price-then-id (deterministic). */
export function fuelCandidates(world: WorldState, pool: Map<string, CardDef>, color: PowerColor, knobs: KnobValues = worldKnobs(world)): FuelCandidate[] {
  const sp = spares(world.player.collection, activeDeck(world));
  const out: FuelCandidate[] = [];
  for (const [cardId, available] of Object.entries(sp)) {
    if (available <= 0) continue;
    const def = pool.get(cardId);
    if (!def || (def as { isTokenDef?: boolean }).isTokenDef) continue;
    if (!fuelColorsOf(def).includes(color)) continue;
    const tier = def.prizeOnly || def.shopTier === undefined ? Number.POSITIVE_INFINITY : def.shopTier === "R" ? 4 : def.shopTier;
    out.push({ cardId, name: def.name, available, tier, price: shopPrice(def, knobs), soleMechanism: !!def.prizeOnly });
  }
  return out.sort((a, b) => a.tier - b.tier || a.price - b.price || a.cardId.localeCompare(b.cardId));
}

/** Auto-suggest `count` copies, cheapest-first (the auto-pay philosophy); sole-mechanism cards
 * never auto-suggest — burning the only one that exists is a DELIBERATE act. Returns null when
 * the burnable spares can't cover the count (the power is unaffordable without override — and if
 * even overrides can't cover it, it is unaffordable, full stop). */
export function suggestFuel(candidates: FuelCandidate[], count: number): string[] | null {
  const picks: string[] = [];
  for (const c of candidates) {
    if (c.soleMechanism) continue;
    for (let i = 0; i < c.available && picks.length < count; i++) picks.push(c.cardId);
    if (picks.length >= count) return picks;
  }
  return null;
}

/** Total burnable depth (override included) — the greyed-with-reason line reads it. */
export function fuelDepth(candidates: FuelCandidate[]): number {
  return candidates.reduce((n, c) => n + c.available, 0);
}

/** Burn the chosen fuel: validates every pick is a spare of the right colour, then decrements
 * the collection. Throws on any invalid pick (the UI offers only candidates; a mismatch is a
 * bug, not a user error — the S22b picker-guard lesson). */
export function burnFuel(world: WorldState, pool: Map<string, CardDef>, color: PowerColor, cardIds: string[]): void {
  const sp = spares(world.player.collection, activeDeck(world));
  const need: Record<string, number> = {};
  for (const id of cardIds) need[id] = (need[id] ?? 0) + 1;
  for (const [id, n] of Object.entries(need)) {
    const def = pool.get(id);
    if (!def) throw new Error(`burnFuel: unknown card ${id}`);
    if (!fuelColorsOf(def).includes(color)) throw new Error(`burnFuel: ${id} cannot fuel ${color}`);
    if ((sp[id] ?? 0) < n) throw new Error(`burnFuel: ${n} copies of ${id} are not spare`);
  }
  for (const [id, n] of Object.entries(need)) {
    world.player.collection[id]! -= n;
    if (world.player.collection[id]! <= 0) delete world.player.collection[id];
  }
}
