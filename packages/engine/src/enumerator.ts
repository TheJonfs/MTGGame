import { isManaAbility, parseManaCost, type CardDef } from "@shandalar/cards";
import type { Action } from "./actions.js";
import { canBlock, eligibleAttackers, eligibleBlockers } from "./combat.js";
import type { EngineCtx } from "./ctx.js";
import { canPay, producibleColors } from "./mana.js";
import { getObject, type PlayerId } from "./state.js";
import { targetCombinations } from "./targeting.js";

/**
 * Legal-action enumerator (engine-design §11). Everything the engine accepts
 * comes from these lists — the RandomAgent samples them, the (later) heuristic
 * agent evaluates them, the UI presents them.
 *
 * Composite attack/block declarations are enumerated exhaustively up to
 * ENUM_CAP combinations (deterministic prefix, smallest declarations first).
 * Block assignments are (attackers+1)^blockers, which explodes at sizes the
 * fuzzer can reach — the cap is an interim ruling flagged in the handoff.
 */
export const ENUM_CAP = 4096;

function sorcerySpeed(ctx: EngineCtx, player: PlayerId): boolean {
  return (
    ctx.state.stack.length === 0 &&
    (ctx.state.step === "MAIN1" || ctx.state.step === "MAIN2") &&
    ctx.state.activePlayer === player
  );
}

/** One representative hand object per cardId (identical copies would enumerate identical actions). */
function handByCard(ctx: EngineCtx, player: PlayerId): { objectId: string; def: CardDef }[] {
  const seen = new Set<string>();
  const out: { objectId: string; def: CardDef }[] = [];
  for (const id of ctx.state.players[player].hand) {
    const obj = getObject(ctx.state, id);
    if (seen.has(obj.cardId)) continue;
    seen.add(obj.cardId);
    out.push({ objectId: id, def: ctx.defs.def(obj.cardId) });
  }
  return out;
}

/** Priority actions for the player holding priority. */
export function legalActions(ctx: EngineCtx, player: PlayerId): Action[] {
  const actions: Action[] = [{ type: "pass" }];
  const state = ctx.state;
  const p = state.players[player];
  const atSorcerySpeed = sorcerySpeed(ctx, player);

  for (const { objectId, def } of handByCard(ctx, player)) {
    const isLand = def.types.includes("Land");
    if (isLand) {
      if (atSorcerySpeed && p.landsPlayedThisTurn < 1) actions.push({ type: "playLand", objectId });
      continue;
    }
    const instantSpeed = def.types.includes("Instant") || (def.keywords ?? []).includes("flash");
    if (!instantSpeed && !atSorcerySpeed) continue;

    const cost = parseManaCost(def.manaCost);
    if (cost.xCount > 0) continue; // no X spell in the pool yet (R-022 slot)
    if (!canPay(ctx, player, cost)) continue;

    const combos = targetCombinations(ctx, def.targets ?? [], player);
    for (const targets of combos) {
      actions.push({ type: "castSpell", objectId, targets });
    }
  }

  // Mana abilities as explicit actions (they don't use the stack).
  for (const id of state.battlefield) {
    const obj = getObject(state, id);
    if (obj.controller !== player) continue;
    if (producibleColors(ctx, id).length > 0) actions.push({ type: "tapForMana", objectId: id });
  }

  // Non-mana activated abilities (no S1 card has one; the path exists for equip).
  for (const id of state.battlefield) {
    const obj = getObject(state, id);
    if (obj.controller !== player) continue;
    const def = ctx.defs.def(obj.cardId);
    (def.abilities ?? []).forEach((ability, abilityIndex) => {
      if (ability.kind !== "activated" || isManaAbility(ability)) return;
      if ((ability.timing ?? "instant") === "sorcery" && !atSorcerySpeed) return;
      if (ability.cost.tap && (obj.tapped || (obj.summoningSick && !ctx.defs.def(obj.cardId).keywords?.includes("haste")))) return;
      const cost = ability.cost.mana ? parseManaCost(ability.cost.mana) : undefined;
      if (cost && (cost.xCount > 0 || !canPay(ctx, player, cost))) return;
      if (ability.cost.sacrifice) return; // R-023 slot-only
      for (const targets of targetCombinations(ctx, ability.targets ?? [], player)) {
        actions.push({ type: "activateAbility", objectId: id, abilityIndex, targets });
      }
    });
  }

  return actions;
}

/** All legal attack declarations (subsets of eligible attackers), capped. */
export function attackDeclarations(ctx: EngineCtx): Action[] {
  const eligible = eligibleAttackers(ctx);
  const n = eligible.length;
  const out: Action[] = [];
  const total = 2 ** n;
  // Masks in increasing popcount-ish order via plain numeric order: mask 0
  // (attack with nothing) always first.
  for (let mask = 0; mask < total && out.length < ENUM_CAP; mask++) {
    const attackers = eligible.filter((_, i) => mask & (1 << i));
    out.push({ type: "declareAttackers", attackers });
  }
  return out;
}

/** All legal block assignments (each blocker: none or one attacker it can block), capped. */
export function blockDeclarations(ctx: EngineCtx): Action[] {
  const blockers = eligibleBlockers(ctx);
  const attackers = ctx.state.combat.attackers.filter((id) => ctx.state.objects[id]);
  const options: (string | null)[][] = blockers.map((b) => [
    null,
    ...attackers.filter((a) => canBlock(ctx, b, a)),
  ]);

  const out: Action[] = [];
  const assignment: (string | null)[] = options.map(() => null);

  const emit = () => {
    const blocks: { blocker: string; attacker: string }[] = [];
    assignment.forEach((a, i) => {
      if (a !== null) blocks.push({ blocker: blockers[i]!, attacker: a });
    });
    out.push({ type: "declareBlockers", blocks });
  };

  const recurse = (i: number): void => {
    if (out.length >= ENUM_CAP) return;
    if (i === options.length) {
      emit();
      return;
    }
    for (const opt of options[i]!) {
      assignment[i] = opt;
      recurse(i + 1);
      if (out.length >= ENUM_CAP) return;
    }
  };
  recurse(0);
  return out;
}

/** Discard choices during cleanup (one per distinct card in hand). */
export function discardChoices(ctx: EngineCtx, player: PlayerId): Action[] {
  return handByCard(ctx, player).map(({ objectId }) => ({ type: "discard", objectId }));
}
