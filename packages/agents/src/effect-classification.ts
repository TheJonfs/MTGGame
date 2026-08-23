import type { CardDef, Effect, ResolvedTarget } from "@shandalar/cards";
import type { Action, GameView } from "@shandalar/engine";

/**
 * Rule 8's harmful/helpful table over the effect vocabulary (ADR-045 amended)
 * — shared between SanePolicyAgent's target-side preference and the M4
 * evaluator (ADR-049's book of shame scores through the same lens).
 */

/** Sign of a PTAmount: "X" counts +1, "-X" counts -1. */
export function ptSign(v: number | "X" | "-X" | { ref: string }): number {
  return v === "X" ? 1 : v === "-X" ? -1 : typeof v === "number" ? v : 1; // count refs are positive (Gaean Wurm)
}

/** Effects you point at things you want hurt. */
export function isHarmful(e: Effect): boolean {
  return (
    e.type === "damage" ||
    e.type === "destroy" ||
    e.type === "exile" ||
    e.type === "bounce" ||
    e.type === "counter" ||
    e.type === "tapTarget" ||
    e.type === "restrict" ||
    e.type === "gainControl" ||
    (e.type === "loseLife" && e.who === "target") ||
    (e.type === "discard" && e.who === "target") ||
    (e.type === "addCounters" && e.kind === "-1/-1") ||
    (e.type === "modifyPT" && ptSign(e.power) + ptSign(e.toughness) < 0)
  );
}

/** Effects you point at things you want helped. */
export function isHelpful(e: Effect): boolean {
  return (
    e.type === "grantKeyword" ||
    e.type === "untapTarget" ||
    (e.type === "addCounters" && e.kind === "+1/+1") ||
    (e.type === "modifyPT" && ptSign(e.power) + ptSign(e.toughness) > 0) ||
    e.type === "draw" // draw auras (Curiosity): the payload benefits the enchanted creature's side
  );
}

export type EffectClass = "harmful" | "helpful" | "neutral";

export function classifyEffects(effects: Effect[]): EffectClass {
  if (effects.some(isHarmful)) return "harmful";
  if (effects.some(isHelpful)) return "helpful";
  return "neutral";
}

/**
 * The effects a castSpell/activateAbility action will point at its targets.
 * Auras/equipment carry their payload as abilities over scope "attached", and
 * an equip activation's meaning is likewise the equipment's statics.
 */
export function effectsForAction(def: CardDef, action: Action): Effect[] {
  if (action.type !== "castSpell" && action.type !== "activateAbility") return [];
  const direct: Effect[] =
    action.type === "activateAbility"
      ? def.abilities?.[action.abilityIndex]?.kind === "activated"
        ? (def.abilities[action.abilityIndex] as { effects: Effect[] }).effects
        : []
      : (def.spellEffect ?? []);
  const attached: Effect[] =
    def.spellEffect === undefined || action.type === "activateAbility"
      ? (def.abilities ?? []).flatMap((a) => ("effects" in a ? (a.effects as Effect[]) : []))
      : [];
  return [...direct, ...attached];
}

/** Which seat a resolved target belongs to; null if it can't be told from the view. */
export function targetSide(view: GameView, t: ResolvedTarget): number | null {
  if (t.kind === "player") return t.player;
  if (t.kind === "object") return view.battlefield.find((o) => o.id === t.id)?.controller ?? null;
  return view.stack.find((s) => s.id === t.id)?.controller ?? null;
}

/** Keep the target tuples entirely on the preferred side; all if none qualify. */
export function preferSide(
  view: GameView,
  variants: Action[],
  effects: Effect[],
): Action[] {
  const cls = classifyEffects(effects);
  if (cls === "neutral") return variants;
  const wantOpponent = cls === "harmful";
  const me = view.you;
  const preferred = variants.filter((a) => {
    const ts = (a as { targets?: ResolvedTarget[] }).targets ?? [];
    return ts.every((t) => {
      const side = targetSide(view, t);
      return side !== null && (wantOpponent ? side !== me : side === me);
    });
  });
  return preferred.length > 0 ? preferred : variants;
}
