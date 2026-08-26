import type { EngineCtx } from "./ctx.js";
import { getObject, type PlayerId } from "./state.js";
import { isCreature } from "./characteristics.js";

/**
 * Sacrifice-as-cost (R-023). Predicates: "self", "creature", or
 * "creature.subtype:<Subtype>". Sacrifice is not destruction and not
 * targeting — indestructible and shroud don't protect (CR 701.17c).
 */
export function matchesSacrificePredicate(
  ctx: EngineCtx,
  objectId: string,
  sourceId: string,
  predicate: string,
): boolean {
  if (predicate === "self") return objectId === sourceId;
  const obj = ctx.state.objects[objectId];
  if (!obj || obj.zone !== "battlefield") return false;
  if (!predicate.startsWith("creature")) return false;
  if (!isCreature(ctx, objectId)) return false;
  const sub = predicate.match(/^creature\.subtype:(.+)$/);
  if (sub) {
    return (ctx.defs.def(obj.cardId).subtypes ?? []).includes(sub[1]!);
  }
  return predicate === "creature";
}

/** Objects `player` could sacrifice to pay this cost (must control them, CR 701.17a). */
export function sacrificeCandidates(
  ctx: EngineCtx,
  player: PlayerId,
  sourceId: string,
  predicate: string,
): string[] {
  return ctx.state.battlefield.filter(
    (id) => getObject(ctx.state, id).controller === player && matchesSacrificePredicate(ctx, id, sourceId, predicate),
  );
}

/** A10 word 2 (S22): bounce-own-permanent-as-cost, structurally parallel to sacrifice. Predicates:
 * "self" | "creature" | "land" | "permanent" | "creature.subtype:<Subtype>". Not targeting —
 * shroud/hexproof don't apply (CR 115.1 lineage, same as sacrifice). */
export function matchesReturnToHandPredicate(
  ctx: EngineCtx,
  objectId: string,
  sourceId: string,
  predicate: string,
): boolean {
  if (predicate === "self") return objectId === sourceId;
  const obj = ctx.state.objects[objectId];
  if (!obj || obj.zone !== "battlefield") return false;
  if (predicate === "permanent") return true;
  if (predicate === "land") return ctx.defs.def(obj.cardId).types.includes("Land");
  if (!predicate.startsWith("creature")) return false;
  if (!isCreature(ctx, objectId)) return false;
  const sub = predicate.match(/^creature\.subtype:(.+)$/);
  if (sub) return (ctx.defs.def(obj.cardId).subtypes ?? []).includes(sub[1]!);
  return predicate === "creature";
}

/** Objects `player` could bounce to pay a returnToHand cost (must control them). */
export function returnToHandCandidates(
  ctx: EngineCtx,
  player: PlayerId,
  sourceId: string,
  predicate: string,
): string[] {
  return ctx.state.battlefield.filter(
    (id) => getObject(ctx.state, id).controller === player && matchesReturnToHandPredicate(ctx, id, sourceId, predicate),
  );
}

/** A10 word 6 (S22): untapped creatures `player` controls that could pay a tapCreature cost.
 * Summoning sickness does NOT block it — CR 602.5.1 governs only the source's own {T} symbol. */
export function tapCreatureCandidates(ctx: EngineCtx, player: PlayerId, predicate: string): string[] {
  return ctx.state.battlefield.filter((id) => {
    const obj = getObject(ctx.state, id);
    if (obj.controller !== player || obj.tapped) return false;
    if (!isCreature(ctx, id)) return false;
    const sub = predicate.match(/^creature\.subtype:(.+)$/);
    if (sub) return (ctx.defs.def(obj.cardId).subtypes ?? []).includes(sub[1]!);
    return predicate === "creature";
  });
}
