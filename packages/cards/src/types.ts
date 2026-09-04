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
  // S26 (Clio's tax): the mirror scope — creatures the source's controller does NOT control.
  "creaturesYouDontControl",
  // S27 (the Manafleur): every LAW on the battlefield, both sides (defs flagged `law: true`).
  "laws",
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
  "landCardInYourGraveyard",
  "creatureCardInYourGraveyard",
  // ADR-076 (S17)
  "artifact",
  "enchantment",
  "nonlandPermanent",
  "creatureSpell",
  // A10 (S22): Experimental Overload's regrowth predicate.
  "instantOrSorceryCardInYourGraveyard",
  // S25 (the Sapphire Sage): controller-scoped permanent predicates — the creatureYouControl
  // pattern widened to permanents ("for each player, choose target permanent that player controls").
  "permanentYouControl",
  "permanentYouDontControl",
  // S26 (Seraphina, the Initiative): the status-predicate door — a creature that is tapped.
  // Re-checked at resolution like every predicate: an untap in response fizzles the kill (CR 608.2b).
  "tappedCreature",
] as const;
export type TargetPredicate = (typeof TARGET_PREDICATES)[number];

/** ADR-076 (S17): predicate-layer filters composed onto a base predicate. */
export interface TargetSpec {
  /** A8 (S20): a fixed count, or an "up to" range ({min:0,max:2} — Drakuseth). A range spec must be
   * the LAST spec (validator-enforced); its chosen targets are always mutually distinct.
   * A10 word 4 (S22): "any" = any-number targeting — the cast enters a logged choose-target/done
   * DecisionRequest loop instead of enumerating combinations (Phyrexian Purge). Must be the SOLE spec. */
  count: number | { min: number; max: number } | "any";
  predicate: TargetPredicate;
  zone: "battlefield" | "stack" | "any" | "graveyard";
  /** A10 / ADR-038 amendment: whose graveyard a graveyard predicate scans (default "you").
   * The Usher is the sole "any" customer; every prior card keeps the default. */
  who?: "you" | "any";
  /** A10 (S22): power ceiling on the candidate (Graceful Restoration's "power 2 or less"). */
  powerAtMost?: number;
  /** S28 (ADR-098): mana-value ceiling on the candidate (Unearth's "mana value 3 or less"); printed
   * cost — a token or a costless card reads 0 (CR 202.3). */
  manaValueAtMost?: number;
  /** Or-predicate: legal if ANY of these alternative specs accepts the target (Airship Crash, Disenchant). */
  anyOf?: TargetSpec[];
  /** Keyword filters ("creature with flying" / "without flying"). */
  withKeyword?: Keyword;
  withoutKeyword?: Keyword;
  /** Exclude a subtype ("non-Angel creature"). */
  notSubtype?: string;
  /** "another target …": the ability's own source is never legal. */
  other?: boolean;
  /** A8: targets of this spec must differ from every target chosen by EARLIER specs (the Drakuseth
   * ruling's no-stacking — "each of up to two OTHER targets"). */
  distinctFromPrior?: boolean;
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
  /** A10 (S22): `types` narrows the count to cards with any of these types (Overload's instant/sorcery). */
  | { ref: "graveyardCount"; who: "you" | "opponent"; types?: CardType[] }
  | { ref: "maxPower"; predicate: CountPredicate }
  /** A10 (S22): the target's mana value, from the resolution LKI snapshot (Aether Mutation — the
   * bounced creature is gone by token time; X for battlefield permanents is 0 per CR 202.3b). */
  | { ref: "targetManaValue"; target: number }
  /** S23 (ADR-084, family member six): the triggering EVENT's damage amount, times a bounded
   * literal multiplier (the Traumatizer's "mills twice that many"). ADR-028's no-arithmetic
   * doctrine is reaffirmed around it — a fixed `times` param is not a calculator; general
   * arithmetic remains excluded. Triggered-ability effects only (validator-confined). */
  | { ref: "eventDamage"; times?: number }
  /** S26 (family member eight — Clio, Lady of the Depths): the number of `kind` counters on the
   * ability's own source, live, times a bounded literal (−1 for a tax: "−1/−0 for each depth
   * counter"). Statics evaluate it live; resolved effects read it at resolution. */
  | { ref: "countersOnSelf"; kind: CounterKind; times?: number }
  /** S25 (ADR-088, family member seven): the X announced for the source permanent's own cast,
   * persisted onto the object at battlefield entry and carried into its ETB trigger's event
   * context (LKI by construction — the Emerald Keeper's pump survives the Keeper's death in
   * response, CR 603.3). ETB-trigger effects on X-cost permanents only (validator-confined). */
  | { ref: "xPaid" };
/** Counter kinds. +1/+1 and −1/−1 are the P/T pair characteristics() reads (S1 slots); S26 opens the
 * accumulator class — a NAMED kind (lowercase word) is inert state the card's own refs and costs
 * read (Clio's depth counters). Named kinds never touch P/T. */
export type CounterKind = "+1/+1" | "-1/-1" | (string & {});
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
  /** A10 (S22): `to: "eventPlayer"` / `from: "eventObject"` address the triggering event's object and
   * its controller (the Warden's law: the untapped creature ITSELF deals 1 to ITS controller — the
   * source matters: lifelink on the untapped creature nets its controller zero). */
  /** S25: `to: "you"` — the effect's controller takes the damage from the resolving source (the
   * Ruby Tyrant's recoil; the Djinn's event addressing can't reach activated abilities). */
  | { type: "damage"; amount: Amount; target?: number; targetSpec?: number; to?: "eventPlayer" | "you"; from?: "eventObject" }
  | { type: "damageAll"; amount: Amount; scope: Scope }
  /** A10 (S22): `targetSpec` fans out over a spec's still-legal chosen targets (Purge's any-number). */
  | { type: "destroy"; target?: number; targetSpec?: number }
  | { type: "destroyAll"; scope: Scope }
  /** S27 (the Manafleur): `scope` — exile-by-predicate on the Wrath-class scope machinery ("exile all laws").
   * A `laws` scope is a no-op under the `accumulate` law-sequence mode (the reserved all-five climax). */
  | { type: "exile"; target?: number; scope?: Scope }
  /** A10 (S22): `to: "libraryTop"` — Temporal Spring. Deliberately NOT a hand return: it never
   * fires RETURNED_TO_HAND (the Spring unwinds too far for the tide to taste — ratified). */
  | { type: "bounce"; target?: number; scope?: Scope; to?: "hand" | "libraryTop" }
  | { type: "counter"; target: number }
  | { type: "draw"; count: number; who: Who }
  /** S28 (ADR-098, Brainstorm): the controller puts N cards from hand on top of the library in any
   * order — a logged pick per card (ADR-013's incremental shape); the FIRST pick ends on top. With
   * fewer than N cards in hand, what is there goes back. */
  | { type: "putOnTop"; count: number }
  | { type: "discard"; count: number; who: Who; mode: DiscardMode; filter?: DiscardFilter }
  /** ADR-070 Amendment 3: top N of the library to its owner's graveyard via moveObject; NOT a draw (no empty-draw loss).
   * S23: count may be a value ref (the Traumatizer's eventDamage). */
  | { type: "mill"; count: number | ValueRef; who: Who }
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
  /** A10 (S22): `count` may be a value ref (Aether Mutation's X Saprolings); `pt` sets the token's
   * base P/T, locked at resolution (Overload's X/X Weird — the printed ruling: it does not fluctuate). */
  | { type: "createToken"; tokenId: string; count: number | ValueRef; who: Who; pt?: ValueRef }
  | { type: "addCounters"; kind: CounterKind; count: number | ValueRef; target?: number; scope?: Scope; subtype?: string; cardType?: string; other?: boolean }
  /** A10 (S22): `targetSpec` fans out (the Warden's "tap up to two target creatures"). */
  | { type: "tapTarget"; target?: number; targetSpec?: number }
  | { type: "untapTarget"; target: number }
  /** S23 (ADR-084): sacrifice the ability's own SOURCE — A10 word 3's internal delayed-sac path
   * surfaced as an effect word (the Thundersnake's end-step exit). Self-only v1 (validator-confined);
   * a no-op if the source already left the battlefield. A sacrifice: no destroy, no indestructible
   * shield, the DIES trigger fires. */
  | { type: "sacrifice"; scope: "self" }
  /** A10 word 3 (S22): `temporary: true` — the reanimated object gains haste and is sacrificed at the
   * beginning of the next end step (a self-contained package rule, not a delayed-trigger subsystem;
   * the Usher's entrance). A blinked guest is a NEW object and sheds both riders (the launder).
   * `withCounters` (S22): it enters with counters (Graceful Restoration's +1/+1 rider). */
  | { type: "returnFromGraveyard"; target?: number; targetSpec?: number; scope?: Scope; to: "battlefield" | "hand"; temporary?: true; withCounters?: { kind: "+1/+1"; count: number } }
  | { type: "fight"; targets: [number, number] }
  /** ADR-033: the static form (scope "attached" — Control Magic). S26 (Lumen, the Hearth Fire): the
   * RESOLVED form — `target` + `duration: "UNTIL_END_OF_TURN"` — the threaten class: a stored control
   * effect the control layer reads beside the statics; expires at cleanup (the creature stays tapped
   * if it attacked); survives the source leaving (CR 611.2c — the duration is the turn's, not hers). */
  | { type: "gainControl"; scope?: Scope; target?: number; duration?: Duration }
  /** ADR-068 Amendment 1: find-may-fail search; chooser sees matching library cards in the request payload; always shuffles after (CR 701.19).
   * ADR-076: predicate may be `subtype:<Subtype>` (Goblin Matron). */
  | { type: "searchLibrary"; predicate: "basicLand" | "anyCard" | `subtype:${string}`; to: "hand" | "battlefield"; entersTapped?: boolean }
  /** ADR-075 A8: blink — exile the target and return it to the battlefield under your control as a new object (ETBs fire). */
  | { type: "exileThenReturn"; target: number; under: "yourControl" }
  /** ADR-068 Amendment 2: `mana` (fixed production) OR `choice` (Lotus: N mana of any one colour — a five-option choice at activation, no stack). */
  | { type: "addMana"; mana?: string; choice?: { count: number; anyOneColor: true } | { count: number; anyCombinationOf: ("W" | "U" | "B" | "R" | "G")[] } }
  /** A10 word 8 (S22): STATIC-ONLY — a battlefield permanent confers an activated ability on cards in
   * a zone and scope. `zone: "hand"` grants to every card in the static's controller's hand (the
   * Stoker's cycling — enumeration-time grant on A5's machinery, no ADR-003 layer contact);
   * `zone: "battlefield"` grants to permanents the scope selects (Frondland Felidar: withKeyword
   * vigilance + creaturesYouControl; per the printed ruling he grants to himself too). */
  | { type: "grantAbility"; zone: "hand" | "battlefield"; ability: ActivatedAbilityDef; scope?: Scope; withKeyword?: Keyword; cardType?: CardType }
  /** A10 law-word (S22b): STATIC-ONLY — the controller may play `count` additional lands each turn.
   * A rules counter the land-play legality check reads (the Risen Tide). */
  | { type: "extraLandDrops"; count: number }
  /** A10 law-word (S22b): STATIC-ONLY — matching permanents entering under a `who`-selected player's
   * control (relative to the static's controller) enter tapped, whatever put them there (the
   * sanctioned enters-tapped special case, extended; the Intake). */
  | { type: "imposeEntersTapped"; who: "you" | "opponent" | "eachPlayer"; cardType?: CardType }
  /** S27 (ADR-093 — the Manafleur's rider): manifest a copy of the NEXT law in the game-level law
   * sequence as a token under the effect's controller, and advance the pointer. The sequence lives in
   * game state (`lawSequence`: order + pointer + mode), set by a match modifier; the default is the
   * WBRUG ring beginning with white. Validator-confined to the Manafleur's own end-step trigger. */
  | { type: "createLaw"; sequence: "next" };
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
  "sacrifice",
  "returnFromGraveyard",
  "fight",
  "gainControl",
  "searchLibrary",
  "addMana",
  "exileThenReturn",
  "grantAbility",
  "extraLandDrops",
  "imposeEntersTapped",
  "createLaw",
  "putOnTop",
];

export type TriggerEvent =
  | "ENTERS_BATTLEFIELD"
  | "DIES"
  | "LEAVES_BATTLEFIELD"
  | "ATTACKS"
  | "BLOCKS"
  | "DEALS_DAMAGE_TO_PLAYER"
  | "DEALS_COMBAT_DAMAGE_TO_PLAYER"
  /** S28 (ADR-098, Spirit Link): damage to ANY recipient — creature or player — with the amount in
   * the event context (the S23 collector shape); `player` is set only when a player was damaged. */
  | "DEALS_DAMAGE"
  | "UPKEEP"
  | "END_STEP"
  | "LAND_ENTERS_UNDER_YOUR_CONTROL"
  | "SPELL_CAST"
  /** ADR-076 (S17): a player discarded a card (Waste Not). Condition `player` = who discarded; type/notType = the card's types. */
  | "DISCARD"
  /** A10 word 1 (S22): a permanent was returned from the battlefield to a hand. Observed form (any
   * controller, any cause); rides the ZONE_CHANGE payload; lookback covers self-observation. */
  | "RETURNED_TO_HAND"
  /** A10 word 5 (S22): a permanent untapped (untap step or effect). Observed form (the Warden's law). */
  | "UNTAPPED"
  /** A10 activation (S22): the play-land special action announced itself — distinct from
   * enters-the-battlefield; effect-placed lands do not fire it (the Sower). */
  | "LAND_PLAYED"
  /** S26 (the Corolla batch): a player drew a card — DISCARD's sibling, the first collector counts
   * as skeleton (Faldor, the Muster). Condition `controller` = who drew, relative to the observer's
   * controller (default "you"). Opening hands are not draws (CR 103.4) — the collector is gated. */
  | "DRAW";

export const TRIGGER_EVENTS: readonly TriggerEvent[] = [
  "ENTERS_BATTLEFIELD",
  "DIES",
  "LEAVES_BATTLEFIELD",
  "ATTACKS",
  "BLOCKS",
  "DEALS_DAMAGE_TO_PLAYER",
  "DEALS_COMBAT_DAMAGE_TO_PLAYER",
  "DEALS_DAMAGE",
  "UPKEEP",
  "END_STEP",
  "LAND_ENTERS_UNDER_YOUR_CONTROL",
  "SPELL_CAST",
  "DISCARD",
  "RETURNED_TO_HAND",
  "UNTAPPED",
  "LAND_PLAYED",
  "DRAW",
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
  /** A10 word 9 (S22): where the card must be for this trigger to collect (default battlefield).
   * First non-battlefield zone: graveyard (Tainted Phoenix's upkeep return — the Squee class). */
  zone?: "battlefield" | "graveyard";
  /** A10 word 9 rider (S22): an ADR-027 optional trigger whose "yes" PAYS — the accept option is
   * offered only when the cost is payable; auto-pays on accept (Tainted Phoenix's {B}). Requires `optional`. */
  optionalCost?: { mana: string };
  /** A10 word 7 (S22) — the punisher package: on resolution the stated player (the event's player,
   * else the controller's opponent) chooses to pay or let `effects` happen. Pay = lose that much life;
   * offered only at life STRICTLY above the cost (the ruled auto-resolve at life ≤ cost — ADR-014
   * takes the lone "don't pay" silently). The Stoker; Browbeat's class rides in. */
  unlessPay?: { life: number };
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
  /** A10 word 2 (S22): return a matching permanent you control to your hand as a cost — structurally
   * parallel to sacrifice costs (choose from set, move, then stack). Predicates: "self" | "creature" |
   * "land" | "permanent" | "creature.subtype:<Subtype>". The Unwinder's engine. */
  returnToHand?: { predicate: string };
  /** A10 word 6 (S22): tap `count` untapped creatures you control as a cost (convoke-lite; summoning
   * sickness does NOT block it — CR 602.5.1 governs only the source's own {T}). Glare of Subdual. */
  tapCreature?: { predicate: string; count: number };
  /** S25 word 3 (ADR-088): pay N life as an activation cost (the Jet Witch — the A9/Purge pay-life
   * primitive priced into tap-abilities). CR 118.4: activatable only while life ≥ N; paying to
   * exactly 0 is legal (and the SBA speaks next). */
  life?: number;
  /** S25 word 4 (ADR-088): exile the top `count` cards of your library as an activation cost
   * (the Pearl Cleric — parameterized count). Activatable only while the library is that deep. */
  exileTop?: number;
  /** S26 (Clio): remove `count` counters of `kind` from the ability's own source as a cost
   * (CR 601.2h — paid at activation, never refunded). Activatable only while the source holds
   * that many; the enumerator gates it (the burst is legal at three, not two). */
  removeCounters?: { kind: CounterKind; count: number };
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
  /** A7: additional cost paid at cast (CR 601.2h) — Goblin Grenade's sacrifice. A10 word 4 companion
   * (S22): `life` + `perTarget` — N life per chosen target, computed at 601.2h from the final count,
   * paid at cast, never refunded on counter/fizzle (Phyrexian Purge; the printed ruling agrees). */
  additionalCost?: { sacrifice?: { predicate: string }; life?: number; perTarget?: true };
  /** A10 small piece (S22): the spell exiles itself on resolution instead of going to the graveyard
   * (Experimental Overload). Countered/fizzled copies still go to the graveyard (CR 608.2b). */
  selfExileOnResolve?: true;
  /** A5: cycling {cost} — compiled by the loader into a hand-zone ability {cost, discardSelf; draw 1}. */
  cycling?: string;
  /** A9 (S20, ADR-079): conditional enters-tapped (the shock clause). On resolving the LAND PLAY the
   * controller chooses: pay (life) → untapped, else tapped. Payable only at life ≥ pay.life (paying to
   * exactly 0 is legal and lethal). Anything PUT onto the battlefield by other means enters tapped,
   * choice-free (keeps initialization request-free; matches the printed ruling's spirit). */
  entersChoice?: { pay: { life: number }; else: "tapped" };
  /** S20: unconditional "this land enters tapped" (the cycling-land cycle). Play and put paths both tap. */
  entersTapped?: boolean;
  art?: { asset?: string; fallback: "rendered" };
  /** ADR-082 (S22): custom cards' printed-view image (Chris-produced via an external card creator) —
   * the parallel of real cards' Scryfall `normal`. Filename under the printed-art asset root; the
   * ADR-066 our-frame fallback on printed-default surfaces is retired for cards that carry this. */
  printedAsset?: string;
  /** S22b (the stronghold laws): this card can never be cast — the enumerator offers no castSpell/
   * playLand for it. The blessed Boomerang quirk rides on it: a zero-cost law bounced to hand is
   * stuck there for the battle (laws are real objects, not tokens — they must SURVIVE the bounce). */
  uncastable?: true;
  /** S27: a stronghold LAW — the five uncastable artifact-enchantments the Manafleur cycles through.
   * Tokens by construction (S26 r3); the `laws` scope and the law sequence read this flag. */
  law?: true;
  isTokenDef?: boolean;
  /** ADR-068: never shop stock — boss/lair treasure only (Black Lotus). Pool-registry column mirrored here so the world can filter. */
  prizeOnly?: boolean;
  /** ADR-078 (S19): shop availability tier — a town stocks cards with shopTier ≤ its ring (civilized 1,
   * approach 2, wild 3); price × shopTierMultiplier[tier]. "R" = never shop stock (ante/quest/treasure
   * circulation only — distinct from prizeOnly). Required on every non-token, non-basic, non-prizeOnly def. */
  shopTier?: 1 | 2 | 3 | "R";
  /** S20 (ADR-079): absolute shop price in gold, replacing the mv formula — mv-0 lands break it
   * (a shock would price at 6g). Generic registry column; rides with the land batch. */
  priceOverride?: number;
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
