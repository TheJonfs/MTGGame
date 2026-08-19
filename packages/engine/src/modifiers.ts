import { resolveEffect, type Effect } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import { makeInitEffectContext } from "./effect-context.js";
import { drawCard } from "./ops.js";
import type { PlayerId } from "./state.js";
import { createObject } from "./zones.js";

/** Overworld-imposed match modifiers (data-model §5). Applied at initialization only (ADR-002). */
export type Modifier =
  | { type: "startingLife"; player: PlayerId; value: number }
  | { type: "extraCards"; player: PlayerId; count: number }
  | { type: "permanentOnBattlefield"; player: PlayerId; cardId: string }
  | { type: "effectAtStart"; player: PlayerId; effects: Effect[] };

export function applyModifiers(ctx: EngineCtx, modifiers: Modifier[]): void {
  for (const m of modifiers) {
    switch (m.type) {
      case "startingLife":
        ctx.state.players[m.player].life = m.value;
        break;
      case "extraCards":
        for (let i = 0; i < m.count; i++) drawCard(ctx, m.player);
        break;
      case "permanentOnBattlefield":
        createObject(ctx, m.cardId, m.player, "battlefield");
        break;
      case "effectAtStart": {
        const ectx = makeInitEffectContext(ctx, m.player);
        for (const e of m.effects) resolveEffect(e, ectx);
        break;
      }
    }
  }
  // Planner ruling (S2 brief fixture 14): modifiers apply before the first
  // turn, and triggers collected during initialization are discarded — a
  // permanentOnBattlefield Pelakka does not gain 7 life.
  ctx.state.pendingTriggers = [];
}
