import { isManaAbility, parseManaCost, type CardDef } from "@shandalar/cards";
import type { Action } from "./actions.js";
import { canBlock, eligibleAttackers, eligibleBlockers, menaceViolations } from "./combat.js";
import { characteristics } from "./characteristics.js";
import { sacrificeCandidates } from "./sacrifice.js";
import type { EngineCtx } from "./ctx.js";
import { canPay, producibleSymbols } from "./mana.js";
import { getObject, type PlayerId } from "./state.js";
import { targetCombinations } from "./targeting.js";

/**
 * Legal-action enumerator (engine-design §11). Everything the engine accepts
 * comes from these lists — the RandomAgent samples them, the (later) heuristic
 * agent evaluates them, the UI presents them.
 *
 * Attack/block declarations are incremental (ADR-013): declare-one or done.
 * Enumeration is linear in board size; nothing is ever truncated.
 * X costs enumerate one action per affordable X value (ADR-017).
 */

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
    const combos = targetCombinations(ctx, def.targets ?? [], player);
    if (combos.length === 0) continue;
    if (cost.xCount === 0) {
      if (!canPay(ctx, player, cost)) continue;
      for (const targets of combos) actions.push({ type: "castSpell", objectId, targets });
    } else {
      // One action per affordable X (ADR-017). canPay is monotonic in x.
      for (let x = 0; canPay(ctx, player, cost, x); x++) {
        for (const targets of combos) actions.push({ type: "castSpell", objectId, targets, x });
      }
    }
  }

  // Mana abilities as explicit actions (they don't use the stack).
  for (const id of state.battlefield) {
    const obj = getObject(state, id);
    if (obj.controller !== player) continue;
    if (producibleSymbols(ctx, id).length > 0) actions.push({ type: "tapForMana", objectId: id });
  }

  // Non-mana activated abilities (no S1 card has one; the path exists for equip).
  for (const id of state.battlefield) {
    const obj = getObject(state, id);
    if (obj.controller !== player) continue;
    const def = ctx.defs.def(obj.cardId);
    (def.abilities ?? []).forEach((ability, abilityIndex) => {
      if (ability.kind !== "activated" || isManaAbility(ability)) return;
      const timing = ability.equip ? "sorcery" : (ability.timing ?? "instant"); // equip is sorcery-speed by rule (702.6b)
      if (timing === "sorcery" && !atSorcerySpeed) return;
      if (ability.cost.tap && (obj.tapped || (obj.summoningSick && !ctx.defs.def(obj.cardId).keywords?.includes("haste")))) return;
      if (ability.cost.sacrifice && sacrificeCandidates(ctx, player, id, ability.cost.sacrifice.predicate).length === 0) return;
      const combos = targetCombinations(ctx, ability.targets ?? [], player);
      if ((ability.targets ?? []).length > 0 && combos.length === 0) return;
      const cost = ability.cost.mana ? parseManaCost(ability.cost.mana) : undefined;
      // A {T}-cost ability can't count its own source as a mana producer.
      const exclude = ability.cost.tap ? [id] : [];
      if (!cost || cost.xCount === 0) {
        if (cost && !canPay(ctx, player, cost, 0, exclude)) return;
        for (const targets of combos) actions.push({ type: "activateAbility", objectId: id, abilityIndex, targets });
      } else {
        for (let x = 0; canPay(ctx, player, cost, x, exclude); x++) {
          for (const targets of combos) actions.push({ type: "activateAbility", objectId: id, abilityIndex, targets, x });
        }
      }
    });
  }

  return actions;
}

/** Incremental attack declaration (ADR-013): done always first, then each not-yet-declared eligible attacker. */
export function attackerChoices(ctx: EngineCtx): Action[] {
  const staged = new Set(ctx.state.combat.attackers);
  const out: Action[] = [{ type: "doneDeclaringAttackers" }];
  for (const id of eligibleAttackers(ctx)) {
    if (!staged.has(id)) out.push({ type: "declareAttacker", objectId: id });
  }
  return out;
}

/**
 * Incremental block declaration (ADR-013): done first, then every legal
 * (blocker, attacker) pair not yet used.
 *
 * Menace (R-015) shapes the list two ways: "done" is withheld while any
 * menace attacker has exactly one staged blocker, and a first block onto a
 * menace attacker is only offered when a second blocker could still join —
 * so no staging sequence can dead-end.
 */
export function blockerChoices(ctx: EngineCtx): Action[] {
  const state = ctx.state;
  const used = new Set(state.combat.blocks.map((b) => b.blocker));
  const free = eligibleBlockers(ctx).filter((b) => !used.has(b));

  const violations = menaceViolations(ctx);
  if (violations.length > 0) {
    // A menace attacker sits at exactly one blocker: the only legal
    // continuations are blocks that fix it. The offer-time guard below
    // guarantees a second candidate existed and nothing since consumed it.
    const out: Action[] = [];
    for (const blocker of free) {
      for (const attacker of violations) {
        if (canBlock(ctx, blocker, attacker)) out.push({ type: "declareBlocker", blocker, attacker });
      }
    }
    if (out.length === 0) throw new Error("blockerChoices: unfixable menace violation (enumerator bug)");
    return out;
  }

  const out: Action[] = [{ type: "doneDeclaringBlockers" }];
  for (const blocker of free) {
    for (const attacker of state.combat.attackers) {
      if (!state.objects[attacker] || !canBlock(ctx, blocker, attacker)) continue;
      if (characteristics(ctx, attacker).keywords.has("menace")) {
        const otherCandidates = free.filter((b2) => b2 !== blocker && canBlock(ctx, b2, attacker)).length;
        // A lone block on a menace attacker with no possible second is a dead end.
        if (state.combat.blocks.filter((b) => b.attacker === attacker).length === 0 && otherCandidates === 0) continue;
      }
      out.push({ type: "declareBlocker", blocker, attacker });
    }
  }
  return out;
}

/** Discard choices during cleanup (one per distinct card in hand). */
export function discardChoices(ctx: EngineCtx, player: PlayerId): Action[] {
  return handByCard(ctx, player).map(({ objectId }) => ({ type: "discard", objectId }));
}

/** Bottoming choices after a mulligan keep (one per distinct card in hand, ADR-011). */
export function bottomChoices(ctx: EngineCtx, player: PlayerId): Action[] {
  return handByCard(ctx, player).map(({ objectId }) => ({ type: "bottomCard", objectId }));
}
