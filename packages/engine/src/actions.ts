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
  /** `mode` (A6): the chosen mode of a modal spell (modes are chosen at cast, targets after — one action per mode × targets). */
  | { type: "castSpell"; objectId: string; targets: ResolvedTarget[]; x?: number; mode?: number }
  /** `color` (ADR-068 Amendment 2): the chosen colour for a choice-bearing mana ability (Lotus) — one action per colour. */
  | { type: "activateAbility"; objectId: string; abilityIndex: number; targets: ResolvedTarget[]; x?: number; color?: "W" | "U" | "B" | "R" | "G" }
  | { type: "tapForMana"; objectId: string }
  | { type: "declareAttacker"; objectId: string }
  | { type: "doneDeclaringAttackers" }
  | { type: "declareBlocker"; blocker: string; attacker: string }
  | { type: "doneDeclaringBlockers" }
  | { type: "orderTrigger"; index: number; cardId: string; objectId: string }
  | { type: "orderBlocker"; attacker: string; blocker: string }
  | { type: "chooseTriggerTargets"; targets: ResolvedTarget[] }
  /** A6: the chosen mode of a modal trigger (label for readability). */
  | { type: "chooseMode"; mode: number; label: string }
  | { type: "sacrifice"; objectId: string }
  | { type: "keepLegend"; objectId: string }
  | { type: "acceptOptional" }
  | { type: "declineOptional" }
  | { type: "mulligan" }
  | { type: "keepHand" }
  | { type: "bottomCard"; objectId: string }
  | { type: "discard"; objectId: string }
  /** ADR-068 Amendment 1: take this library card (one action per distinct cardId among the matches)… */
  | { type: "searchPick"; objectId: string }
  /** …or find nothing (always offered first — the safe default; ADR-014 auto-takes it when nothing matches). */
  | { type: "declineSearch" };

export function sameAction(a: Action, b: Action): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
