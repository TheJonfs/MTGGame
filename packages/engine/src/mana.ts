import { COLORS, isManaAbility, parseManaCost, parseManaProduction, type Color, type ManaCost } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import { getObject, type PlayerId } from "./state.js";

/**
 * Mana + auto-pay (ADR-004). A cast is enumerated as legal when floating mana
 * plus untapped producers can cover the cost; executing the cast taps
 * producers deterministically (battlefield order) and pays automatically.
 * Explicit tapForMana actions also exist; both paths meet here.
 *
 * Known simplification (noted in R-006): feasibility assumes each producer
 * makes exactly one color per activation (true for all current pool cards).
 */

/** Colors a permanent's mana abilities can produce right now (untapped only). */
export function producibleColors(ctx: EngineCtx, objectId: string): Color[] {
  const obj = getObject(ctx.state, objectId);
  if (obj.zone !== "battlefield" || obj.tapped) return [];
  const out: Color[] = [];
  for (const ability of ctx.defs.def(obj.cardId).abilities ?? []) {
    if (!isManaAbility(ability) || ability.kind !== "activated") continue;
    if (ability.cost.tap && obj.tapped) continue;
    for (const e of ability.effects) {
      if (e.type !== "addMana") continue;
      for (const sym of parseManaProduction(e.mana)) {
        if (sym.color) out.push(sym.color);
      }
    }
  }
  return out;
}

function untappedProducers(ctx: EngineCtx, player: PlayerId): { id: string; colors: Color[] }[] {
  return ctx.state.battlefield
    .filter((id) => getObject(ctx.state, id).controller === player)
    .map((id) => ({ id, colors: producibleColors(ctx, id) }))
    .filter((p) => p.colors.length > 0);
}

export function totalCost(cost: ManaCost, x: number): { colored: Record<Color, number>; generic: number } {
  return { colored: { ...cost.colored }, generic: cost.generic + cost.xCount * x };
}

/** Can `player` pay `cost` using floating mana plus untapped producers? */
export function canPay(ctx: EngineCtx, player: PlayerId, cost: ManaCost, x = 0): boolean {
  const pool = ctx.state.players[player].manaPool;
  const producers = untappedProducers(ctx, player);
  const { colored, generic } = totalCost(cost, x);

  const producerCount: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const p of producers) for (const c of new Set(p.colors)) producerCount[c] += 1;

  for (const c of COLORS) {
    if (pool[c] + producerCount[c] < colored[c]) return false;
  }
  const totalAvailable = COLORS.reduce((n, c) => n + pool[c], 0) + producers.length;
  const totalNeeded = COLORS.reduce((n, c) => n + colored[c], 0) + generic;
  return totalAvailable >= totalNeeded;
}

/** Execute one mana ability of a permanent (non-stack action, CR 605). */
export function tapForMana(ctx: EngineCtx, objectId: string): void {
  const obj = getObject(ctx.state, objectId);
  const abilities = (ctx.defs.def(obj.cardId).abilities ?? []).filter(isManaAbility);
  const ability = abilities[0];
  if (!ability || ability.kind !== "activated") throw new Error(`${obj.cardId} has no mana ability`);
  if (ability.cost.tap) {
    if (obj.tapped) throw new Error(`${obj.cardId} is already tapped`);
    obj.tapped = true;
    ctx.bus.emit("TAPPED", { objectId });
  }
  const pool = ctx.state.players[obj.controller].manaPool;
  for (const e of ability.effects) {
    if (e.type !== "addMana") continue;
    for (const sym of parseManaProduction(e.mana)) {
      if (sym.color) pool[sym.color] += 1;
    }
  }
}

/**
 * Pay a cost: tap producers as needed (deterministic battlefield order,
 * colored shortfalls first), then deduct from the pool. Throws if infeasible —
 * callers must have checked canPay (the enumerator guarantees it).
 */
export function autoPay(ctx: EngineCtx, player: PlayerId, cost: ManaCost, x = 0): void {
  const pool = ctx.state.players[player].manaPool;
  const { colored, generic } = totalCost(cost, x);

  // 1. Tap producers to cover colored shortfalls.
  for (const c of COLORS) {
    let shortfall = colored[c] - pool[c];
    while (shortfall > 0) {
      const producer = untappedProducers(ctx, player).find((p) => p.colors.includes(c));
      if (!producer) throw new Error(`autoPay: cannot produce ${c}`);
      tapForMana(ctx, producer.id);
      shortfall = colored[c] - pool[c];
    }
  }
  // 2. Tap producers to cover generic shortfall.
  const totalColored = COLORS.reduce((n, c) => n + colored[c], 0);
  let available = COLORS.reduce((n, c) => n + pool[c], 0);
  while (available < totalColored + generic) {
    const producer = untappedProducers(ctx, player)[0];
    if (!producer) throw new Error(`autoPay: not enough mana`);
    tapForMana(ctx, producer.id);
    available = COLORS.reduce((n, c) => n + pool[c], 0);
  }
  // 3. Deduct colored.
  for (const c of COLORS) {
    if (pool[c] < colored[c]) throw new Error(`autoPay: pool underflow on ${c}`);
    pool[c] -= colored[c];
  }
  // 4. Deduct generic in WUBRG order.
  let remaining = generic;
  for (const c of COLORS) {
    const take = Math.min(remaining, pool[c]);
    pool[c] -= take;
    remaining -= take;
  }
  if (remaining > 0) throw new Error(`autoPay: pool underflow on generic`);
}

export function emptyManaPools(ctx: EngineCtx): void {
  for (const p of ctx.state.players) {
    for (const c of COLORS) p.manaPool[c] = 0;
  }
}

export function costOf(ctx: EngineCtx, cardId: string): ManaCost {
  return parseManaCost(ctx.defs.def(cardId).manaCost);
}
