import type { ResolvedTarget } from "@shandalar/cards";

/**
 * Everything an agent can do, live or in replay. The engine only accepts
 * actions that came from the legal-action enumerator (engine-design §11);
 * replay re-submits logged actions through the same entry points.
 *
 * Attack/block declarations and all ordering choices are incremental
 * (ADR-013, ADR-011): one object per action, with an explicit "done" —
 * legality is never truncated and the log reads as a sequence of choices.
 */
export type Action =
  | { type: "pass" }
  | { type: "playLand"; objectId: string }
  | { type: "castSpell"; objectId: string; targets: ResolvedTarget[]; x?: number }
  | { type: "activateAbility"; objectId: string; abilityIndex: number; targets: ResolvedTarget[]; x?: number }
  | { type: "tapForMana"; objectId: string }
  | { type: "declareAttacker"; objectId: string }
  | { type: "doneDeclaringAttackers" }
  | { type: "declareBlocker"; blocker: string; attacker: string }
  | { type: "doneDeclaringBlockers" }
  | { type: "orderTrigger"; index: number; cardId: string; objectId: string }
  | { type: "orderBlocker"; attacker: string; blocker: string }
  | { type: "chooseTriggerTargets"; targets: ResolvedTarget[] }
  | { type: "sacrifice"; objectId: string }
  | { type: "keepLegend"; objectId: string }
  | { type: "acceptOptional" }
  | { type: "declineOptional" }
  | { type: "mulligan" }
  | { type: "keepHand" }
  | { type: "bottomCard"; objectId: string }
  | { type: "discard"; objectId: string };

export function sameAction(a: Action, b: Action): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
