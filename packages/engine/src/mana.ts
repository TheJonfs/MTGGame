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
 *
 * S20 (ADR-004 second amendment — the payment solver): multi-color producers
 * (duals: two plain tap abilities on one land) are handled by PIP-TO-PRODUCER
 * ASSIGNMENT — colored pips are matched to producers by Kuhn's augmenting-path
 * matching (instances ≤ ~7 pips × ~15 producers), generic fills from what's
 * left. The old per-color counting admitted Hall violations the moment one
 * producer counted in two buckets ({W}{U} against Tundra + Swamp "passed").
 * Determinism: pips in WUBRG order, producers tried mono-first then
 * battlefield order — same state, same assignment, replay-stable.
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

/** Untapped producers in auto-pay order: lands and other non-creatures first
 * (battlefield order within each group), creature producers LAST — auto-pay
 * spends a Llanowar Elves only when nothing else can pay, so the body stays
 * untapped to attack/block; manual tapping can still choose it (S16, Chris). */
function untappedProducers(ctx: EngineCtx, player: PlayerId): { id: string; symbols: ManaSymbol[]; creature: boolean }[] {
  const all = ctx.state.battlefield
    .filter((id) => getObject(ctx.state, id).controller === player)
    .map((id) => ({ id, symbols: producibleSymbols(ctx, id), creature: ctx.defs.def(getObject(ctx.state, id).cardId).types.includes("Creature") }))
    .filter((p) => p.symbols.length > 0);
  return [...all.filter((p) => !p.creature), ...all.filter((p) => p.creature)];
}

export function totalCost(cost: ManaCost, x: number): { colored: Record<Color, number>; generic: number } {
  return { colored: { ...cost.colored }, generic: cost.generic + cost.xCount * x };
}

/** S20 solver: a payment plan — which producers tap for which symbol, and what the pool covers. */
export interface PaymentPlan {
  /** Producer taps in execution order, each with its assigned symbol. */
  taps: { id: string; symbol: ManaSymbol }[];
}

/**
 * Pip-to-producer assignment (ADR-004 second amendment). Returns a deterministic
 * plan or null when infeasible. Pool mana pays colored pips first (exact color),
 * then generic; producers cover the rest via matching (colored) + any-symbol taps
 * (generic, non-creature and mono-color preferred).
 */
export function solvePayment(
  ctx: EngineCtx,
  player: PlayerId,
  cost: ManaCost,
  x = 0,
  excludeProducers: readonly string[] = [],
): PaymentPlan | null {
  const pool = ctx.state.players[player].manaPool;
  const producers = untappedProducers(ctx, player).filter((p) => !excludeProducers.includes(p.id));
  const { colored, generic } = totalCost(cost, x);

  // Colored pips not covered by floating mana, expanded to instances in WUBRG order.
  const pips: Color[] = [];
  for (const c of COLORS) {
    const need = Math.max(0, colored[c] - pool[c]);
    for (let i = 0; i < need; i++) pips.push(c);
  }

  // Kuhn's matching: pip index → producer index. For each pip, producers are tried
  // NON-CREATURES first (S20 playtest, Chris: never tap a body when a land can pay —
  // a dual land is spent before a Llanowar Elves), then mono-color first (save the
  // flexible ones), then battlefield order.
  const order = (c: Color) =>
    producers
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.symbols.includes(c))
      .sort((a, b) => Number(a.p.creature) - Number(b.p.creature) || new Set(a.p.symbols).size - new Set(b.p.symbols).size || a.i - b.i)
      .map(({ i }) => i);
  const matchOf: number[] = new Array(producers.length).fill(-1); // producer → pip
  const tryAssign = (pip: number, seen: Set<number>): boolean => {
    for (const pi of order(pips[pip]!)) {
      if (seen.has(pi)) continue;
      seen.add(pi);
      if (matchOf[pi] === -1 || tryAssign(matchOf[pi]!, seen)) {
        matchOf[pi] = pip;
        return true;
      }
    }
    return false;
  };
  for (let pip = 0; pip < pips.length; pip++) {
    if (!tryAssign(pip, new Set())) return null;
  }

  // Generic: pool leftovers first, then untapped remaining producers — {C} producers, then
  // non-creatures (S20 playtest, Chris: keep-duals-free never outranks keep-bodies-untapped;
  // manual tapping remains the override), then fewest-symbols (keep duals free), then order.
  const matchedProducers = new Set(matchOf.map((m, i) => (m !== -1 ? i : -1)).filter((i) => i >= 0));
  const poolLeft = { ...pool };
  for (const c of COLORS) poolLeft[c] -= Math.min(poolLeft[c], colored[c]);
  const poolLeftTotal = MANA_SYMBOLS.reduce((n, s) => n + poolLeft[s], 0);
  let genericFromProducers = Math.max(0, generic - poolLeftTotal);
  const genericTaps: { i: number; symbol: ManaSymbol }[] = [];
  const free = producers
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !matchedProducers.has(i))
    .sort((a, b) => Number(b.p.symbols.includes("C")) - Number(a.p.symbols.includes("C")) || Number(a.p.creature) - Number(b.p.creature) || new Set(a.p.symbols).size - new Set(b.p.symbols).size || a.i - b.i);
  for (const { p, i } of free) {
    if (genericFromProducers <= 0) break;
    genericTaps.push({ i, symbol: p.symbols.includes("C") ? "C" : p.symbols[0]! });
    genericFromProducers -= 1;
  }
  if (genericFromProducers > 0) return null;

  // Execution order: colored taps in pip order, then generic taps.
  const taps: { id: string; symbol: ManaSymbol }[] = [];
  const byPip: { pip: number; producer: number }[] = [];
  matchOf.forEach((pip, producer) => { if (pip !== -1) byPip.push({ pip, producer }); });
  byPip.sort((a, b) => a.pip - b.pip);
  for (const { pip, producer } of byPip) taps.push({ id: producers[producer]!.id, symbol: pips[pip]! });
  for (const t of genericTaps) taps.push({ id: producers[t.i]!.id, symbol: t.symbol });
  return { taps };
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
  return solvePayment(ctx, player, cost, x, excludeProducers) !== null;
}

/** Execute one mana ability of a permanent (non-stack action, CR 605).
 * S20: `symbol` picks WHICH plain mana ability on a multi-ability producer (duals carry two);
 * omitted = the first (every pre-S20 log replays unchanged). */
export function tapForMana(ctx: EngineCtx, objectId: string, symbol?: ManaSymbol): void {
  const obj = getObject(ctx.state, objectId);
  const abilities = (ctx.defs.def(obj.cardId).abilities ?? []).filter((a) => isManaAbility(a) && !isChoiceManaAbility(a));
  const ability = symbol === undefined
    ? abilities[0]
    : abilities.find((a) => a.kind === "activated" && a.effects.some((e) => e.type === "addMana" && !!e.mana && parseManaProduction(e.mana).some((m) => m.symbol === symbol))) ?? abilities[0];
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

  // S20: the solver picks the taps (and each tap's symbol — a dual taps for its ASSIGNED color).
  const plan = solvePayment(ctx, player, cost, x);
  if (!plan) throw new Error("autoPay: infeasible (caller must check canPay)");
  for (const t of plan.taps) tapForMana(ctx, t.id, t.symbol);
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
