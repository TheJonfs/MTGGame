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
