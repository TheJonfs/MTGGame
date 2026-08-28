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
  const pend = (
    sourceId: string,
    sourceCardId: string,
    controller: PlayerId,
    abilityIndex: number,
    eventContext?: { objectId?: string; cardId?: string; player?: PlayerId; amount?: number },
  ) => {
    ctx.state.pendingTriggers.push({
      sourceId,
      sourceCardId,
      controller,
      abilityIndex,
      timestamp: nextTimestamp(ctx.state),
      ...(eventContext ? { eventContext } : {}),
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
    // A10 word 1 (S22): battlefield→hand joins the observed shapes as RETURNED_TO_HAND
    // (any controller, any cause — the Unwinder's ping; his own bounce fires it via the
    // moved-object-observes-itself path, the Blood Artist precedent).
    const observedEvent =
      ev.to === "battlefield" && ev.newId ? "ENTERS_BATTLEFIELD"
      : ev.from === "battlefield" && ev.to === "graveyard" ? "DIES"
      : ev.from === "battlefield" && ev.to === "hand" ? "RETURNED_TO_HAND"
      : null;
    if (!observedEvent) return;
    const movedId = observedEvent === "ENTERS_BATTLEFIELD" ? ev.newId! : ev.oldId;
    const movedDef = ctx.defs.def(ev.cardId);
    const movedController = observedEvent === "ENTERS_BATTLEFIELD" ? ev.controller : ev.controllerBefore;
    const eventContext = { objectId: ev.newId || ev.oldId, cardId: ev.cardId, player: movedController };
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
        pend(sourceId, obs.cardId, obs.controller, i, eventContext);
      });
    }
  });

  // A10 word 5 (S22): UNTAPPED — observed across the battlefield (untap step and effect untaps both
  // emit). The Warden's law: condition type reads the untapped object's card; the event context
  // carries the object and its controller so "it deals 1 damage to its controller" can address them.
  ctx.bus.on("UNTAPPED", (ev) => {
    const untapped = ctx.state.objects[ev.objectId];
    if (!untapped || untapped.zone !== "battlefield") return;
    const untappedDef = ctx.defs.def(untapped.cardId);
    const eventContext = { objectId: ev.objectId, cardId: untapped.cardId, player: untapped.controller };
    for (const permId of [...ctx.state.battlefield]) {
      const perm = ctx.state.objects[permId];
      if (!perm) continue;
      (ctx.defs.def(perm.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== "UNTAPPED") return;
        const cond = a.condition ?? {};
        const source = cond.source ?? "self";
        if (source === "self" && ev.objectId !== permId) return;
        if (source === "other" && ev.objectId === permId) return;
        const ctrl = cond.controller ?? "any";
        if (ctrl === "you" && untapped.controller !== perm.controller) return;
        if (ctrl === "opponent" && untapped.controller === perm.controller) return;
        if (cond.type && !cond.type.some((t) => untappedDef.types.includes(t as never))) return;
        if (cond.subtype && !cond.subtype.some((t) => (untappedDef.subtypes ?? []).includes(t))) return;
        pend(permId, perm.cardId, perm.controller, i, eventContext);
      });
    }
  });

  // A10 activation (S22): SPELL_CAST — reserved since S1, first collector (the Stoker). Condition
  // `controller` is the caster relative to the observer's controller; the event context carries the
  // caster (unlessPay's payer) and the cast card.
  ctx.bus.on("SPELL_CAST", (ev) => {
    for (const permId of [...ctx.state.battlefield]) {
      const perm = ctx.state.objects[permId];
      if (!perm) continue;
      (ctx.defs.def(perm.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== "SPELL_CAST") return;
        const ctrl = a.condition?.controller ?? "any";
        if (ctrl === "you" && ev.controller !== perm.controller) return;
        if (ctrl === "opponent" && ev.controller === perm.controller) return;
        const castDef = ctx.defs.def(ev.cardId);
        const cond = a.condition ?? {};
        if (cond.type && !cond.type.some((t) => castDef.types.includes(t as never))) return;
        if (cond.notType && cond.notType.some((t) => castDef.types.includes(t as never))) return;
        pend(permId, perm.cardId, perm.controller, i, { cardId: ev.cardId, player: ev.controller });
      });
    }
  });

  // A10 activation (S22): LAND_PLAYED — the special action's own announcement (the Sower). The
  // same observer shape as SPELL_CAST; effect-placed lands never fire it.
  ctx.bus.on("LAND_PLAYED", (ev) => {
    for (const permId of [...ctx.state.battlefield]) {
      const perm = ctx.state.objects[permId];
      if (!perm) continue;
      (ctx.defs.def(perm.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== "LAND_PLAYED") return;
        const ctrl = a.condition?.controller ?? "any";
        if (ctrl === "you" && ev.controller !== perm.controller) return;
        if (ctrl === "opponent" && ev.controller === perm.controller) return;
        pend(permId, perm.cardId, perm.controller, i, { objectId: ev.objectId, player: ev.controller });
      });
    }
  });

  // A8/S20 (Drakuseth — the vocabulary's ATTACKS event gets its first collector): each declared
  // attacker's own self-condition ATTACKS abilities pend, in declaration order. S23: the event
  // context carries the attacker and its controller — the Gallows Djinn's "it deals 1 damage to
  // you" addresses them (to: eventPlayer / from: eventObject, the Warden pattern).
  ctx.bus.on("ATTACKERS_DECLARED", (ev) => {
    for (const attackerId of ev.attackers) {
      const obj = ctx.state.objects[attackerId];
      if (!obj) continue;
      (ctx.defs.def(obj.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== "ATTACKS") return;
        const src = a.condition?.source ?? "self";
        if (src !== "self") return; // observed attack triggers arrive with their first customer
        pend(attackerId, obj.cardId, obj.controller, i, { objectId: attackerId, cardId: obj.cardId, player: obj.controller });
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
        if ((a.zone ?? "battlefield") !== "battlefield") return; // A10 word 9: zone-scoped triggers collect from their zone
        const ctrl = a.condition?.controller ?? "you";
        if (ctrl === "you" && ev.player !== perm.controller) return;
        if (ctrl === "opponent" && ev.player === perm.controller) return;
        pend(permId, perm.cardId, perm.controller, i);
      });
    }
    // A10 word 9 (S22): graveyard-zone upkeep triggers (Tainted Phoenix — the Squee class, bought
    // on purpose). A graveyard card's controller is its owner; the intervening "is in your
    // graveyard" holds at collection by construction, and the self-scoped return no-ops if the
    // card raced away before resolution (the returnFromGraveyard guard).
    for (const player of [0, 1] as PlayerId[]) {
      for (const id of [...ctx.state.players[player].graveyard]) {
        const obj = ctx.state.objects[id];
        if (!obj) continue;
        (ctx.defs.def(obj.cardId).abilities ?? []).forEach((a, i) => {
          if (a.kind !== "triggered" || a.event !== "UPKEEP" || a.zone !== "graveyard") return;
          const ctrl = a.condition?.controller ?? "you";
          if (ctrl === "you" && ev.player !== player) return;
          if (ctrl === "opponent" && ev.player === player) return;
          pend(id, obj.cardId, player, i);
        });
      }
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
        // S23 (ADR-084): the event context carries the damaged player AND the amount — the
        // eventDamage ref (the Traumatizer's "twice that many") reads it at resolution.
        pend(permId, perm.cardId, perm.controller, i, { player: damagedPlayer, amount: ev.amount });
      });
    }
  });

  // S23 (the fun batch — first collectors on skeleton events, the R-061 ATTACKS precedent):
  // BLOCKS — each declared blocker's own self-condition abilities pend, in declaration order
  // (the Gallows Djinn's aggression tax charges blocking too).
  ctx.bus.on("BLOCKERS_DECLARED", (ev) => {
    for (const { blocker } of ev.blocks) {
      const obj = ctx.state.objects[blocker];
      if (!obj) continue;
      (ctx.defs.def(obj.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== "BLOCKS") return;
        const src = a.condition?.source ?? "self";
        if (src !== "self") return; // observed block triggers arrive with their first customer
        pend(blocker, obj.cardId, obj.controller, i, { objectId: blocker, cardId: obj.cardId, player: obj.controller });
      });
    }
  });

  // S23: END_STEP — "at the beginning of the end step" collects at STEP_BEGIN(END), before the
  // step's first priority (CR 503.1a's shape at the other end of the turn). Family templating:
  // EVERY end step by default (the Thundersnake dies on the opponent's turn too); condition
  // `controller: "you"` narrows to the permanent controller's own end step for future customers.
  // A permanent arriving DURING the end step missed the beginning and waits for the next one.
  ctx.bus.on("STEP_BEGIN", (ev) => {
    if (ev.step !== "END") return;
    for (const permId of [...ctx.state.battlefield]) {
      const perm = ctx.state.objects[permId];
      if (!perm) continue;
      (ctx.defs.def(perm.cardId).abilities ?? []).forEach((a, i) => {
        if (a.kind !== "triggered" || a.event !== "END_STEP") return;
        const ctrl = a.condition?.controller ?? "any";
        if (ctrl === "you" && ev.activePlayer !== perm.controller) return;
        if (ctrl === "opponent" && ev.activePlayer === perm.controller) return;
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
      // A10 QoL (S22, the Warden's untap step): identical triggers — same card, same ability,
      // differing only in event context — auto-order in timestamp order. Their relative order is
      // outcome-equivalent (each resolution is bound to its own event object), so the request is
      // ADR-014's "no real decision" case at trigger scale. CR 603.3b's controller choice is
      // preserved whenever two DIFFERENT abilities pend.
      const identical = remaining.every((t) => t.sourceCardId === remaining[0]!.sourceCardId && t.abilityIndex === remaining[0]!.abilityIndex);
      if (remaining.length > 1 && !identical) {
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
    // A10 (S22): event identity, the punisher fork, and the pay-on-yes rider ride the item.
    ...(trigger.eventContext ? { eventContext: trigger.eventContext } : {}),
    ...(ability.unlessPay ? { unlessPay: ability.unlessPay } : {}),
    ...(ability.optionalCost ? { optionalCost: ability.optionalCost } : {}),
  };
}
