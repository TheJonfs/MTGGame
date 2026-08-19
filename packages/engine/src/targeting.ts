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

/** Is `target` legal for `spec` right now, targeted by `by`? Used at cast and re-checked at resolution (CR 608.2b). */
export function isLegalTarget(ctx: EngineCtx, spec: TargetSpec, target: ResolvedTarget, by: PlayerId): boolean {
  const state = ctx.state;
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
    case "spell":
      return target.kind === "stackItem" && state.stack.some((s) => s.id === target.id && s.kind === "spell");
    case "cardInYourGraveyard": {
      if (target.kind !== "object") return false;
      const obj = state.objects[target.id];
      return !!obj && obj.zone === "graveyard" && obj.owner === by;
    }
  }
}

/** All legal targets for a spec (deterministic order: battlefield/stack order, then players 0,1). */
export function targetCandidates(ctx: EngineCtx, spec: TargetSpec, by: PlayerId): ResolvedTarget[] {
  const state = ctx.state;
  const out: ResolvedTarget[] = [];
  for (const id of state.battlefield) {
    const t: ResolvedTarget = { kind: "object", id };
    if (isLegalTarget(ctx, spec, t, by)) out.push(t);
  }
  for (const item of state.stack) {
    const t: ResolvedTarget = { kind: "stackItem", id: item.id };
    if (isLegalTarget(ctx, spec, t, by)) out.push(t);
  }
  for (const player of [0, 1] as PlayerId[]) {
    const t: ResolvedTarget = { kind: "player", player };
    if (isLegalTarget(ctx, spec, t, by)) out.push(t);
  }
  if (spec.predicate === "cardInYourGraveyard") {
    for (const id of state.players[by].graveyard) {
      const t: ResolvedTarget = { kind: "object", id };
      if (isLegalTarget(ctx, spec, t, by)) out.push(t);
    }
  }
  return out;
}

/**
 * All legal target tuples for a spell/ability's specs (each spec count=1 in
 * the current pool; the cartesian product is bounded by ADR-004's reasoning).
 */
export function targetCombinations(ctx: EngineCtx, specs: TargetSpec[], by: PlayerId): ResolvedTarget[][] {
  if (specs.length === 0) return [[]];
  let combos: ResolvedTarget[][] = [[]];
  for (const spec of specs) {
    if (spec.count !== 1) throw new Error("multi-target specs not yet supported (no pool card needs them)");
    const cands = targetCandidates(ctx, spec, by);
    const next: ResolvedTarget[][] = [];
    for (const combo of combos) for (const c of cands) next.push([...combo, c]);
    combos = next;
  }
  return combos;
}
