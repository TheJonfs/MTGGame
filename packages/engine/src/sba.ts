import type { Action } from "./actions.js";
import { characteristics, isCreature } from "./characteristics.js";
import { syncControl } from "./control.js";
import type { EngineCtx } from "./ctx.js";
import { getObject, type PlayerId } from "./state.js";
import { moveBatchToGraveyard, moveObject } from "./zones.js";

/** The one decision SBAs can require: which legendary to keep (704.5j, ADR-007). */
export type SbaRequester = (player: PlayerId, purpose: "legendRule", actions: Action[]) => Promise<Action>;

/**
 * State-based actions (R-007, CR 704). The ONLY place that decides a creature
 * is dead or a player has lost. Run whenever a player would receive priority;
 * loops until a pass makes no changes. All actions found in one pass are
 * applied together (CR 704.3); the legend rule's keep-choice is interposed at
 * the end of a pass (noted simplification, R-025).
 *
 * Each pass starts by syncing the control layer (ADR-033) — control statics
 * apply/revert here, before anyone can observe stale control.
 *
 * The requester is only consulted for the legend rule; callers without one
 * (unit tests on legend-free boards) may omit it.
 */
export async function runSBAs(ctx: EngineCtx, requester?: SbaRequester): Promise<boolean> {
  const state = ctx.state;
  let anyChange = false;

  for (;;) {
    let changed = syncControl(ctx);

    // Player losses (704.5a, 704.5c).
    for (const player of [0, 1] as PlayerId[]) {
      const p = state.players[player];
      if (p.lost) continue;
      if (p.life <= 0) {
        p.lost = true;
        p.lostReason = "LIFE";
        changed = true;
      } else if (p.attemptedDrawFromEmpty) {
        p.lost = true;
        p.lostReason = "DECKED";
        changed = true;
      }
    }

    // Collect object actions first, apply together.
    const toGraveyard: string[] = [];
    const annihilations: { id: string; n: number }[] = [];
    for (const id of [...state.battlefield]) {
      const obj = getObject(state, id);
      const def = ctx.defs.def(obj.cardId);

      // +1/+1 and -1/-1 counters annihilate in pairs (CR 704.5q).
      const plus = obj.counters["+1/+1"] ?? 0;
      const minus = obj.counters["-1/-1"] ?? 0;
      if (plus > 0 && minus > 0) annihilations.push({ id, n: Math.min(plus, minus) });

      if (isCreature(ctx, id)) {
        const chars = characteristics(ctx, id);
        if (chars.toughness <= 0) {
          toGraveyard.push(id); // 704.5f — put into graveyard; indestructible does not help
        } else if (!chars.keywords.has("indestructible")) {
          if (obj.damage >= chars.toughness) {
            toGraveyard.push(id); // 704.5g — destroyed by lethal damage
          } else if (obj.damage > 0 && obj.deathtouchDamage) {
            toGraveyard.push(id); // 704.5h — any deathtouch damage destroys (R-014)
          }
        }
      }

      // Attachment legality (704.5m, 704.5n): an aura with an illegal or
      // absent host dies; an equipment merely unattaches and stays.
      const host = obj.attachedTo ? state.objects[obj.attachedTo] : undefined;
      const legalHost = host && host.zone === "battlefield" && isCreature(ctx, host.id);
      if (def.subtypes?.includes("Aura") && !legalHost) {
        toGraveyard.push(id);
      }
      if (def.subtypes?.includes("Equipment") && obj.attachedTo && !legalHost) {
        const previousHost = obj.attachedTo;
        obj.attachedTo = null;
        ctx.bus.emit("ATTACHED", { objectId: id, previousHost, newHost: null, cause: "sba-unattach" });
        changed = true;
      }
    }

    for (const { id, n } of annihilations) {
      const obj = getObject(state, id);
      obj.counters["+1/+1"]! -= n;
      obj.counters["-1/-1"]! -= n;
    }
    moveBatchToGraveyard(ctx, [...new Set(toGraveyard)]); // one batch: simultaneous deaths see each other (ADR-076)
    if (toGraveyard.length > 0 || annihilations.length > 0) changed = true;

    // Legend rule (704.5j): per controller, same name, keep one. The keep is
    // a DecisionRequest — never silent, since a group has >= 2 members.
    for (const player of [0, 1] as PlayerId[]) {
      const groups = new Map<string, string[]>();
      for (const id of state.battlefield) {
        const obj = getObject(state, id);
        if (obj.controller !== player) continue;
        const def = ctx.defs.def(obj.cardId);
        if (!def.supertypes?.includes("Legendary")) continue;
        (groups.get(def.name) ?? groups.set(def.name, []).get(def.name))!.push(id);
      }
      for (const [, ids] of groups) {
        if (ids.length < 2) continue;
        if (!requester) throw new Error("legend rule needs a requester (SBA choice, ADR-007)");
        const chosen = await requester(player, "legendRule", ids.map((objectId) => ({ type: "keepLegend", objectId })));
        if (chosen.type !== "keepLegend") throw new Error("expected keepLegend");
        for (const id of ids) {
          if (id !== chosen.objectId && state.objects[id]) moveObject(ctx, id, "graveyard");
        }
        changed = true;
      }
    }

    if (!changed) break;
    anyChange = true;
  }

  // Game end from player losses (104.2a). Both lost in the same pass = draw.
  if (!state.result) {
    const [a, b] = state.players;
    if (a.lost && b.lost) state.result = { winner: null, reason: "DRAW" };
    else if (a.lost) state.result = { winner: 1, reason: a.lostReason ?? "LIFE" };
    else if (b.lost) state.result = { winner: 0, reason: b.lostReason ?? "LIFE" };
  }

  return anyChange;
}
