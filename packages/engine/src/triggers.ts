import type { EngineCtx } from "./ctx.js";
import type { Action } from "./actions.js";
import { targetCombinations } from "./targeting.js";
import { nextTimestamp, type PendingTrigger, type PlayerId, type StackItem } from "./state.js";

/**
 * Triggered abilities (R-016). Triggers are collected from ZONE_CHANGE events
 * into a pending queue and placed on the stack the next time a player would
 * receive priority, APNAP order. Same-controller ordering is the controller's
 * choice via orderTrigger actions (ADR-011); the first trigger placed
 * resolves last (CR 603.3b).
 *
 * DIES/LEAVES_BATTLEFIELD triggers belong to the object's pre-move
 * controller, read from the ZONE_CHANGE payload (ADR-016).
 */
export function wireTriggerCollection(ctx: EngineCtx): void {
  ctx.bus.on("ZONE_CHANGE", (ev) => {
    const def = ctx.defs.def(ev.cardId);
    const abilities = def.abilities ?? [];

    const collect = (eventName: string, sourceId: string, controller: PlayerId) => {
      abilities.forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== eventName) return;
        // Current conditions are all `self`; a trigger with no condition on
        // these events is also about its own source.
        ctx.state.pendingTriggers.push({
          sourceId,
          sourceCardId: ev.cardId,
          controller,
          abilityIndex: i,
          timestamp: nextTimestamp(ctx.state),
        });
      });
    };

    if (ev.to === "battlefield" && ev.newId) collect("ENTERS_BATTLEFIELD", ev.newId, ev.controller);
    if (ev.from === "battlefield") {
      // Look-back: the ability of the object that left fires even though the
      // object is gone (engine-design §4), for whoever controlled it there.
      if (ev.to === "graveyard") collect("DIES", ev.oldId, ev.controllerBefore);
      collect("LEAVES_BATTLEFIELD", ev.oldId, ev.controllerBefore);
    }
  });
}

export type ActionRequester = (
  player: PlayerId,
  purpose: "chooseTarget" | "orderTriggers",
  actions: Action[],
) => Promise<Action>;

/**
 * Move pending triggers onto the stack (CR 603.3). APNAP between players;
 * within one player's set, the controller picks which goes on the stack next
 * (single leftover is forced and silent, ADR-014). Targets are chosen as each
 * trigger is placed. Returns true if anything was placed.
 */
export async function placePendingTriggers(ctx: EngineCtx, request: ActionRequester): Promise<boolean> {
  const state = ctx.state;
  if (state.pendingTriggers.length === 0) return false;

  const pending = state.pendingTriggers;
  state.pendingTriggers = [];

  const active = state.activePlayer;
  let placed = false;
  for (const controller of [active, active === 0 ? 1 : 0] as PlayerId[]) {
    const remaining = pending
      .filter((t) => t.controller === controller)
      .sort((a, b) => a.timestamp - b.timestamp);
    while (remaining.length > 0) {
      let pickIndex = 0;
      if (remaining.length > 1) {
        const actions: Action[] = remaining.map((t, index) => ({
          type: "orderTrigger",
          index,
          cardId: t.sourceCardId,
        }));
        const chosen = await request(controller, "orderTriggers", actions);
        if (chosen.type !== "orderTrigger") throw new Error("expected orderTrigger action");
        pickIndex = chosen.index;
      }
      const [trigger] = remaining.splice(pickIndex, 1);
      const item = await buildTriggerItem(ctx, trigger!, request);
      if (item) {
        state.stack.push(item);
        placed = true;
      }
    }
  }
  return placed;
}

async function buildTriggerItem(
  ctx: EngineCtx,
  trigger: PendingTrigger,
  request: ActionRequester,
): Promise<StackItem | null> {
  const def = ctx.defs.def(trigger.sourceCardId);
  const ability = def.abilities?.[trigger.abilityIndex];
  if (!ability || ability.kind !== "triggered") {
    throw new Error(`Pending trigger points at a non-trigger: ${trigger.sourceCardId}[${trigger.abilityIndex}]`);
  }
  const specs = ability.targets ?? [];
  let targets: import("@shandalar/cards").ResolvedTarget[] = [];

  if (specs.length > 0) {
    const combos = targetCombinations(ctx, specs, trigger.controller);
    if (combos.length === 0) {
      // A trigger that requires targets with none legal never goes on the
      // stack (CR 603.3d).
      ctx.log.append({ t: "EVENT", name: "TRIGGER_NO_TARGETS", payload: { cardId: trigger.sourceCardId } });
      return null;
    }
    if (combos.length === 1) {
      targets = combos[0]!;
    } else {
      const actions: Action[] = combos.map((c) => ({ type: "chooseTriggerTargets", targets: c }));
      const chosen = await request(trigger.controller, "chooseTarget", actions);
      if (chosen.type !== "chooseTriggerTargets") throw new Error("expected chooseTriggerTargets action");
      targets = chosen.targets;
    }
  }

  return {
    id: ctx.ids.next("stk"),
    kind: "trigger",
    sourceId: trigger.sourceId,
    sourceCardId: trigger.sourceCardId,
    controller: trigger.controller,
    targetSpecs: specs,
    targets,
    effects: ability.effects,
    x: 0,
  };
}
