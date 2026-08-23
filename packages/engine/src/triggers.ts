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
  const pend = (sourceId: string, sourceCardId: string, controller: PlayerId, abilityIndex: number) => {
    ctx.state.pendingTriggers.push({
      sourceId,
      sourceCardId,
      controller,
      abilityIndex,
      timestamp: nextTimestamp(ctx.state),
    });
  };

  // Zone-change-shaped events: the moving object's own abilities (self conditions)…
  ctx.bus.on("ZONE_CHANGE", (ev) => {
    const abilities = ctx.defs.def(ev.cardId).abilities ?? [];
    const isSelf = (a: import("@shandalar/cards").TriggeredAbilityDef) => {
      const src = a.condition?.source ?? (a.condition?.self === false ? "other" : "self");
      return src === "self";
    };
    const collect = (eventName: string, sourceId: string, controller: PlayerId) => {
      abilities.forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== eventName || !isSelf(a)) return;
        pend(sourceId, ev.cardId, controller, i);
      });
    };
    if (ev.to === "battlefield" && ev.newId) collect("ENTERS_BATTLEFIELD", ev.newId, ev.controller);
    if (ev.from === "battlefield") {
      // Look-back: the ability of the object that left fires even though the
      // battlefield object is gone (engine-design §4), for whoever controlled
      // it there. The trigger's sourceId is the object's CURRENT identity
      // (the graveyard card) so self-referencing effects — Rancor's return —
      // can reach it; tokens that ceased keep the old id.
      const sourceId = ev.newId || ev.oldId;
      if (ev.to === "graveyard") collect("DIES", sourceId, ev.controllerBefore);
      collect("LEAVES_BATTLEFIELD", sourceId, ev.controllerBefore);
    }
    // …and ADR-076 (S17) OBSERVED triggers: other permanents watching ETB/DIES
    // (source "other" | "any" with type/subtype/controller conditions — Youthful
    // Valkyrie's "another Angel enters", Blood Artist's "this or another creature
    // dies"). Observers = battlefield permanents + the look-back set (objects that
    // left in the same batch — Blood Artist dying with the rest still sees them).
    const observedEvent = ev.to === "battlefield" && ev.newId ? "ENTERS_BATTLEFIELD" : ev.from === "battlefield" && ev.to === "graveyard" ? "DIES" : null;
    if (!observedEvent) return;
    const movedId = observedEvent === "ENTERS_BATTLEFIELD" ? ev.newId! : ev.oldId;
    const movedDef = ctx.defs.def(ev.cardId);
    const movedController = observedEvent === "ENTERS_BATTLEFIELD" ? ev.controller : ev.controllerBefore;
    const observers: { id: string; cardId: string; controller: PlayerId }[] = ctx.state.battlefield.map((id) => {
      const o = ctx.state.objects[id]!;
      return { id, cardId: o.cardId, controller: o.controller };
    });
    for (const [id, lb] of ctx.lookback ?? []) if (!ctx.state.battlefield.includes(id) && id !== movedId) observers.push({ id, cardId: lb.cardId, controller: lb.controller });
    // The moved object observes its own event too (source "any": Blood Artist's OWN death drains; "other"/"self" sort themselves out below).
    if (!observers.some((o) => o.id === movedId)) observers.push({ id: movedId, cardId: ev.cardId, controller: movedController });
    for (const obs of observers) {
      (ctx.defs.def(obs.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== observedEvent) return;
        const cond = a.condition ?? {};
        const source = cond.source ?? "self";
        if (source === "self" || source === "attached") return; // handled above / not an observer shape
        if (source === "other" && obs.id === movedId) return;
        // "any" includes itself: Blood Artist's own death is collected HERE (not as a self trigger) so it isn't double-counted.
        if (source === "any" && obs.id === movedId && isSelfCollected(a)) return;
        const ctrl = cond.controller ?? "any";
        if (ctrl === "you" && movedController !== obs.controller) return;
        if (ctrl === "opponent" && movedController === obs.controller) return;
        if (cond.type && !cond.type.some((t) => movedDef.types.includes(t as never))) return;
        if (cond.notType && cond.notType.some((t) => movedDef.types.includes(t as never))) return;
        if (cond.subtype && !cond.subtype.some((t) => (movedDef.subtypes ?? []).includes(t))) return;
        // The observer's trigger source: its current identity (graveyard card if it already left; the moved object's new id).
        const sourceId = ctx.state.objects[obs.id] ? obs.id : obs.id === movedId ? (ev.newId || ev.oldId) : (ctx.lookback?.get(obs.id)?.currentId ?? obs.id);
        pend(sourceId, obs.cardId, obs.controller, i);
      });
    }
  });

  // ADR-076: upkeep triggers ("at the beginning of your upkeep" — Bitterblossom). Controller
  // condition is relative to whose upkeep it is: default "you" = the permanent's controller.
  ctx.bus.on("UPKEEP_BEGIN", (ev) => {
    for (const permId of [...ctx.state.battlefield]) {
      const perm = ctx.state.objects[permId];
      if (!perm) continue;
      (ctx.defs.def(perm.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== "UPKEEP") return;
        const ctrl = a.condition?.controller ?? "you";
        if (ctrl === "you" && ev.player !== perm.controller) return;
        if (ctrl === "opponent" && ev.player === perm.controller) return;
        pend(permId, perm.cardId, perm.controller, i);
      });
    }
  });

  // ADR-076: discard triggers (Waste Not): `player` = who discarded, relative to the
  // observer's controller; type/notType read the discarded card's types.
  ctx.bus.on("DISCARD", (ev) => {
    for (const permId of [...ctx.state.battlefield]) {
      const perm = ctx.state.objects[permId];
      if (!perm) continue;
      (ctx.defs.def(perm.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== "DISCARD") return;
        const cond = a.condition ?? {};
        const who = cond.player ?? "any";
        if (who === "opponentOfController" && ev.player === perm.controller) return;
        if (who === "controller" && ev.player !== perm.controller) return;
        if (cond.type && !cond.type.some((t) => ev.types.includes(t))) return;
        if (cond.notType && cond.notType.some((t) => ev.types.includes(t))) return;
        pend(permId, perm.cardId, perm.controller, i);
      });
    }
  });

  // Damage-to-player events: scanned across all battlefield permanents with
  // condition evaluation (ADR-021; Curiosity is the first listener).
  ctx.bus.on("DAMAGE", (ev) => {
    if (ev.target.kind !== "player") return;
    const damagedPlayer = ev.target.player;
    for (const permId of [...ctx.state.battlefield]) {
      const perm = ctx.state.objects[permId];
      if (!perm) continue;
      const abilities = ctx.defs.def(perm.cardId).abilities ?? [];
      abilities.forEach((a, i) => {
        if (a.kind !== "triggered") return;
        if (a.event !== "DEALS_DAMAGE_TO_PLAYER" && !(a.event === "DEALS_COMBAT_DAMAGE_TO_PLAYER" && ev.combat)) {
          return;
        }
        const cond = a.condition ?? {};
        // source: whose damage counts. "attached" = the object this
        // aura/equipment is attached to (Curiosity); "self" = the permanent itself.
        const source = cond.source ?? "self";
        if (source === "self" && ev.sourceId !== permId) return;
        if (source === "attached" && (!perm.attachedTo || ev.sourceId !== perm.attachedTo)) return;
        if (source === "other" && ev.sourceId === permId) return;
        // player: which damaged player counts, relative to the ability's controller.
        const playerCond = cond.player ?? "any";
        if (playerCond === "opponentOfController" && damagedPlayer === perm.controller) return;
        if (playerCond === "controller" && damagedPlayer !== perm.controller) return;
        pend(permId, perm.cardId, perm.controller, i);
      });
    }
  });
}

/** A "self" trigger on the same event is collected by the ZONE_CHANGE self path; an "any"
 * observer is not also a self trigger (source "any" means the self path skipped it). */
function isSelfCollected(a: import("@shandalar/cards").TriggeredAbilityDef): boolean {
  const src = a.condition?.source ?? "self";
  return src === "self";
}

export type ActionRequester = (
  player: PlayerId,
  purpose: "chooseTarget" | "orderTriggers" | "chooseMode",
  actions: Action[],
  /** ADR-048: identity of the trigger asking for targets. */
  source?: { cardId: string; effects: import("@shandalar/cards").Effect[] },
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
          objectId: t.sourceId, // log readability (data-model §6, S3)
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
  // A6: modal trigger — the controller picks a mode as it goes on the stack (CR 603.3c), among
  // the modes whose targets can be chosen (601.2b legality); targets come after the mode.
  let effects = ability.effects;
  let specs = ability.targets ?? [];
  let mode: number | undefined;
  if (ability.modes) {
    const legal = ability.modes.map((m, i) => ({ m, i })).filter(({ m }) => targetCombinations(ctx, m.targets ?? [], trigger.controller, trigger.sourceId).length > 0);
    if (legal.length === 0) {
      ctx.log.append({ t: "EVENT", name: "TRIGGER_NO_TARGETS", payload: { cardId: trigger.sourceCardId } });
      return null;
    }
    let pick = legal[0]!.i;
    if (legal.length > 1) {
      const actions: Action[] = legal.map(({ m, i }) => ({ type: "chooseMode", mode: i, label: m.label }));
      const chosen = await request(trigger.controller, "chooseMode", actions, { cardId: trigger.sourceCardId, effects: legal.flatMap((l) => l.m.effects) });
      if (chosen.type !== "chooseMode") throw new Error("expected chooseMode action");
      pick = chosen.mode;
    }
    mode = pick;
    effects = ability.modes[pick]!.effects;
    specs = ability.modes[pick]!.targets ?? [];
  }
  let targets: import("@shandalar/cards").ResolvedTarget[] = [];

  if (specs.length > 0) {
    const combos = targetCombinations(ctx, specs, trigger.controller, trigger.sourceId);
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
      const chosen = await request(trigger.controller, "chooseTarget", actions, {
        cardId: trigger.sourceCardId,
        effects,
      });
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
    effects,
    x: 0,
    ...(ability.optional === true ? { isOptionalTrigger: true } : {}),
    ...(mode !== undefined ? { mode } : {}),
  };
}
