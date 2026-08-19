import type { ResolvedTarget } from "@shandalar/cards";

/**
 * Everything an agent can do, live or in replay. The engine only accepts
 * actions that came from the legal-action enumerator (engine-design §11);
 * replay re-submits logged actions through the same entry points.
 */
export type Action =
  | { type: "pass" }
  | { type: "playLand"; objectId: string }
  | { type: "castSpell"; objectId: string; targets: ResolvedTarget[]; x?: number }
  | { type: "activateAbility"; objectId: string; abilityIndex: number; targets: ResolvedTarget[]; x?: number }
  | { type: "tapForMana"; objectId: string }
  | { type: "declareAttackers"; attackers: string[] }
  | { type: "declareBlockers"; blocks: { blocker: string; attacker: string }[] }
  | { type: "chooseTriggerTargets"; targets: ResolvedTarget[] }
  | { type: "mulligan" }
  | { type: "keepHand" }
  | { type: "discard"; objectId: string };

export function sameAction(a: Action, b: Action): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
