import type { EngineCtx } from "./ctx.js";
import { getObject } from "./state.js";
import { isCreature } from "./characteristics.js";
import { evaluateValueRef, isStackOnlyRef } from "./effect-context.js";

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
          if (e.type !== "gainControl" || e.scope !== "attached") continue;
          // S56 (R-105, Protocol — "you control enchanted creature as long as its power would be 0 or less if you didn't control it"): a
          // conditional control static is read with the creature under the control it would have WITHOUT this
          // Aura (the control so far), so the answer does not depend on itself — our own anthem on a creature we
          // took does not hand it back, and no pair of effects can pass it to and fro within one check.
          if (ability.condition) {
            const c = ability.condition, held = obj.controller;
            obj.controller = effective;
            const n = isStackOnlyRef(c.value) ? 0 : evaluateValueRef(ctx, c.value, src.controller, srcId);
            obj.controller = held;
            if (!(c.atMost !== undefined ? n <= c.atMost : n >= (c.atLeast ?? 0))) continue;
          }
          effective = src.controller;
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
