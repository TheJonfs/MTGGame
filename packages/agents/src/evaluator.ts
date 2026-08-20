import { parseManaCost, manaValue, type CardDef } from "@shandalar/cards";
import type { GameView } from "@shandalar/engine";

/**
 * Evaluator v1 (S8 brief Part 1, ADR-049..051): one function over the
 * ADR-048 view + the AI profile. Scores are in "mana units" — one point is
 * roughly one mana of board value — so weights below read as exchange rates.
 * Deliberately shallow: M4a ships when it beats sane everywhere; M4b tunes.
 */

export type Archetype = "aggro" | "midrange" | "control";

export interface AiProfile {
  archetype: Archetype;
  /** ADR-051: the opponent's decklist is known (Shandalar-honest); hidden zones never. */
  opponentDecklist: { cardId: string; count: number }[];
  /** ADR-050 softmax temperature; higher = noisier (weak opponents run hot). */
  temperature: number;
}

export const DEFAULT_TEMPERATURE = 0.35;

/** Per-archetype exchange rates (mana units per unit of each term). */
const WEIGHTS: Record<Archetype, { ownLife: number; oppLife: number; material: number; hand: number }> = {
  aggro: { ownLife: 0.1, oppLife: 0.35, material: 1.0, hand: 0.25 },
  midrange: { ownLife: 0.18, oppLife: 0.22, material: 1.2, hand: 0.4 },
  control: { ownLife: 0.25, oppLife: 0.12, material: 1.0, hand: 0.55 },
};

/** Keyword worth, in mana units (evergreen combat/value keywords only). */
const KEYWORD_BONUS: Record<string, number> = {
  flying: 0.7, menace: 0.4, trample: 0.4, vigilance: 0.3, lifelink: 0.5,
  deathtouch: 0.6, "first strike": 0.5, "double strike": 1.2, haste: 0.3,
  reach: 0.2, hexproof: 0.4, shroud: 0.3, indestructible: 0.8,
};

/** Board value of one battlefield object, from the view's live characteristics. */
export function objectValue(defs: Map<string, CardDef>, o: GameView["battlefield"][number]): number {
  const def = defs.get(o.cardId);
  const mv = def ? manaValue(parseManaCost(def.manaCost)) : 1;
  if (o.power === null || o.toughness === null) {
    // Non-creature permanent: worth roughly half its mana in standing value
    // (its statics/abilities pay the rest through the creatures they touch).
    return Math.max(0.5, mv * 0.5);
  }
  let v = Math.max(0.5, mv);
  // Live P/T above printed (anthems, equipment, counters) is real material.
  const def2 = def;
  const printed = (def2?.power ?? 0) + (def2?.toughness ?? 0);
  v += 0.4 * Math.max(0, o.power + o.toughness - printed);
  for (const k of o.keywords) v += KEYWORD_BONUS[k] ?? 0;
  // A creature that can't do anything much (0 power, no keywords) is worth less.
  if (o.power === 0) v *= 0.5;
  return v;
}

/** Does this decklist contain mass removal? Vocabulary-driven (destroyAll/damageAll), no card names. */
export function listHasSweeper(defs: Map<string, CardDef>, decklist: { cardId: string; count: number }[]): boolean {
  return decklist.some(({ cardId }) => {
    const def = defs.get(cardId);
    const effects = [
      ...(def?.spellEffect ?? []),
      ...(def?.abilities ?? []).flatMap((a) => ("effects" in a ? a.effects : [])),
    ];
    return effects.some((e) => e.type === "destroyAll" || e.type === "damageAll");
  });
}

/** Boards wider than this get their excess dampened when the opponent's list has sweepers. */
const SWEEPER_BOARD_N = 3;
const SWEEPER_DAMPEN = 0.5;

export function evaluate(view: GameView, profile: AiProfile, defs: Map<string, CardDef>): number {
  const w = WEIGHTS[profile.archetype];
  const me = view.you;
  const opp = me === 0 ? 1 : 0;

  // Terminal states dominate everything.
  if (view.life[opp] <= 0) return 1000;
  if (view.life[me] <= 0) return -1000;

  const mine = view.battlefield.filter((o) => o.controller === me);
  const theirs = view.battlefield.filter((o) => o.controller === opp);

  let ownMaterial = 0;
  const creatureValues: number[] = [];
  for (const o of mine) {
    const v = objectValue(defs, o);
    ownMaterial += v;
    if (o.power !== null) creatureValues.push(v);
  }
  // ADR-051 sweeper-risk dampener: when the known opponent list has mass
  // removal, creatures beyond the Nth carry only part of their value.
  if (creatureValues.length > SWEEPER_BOARD_N && listHasSweeper(defs, profile.opponentDecklist)) {
    const excess = [...creatureValues].sort((a, b) => b - a).slice(SWEEPER_BOARD_N);
    ownMaterial -= SWEEPER_DAMPEN * excess.reduce((x, y) => x + y, 0);
  }
  let oppMaterial = 0;
  for (const o of theirs) oppMaterial += objectValue(defs, o);

  return (
    w.material * (ownMaterial - oppMaterial) +
    w.ownLife * view.life[me] +
    w.oppLife * (20 - view.life[opp]) +
    w.hand * (view.hand.length - view.opponentHandCount)
  );
}
