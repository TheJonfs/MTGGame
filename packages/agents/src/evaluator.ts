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
  /** S9 Part 3: hold counter/flash mana (journeyman+). Default true.
   * S11 (ADR-060.2): when true, holding is further conditioned on the
   * board-value delta — behind → develop, ahead/even → hold. */
  holdTricks?: boolean;
  /** S11 (ADR-060.3): evaluator constants. Default DEFAULT_CONSTANTS;
   * master carries the weight-search vector. */
  constants?: EvalConstants;
}

/** S11 (ADR-060.3): every evaluator constant the weight search may move,
 * gathered in one profile-carried object so two agents with different
 * vectors can share a game (module constants would cross-contaminate). */
export interface EvalConstants {
  weights: Record<Archetype, { ownLife: number; oppLife: number; material: number; hand: number }>;
  keywordBonus: Record<string, number>;
  /** ADR-060.1 deterrence: `weight` scales the best threatened trade; a
   * blocker that merely survives (walls) earns `wallFraction` of a kill. */
  deterrence: { weight: number; wallFraction: number };
  /** ADR-060.2 posture: hold tricks unless behind by more than this (mana units). */
  posture: { behindThreshold: number };
}

export const DEFAULT_TEMPERATURE = 0.35;

/** S11 (ADR-060.3): the vector `pnpm weight-search` found — NOT wired (ADR-061 reverted master to DEFAULT_CONSTANTS); kept as the record of the search
 * (coordinate descent, 80/cell search seed 11000000, verified 300/cell on
 * held-out seed 21000000). Seven moves survived three sweeps: flying 0.7→0.98,
 * double strike 1.2→0.857, haste 0.3→0.42, menace 0.4→0.286, aggro hand
 * 0.25→0.179, midrange material 1.2→2.352 (the big one — searched master
 * trades material far harder with the midrange decks). Deterrence/posture
 * kept at the S11 hand-tuned values (the search did not move them).
 * Journeyman keeps DEFAULT_CONSTANTS.
 *
 * HONEST NUMBERS: held-out (300/cell) this vector is 53.10% vs journeyman;
 * temp-only master (DEFAULT_CONSTANTS) is 53.37% on the same seeds — the
 * search's incremental edge is ZERO (its +1.7 was seed overfit). Kept
 * because the brief ratifies the found vector as master's weights and it is
 * noise-equal; the +8% target needs search over something richer than these
 * constants (2-ply recommendation in the S11 handoff). */
export const MASTER_CONSTANTS: EvalConstants = {
  weights: {
    aggro: { ownLife: 0.1, oppLife: 0.35, material: 1.0, hand: 0.179 },
    midrange: { ownLife: 0.18, oppLife: 0.22, material: 2.352, hand: 0.4 },
    control: { ownLife: 0.25, oppLife: 0.12, material: 1.0, hand: 0.55 },
  },
  keywordBonus: {
    flying: 0.98, menace: 0.286, trample: 0.4, vigilance: 0.3, lifelink: 0.5,
    deathtouch: 0.6, "first strike": 0.5, "double strike": 0.857, haste: 0.42,
    reach: 0.2, hexproof: 0.4, shroud: 0.3, indestructible: 0.8,
  },
  deterrence: { weight: 0.5, wallFraction: 0.4 },
  posture: { behindThreshold: 4 },
};

/** S9 Part 3 (roadmap M4): named difficulty profiles on existing machinery —
 * these are the overworld's difficulty dials. Knobs documented in
 * packages/agents/README.md. */
export type Difficulty = "apprentice" | "journeyman" | "master";

export function difficultyProfile(
  difficulty: Difficulty,
  deckArchetype: Archetype,
  opponentDecklist: { cardId: string; count: number }[],
): AiProfile {
  switch (difficulty) {
    case "apprentice":
      // Runs hot, plays every deck like an aggro deck, never holds mana.
      return { archetype: "aggro", opponentDecklist, temperature: 1.2, holdTricks: false };
    case "journeyman":
      return { archetype: deckArchetype, opponentDecklist, temperature: DEFAULT_TEMPERATURE, holdTricks: true };
    case "master":
      // Low-noise selection (S9: 0.12 beats 0.05 — near-determinism at the
      // top is exploitable). ADR-061: master uses DEFAULT_CONSTANTS — the
      // S11 searched vector's held-out edge was zero, and zero-delta
      // discipline admits no exception; MASTER_CONSTANTS stays exported as
      // the record of that search only.
      return { archetype: deckArchetype, opponentDecklist, temperature: 0.12, holdTricks: true };
  }
}

/** The hand-tuned defaults (S8/S9 lineage) — journeyman's vector. */
export const DEFAULT_CONSTANTS: EvalConstants = {
  /** Per-archetype exchange rates (mana units per unit of each term). */
  weights: {
    aggro: { ownLife: 0.1, oppLife: 0.35, material: 1.0, hand: 0.25 },
    midrange: { ownLife: 0.18, oppLife: 0.22, material: 1.2, hand: 0.4 },
    control: { ownLife: 0.25, oppLife: 0.12, material: 1.0, hand: 0.55 },
  },
  /** Keyword worth, in mana units (evergreen combat/value keywords only). */
  keywordBonus: {
    flying: 0.7, menace: 0.4, trample: 0.4, vigilance: 0.3, lifelink: 0.5,
    deathtouch: 0.6, "first strike": 0.5, "double strike": 1.2, haste: 0.3,
    reach: 0.2, hexproof: 0.4, shroud: 0.3, indestructible: 0.8,
  },
  // S11 measured (200/cell mirrors vs sane, seed 1): profit-based f at
  // weight 0.5 costs −0.8 aggregate vs deterrence-off (68.85→68.05), the
  // human-challenge trade ADR-060 authorizes; gross-value f cost −1.55 and
  // was rejected. wallFraction was insensitive (0.2/0.4/0.6 identical).
  deterrence: { weight: 0.5, wallFraction: 0.4 },
  // S11 measured (E-E 500/cell, seeds 1 & 7001, paired): threshold 4 gains
  // ~+1 on E seat1 (56.5→57.3) with seat0/aggregate flat; thresholds 1–3
  // and 6 were worse or noise. The brief's ~65 band was NOT reached — the
  // remaining E seat1 gap is not in holdTricks (honest plateau, see handoff).
  posture: { behindThreshold: 4 },
};

/** Board value of one battlefield object, from the view's live characteristics.
 * ADR-056: creatures carry their buffs (live stats), so auras and equipment
 * themselves are worth ~0 standing material — an unattached equipment keeps a
 * small salvage value (it can still be equipped later). Other non-creature
 * permanents (mana rocks, global enchantments) keep half-mana standing. */
export function objectValue(
  defs: Map<string, CardDef>,
  o: GameView["battlefield"][number],
  constants: EvalConstants = DEFAULT_CONSTANTS,
): number {
  const def = defs.get(o.cardId);
  const mv = def ? manaValue(parseManaCost(def.manaCost)) : 1;
  if (o.power === null || o.toughness === null) {
    if (def?.subtypes?.includes("Aura")) return 0.05;
    if (def?.subtypes?.includes("Equipment")) return o.attachedTo ? 0.05 : 0.3;
    return Math.max(0.5, mv * 0.5);
  }
  let v = Math.max(0.5, mv);
  // Live P/T above printed (anthems, equipment, counters) is real material.
  const def2 = def;
  const printed = (def2?.power ?? 0) + (def2?.toughness ?? 0);
  v += 0.4 * Math.max(0, o.power + o.toughness - printed);
  for (const k of o.keywords) v += constants.keywordBonus[k] ?? 0;
  // A creature that can't do anything much (0 power, no keywords) is worth less.
  if (o.power === 0) v *= 0.5;
  return v;
}

/** ADR-060.1 deterrence: what one untapped blocker threatens against the
 * opponent's likely attackers — the PROFIT of its best trade (what the kill
 * is worth minus what the blocker gives back if it dies; deathtouch trades
 * with anything, so it profits by the gap it trades up). A creature too
 * valuable to trade deters ~nothing and stays free to attack. A
 * big-toughness wall that merely survives earns the wall fraction. One
 * creature holds back one attack, hence max, not sum. Returns 0 for
 * non-creatures or an empty enemy board. */
export function deterrence(
  defs: Map<string, CardDef>,
  blocker: GameView["battlefield"][number],
  oppCreatures: GameView["battlefield"][number][],
  constants: EvalConstants = DEFAULT_CONSTANTS,
): number {
  if (blocker.power === null || blocker.toughness === null) return 0;
  const bv = objectValue(defs, blocker, constants);
  let best = 0;
  for (const a of oppCreatures) {
    if (a.power === null || a.toughness === null) continue;
    const kills = blocker.keywords.includes("deathtouch") || blocker.power >= a.toughness;
    const dies = a.keywords.includes("deathtouch") || a.power >= blocker.toughness;
    const walls = blocker.toughness > a.power && !a.keywords.includes("deathtouch");
    const v = kills
      ? Math.max(0, objectValue(defs, a, constants) - (dies ? bv : 0))
      : walls
        ? constants.deterrence.wallFraction * objectValue(defs, a, constants)
        : 0;
    if (v > best) best = v;
  }
  return constants.deterrence.weight * best;
}

/** S29's mill pricing (book 37), factored out in S31 so the attack planner and the ability predictor
 * price the Traumatizer's trigger with the same curve: mill is damage against the library — each card
 * worth more as the library shortens (the square of the fraction milled), emptying it a win the way
 * lethal damage is. `before` is the library size the mill hits. */
export function millValue(n: number, before: number): number {
  if (n <= 0) return 0;
  const b = Math.max(0, before);
  const lib = Math.max(0, b - n);
  const frac = Math.min(1, n / Math.max(1, b));
  return 0.3 * n + 4 * frac * frac + (lib === 0 && b > 0 ? 12 : 0);
}

/** S31 (R-094, the Traumatizer — ADR-107): how many cards a point of damage to a player by one of
 * `player`'s CREATURES mills, summed over `player`'s controller-wide mill observers (each Traumatizer
 * is "twice"; two stack additively). Read off the vocabulary — a DEALS_DAMAGE_TO_PLAYER trigger with
 * controller:"you" + type Creature and a mill of {ref: eventDamage, times} — so a future "creatures you
 * control" observer prices the same way. */
export function millPerDamage(view: GameView, defs: Map<string, CardDef>, player: number): number {
  let per = 0;
  for (const o of view.battlefield) {
    if (o.controller !== player) continue;
    for (const a of defs.get(o.cardId)?.abilities ?? []) {
      if (a.kind !== "triggered" || a.event !== "DEALS_DAMAGE_TO_PLAYER") continue;
      const c = a.condition ?? {};
      if (c.controller !== "you" || !(c.type ?? []).includes("Creature") || (c.source ?? "self") === "self") continue;
      for (const e of a.effects) {
        if (e.type !== "mill" || typeof e.count !== "object" || e.count.ref !== "eventDamage") continue;
        if (e.who !== "eventPlayer" && e.who !== "opponent") continue;
        per += e.count.times ?? 1;
      }
    }
  }
  return per;
}

/** S28's Unearth valuation, factored out in S31 (book 47/48): what a creature CARD is worth brought back
 * to the battlefield — its mana value, its size, an ETB. Used by the graveyard-search chooser (Buried
 * Alive), the reanimation target predictor (Zombify/Unearth), the trigger-target chooser and the cast
 * trigger's credit (the Artisan), so the Artisan outranks the Serra outranks the Aristocrat everywhere. */
export function reanimationWorth(d: CardDef | undefined): number {
  if (!d || !d.types.includes("Creature")) return 0;
  return Math.max(0.5, manaValue(parseManaCost(d.manaCost))) + 0.2 * ((d.power ?? 0) + (d.toughness ?? 0)) + (d.abilities?.some((a) => a.kind === "triggered" && a.event === "ENTERS_BATTLEFIELD") ? 0.8 : 0);
}

export function evaluate(view: GameView, profile: AiProfile, defs: Map<string, CardDef>): number {
  const C = profile.constants ?? DEFAULT_CONSTANTS;
  const w = C.weights[profile.archetype];
  const me = view.you;
  const opp = me === 0 ? 1 : 0;

  // Terminal states dominate everything.
  if (view.life[opp] <= 0) return 1000;
  if (view.life[me] <= 0) return -1000;

  const mine = view.battlefield.filter((o) => o.controller === me);
  const theirs = view.battlefield.filter((o) => o.controller === opp);

  // (S9 Part 0.4: the S8 sweeper-risk dampener is removed — no measured
  // effect in any ladder table. A future risk model is a measured re-add.)
  let ownMaterial = 0;
  for (const o of mine) ownMaterial += objectValue(defs, o, C);
  let oppMaterial = 0;
  for (const o of theirs) oppMaterial += objectValue(defs, o, C);

  // ADR-060.1: untapped own creatures that threaten a profitable block are
  // worth keeping home. The attack sim debits the same term per attacker, so
  // "hold the deathtoucher" and "swing anyway" finally price differently.
  const oppCreatures = theirs.filter((o) => o.power !== null && !o.keywords.includes("defender")); // S30: a Wall threatens no attack
  let deter = 0;
  if (oppCreatures.length > 0) {
    for (const o of mine) if (!o.tapped) deter += deterrence(defs, o, oppCreatures, C);
  }

  // S31 (R-094, the Traumatizer): a controller-wide mill engine is worth the mill its side's
  // attackers threaten — per point of power on the board, at the per-card base rate — so the
  // Traumatizer is cast ahead of a second Crab when the board has attackers, and a counter is
  // spent to keep it. Symmetric: theirs debits the same.
  let engine = 0;
  for (const side of [me, opp] as const) {
    const per = millPerDamage(view, defs, side);
    if (per === 0) continue;
    let power = 0;
    for (const o of side === me ? mine : theirs) if (o.power !== null && !o.keywords.includes("defender")) power += o.power;
    engine += (side === me ? 1 : -1) * per * power * 0.3;
  }

  return (
    w.material * (ownMaterial - oppMaterial) +
    w.ownLife * view.life[me] +
    w.oppLife * (view.startingLife - view.life[opp]) +
    w.hand * (view.hand.length - view.opponentHandCount) +
    deter +
    engine
  );
}
