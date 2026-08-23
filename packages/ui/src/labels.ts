/** Prose labels for actions, targets, and events — the log and decision panel speak these. */
import type { ResolvedTarget } from "@shandalar/cards";
import type { Action, GameState } from "@shandalar/engine";
import type { CardDef } from "@shandalar/cards";

export function cardName(pool: Map<string, CardDef>, cardId: string): string {
  return pool.get(cardId)?.name ?? cardId;
}

export function objectName(state: GameState, pool: Map<string, CardDef>, objectId: string): string {
  const obj = state.objects[objectId];
  return obj ? cardName(pool, obj.cardId) : objectId;
}

export function targetLabel(state: GameState, pool: Map<string, CardDef>, t: ResolvedTarget, you = 0): string {
  if (t.kind === "player") return t.player === you ? "You" : "Opponent";
  if (t.kind === "object") return objectName(state, pool, t.id);
  const item = state.stack.find((s) => s.id === t.id);
  return item ? `${cardName(pool, item.sourceCardId)} (on stack)` : "a spell";
}

export function actionLabel(state: GameState, pool: Map<string, CardDef>, a: Action): string {
  const name = (id: string) => objectName(state, pool, id);
  const targets = (ts: ResolvedTarget[]) =>
    ts.length ? ` → ${ts.map((t) => targetLabel(state, pool, t)).join(", ")}` : "";
  switch (a.type) {
    case "pass": return "Pass";
    case "playLand": return `Play ${name(a.objectId)}`;
    case "castSpell": return `Cast ${name(a.objectId)}${a.x !== undefined ? ` (X=${a.x})` : ""}${targets(a.targets)}`;
    case "activateAbility": return `Activate ${name(a.objectId)}${a.x !== undefined ? ` (X=${a.x})` : ""}${targets(a.targets)}`;
    case "tapForMana": return `Tap ${name(a.objectId)} for mana`;
    case "declareAttacker": return `Attack with ${name(a.objectId)}`;
    case "doneDeclaringAttackers": return "Done declaring attackers";
    case "declareBlocker": return `Block ${name(a.attacker)} with ${name(a.blocker)}`;
    case "doneDeclaringBlockers": return "Done declaring blockers";
    case "orderTrigger": return `Put ${cardName(pool, a.cardId)} trigger on the stack`;
    case "orderBlocker": return `${name(a.blocker)} takes damage next`;
    case "chooseTriggerTargets": return `Trigger targets${targets(a.targets)}`;
    case "sacrifice": return `Sacrifice ${name(a.objectId)}`;
    case "keepLegend": return `Keep ${name(a.objectId)}`;
    case "acceptOptional": return "Yes (use the ability)";
    case "declineOptional": return "No (decline)";
    case "mulligan": return "Mulligan";
    case "keepHand": return "Keep hand";
    case "bottomCard": return `Bottom ${name(a.objectId)}`;
    case "discard": return `Discard ${name(a.objectId)}`;
    case "searchPick": return `Take ${name(a.objectId)} from your library`;
    case "declineSearch": return "Find nothing (shuffle)";
  }
}

const STEP_LABELS: Record<string, string> = {
  UNTAP: "Untap", UPKEEP: "Upkeep", DRAW: "Draw", MAIN1: "Main 1",
  COMBAT_BEGIN: "Combat begins", DECLARE_ATTACKERS: "Declare attackers",
  DECLARE_BLOCKERS: "Declare blockers", FIRST_STRIKE_DAMAGE: "First-strike damage",
  COMBAT_DAMAGE: "Combat damage", COMBAT_END: "End of combat",
  MAIN2: "Main 2", END: "End step", CLEANUP: "Cleanup",
};
export function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? step;
}

/** A human line for the EVENT entries worth showing in the log panel. */
export function eventLabel(
  pool: Map<string, CardDef>,
  name: string,
  payload: Record<string, unknown>,
  you = 0,
): string | null {
  const who = (p: unknown) => (p === you ? "You" : "Opponent");
  switch (name) {
    case "DAMAGE": {
      const target = payload.target as { kind: string; player?: number; id?: string };
      const to =
        target.kind === "player"
          ? who(target.player)
          : payload.targetCardId
            ? cardName(pool, payload.targetCardId as string)
            : "a creature"; // pre-ADR-044 logs lack targetCardId

      return `${cardName(pool, payload.sourceCardId as string)} deals ${payload.amount} damage to ${to}`;
    }
    case "DIES": return `${cardName(pool, payload.cardId as string)} dies`;
    case "LIFE_CHANGE": {
      const delta = payload.delta as number;
      return `${who(payload.player)} ${delta > 0 ? "gains" : "loses"} ${Math.abs(delta)} life (${payload.total})`;
    }
    case "SPELL_CAST": return `${who(payload.controller)}: ${cardName(pool, payload.cardId as string)} cast`;
    case "CARD_DRAWN": return `${who(payload.player)} draws a card`;
    case "MILLED": return `${who(payload.player)} mills ${cardName(pool, payload.cardId as string)}`; // graveyards are public — naming it is fine
    case "FIZZLE": return `${cardName(pool, payload.cardId as string)} fizzles (all targets illegal)`;
    case "TRIGGER_NO_TARGETS": return `${cardName(pool, payload.cardId as string)} trigger: no legal targets`;
    case "ATTACHED": return null; // too chatty for the log; inspector shows attachments
    default: return null;
  }
}
