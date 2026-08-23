import { cardColors, type ResolvedTarget, type TargetSpec } from "@shandalar/cards";
import { characteristics, isCreature } from "./characteristics.js";
import type { EngineCtx } from "./ctx.js";
import type { PlayerId } from "./state.js";

/** Hexproof/shroud live in the predicate layer (engine-design §10). */
function canBeTargeted(ctx: EngineCtx, objectId: string, by: PlayerId): boolean {
  const obj = ctx.state.objects[objectId];
  if (!obj) return false;
  const chars = characteristics(ctx, objectId);
  if (chars.keywords.has("shroud")) return false;
  if (chars.keywords.has("hexproof") && obj.controller !== by) return false;
  return true;
}

/** Is `target` legal for `spec` right now, targeted by `by`? Used at cast and re-checked at resolution (CR 608.2b).
 * ADR-076 (S17): the base predicate is composed with filters — `anyOf` (or), `withKeyword`/`withoutKeyword`,
 * `notSubtype`, and `other` (never the ability's own `sourceId`). */
export function isLegalTarget(ctx: EngineCtx, spec: TargetSpec, target: ResolvedTarget, by: PlayerId, sourceId?: string): boolean {
  if (spec.anyOf && spec.anyOf.length > 0) {
    if (!spec.anyOf.some((alt) => isLegalTarget(ctx, alt, target, by, sourceId))) return false;
  } else if (!basePredicate(ctx, spec, target, by)) {
    return false;
  }
  if (spec.other && sourceId && target.kind === "object" && target.id === sourceId) return false;
  if (target.kind === "object" && (spec.withKeyword || spec.withoutKeyword || spec.notSubtype)) {
    const obj = ctx.state.objects[target.id];
    if (!obj || obj.zone !== "battlefield") return false;
    const ch = characteristics(ctx, target.id);
    if (spec.withKeyword && !ch.keywords.has(spec.withKeyword)) return false;
    if (spec.withoutKeyword && ch.keywords.has(spec.withoutKeyword)) return false;
    if (spec.notSubtype && ch.subtypes.includes(spec.notSubtype)) return false;
  }
  return true;
}

function basePredicate(ctx: EngineCtx, spec0: TargetSpec, target: ResolvedTarget, by: PlayerId): boolean {
  const state = ctx.state;
  // Recursive base checks below compose predicates only — filters are applied once, by the caller.
  const spec: TargetSpec = { count: spec0.count, predicate: spec0.predicate, zone: spec0.zone };
  switch (spec.predicate) {
    case "creature": {
      if (target.kind !== "object") return false;
      const obj = state.objects[target.id];
      return !!obj && obj.zone === "battlefield" && isCreature(ctx, target.id) && canBeTargeted(ctx, target.id, by);
    }
    case "nonblackCreature": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by)) return false;
      // ADR-019: color predicates read the explicit/derived colors field.
      return target.kind === "object" && !cardColors(ctx.defs.def(state.objects[target.id]!.cardId)).includes("B");
    }
    case "nonartifactNonblackCreature": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "nonblackCreature" }, target, by)) return false;
      return target.kind === "object" && !ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Artifact");
    }
    case "creatureYouControl": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by)) return false;
      return target.kind === "object" && state.objects[target.id]!.controller === by;
    }
    case "creatureYouDontControl": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by)) return false;
      return target.kind === "object" && state.objects[target.id]!.controller !== by;
    }
    case "permanent": {
      if (target.kind !== "object") return false;
      const obj = state.objects[target.id];
      return !!obj && obj.zone === "battlefield" && canBeTargeted(ctx, target.id, by);
    }
    case "anyTarget":
      if (target.kind === "player") return true;
      return isLegalTarget(ctx, { ...spec, predicate: "creature" }, target, by);
    case "player":
      return target.kind === "player";
    case "opponentPlayer":
      return target.kind === "player" && target.player !== by;
    case "spell":
      return target.kind === "stackItem" && state.stack.some((s) => s.id === target.id && s.kind === "spell");
    case "cardInYourGraveyard": {
      if (target.kind !== "object") return false;
      const obj = state.objects[target.id];
      return !!obj && obj.zone === "graveyard" && obj.owner === by;
    }
    case "creatureCardInYourGraveyard": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "cardInYourGraveyard" }, target, by)) return false;
      return target.kind === "object" && ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Creature");
    }
    // ADR-076 (S17)
    case "artifact": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "permanent" }, target, by)) return false;
      return target.kind === "object" && ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Artifact");
    }
    case "enchantment": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "permanent" }, target, by)) return false;
      return target.kind === "object" && ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Enchantment");
    }
    case "nonlandPermanent": {
      if (!isLegalTarget(ctx, { ...spec, predicate: "permanent" }, target, by)) return false;
      return target.kind === "object" && !ctx.defs.def(state.objects[target.id]!.cardId).types.includes("Land");
    }
    case "creatureSpell":
      return target.kind === "stackItem" && state.stack.some((s) => s.id === target.id && s.kind === "spell" && ctx.defs.def(s.sourceCardId).types.includes("Creature"));
  }
}

/** All legal targets for a spec (deterministic order: battlefield/stack order, then players 0,1). */
export function targetCandidates(ctx: EngineCtx, spec: TargetSpec, by: PlayerId, sourceId?: string): ResolvedTarget[] {
  const state = ctx.state;
  const out: ResolvedTarget[] = [];
  for (const id of state.battlefield) {
    const t: ResolvedTarget = { kind: "object", id };
    if (isLegalTarget(ctx, spec, t, by, sourceId)) out.push(t);
  }
  for (const item of state.stack) {
    const t: ResolvedTarget = { kind: "stackItem", id: item.id };
    if (isLegalTarget(ctx, spec, t, by, sourceId)) out.push(t);
  }
  for (const player of [0, 1] as PlayerId[]) {
    const t: ResolvedTarget = { kind: "player", player };
    if (isLegalTarget(ctx, spec, t, by, sourceId)) out.push(t);
  }
  const graveyardy = (sp: TargetSpec): boolean => sp.predicate === "cardInYourGraveyard" || sp.predicate === "creatureCardInYourGraveyard" || (sp.anyOf ?? []).some(graveyardy);
  if (graveyardy(spec)) {
    for (const id of state.players[by].graveyard) {
      const t: ResolvedTarget = { kind: "object", id };
      if (isLegalTarget(ctx, spec, t, by, sourceId)) out.push(t);
    }
  }
  return out;
}

/**
 * All legal target tuples for a spell/ability's specs (each spec count=1 in
 * the current pool; the cartesian product is bounded by ADR-004's reasoning).
 */
export function targetCombinations(ctx: EngineCtx, specs: TargetSpec[], by: PlayerId, sourceId?: string): ResolvedTarget[][] {
  if (specs.length === 0) return [[]];
  let combos: ResolvedTarget[][] = [[]];
  for (const spec of specs) {
    if (spec.count !== 1) throw new Error("multi-target specs not yet supported (no pool card needs them)");
    const cands = targetCandidates(ctx, spec, by, sourceId);
    const next: ResolvedTarget[][] = [];
    for (const combo of combos) for (const c of cands) next.push([...combo, c]);
    combos = next;
  }
  return combos;
}
