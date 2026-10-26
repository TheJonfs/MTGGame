import type { Effect, ResolvedTarget } from "@shandalar/cards";
import type { Action, ActionRequest, PlayerId } from "@shandalar/engine";

/**
 * Post-S69 (Chris: a Massacrats turn asks for a Blood Artist's target a dozen times): a trigger whose targets are all
 * players and whose every effect on its target hurts that player — loses life, is dealt damage — is aimed at the
 * opponent without asking. Anything else on the target (Hedron Crab's mill: a reanimator mills itself) asks as before.
 * Returns the action to submit, or null to ask.
 */
export function autoAimAction(request: ActionRequest, opponent: PlayerId): Action | null {
  if (request.purpose !== "chooseTarget" || !request.source) return null;
  const effects = request.source.effects;
  const hurts = (e: Effect) => (e.type === "loseLife" && (e as { who?: string }).who === "target") || (e.type === "damage" && (e as { to?: string }).to === undefined);
  const touches = (e: Effect) => hurts(e) || (e as { who?: string }).who === "target" || "target" in e || "targetSpec" in e;
  if (!effects.some(hurts) || !effects.filter(touches).every(hurts)) return null;
  const targetsOf = (a: Action) => (a as { targets?: ResolvedTarget[] }).targets;
  if (!request.actions.every((a) => { const ts = targetsOf(a); return Array.isArray(ts) && ts.length > 0 && ts.every((t) => t.kind === "player"); })) return null;
  return request.actions.find((a) => targetsOf(a)!.every((t) => t.kind === "player" && t.player === opponent)) ?? null;
}
