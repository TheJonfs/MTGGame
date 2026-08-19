import type { TriggeredAbilityDef } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import type { Action } from "./actions.js";
import { targetCombinations } from "./targeting.js";
import { nextTimestamp, opponentOf, type PendingTrigger, type StackItem } from "./state.js";

/**
 * Triggered abilities (R-016). Triggers are collected from ZONE_CHANGE events
 * into a pending queue and placed on the stack the next time a player would
 * receive priority, APNAP order. Same-controller ordering: timestamp order —
 * deterministic interim per the brief (a chooseOne hook replaces this later).
 *
 * S1 scope: ETB (and the DIES look-back wiring, unused by the slice) with
 * `self` conditions only.
 */
export function wireTriggerCollection(ctx: EngineCtx): void {
  ctx.bus.on("ZONE_CHANGE", (ev) => {
    const def = ctx.defs.def(ev.cardId);
    const abilities = def.abilities ?? [];

    const collect = (eventName: string, sourceId: string) => {
      abilities.forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== eventName) return;
        // S1: only `self` conditions exist; a trigger with no condition on
        // these events is also about its own source.
        ctx.state.pendingTriggers.push({
          sourceId,
          sourceCardId: ev.cardId,
          controller: ev.controller,
          abilityIndex: i,
          timestamp: nextTimestamp(ctx.state),
        });
      });
    };

    if (ev.to === "battlefield" && ev.newId) collect("ENTERS_BATTLEFIELD", ev.newId);
    if (ev.from === "battlefield") {
      // Leave/dies triggers use a look-back: the ability of the object that
      // left fires even though the object is gone (engine-design §4).
      if (ev.to === "graveyard") collect("DIES", ev.oldId);
      collect("LEAVES_BATTLEFIELD", ev.oldId);
    }
  });
}

export type ActionRequester = (
  player: 0 | 1,
  purpose: "triggerTargets",
  actions: Action[],
) => Promise<Action>;

/**
 * Move pending triggers onto the stack (CR 603.3), asking the controller for
 * targets where the ability targets. Returns true if anything was placed.
 */
export async function placePendingTriggers(ctx: EngineCtx, request: ActionRequester): Promise<boolean> {
  const state = ctx.state;
  if (state.pendingTriggers.length === 0) return false;

  const pending = state.pendingTriggers;
  state.pendingTriggers = [];

  // APNAP: active player's triggers go on first (resolve last).
  const active = state.activePlayer;
  const ordered = [
    ...pending.filter((t) => t.controller === active).sort((a, b) => a.timestamp - b.timestamp),
    ...pending.filter((t) => t.controller !== active).sort((a, b) => a.timestamp - b.timestamp),
  ];

  let placed = false;
  for (const trigger of ordered) {
    const item = await buildTriggerItem(ctx, trigger, request);
    if (item) {
      state.stack.push(item);
      placed = true;
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
      const chosen = await request(trigger.controller, "triggerTargets", actions);
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
