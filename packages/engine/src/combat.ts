import { characteristics } from "./characteristics.js";
import type { EngineCtx } from "./ctx.js";
import { dealDamage } from "./ops.js";
import { getObject, opponentOf, type PlayerId } from "./state.js";

/**
 * Combat (R-008). Damage assignment and damage dealing are separate functions
 * (ADR-006): trample/deathtouch/lifelink later modify exactly one of them.
 * S1 keywords: flying, reach, first strike, haste, vigilance.
 */

export function eligibleAttackers(ctx: EngineCtx): string[] {
  const state = ctx.state;
  const active = state.activePlayer;
  return state.battlefield.filter((id) => {
    const obj = getObject(state, id);
    if (obj.controller !== active || !ctx.defs.def(obj.cardId).types.includes("Creature")) return false;
    if (obj.tapped) return false;
    const chars = characteristics(ctx, id);
    if (obj.summoningSick && !chars.keywords.has("haste")) return false;
    if (chars.cantAttack || chars.keywords.has("defender")) return false;
    return true;
  });
}

export function declareAttackers(ctx: EngineCtx, attackers: string[]): void {
  const state = ctx.state;
  const eligible = new Set(eligibleAttackers(ctx));
  for (const id of attackers) {
    if (!eligible.has(id)) throw new Error(`Illegal attacker: ${id}`);
  }
  state.combat.attackers = [...attackers];
  for (const id of attackers) {
    const chars = characteristics(ctx, id);
    if (!chars.keywords.has("vigilance")) getObject(state, id).tapped = true;
  }
  ctx.bus.emit("ATTACKERS_DECLARED", { attackers: [...attackers] });
}

export function eligibleBlockers(ctx: EngineCtx): string[] {
  const state = ctx.state;
  const defender = opponentOf(state.activePlayer);
  return state.battlefield.filter((id) => {
    const obj = getObject(state, id);
    if (obj.controller !== defender || !ctx.defs.def(obj.cardId).types.includes("Creature")) return false;
    if (obj.tapped) return false;
    return !characteristics(ctx, id).cantBlock;
  });
}

/** Can this blocker legally block this attacker? (Flying/reach; menace is a declaration-level count rule, slot R-015.) */
export function canBlock(ctx: EngineCtx, blockerId: string, attackerId: string): boolean {
  const attacker = characteristics(ctx, attackerId);
  const blocker = characteristics(ctx, blockerId);
  if (attacker.keywords.has("flying") && !blocker.keywords.has("flying") && !blocker.keywords.has("reach")) {
    return false;
  }
  return true;
}

export function declareBlockers(ctx: EngineCtx, blocks: { blocker: string; attacker: string }[]): void {
  const state = ctx.state;
  const eligible = new Set(eligibleBlockers(ctx));
  const seen = new Set<string>();
  for (const { blocker, attacker } of blocks) {
    if (!eligible.has(blocker)) throw new Error(`Illegal blocker: ${blocker}`);
    if (seen.has(blocker)) throw new Error(`Blocker ${blocker} assigned twice`);
    seen.add(blocker);
    if (!state.combat.attackers.includes(attacker)) throw new Error(`Not an attacker: ${attacker}`);
    if (!canBlock(ctx, blocker, attacker)) throw new Error(`${blocker} cannot block ${attacker}`);
  }
  state.combat.blocks = [...blocks];
  for (const { blocker, attacker } of blocks) {
    state.combat.blocked[attacker] = true;
    // Damage order: declaration order. Ordering is the attacker's choice per
    // CR 509.2; deterministic interim for S1 (R-008 note).
    (state.combat.blockOrder[attacker] ??= []).push(blocker);
  }
  ctx.bus.emit("BLOCKERS_DECLARED", { blocks: [...blocks] });
}

export function combatHasFirstStrikers(ctx: EngineCtx): boolean {
  const state = ctx.state;
  const inCombat = [...state.combat.attackers, ...state.combat.blocks.map((b) => b.blocker)];
  return inCombat.some((id) => {
    if (!state.objects[id]) return false;
    const k = characteristics(ctx, id).keywords;
    return k.has("first strike") || k.has("double strike");
  });
}

export interface DamageAssignment {
  sourceId: string;
  target: { kind: "player"; player: PlayerId } | { kind: "object"; id: string };
  amount: number;
}

function strikesInStep(ctx: EngineCtx, id: string, firstStrikeStep: boolean): boolean {
  const k = characteristics(ctx, id).keywords;
  if (k.has("double strike")) return true;
  return firstStrikeStep ? k.has("first strike") : !k.has("first strike");
}

/**
 * Produce the damage assignments for one combat damage step. Pure with
 * respect to state — dealing happens separately (ADR-006).
 */
export function assignCombatDamage(ctx: EngineCtx, firstStrikeStep: boolean): DamageAssignment[] {
  const state = ctx.state;
  const defender = opponentOf(state.activePlayer);
  const out: DamageAssignment[] = [];

  for (const attackerId of state.combat.attackers) {
    const attacker = state.objects[attackerId];
    if (!attacker || attacker.zone !== "battlefield") continue;
    if (!strikesInStep(ctx, attackerId, firstStrikeStep)) continue;
    let power = characteristics(ctx, attackerId).power;
    if (power <= 0) continue;

    if (state.combat.blocked[attackerId]) {
      const blockers = (state.combat.blockOrder[attackerId] ?? []).filter(
        (b) => state.objects[b]?.zone === "battlefield",
      );
      if (blockers.length === 0) continue; // blocked, all blockers gone: deals no damage (no trample)
      // Assign lethal in order; remainder goes to the last blocker (509.2 simplified, no trample).
      for (let i = 0; i < blockers.length && power > 0; i++) {
        const bId = blockers[i]!;
        const b = getObject(state, bId);
        const lethal = Math.max(0, characteristics(ctx, bId).toughness - b.damage);
        const amount = i === blockers.length - 1 ? power : Math.min(power, Math.max(lethal, 0));
        if (amount > 0) out.push({ sourceId: attackerId, target: { kind: "object", id: bId }, amount });
        power -= amount;
      }
    } else {
      out.push({ sourceId: attackerId, target: { kind: "player", player: defender }, amount: power });
    }
  }

  for (const { blocker: blockerId, attacker: attackerId } of state.combat.blocks) {
    const blocker = state.objects[blockerId];
    if (!blocker || blocker.zone !== "battlefield") continue;
    if (!strikesInStep(ctx, blockerId, firstStrikeStep)) continue;
    const attacker = state.objects[attackerId];
    if (!attacker || attacker.zone !== "battlefield") continue; // attacker gone: no one to damage
    const power = characteristics(ctx, blockerId).power;
    if (power <= 0) continue;
    out.push({ sourceId: blockerId, target: { kind: "object", id: attackerId }, amount: power });
  }

  return out;
}

/** Apply assignments simultaneously (CR 510.2): all damage dealt at once. */
export function dealCombatDamage(ctx: EngineCtx, assignments: DamageAssignment[]): void {
  for (const a of assignments) {
    const source = getObject(ctx.state, a.sourceId);
    dealDamage(
      ctx,
      { id: source.id, cardId: source.cardId, controller: source.controller },
      a.target.kind === "player" ? { kind: "player", player: a.target.player } : { kind: "object", id: a.target.id },
      a.amount,
      true,
    );
  }
}
