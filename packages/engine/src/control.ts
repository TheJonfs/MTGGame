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

    // S26 (Lumen — the threaten class): stored gainControl effects (resolved, until end of turn)
    // apply AFTER the aura statics, in their own timestamp order. Known simplification (R-087):
    // CR 613.7 orders statics and resolved effects by one shared timestamp; here a resolved steal
    // always outranks an aura, so a Control Magic cast on an already-threatened creature waits
    // for cleanup to bite. The reverse (threaten a Control-Magic'd creature) is exact.
    const stolen = state.continuousEffects
      .filter((ce) => ce.kind === "gainControl" && ce.objectId === id && ce.controller !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);
    for (const ce of stolen) effective = ce.controller!;

    if (effective !== obj.controller) {
      obj.controller = effective;
      if (isCreature(ctx, id)) obj.summoningSick = true; // 302.6, both steal and reversion
      changed = true;
    }
  }
  return changed;
}
