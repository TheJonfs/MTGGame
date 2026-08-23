import {
  COLORS,
  MANA_SYMBOLS,
  isManaAbility,
  parseManaCost,
  parseManaProduction,
  type Color,
  type ManaCost,
  type ManaSymbol,
  isChoiceManaAbility,
} from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import { characteristics } from "./characteristics.js";
import { getObject, type PlayerId } from "./state.js";

/**
 * Mana + auto-pay (ADR-004, amended). A cast is enumerated as legal when
 * floating mana plus untapped producers can cover the cost; executing the
 * cast taps producers deterministically (battlefield order) and pays
 * automatically. Explicit tapForMana actions also exist; both paths meet here.
 *
 * Colorless {C} (S3, Mind Stone): a distinct pool slot that pays generic
 * costs but never colored ones. Auto-pay spends {C} on generic first —
 * deterministic and never worse than spending a color.
 *
 * Known simplification (R-006): feasibility assumes each producer makes
 * exactly one symbol per activation (true for all current pool cards).
 */

/** Symbols a permanent's mana abilities can produce right now (untapped only;
 * a summoning-sick creature without haste can't pay {T} — CR 302.6 / 602.5g,
 * ADR-070: Llanowar Elves). Lands never needed the gate. */
export function producibleSymbols(ctx: EngineCtx, objectId: string): ManaSymbol[] {
  const obj = getObject(ctx.state, objectId);
  if (obj.zone !== "battlefield" || obj.tapped) return [];
  const def = ctx.defs.def(obj.cardId);
  const sickCreature = obj.summoningSick && def.types.includes("Creature") && !characteristics(ctx, objectId).keywords.has("haste");
  const out: ManaSymbol[] = [];
  for (const ability of def.abilities ?? []) {
    if (!isManaAbility(ability) || ability.kind !== "activated") continue;
    if (ability.cost.tap && sickCreature) continue;
    // ADR-068 Amendment 2: choice-bearing / sacrifice-cost mana abilities
    // (Lotus) are never auto-paid or bare-tapped — activated deliberately.
    if (isChoiceManaAbility(ability)) continue;
    for (const e of ability.effects) {
      if (e.type !== "addMana" || !e.mana) continue;
      for (const sym of parseManaProduction(e.mana)) out.push(sym.symbol);
    }
  }
  return out;
}

function untappedProducers(ctx: EngineCtx, player: PlayerId): { id: string; symbols: ManaSymbol[] }[] {
  return ctx.state.battlefield
    .filter((id) => getObject(ctx.state, id).controller === player)
    .map((id) => ({ id, symbols: producibleSymbols(ctx, id) }))
    .filter((p) => p.symbols.length > 0);
}

export function totalCost(cost: ManaCost, x: number): { colored: Record<Color, number>; generic: number } {
  return { colored: { ...cost.colored }, generic: cost.generic + cost.xCount * x };
}

/**
 * Can `player` pay `cost` using floating mana plus untapped producers?
 * `excludeProducers`: objects whose mana can't help — e.g. the ability's own
 * source when {T} is part of the cost being paid (it can't tap twice).
 */
export function canPay(
  ctx: EngineCtx,
  player: PlayerId,
  cost: ManaCost,
  x = 0,
  excludeProducers: readonly string[] = [],
): boolean {
  const pool = ctx.state.players[player].manaPool;
  const producers = untappedProducers(ctx, player).filter((p) => !excludeProducers.includes(p.id));
  const { colored, generic } = totalCost(cost, x);

  const producerCount: Record<ManaSymbol, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const p of producers) for (const s of new Set(p.symbols)) producerCount[s] += 1;

  // Colored requirements: {C} never helps (106.9).
  for (const c of COLORS) {
    if (pool[c] + producerCount[c] < colored[c]) return false;
  }
  const totalAvailable = MANA_SYMBOLS.reduce((n, s) => n + pool[s], 0) + producers.length;
  const totalNeeded = COLORS.reduce((n, c) => n + colored[c], 0) + generic;
  return totalAvailable >= totalNeeded;
}

/** Execute one mana ability of a permanent (non-stack action, CR 605). */
export function tapForMana(ctx: EngineCtx, objectId: string): void {
  const obj = getObject(ctx.state, objectId);
  const abilities = (ctx.defs.def(obj.cardId).abilities ?? []).filter((a) => isManaAbility(a) && !isChoiceManaAbility(a));
  const ability = abilities[0];
  if (!ability || ability.kind !== "activated") throw new Error(`${obj.cardId} has no mana ability`);
  if (ability.cost.tap) {
    if (obj.tapped) throw new Error(`${obj.cardId} is already tapped`);
    if (obj.summoningSick && ctx.defs.def(obj.cardId).types.includes("Creature") && !characteristics(ctx, objectId).keywords.has("haste")) {
      throw new Error(`${obj.cardId} is summoning sick (CR 302.6)`);
    }
    obj.tapped = true;
    ctx.bus.emit("TAPPED", { objectId });
  }
  const pool = ctx.state.players[obj.controller].manaPool;
  for (const e of ability.effects) {
    if (e.type !== "addMana" || !e.mana) continue;
    for (const sym of parseManaProduction(e.mana)) pool[sym.symbol] += 1;
  }
}

/**
 * Pay a cost: tap producers as needed (deterministic battlefield order,
 * colored shortfalls first), then deduct from the pool — colored exactly,
 * generic from {C} first, then WUBRG order. Throws if infeasible — callers
 * must have checked canPay (the enumerator guarantees it).
 */
export function autoPay(ctx: EngineCtx, player: PlayerId, cost: ManaCost, x = 0): void {
  const pool = ctx.state.players[player].manaPool;
  const { colored, generic } = totalCost(cost, x);

  // 1. Tap producers to cover colored shortfalls.
  for (const c of COLORS) {
    let shortfall = colored[c] - pool[c];
    while (shortfall > 0) {
      const producer = untappedProducers(ctx, player).find((p) => p.symbols.includes(c));
      if (!producer) throw new Error(`autoPay: cannot produce ${c}`);
      tapForMana(ctx, producer.id);
      shortfall = colored[c] - pool[c];
    }
  }
  // 2. Tap producers to cover the generic shortfall — colorless producers first.
  const totalColored = COLORS.reduce((n, c) => n + colored[c], 0);
  const poolTotal = () => MANA_SYMBOLS.reduce((n, s) => n + pool[s], 0);
  while (poolTotal() < totalColored + generic) {
    const producers = untappedProducers(ctx, player);
    const producer = producers.find((p) => p.symbols.includes("C")) ?? producers[0];
    if (!producer) throw new Error(`autoPay: not enough mana`);
    tapForMana(ctx, producer.id);
  }
  // 3. Deduct colored.
  for (const c of COLORS) {
    if (pool[c] < colored[c]) throw new Error(`autoPay: pool underflow on ${c}`);
    pool[c] -= colored[c];
  }
  // 4. Deduct generic: {C} first (it can pay nothing else), then WUBRG order.
  let remaining = generic;
  for (const s of ["C", ...COLORS] as ManaSymbol[]) {
    const take = Math.min(remaining, pool[s]);
    pool[s] -= take;
    remaining -= take;
  }
  if (remaining > 0) throw new Error(`autoPay: pool underflow on generic`);
}

export function emptyManaPools(ctx: EngineCtx): void {
  for (const p of ctx.state.players) {
    for (const s of MANA_SYMBOLS) p.manaPool[s] = 0;
  }
}

export function costOf(ctx: EngineCtx, cardId: string): ManaCost {
  return parseManaCost(ctx.defs.def(cardId).manaCost);
}
