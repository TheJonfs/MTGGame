import { parseManaCost, manaValue, type CardDef, type Effect, type ResolvedTarget } from "@shandalar/cards";
import type { Action, GameView } from "@shandalar/engine";
import { classifyEffects, effectsForAction } from "./effect-classification.js";
import { DEFAULT_CONSTANTS, objectValue, type EvalConstants } from "./evaluator.js";

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

/** Hand-rolled deep copy — GameView is plain data and structuredClone was
 * the single hottest call in priority scoring (S9 Part 0.2 perf pass). */
function clone(view: GameView): GameView {
  return {
    ...view,
    life: [view.life[0], view.life[1]],
    librarySizes: [view.librarySizes[0], view.librarySizes[1]], // S16: mill mutates it
    hand: view.hand.map((c) => ({ ...c })),
    combat: {
      attackers: [...view.combat.attackers],
      blocks: view.combat.blocks.map((b) => ({ ...b })),
    },
    battlefield: view.battlefield.map((o) => ({ ...o, keywords: [...o.keywords] })),
    stack: view.stack.map((s) => ({ ...s })),
    graveyards: [[...view.graveyards[0]], [...view.graveyards[1]]],
  };
}

function removeObject(view: GameView, id: string): void {
  view.battlefield = view.battlefield.filter((o) => o.id !== id);
}

let predSeq = 0;

export function predictAction(
  view: GameView,
  action: Action,
  defs: Map<string, CardDef>,
  constants: EvalConstants = DEFAULT_CONSTANTS,
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
      // S9 Part 2b: an ETB trigger that counters a spell (Mystic Snake) is
      // worth the countered spell's mana when an opponent spell is on the
      // stack right now — the flash cast IS the counterspell.
      const etbCounter = (d.abilities ?? []).some(
        (a) => a.kind === "triggered" && a.event === "ENTERS_BATTLEFIELD" && a.effects.some((e) => e.type === "counter"),
      );
      if (etbCounter) {
        const oppSpell = [...view.stack].reverse().find((it) => it.controller !== me && it.kind === "spell");
        if (oppSpell) {
          const sd = defs.get(oppSpell.cardId);
          adjustment += sd ? Math.max(1, manaValue(parseManaCost(sd.manaCost))) : 1;
        }
      }
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
      // ADR-056: the aura's standing value is ~0 in the evaluator now, so no
      // standing-value patch is needed — self-steal ordering follows from
      // accounting (book of shame verifies).
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
    for (const e of d.spellEffect ?? []) adjustment += applyEffect(next, e, targets, x, defs, constants);
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
  for (const e of ability.effects) adjustment += applyEffect(next, e, targets, x, defs, constants);
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
  constants: EvalConstants,
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
      if (o.controller === me) {
        view.hand.push({ objectId: `pred_${predSeq++}`, cardId: o.cardId });
        return 0;
      }
      view.opponentHandCount += 1;
      // S9 Part 2c: bouncing an opponent permanent is tempo, not removal —
      // they can recast it, so charge back roughly half its board value. The
      // rest (recast cost, lost enchant/equip investment, sickness reset)
      // is the real tempo profit the material swing keeps.
      return -0.5 * objectValue(defs, o, constants);
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
      // S11 (playtest): resolve WHO actually discards. The old code debited
      // the opponent for every who:"target" discard, so Hymn-at-own-head
      // scored identically to Hymn-at-theirs and softmax coin-flipped it.
      const ps =
        e.who === "you" ? [me]
        : e.who === "opponent" ? [opp]
        : e.who === "eachPlayer" ? [me, opp]
        : targets.flatMap((t) => (t.kind === "player" ? [t.player] : []));
      for (const p of ps) {
        if (p === me) view.hand.length = Math.max(0, view.hand.length - e.count);
        else view.opponentHandCount = Math.max(0, view.opponentHandCount - e.count);
      }
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
    case "mill": {
      // ADR-070: mill valuation v1 — a nuisance, not an archetype (the Adept
      // is a starter check). Resolve WHO is milled (book of shame 10: the
      // Adept milled its own controller half the time when this was a flat
      // 0.1): milling the opponent is worth a little, more as their library
      // thins; milling yourself is a real cost in 30-card decks.
      const ps =
        e.who === "you" ? [me]
        : e.who === "opponent" ? [opp]
        : e.who === "eachPlayer" ? [me, opp]
        : targets.flatMap((t) => (t.kind === "player" ? [t.player as 0 | 1] : []));
      let v = 0;
      for (const p of ps) {
        const lib = Math.max(0, (view.librarySizes[p] ?? 0) - e.count);
        view.librarySizes[p] = lib;
        if (p === me) v -= 1.5 * e.count + (lib <= 5 ? 2 : 0);
        else v += 0.25 * e.count + (lib <= 5 ? 0.6 * e.count : 0) + (lib === 0 ? 5 : 0);
      }
      return v;
    }
    case "returnFromGraveyard":
      return 0.6;
    default:
      return 0.2; // unknown vocabulary: casting is mildly better than nothing
  }
}
