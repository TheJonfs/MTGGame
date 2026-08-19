import type { EngineCtx } from "./ctx.js";
import { getObject } from "./state.js";
import { isCreature } from "./characteristics.js";

/**
 * Control layer (ADR-003 slot, ADR-033). Effective control = baseController
 * overridden by control-changing statics ("You control enchanted creature" —
 * Control Magic), latest battlefield timestamp winning. The result is written
 * back to `obj.controller` so every existing "you control" reader stays a
 * plain field read.
 *
 * Runs at the top of every SBA pass — i.e. before any player would receive
 * priority — so a control change or reversion is never observable stale.
 * A change (either direction) sets summoning sickness for the new controller
 * (CR 302.6).
 */
export function syncControl(ctx: EngineCtx): boolean {
  const state = ctx.state;
  let changed = false;

  for (const id of state.battlefield) {
    const obj = getObject(state, id);
    let effective = obj.baseController;

    // Battlefield order is timestamp order; a later control static wins.
    for (const srcId of state.battlefield) {
      const src = getObject(state, srcId);
      if (src.attachedTo !== id) continue;
      for (const ability of ctx.defs.def(src.cardId).abilities ?? []) {
        if (ability.kind !== "static") continue;
        for (const e of ability.effects) {
          if (e.type === "gainControl" && e.scope === "attached") effective = src.controller;
        }
      }
    }

    if (effective !== obj.controller) {
      obj.controller = effective;
      if (isCreature(ctx, id)) obj.summoningSick = true; // 302.6, both steal and reversion
      changed = true;
    }
  }
  return changed;
}
