/** Prose labels for actions, targets, and events — the log and decision panel speak these. */
import type { ResolvedTarget } from "@shandalar/cards";
import type { Action, GameState } from "@shandalar/engine";
import type { CardDef } from "@shandalar/cards";

export function cardName(pool: Map<string, CardDef>, cardId: string): string {
  return pool.get(cardId)?.name ?? cardId;
}

/** S22 r2 (Chris: a Gravedigger trigger narrated "obj_157"): ids die on every zone move
 * (CR 400.7), so historical ids need the caller's id→cardId ledger (MatchController.idNames)
 * to stay nameable. The bare-id fallback remains only for callers without one. */
export function objectName(state: GameState, pool: Map<string, CardDef>, objectId: string, idNames?: Map<string, string>): string {
  const obj = state.objects[objectId];
  if (obj) return cardName(pool, obj.cardId);
  const cardId = idNames?.get(objectId);
  return cardId ? cardName(pool, cardId) : "a departed card";
}

export function targetLabel(state: GameState, pool: Map<string, CardDef>, t: ResolvedTarget, you = 0, idNames?: Map<string, string>): string {
  if (t.kind === "player") return t.player === you ? "You" : "Opponent";
  if (t.kind === "object") return objectName(state, pool, t.id, idNames);
  const item = state.stack.find((s) => s.id === t.id);
  return item ? `${cardName(pool, item.sourceCardId)} (on stack)` : "a spell";
}

export function actionLabel(state: GameState, pool: Map<string, CardDef>, a: Action, idNames?: Map<string, string>): string {
  const name = (id: string) => objectName(state, pool, id, idNames);
  const targets = (ts: ResolvedTarget[]) =>
    ts.length ? ` → ${ts.map((t) => targetLabel(state, pool, t, 0, idNames)).join(", ")}` : "";
  switch (a.type) {
    case "pass": return "Pass";
    case "playLand": return `Play ${name(a.objectId)}`;
    case "castSpell": return `Cast ${name(a.objectId)}${a.x !== undefined ? ` (X=${a.x})` : ""}${a.mode !== undefined ? ` [mode ${a.mode + 1}]` : ""}${targets(a.targets)}`;
    case "activateAbility": return `Activate ${name(a.objectId)}${a.x !== undefined ? ` (X=${a.x})` : ""}${targets(a.targets)}`;
    case "tapForMana": return `Tap ${name(a.objectId)} for mana`;
    case "untapForMana": return `Take back the tap of ${name(a.objectId)}`;
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
    case "chooseMode": return `Mode: ${a.label}`;
    case "returnToHand": return `Return ${name(a.objectId)} to hand (cost)`;
    case "tapCreature": return `Tap ${name(a.objectId)} (cost)`;
    case "chooseVariableTarget": return `Add target: ${targetLabel(state, pool, a.target)}`;
    case "doneChoosingTargets": return "Done choosing targets";
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
    // S22 r4 (Chris, item 6): a restricted search's find is revealed (CR 701.19.4) — the engine
    // only emits this for basicLand/subtype searches, never Demonic Tutor's anyCard.
    case "SEARCH_REVEAL": return `${who(payload.player)} reveal${payload.player === you ? "" : "s"} ${cardName(pool, payload.cardId as string)} — found by search`;
    case "FIZZLE": return `${cardName(pool, payload.cardId as string)} fizzles (all targets illegal)`;
    case "TRIGGER_NO_TARGETS": return `${cardName(pool, payload.cardId as string)} trigger: no legal targets`;
    case "ATTACHED": return null; // too chatty for the log; inspector shows attachments
    default: return null;
  }
}
