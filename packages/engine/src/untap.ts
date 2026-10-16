import type { EngineCtx } from "./ctx.js";

/**
 * Post-S65 (R-113, Tidal Shackle) — the one way a permanent untaps. CR 122.1d: one or more stun counters on a permanent
 * are a single replacement effect — if it would become untapped, a stun counter is removed from it instead. Every untap
 * (the untap step, Seedborn's untap on another's step, an effect that untaps) comes through here, so the counter and the
 * UNTAPPED event (the Warden's law hangs on it) cannot disagree: a stunned permanent does not untap, and nothing fires.
 * Returns whether it untapped. (The mana take-back, `untapForMana`, is an interface undo of a tap, not an untap.)
 */
export function untapPermanent(ctx: EngineCtx, objectId: string): boolean {
  const obj = ctx.state.objects[objectId];
  if (!obj || obj.zone !== "battlefield" || !obj.tapped) return false;
  const stun = obj.counters["stun"] ?? 0;
  if (stun > 0) {
    if (stun === 1) delete obj.counters["stun"];
    else obj.counters["stun"] = stun - 1;
    return false;
  }
  obj.tapped = false;
  ctx.bus.emit("UNTAPPED", { objectId });
  return true;
}
