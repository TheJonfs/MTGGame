/**
 * Card definition schema and effect vocabulary (data-model §1–§4).
 * Types exist for every vocabulary word; resolvers only for the slice words.
 * The vocabulary grows only by manifest decision (ADR-001).
 */

export type CardType = "Land" | "Creature" | "Instant" | "Sorcery" | "Enchantment" | "Artifact";

export const KEYWORDS = [
  "flying",
  "reach",
  "first strike",
  "double strike",
  "trample",
  "haste",
  "vigilance",
  "deathtouch",
  "lifelink",
  "menace",
  "defender",
  "flash",
  "hexproof",
  "shroud",
  "indestructible",
  "cant be countered",
] as const;
export type Keyword = (typeof KEYWORDS)[number];

export type Duration = "WHILE_SOURCE_ON_BATTLEFIELD" | "UNTIL_END_OF_TURN" | "UNTIL_SOURCE_LEAVES";

/**
 * Scopes select sets of objects/players without targeting.
 * "attached" is how aura/equipment statics reach the object they enchant/equip.
 */
export const SCOPES = [
  "creaturesYouControl",
  "allCreatures",
  "attached",
  "self",
  "you",
  "opponent",
  "eachPlayer",
] as const;
export type Scope = (typeof SCOPES)[number];

export type Who = "you" | "opponent" | "eachPlayer" | "target" | "controllerOfTarget";
/** ADR-029 discard modes. */
export type DiscardMode = "ownerChooses" | "random" | "casterChooses";
export const DISCARD_FILTERS = ["noncreatureNonland"] as const;
export type DiscardFilter = (typeof DISCARD_FILTERS)[number];

/** Targeting predicates known to the engine (engine-design §10). */
export const TARGET_PREDICATES = [
  "creature",
  "creatureYouControl",
  "creatureYouDontControl",
  "anyTarget",
  "spell",
  "permanent",
  "nonblackCreature",
  "nonartifactNonblackCreature",
  "player",
  "opponentPlayer",
  "cardInYourGraveyard",
  "creatureCardInYourGraveyard",
  // ADR-076 (S17)
  "artifact",
  "enchantment",
  "nonlandPermanent",
  "creatureSpell",
] as const;
export type TargetPredicate = (typeof TARGET_PREDICATES)[number];

/** ADR-076 (S17): predicate-layer filters composed onto a base predicate. */
export interface TargetSpec {
  count: number;
  predicate: TargetPredicate;
  zone: "battlefield" | "stack" | "any" | "graveyard";
  /** Or-predicate: legal if ANY of these alternative specs accepts the target (Airship Crash, Disenchant). */
  anyOf?: TargetSpec[];
  /** Keyword filters ("creature with flying" / "without flying"). */
  withKeyword?: Keyword;
  withoutKeyword?: Keyword;
  /** Exclude a subtype ("non-Angel creature"). */
  notSubtype?: string;
  /** "another target …": the ability's own source is never legal. */
  other?: boolean;
}

/** ADR-075 A4: a battlefield-permanent predicate for counting / max-power refs. */
export interface CountPredicate {
  cardType?: CardType;
  subtype?: string;
  /** Default "you". */
  controller?: "you" | "opponent" | "any";
  /** Exclude the source itself ("other attacking Goblins"). */
  other?: boolean;
  attacking?: boolean;
}
/** ADR-028: amounts are literals, "X", or a minimal value reference (no arithmetic).
 * ADR-075 A4 adds counting refs: permanents matching a predicate, cards in a graveyard,
 * and the greatest power among matching permanents (Baru's reduction input). */
export type ValueRef =
  | { ref: "targetPower"; target: number }
  | { ref: "count"; predicate: CountPredicate }
  | { ref: "graveyardCount"; who: "you" | "opponent" }
  | { ref: "maxPower"; predicate: CountPredicate };
export type Amount = number | "X" | ValueRef;
/** P/T deltas may reference the stack item's X, positively or negated (Drana); statics may carry
 * count refs, evaluated live (A4: Gaean Wurm's "+1/+1 for each Forest you control"). */
export type PTAmount = number | "X" | "-X" | ValueRef;

/** ADR-076: an effect clause may be conditioned on a target's CURRENT characteristics
 * (Little Bear: "if that creature is a Bear"). Attached as `if` on any effect. */
export interface EffectCondition {
  target: number;
  subtype?: string;
  cardType?: CardType;
}

/** Effect vocabulary v1 (data-model §3). Reserved words are commented at the bottom.
 * ADR-076 (S17): every effect may carry `if` — a condition on a target's current characteristics. */
export type Effect = EffectBase & { if?: EffectCondition };
export type EffectBase =
  | { type: "damage"; amount: Amount; target: number }
  | { type: "damageAll"; amount: Amount; scope: Scope }
  | { type: "destroy"; target: number }
  | { type: "destroyAll"; scope: Scope }
  | { type: "exile"; target: number }
  | { type: "bounce"; target: number }
  | { type: "counter"; target: number }
  | { type: "draw"; count: number; who: Who }
  | { type: "discard"; count: number; who: Who; mode: DiscardMode; filter?: DiscardFilter }
  /** ADR-070 Amendment 3: top N of the library to its owner's graveyard via moveObject; NOT a draw (no empty-draw loss). */
  | { type: "mill"; count: number; who: Who }
  | { type: "gainLife"; amount: number | ValueRef; who: Who }
  | { type: "loseLife"; amount: number | ValueRef; who: Who }
  | {
      type: "modifyPT";
      power: PTAmount;
      toughness: PTAmount;
      target?: number;
      scope?: Scope;
      subtype?: string;
      cardType?: string;
      other?: boolean;
      /** ADR-076: keyword-filtered scopes ("creatures with flying" / "without flying" — Gravitational Shift). */
      withKeyword?: Keyword;
      withoutKeyword?: Keyword;
      duration: Duration;
    }
  | { type: "grantKeyword"; keyword: Keyword; target?: number; scope?: Scope; subtype?: string; cardType?: string; other?: boolean; withKeyword?: Keyword; withoutKeyword?: Keyword; duration: Duration }
  | { type: "restrict"; what: "attack" | "block" | "both"; target?: number; scope?: Scope; subtype?: string; cardType?: string; other?: boolean; duration: Duration }
  | { type: "createToken"; tokenId: string; count: number; who: Who }
  | { type: "addCounters"; kind: "+1/+1" | "-1/-1"; count: number; target?: number; scope?: Scope; subtype?: string; cardType?: string; other?: boolean }
  | { type: "tapTarget"; target: number }
  | { type: "untapTarget"; target: number }
  | { type: "returnFromGraveyard"; target?: number; scope?: Scope; to: "battlefield" | "hand" }
  | { type: "fight"; targets: [number, number] }
  | { type: "gainControl"; scope: Scope } // static-only (ADR-033); targeted/EOT variant reserved
  /** ADR-068 Amendment 1: find-may-fail search; chooser sees matching library cards in the request payload; always shuffles after (CR 701.19).
   * ADR-076: predicate may be `subtype:<Subtype>` (Goblin Matron). */
  | { type: "searchLibrary"; predicate: "basicLand" | "anyCard" | `subtype:${string}`; to: "hand" | "battlefield"; entersTapped?: boolean }
  /** ADR-075 A8: blink — exile the target and return it to the battlefield under your control as a new object (ETBs fire). */
  | { type: "exileThenReturn"; target: number; under: "yourControl" }
  /** ADR-068 Amendment 2: `mana` (fixed production) OR `choice` (Lotus: N mana of any one colour — a five-option choice at activation, no stack). */
  | { type: "addMana"; mana?: string; choice?: { count: number; anyOneColor: true } };
// Reserved, not implemented (data-model §3): copy, setPT, preventDamage, changeType.

export type EffectType = EffectBase["type"];

export const EFFECT_TYPES: readonly EffectType[] = [
  "damage",
  "damageAll",
  "destroy",
  "destroyAll",
  "exile",
  "bounce",
  "counter",
  "draw",
  "discard",
  "mill",
  "gainLife",
  "loseLife",
  "modifyPT",
  "grantKeyword",
  "restrict",
  "createToken",
  "addCounters",
  "tapTarget",
  "untapTarget",
  "returnFromGraveyard",
  "fight",
  "gainControl",
  "searchLibrary",
  "addMana",
  "exileThenReturn",
];

export type TriggerEvent =
  | "ENTERS_BATTLEFIELD"
  | "DIES"
  | "LEAVES_BATTLEFIELD"
  | "ATTACKS"
  | "BLOCKS"
  | "DEALS_DAMAGE_TO_PLAYER"
  | "DEALS_COMBAT_DAMAGE_TO_PLAYER"
  | "UPKEEP"
  | "END_STEP"
  | "LAND_ENTERS_UNDER_YOUR_CONTROL"
  | "SPELL_CAST"
  /** ADR-076 (S17): a player discarded a card (Waste Not). Condition `player` = who discarded; type/notType = the card's types. */
  | "DISCARD";

export const TRIGGER_EVENTS: readonly TriggerEvent[] = [
  "ENTERS_BATTLEFIELD",
  "DIES",
  "LEAVES_BATTLEFIELD",
  "ATTACKS",
  "BLOCKS",
  "DEALS_DAMAGE_TO_PLAYER",
  "DEALS_COMBAT_DAMAGE_TO_PLAYER",
  "UPKEEP",
  "END_STEP",
  "LAND_ENTERS_UNDER_YOUR_CONTROL",
  "SPELL_CAST",
  "DISCARD",
];

/**
 * Trigger condition object (ADR-021). Default {source: "self"}. `player`
 * narrows player-affecting events (damage), relative to the ability's
 * controller. The legacy `{self: true}` shorthand is still accepted.
 */
export interface TriggerCondition {
  self?: boolean;
  source?: "self" | "attached" | "other" | "any";
  controller?: "you" | "opponent" | "any";
  type?: string[];
  /** ADR-076: none of these types ("noncreature, nonland card"). */
  notType?: string[];
  subtype?: string[];
  player?: "opponentOfController" | "controller" | "any";
}

/** ADR-075 A6: one mode of a modal spell/trigger ("choose one —"). */
export interface ModeDef {
  label: string;
  targets?: TargetSpec[];
  effects: Effect[];
}

export interface TriggeredAbilityDef {
  kind: "triggered";
  event: TriggerEvent;
  condition?: TriggerCondition;
  targets?: TargetSpec[];
  effects: Effect[];
  optional?: boolean;
  /** A6: modal trigger — the controller picks a mode when it is put on the stack (CR 603.3c); `effects` must be empty. */
  modes?: ModeDef[];
}

/**
 * Sacrifice-cost predicates (R-023): "self", "creature", or
 * "creature.subtype:<Subtype>" (e.g. Siege-Gang's "creature.subtype:Goblin").
 */
export interface ActivatedCost {
  mana?: string;
  tap?: boolean;
  sacrifice?: { predicate: string };
  /** ADR-076: discard N cards from hand (Waterfront Bouncer). */
  discard?: number;
  /** A5: discard this card (hand-zone abilities — cycling). */
  discardSelf?: boolean;
  /** A5: exile this card (graveyard-zone abilities — Mother Bear). */
  exileSelf?: boolean;
  /** ADR-076: the generic part of `mana` is reduced by this value, floored at the coloured pips (Baru). */
  reduceBy?: ValueRef;
}

export interface ActivatedAbilityDef {
  kind: "activated";
  cost: ActivatedCost;
  timing?: "instant" | "sorcery";
  targets?: TargetSpec[];
  effects: Effect[];
  /** Equip ability (CR 702.6): sorcery-timing attach of this permanent to the target. Effects must be empty. */
  equip?: boolean;
  /** A5: where the card must be for this ability to be activatable (default battlefield). */
  zone?: "battlefield" | "hand" | "graveyard";
}

/** A4: a static may be conditional on a live value (Werebear's threshold: graveyardCount ≥ 7). */
export interface StaticCondition {
  value: ValueRef;
  atLeast: number;
}

export interface StaticAbilityDef {
  kind: "static";
  effects: Effect[];
  condition?: StaticCondition;
}

export type AbilityDef = TriggeredAbilityDef | ActivatedAbilityDef | StaticAbilityDef;

export interface CardDef {
  id: string;
  name: string;
  source: "real" | "custom";
  scryfallId?: string;
  manaCost: string;
  types: CardType[];
  subtypes?: string[];
  supertypes?: string[];
  power?: number;
  toughness?: number;
  /** ADR-019: explicit colors; derived from manaCost when absent; REQUIRED on token defs. */
  colors?: ("W" | "U" | "B" | "R" | "G")[];
  keywords?: Keyword[];
  /** Custom cards only (ADR-053): rules text for the frame. Real cards source oracle.json. */
  text?: string;
  abilities?: AbilityDef[];
  spellEffect?: Effect[];
  targets?: TargetSpec[];
  /** A6: modal spell — one castSpell action per (mode, targets); `spellEffect`/`targets` must be absent. */
  modes?: ModeDef[];
  /** A7: additional cost paid at cast (CR 601.2h) — Goblin Grenade's sacrifice. */
  additionalCost?: { sacrifice: { predicate: string } };
  /** A5: cycling {cost} — compiled by the loader into a hand-zone ability {cost, discardSelf; draw 1}. */
  cycling?: string;
  art?: { asset?: string; fallback: "rendered" };
  isTokenDef?: boolean;
  /** ADR-068: never shop stock — boss/lair treasure only (Black Lotus). Pool-registry column mirrored here so the world can filter. */
  prizeOnly?: boolean;
  /** ADR-078 (S19): shop availability tier — a town stocks cards with shopTier ≤ its ring (civilized 1,
   * approach 2, wild 3); price × shopTierMultiplier[tier]. "R" = never shop stock (ante/quest/treasure
   * circulation only — distinct from prizeOnly). Required on every non-token, non-basic, non-prizeOnly def. */
  shopTier?: 1 | 2 | 3 | "R";
}

/** An activated ability is a mana ability iff every effect is addMana and it has no targets (CR 605 simplification). */
export function isManaAbility(a: AbilityDef): boolean {
  return (
    a.kind === "activated" &&
    (a.targets ?? []).length === 0 &&
    a.effects.length > 0 &&
    a.effects.every((e) => e.type === "addMana")
  );
}

/** ADR-068 Amendment 2: a mana ability that carries a colour choice (Lotus) or a
 * sacrifice cost is activated DELIBERATELY (one action per colour) — never by
 * auto-pay, never by the bare `tapForMana` path. */
export function isChoiceManaAbility(a: AbilityDef): boolean {
  return isManaAbility(a) && a.kind === "activated" && (a.effects.some((e) => e.type === "addMana" && !!e.choice) || !!a.cost.sacrifice);
}

export const MANA_COLORS = ["W", "U", "B", "R", "G"] as const;
export type ManaColor = (typeof MANA_COLORS)[number];

/** Effective colors per ADR-019: the explicit field, else derived from mana cost symbols. */
export function cardColors(def: CardDef): ("W" | "U" | "B" | "R" | "G")[] {
  if (def.colors) return def.colors;
  const out: ("W" | "U" | "B" | "R" | "G")[] = [];
  for (const c of ["W", "U", "B", "R", "G"] as const) {
    if (def.manaCost.includes(`{${c}}`)) out.push(c);
  }
  return out;
}
