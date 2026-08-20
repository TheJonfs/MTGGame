import { parseManaCost, manaValue, type CardDef, type Effect, type ResolvedTarget } from "@shandalar/cards";
import type { Action, GameView } from "@shandalar/engine";
import { classifyEffects, effectsForAction } from "./effect-classification.js";
import { objectValue } from "./evaluator.js";

/**
 * View-level action prediction (S8 brief Part 2): apply an action's visible
 * consequences to a copy of the view so the evaluator can score the result.
 * Only public information moves — no hidden zones are touched, no engine
 * rules re-implemented (deaths here are the plain lethal-damage check; the
 * real engine remains the arbiter in actual play). Anything not predictable
 * contributes through `adjustment` instead (counterspells, pumps, steals).
 */

export interface Prediction {
  view: GameView;
  /** Score delta for consequences the view copy can't express, in mana units. */
  adjustment: number;
  /** True when the action visibly changed nothing (friction applies). */
  unchanged: boolean;
}

function clone(view: GameView): GameView {
  return structuredClone(view);
}

function removeObject(view: GameView, id: string): void {
  view.battlefield = view.battlefield.filter((o) => o.id !== id);
}

let predSeq = 0;

export function predictAction(
  view: GameView,
  action: Action,
  defs: Map<string, CardDef>,
): Prediction {
  const me = view.you;
  const next = clone(view);
  let adjustment = 0;

  const def = (cardId: string) => defs.get(cardId);

  if (action.type === "playLand") {
    const card = view.hand.find((c) => c.objectId === action.objectId);
    next.hand = next.hand.filter((c) => c.objectId !== action.objectId);
    if (card) {
      next.battlefield.push({
        id: action.objectId, cardId: card.cardId, controller: me, tapped: false,
        damage: 0, attachedTo: null, power: null, toughness: null, keywords: [],
      });
    }
    // A land's mana access is worth more than its standing objectValue says.
    adjustment += 0.8;
    return { view: next, adjustment, unchanged: false };
  }

  if (action.type !== "castSpell" && action.type !== "activateAbility") {
    return { view, adjustment: 0, unchanged: true };
  }

  const targets: ResolvedTarget[] = action.targets ?? [];
  const x = action.x ?? 0;

  if (action.type === "castSpell") {
    const card = view.hand.find((c) => c.objectId === action.objectId);
    const d = card ? def(card.cardId) : undefined;
    next.hand = next.hand.filter((c) => c.objectId !== action.objectId);
    if (!d) return { view: next, adjustment: 0.2, unchanged: false };

    const isPermanent = d.types.some((t) => ["Creature", "Artifact", "Enchantment"].includes(t));
    const isAura = d.subtypes?.includes("Aura") ?? false;
    if (isPermanent && !isAura) {
      next.battlefield.push({
        id: `pred_${predSeq++}`, cardId: d.id, controller: me, tapped: false, damage: 0,
        attachedTo: null,
        power: d.types.includes("Creature") ? (d.power ?? 0) : null,
        toughness: d.types.includes("Creature") ? (d.toughness ?? 0) : null,
        keywords: [...(d.keywords ?? [])],
      });
      // Equipment on an empty board can't do anything yet; slight discount.
      if (d.subtypes?.includes("Equipment")) adjustment -= 0.2;
      return { view: next, adjustment, unchanged: false };
    }
    if (isAura) {
      // The aura's payload lands on the host: harmful on theirs neutralizes
      // most of the host; helpful on ours adds a little. (Steal auras —
      // gainControl — effectively transfer the whole host.)
      const host = targets[0];
      const hostObj = host?.kind === "object" ? view.battlefield.find((o) => o.id === host.id) : undefined;
      const effects = (d.abilities ?? []).flatMap((a) => ("effects" in a ? (a.effects as Effect[]) : []));
      const cls = classifyEffects(effects);
      const steals = effects.some((e) => e.type === "gainControl");
      // An aura's standing board value flows through its host — subtract the
      // material the predicted battlefield entry will claim, so a mis-aimed
      // aura can't score as "+2 mana of stuff" (book of shame: self-steal).
      adjustment -= Math.max(0.5, manaValue(parseManaCost(d.manaCost)) * 0.5);
      if (hostObj) {
        const hv = objectValue(defs, hostObj);
        if (cls === "harmful" && hostObj.controller !== me) adjustment += steals ? 1.6 * hv : 0.7 * hv;
        else if (cls === "helpful" && hostObj.controller === me) adjustment += 1.0;
        // Harmful aura pointed at our own creature: the view can't show the
        // downside, so charge it directly.
        else if (cls === "harmful" && hostObj.controller === me) adjustment -= steals ? 0.2 : 0.7 * hv;
      }
      next.battlefield.push({
        id: `pred_${predSeq++}`, cardId: d.id, controller: me, tapped: false, damage: 0,
        attachedTo: host?.kind === "object" ? host.id : null, power: null, toughness: null, keywords: [],
      });
      return { view: next, adjustment, unchanged: false };
    }
    // Instant/sorcery: apply its effects, card leaves hand.
    for (const e of d.spellEffect ?? []) adjustment += applyEffect(next, e, targets, x, defs);
    return { view: next, adjustment, unchanged: false };
  }

  // activateAbility
  const objEntry = view.battlefield.find((o) => o.id === action.objectId);
  const d = objEntry ? def(objEntry.cardId) : undefined;
  const ability = d?.abilities?.[action.abilityIndex];
  if (!d || !ability || ability.kind !== "activated") return { view, adjustment: 0.1, unchanged: true };

  if (ability.cost.tap) {
    const self = next.battlefield.find((o) => o.id === action.objectId);
    if (self) self.tapped = true;
    adjustment -= 0.15; // tapping out a creature is a real (small) cost
  }
  if (ability.cost.sacrifice?.predicate === "self") {
    removeObject(next, action.objectId);
  }
  if (ability.equip) {
    const host = targets[0];
    const equip = view.battlefield.find((o) => o.id === action.objectId);
    if (host?.kind === "object" && equip) {
      if (equip.attachedTo === host.id) {
        return { view, adjustment: 0, unchanged: true }; // re-equip same host: nothing happens
      }
      const e2 = next.battlefield.find((o) => o.id === action.objectId);
      if (e2) e2.attachedTo = host.id;
      adjustment += 0.4; // statics will land on the host next time the real view arrives
    }
    return { view: next, adjustment, unchanged: false };
  }
  const before = JSON.stringify(next);
  for (const e of ability.effects) adjustment += applyEffect(next, e, targets, x, defs);
  const unchanged = adjustment === 0 && JSON.stringify(next) === before && !ability.cost.tap;
  return { view: next, adjustment, unchanged };
}

/** Apply one effect to the view copy; returns the unpredictable-part adjustment. */
function applyEffect(
  view: GameView,
  e: Effect,
  targets: ResolvedTarget[],
  x: number,
  defs: Map<string, CardDef>,
): number {
  const me = view.you;
  const opp = me === 0 ? 1 : 0;
  const amt = (a: number | "X" | { ref: string; target: number }): number =>
    typeof a === "number" ? a : a === "X" ? x : 0;
  const objAt = (i: number) => {
    const t = targets[i];
    return t?.kind === "object" ? view.battlefield.find((o) => o.id === t.id) : undefined;
  };

  switch (e.type) {
    case "damage": {
      const t = targets[e.target];
      if (t?.kind === "player") {
        view.life[t.player as 0 | 1] -= amt(e.amount);
        // Nothing in this pool profits from hurting yourself: self-face
        // damage carries a strategic penalty beyond the life term (book of
        // shame: burn at own face loses to every other use).
        return t.player === me ? -0.8 * amt(e.amount) : 0;
      }
      const o = objAt(e.target);
      if (o && o.toughness !== null) {
        o.damage += amt(e.amount);
        if (o.damage >= o.toughness) removeObject(view, o.id);
      }
      return 0;
    }
    case "damageAll": {
      for (const o of [...view.battlefield]) {
        if (o.toughness === null) continue;
        if (amt(e.amount) + o.damage >= o.toughness) removeObject(view, o.id);
      }
      return 0;
    }
    case "destroy": {
      const o = objAt(e.target);
      if (o && !o.keywords.includes("indestructible")) removeObject(view, o.id);
      return 0;
    }
    case "destroyAll": {
      for (const o of [...view.battlefield]) {
        if (o.power !== null && !o.keywords.includes("indestructible")) removeObject(view, o.id);
      }
      return 0;
    }
    case "exile": {
      const o = objAt(e.target);
      if (o) removeObject(view, o.id);
      return 0;
    }
    case "bounce": {
      const o = objAt(e.target);
      if (!o) return 0;
      removeObject(view, o.id);
      if (o.controller === me) view.hand.push({ objectId: `pred_${predSeq++}`, cardId: o.cardId });
      else view.opponentHandCount += 1;
      return 0;
    }
    case "counter": {
      const t = targets[e.target];
      const item = t && view.stack.find((s) => s.id === (t as { id?: string }).id);
      if (!item) return 0;
      view.stack = view.stack.filter((s) => s.id !== item.id);
      const d = defs.get(item.cardId);
      return d ? Math.max(1, manaValue(parseManaCost(d.manaCost))) : 1;
    }
    case "draw": {
      for (const p of e.who === "you" ? [me] : e.who === "opponent" ? [opp] : [me, opp]) {
        if (p === me) for (let i = 0; i < e.count; i++) view.hand.push({ objectId: `pred_${predSeq++}`, cardId: "" });
        else view.opponentHandCount += e.count;
      }
      return 0;
    }
    case "discard": {
      if (e.who === "target" || e.who === "opponent") view.opponentHandCount = Math.max(0, view.opponentHandCount - e.count);
      return 0;
    }
    case "gainLife": {
      for (const p of e.who === "you" ? [me] : e.who === "opponent" ? [opp] : [me, opp]) {
        view.life[p as 0 | 1] += typeof e.amount === "number" ? e.amount : 0;
      }
      return 0;
    }
    case "loseLife": {
      const ps =
        e.who === "you" ? [me] : e.who === "opponent" ? [opp] : e.who === "target"
          ? targets.flatMap((t) => (t.kind === "player" ? [t.player] : []))
          : [me, opp];
      for (const p of ps) view.life[p as 0 | 1] -= typeof e.amount === "number" ? e.amount : 0;
      return 0;
    }
    case "createToken": {
      const td = defs.get(e.tokenId);
      for (let i = 0; i < e.count; i++) {
        view.battlefield.push({
          id: `pred_${predSeq++}`, cardId: e.tokenId, controller: me, tapped: false, damage: 0,
          attachedTo: null, power: td?.power ?? 1, toughness: td?.toughness ?? 1,
          keywords: [...(td?.keywords ?? [])],
        });
      }
      return 0;
    }
    case "addCounters": {
      const o = objAt(e.target);
      if (o && o.power !== null && o.toughness !== null) {
        const delta = e.kind === "+1/+1" ? e.count : -e.count;
        o.power += delta;
        o.toughness += delta;
        if (o.toughness <= 0) removeObject(view, o.id);
      }
      return 0;
    }
    case "tapTarget": {
      const o = objAt(e.target);
      if (!o) return 0;
      const wasUntapped = !o.tapped;
      o.tapped = true;
      // Tempo value when it taps down an opponent's untapped creature; a
      // small cost when it wastes our own (book of shame: no-benefit taps).
      if (!wasUntapped) return 0;
      return o.controller !== me ? 0.3 : -0.15;
    }
    case "untapTarget": {
      const o = objAt(e.target);
      if (o) o.tapped = false;
      return 0;
    }
    case "modifyPT": {
      // Targeted pump/shrink: apply to the live numbers so lethal -X/-X
      // (Drana) reads as removal and saves read as survival. Scope'd or
      // static pumps stay a small flat bonus (combat context not modeled).
      if (e.target === undefined) return e.duration === "UNTIL_END_OF_TURN" ? 0.2 : 0.3;
      const o = objAt(e.target);
      if (!o || o.power === null || o.toughness === null) return 0.1;
      const pv = e.power === "X" ? x : e.power === "-X" ? -x : e.power;
      const tv = e.toughness === "X" ? x : e.toughness === "-X" ? -x : e.toughness;
      o.power += pv;
      o.toughness += tv;
      if (o.toughness <= 0) removeObject(view, o.id);
      return 0.05;
    }
    case "grantKeyword":
      return 0.15;
    case "searchLibrary":
      return 0.5;
    case "returnFromGraveyard":
      return 0.6;
    default:
      return 0.2; // unknown vocabulary: casting is mildly better than nothing
  }
}
