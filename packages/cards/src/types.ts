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
  "you",
  "opponent",
  "eachPlayer",
] as const;
export type Scope = (typeof SCOPES)[number];

export type Who = "you" | "opponent" | "eachPlayer";

/** Targeting predicates known to the engine (engine-design §10). */
export const TARGET_PREDICATES = [
  "creature",
  "creatureYouControl",
  "creatureYouDontControl",
  "anyTarget",
  "spell",
  "permanent",
  "nonblackCreature",
  "player",
  "cardInYourGraveyard",
] as const;
export type TargetPredicate = (typeof TARGET_PREDICATES)[number];

export interface TargetSpec {
  count: number;
  predicate: TargetPredicate;
  zone: "battlefield" | "stack" | "any" | "graveyard";
}

export type Amount = number | "X";

/** Effect vocabulary v1 (data-model §3). Reserved words are commented at the bottom. */
export type Effect =
  | { type: "damage"; amount: Amount; target: number }
  | { type: "damageAll"; amount: Amount; scope: Scope }
  | { type: "destroy"; target: number }
  | { type: "destroyAll"; scope: Scope }
  | { type: "exile"; target: number }
  | { type: "bounce"; target: number }
  | { type: "counter"; target: number }
  | { type: "draw"; count: number; who: Who }
  | { type: "discard"; count: number; who: Who; mode: "choose" | "random" }
  | { type: "gainLife"; amount: number; who: Who }
  | { type: "loseLife"; amount: number; who: Who }
  | {
      type: "modifyPT";
      power: number;
      toughness: number;
      target?: number;
      scope?: Scope;
      duration: Duration;
    }
  | { type: "grantKeyword"; keyword: Keyword; target?: number; scope?: Scope; duration: Duration }
  | { type: "restrict"; what: "attack" | "block" | "both"; target?: number; scope?: Scope; duration: Duration }
  | { type: "createToken"; tokenId: string; count: number; who: Who }
  | { type: "addCounters"; kind: "+1/+1" | "-1/-1"; count: number; target: number }
  | { type: "tapTarget"; target: number }
  | { type: "untapTarget"; target: number }
  | { type: "returnFromGraveyard"; target: number; to: "battlefield" | "hand" }
  | { type: "fight"; targets: [number, number] }
  | { type: "gainControl"; target: number; duration: "UNTIL_SOURCE_LEAVES" }
  | { type: "searchLibrary"; predicate: "basicLand"; to: "hand" | "battlefield" }
  | { type: "addMana"; mana: string };
// Reserved, not implemented (data-model §3): copy, setPT, preventDamage, changeType.

export type EffectType = Effect["type"];

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
];

export type TriggerEvent =
  | "ENTERS_BATTLEFIELD"
  | "DIES"
  | "LEAVES_BATTLEFIELD"
  | "ATTACKS"
  | "BLOCKS"
  | "DEALS_COMBAT_DAMAGE_TO_PLAYER"
  | "UPKEEP"
  | "END_STEP"
  | "LAND_ENTERS_UNDER_YOUR_CONTROL"
  | "SPELL_CAST";

export const TRIGGER_EVENTS: readonly TriggerEvent[] = [
  "ENTERS_BATTLEFIELD",
  "DIES",
  "LEAVES_BATTLEFIELD",
  "ATTACKS",
  "BLOCKS",
  "DEALS_COMBAT_DAMAGE_TO_PLAYER",
  "UPKEEP",
  "END_STEP",
  "LAND_ENTERS_UNDER_YOUR_CONTROL",
  "SPELL_CAST",
];

/** Trigger condition predicates. S1 uses only `self` (the trigger's own source). */
export interface TriggerCondition {
  self?: boolean;
}

export interface TriggeredAbilityDef {
  kind: "triggered";
  event: TriggerEvent;
  condition?: TriggerCondition;
  targets?: TargetSpec[];
  effects: Effect[];
  optional?: boolean;
}

/**
 * Sacrifice-cost predicates (R-023): "self", "creature", or
 * "creature.subtype:<Subtype>" (e.g. Siege-Gang's "creature.subtype:Goblin").
 */
export interface ActivatedCost {
  mana?: string;
  tap?: boolean;
  sacrifice?: { predicate: string };
}

export interface ActivatedAbilityDef {
  kind: "activated";
  cost: ActivatedCost;
  timing?: "instant" | "sorcery";
  targets?: TargetSpec[];
  effects: Effect[];
  /** Equip ability (CR 702.6): sorcery-timing attach of this permanent to the target. Effects must be empty. */
  equip?: boolean;
}

export interface StaticAbilityDef {
  kind: "static";
  effects: Effect[];
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
  abilities?: AbilityDef[];
  spellEffect?: Effect[];
  targets?: TargetSpec[];
  art?: { asset?: string; fallback: "rendered" };
  isTokenDef?: boolean;
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

/** Effective colors per ADR-019: the explicit field, else derived from mana cost symbols. */
export function cardColors(def: CardDef): ("W" | "U" | "B" | "R" | "G")[] {
  if (def.colors) return def.colors;
  const out: ("W" | "U" | "B" | "R" | "G")[] = [];
  for (const c of ["W", "U", "B", "R", "G"] as const) {
    if (def.manaCost.includes(`{${c}}`)) out.push(c);
  }
  return out;
}
