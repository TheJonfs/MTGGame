import { characteristics, isCreature } from "./characteristics.js";
import type { EngineCtx } from "./ctx.js";
import { getObject, opponentOf, type PlayerId } from "./state.js";
import { moveObject } from "./zones.js";

/**
 * State-based actions (R-007, CR 704). The ONLY place that decides a creature
 * is dead or a player has lost. Run whenever a player would receive priority;
 * loops until a pass makes no changes. All actions found in one pass are
 * applied together (CR 704.3).
 */
export function runSBAs(ctx: EngineCtx): boolean {
  const state = ctx.state;
  let anyChange = false;

  for (;;) {
    let changed = false;

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
          toGraveyard.push(id); // 704.5f — put into graveyard (not destruction)
        } else if (obj.damage >= chars.toughness && !chars.keywords.has("indestructible")) {
          toGraveyard.push(id); // 704.5g — destroyed by lethal damage
        }
      }

      // Aura attached to an illegal object or to nothing (704.5m, 704.5n).
      if (def.subtypes?.includes("Aura")) {
        const host = obj.attachedTo ? state.objects[obj.attachedTo] : undefined;
        const legalHost = host && host.zone === "battlefield" && isCreature(ctx, host.id);
        if (!legalHost) toGraveyard.push(id);
      }
    }

    for (const { id, n } of annihilations) {
      const obj = getObject(state, id);
      obj.counters["+1/+1"]! -= n;
      obj.counters["-1/-1"]! -= n;
    }
    for (const id of new Set(toGraveyard)) {
      if (state.objects[id]) moveObject(ctx, id, "graveyard");
    }
    if (toGraveyard.length > 0 || annihilations.length > 0) changed = true;

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
