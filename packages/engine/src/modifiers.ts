import type { Effect } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
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
      case "effectAtStart":
        // Needs a stack-item-less effect context; no overworld exists to
        // produce these yet. Escalated rather than guessed (CLAUDE.md §7).
        throw new Error("effectAtStart modifiers are not implemented yet");
    }
  }
}
