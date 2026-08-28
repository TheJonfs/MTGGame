import type { CardDef, ManaSymbol } from "@shandalar/cards";
import type { ResolvedTarget, Effect, TargetSpec, Keyword } from "@shandalar/cards";

export type PlayerId = 0 | 1;

export function opponentOf(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

/** S12: "ante" is the stakes zone (CR 407 lineage, see R-043) — set aside at
 * setup, invisible to every predicate/scope/count; only the overworld reads it. */
export type ZoneName = "library" | "hand" | "battlefield" | "graveyard" | "stack" | "exile" | "ante";

export const STEPS = [
  "UNTAP",
  "UPKEEP",
  "DRAW",
  "MAIN1",
  "COMBAT_BEGIN",
  "DECLARE_ATTACKERS",
  "DECLARE_BLOCKERS",
  "FIRST_STRIKE_DAMAGE",
  "COMBAT_DAMAGE",
  "COMBAT_END",
  "MAIN2",
  "END",
  "CLEANUP",
] as const;
export type Step = (typeof STEPS)[number];

export interface GameObject {
  id: string;
  cardId: string;
  owner: PlayerId;
  /** Effective controller — what every "you control" check reads. Kept in sync with control statics (ADR-033). */
  controller: PlayerId;
  /** Controller absent any control-changing static; set on battlefield entry. */
  baseController: PlayerId;
  zone: ZoneName;
  isToken: boolean;
  // Battlefield-only state; stripped by moveObject on leaving.
  tapped: boolean;
  damage: number;
  /** True when any of the marked damage came from a deathtouch source (R-014). Cleared with damage. */
  deathtouchDamage: boolean;
  summoningSick: boolean;
  attachedTo: string | null;
  counters: Record<string, number>;
  /** A10 (S22): base P/T locked at creation, overriding the def's printed values (Overload's X/X
   * Weird — the printed ruling: set once, never fluctuates). Tokens only today. */
  basePT?: { power: number; toughness: number };
}

/** Pool slots per producible symbol; {C} is colorless, spendable only on generic costs (S3). */
export type ManaPool = Record<ManaSymbol, number>;

export function emptyPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

export interface PlayerState {
  life: number;
  library: string[]; // object ids, index 0 = top
  hand: string[];
  graveyard: string[];
  exile: string[];
  /** S12 ante stakes (R-043): set aside at setup; never drawn, searched, or counted. */
  ante: string[];
  manaPool: ManaPool;
  landsPlayedThisTurn: number;
  /** London mulligans taken (ADR-048: surfaced in the owner's view). */
  mulligans: number;
  attemptedDrawFromEmpty: boolean;
  lost: boolean; // set by SBAs; game end computed from these
  lostReason: "LIFE" | "DECKED" | null;
}

export type StackItemKind = "spell" | "ability" | "trigger";

export interface StackItem {
  id: string;
  kind: StackItemKind;
  /** Spell: the card object sitting in the stack zone. */
  objectId?: string;
  /** Ability/trigger: the battlefield object it came from. */
  sourceId?: string;
  sourceCardId: string;
  controller: PlayerId;
  targetSpecs: TargetSpec[];
  targets: ResolvedTarget[];
  effects: Effect[];
  x: number;
  /** Equip ability (CR 702.6): resolution attaches the source to the target. */
  isEquip?: boolean;
  /** "You may" trigger (ADR-027): controller is asked yes/no on resolution. */
  isOptionalTrigger?: boolean;
  /** A6: the chosen mode index of a modal spell/trigger (display; effects/targetSpecs already reflect it). */
  mode?: number;
  /** A10 (S22): the triggering event's identity, for effects that address it (the Warden's law) and
   * for unlessPay's payer (the Stoker's caster). Captured at collection time — LKI by construction. */
  eventContext?: { objectId?: string; cardId?: string; player?: PlayerId; amount?: number };
  /** A10 word 7 (S22): the punisher fork — resolution asks the event's player pay-or-suffer. */
  unlessPay?: { life: number };
  /** A10 word 9 rider (S22): an optional trigger whose "yes" pays this mana at resolution. */
  optionalCost?: { mana: string };
}

/** A continuous effect created by a resolved spell/ability. Statics are computed live, not stored. */
export interface StoredContinuousEffect {
  kind: "modifyPT" | "grantKeyword" | "restrict";
  objectId: string;
  power?: number;
  toughness?: number;
  keyword?: Keyword;
  what?: "attack" | "block" | "both";
  duration: "UNTIL_END_OF_TURN" | "UNTIL_SOURCE_LEAVES" | "WHILE_SOURCE_ON_BATTLEFIELD";
  sourceStackItemId: string;
  timestamp: number;
}

export interface PendingTrigger {
  sourceId: string;
  sourceCardId: string;
  controller: PlayerId;
  abilityIndex: number;
  timestamp: number;
  /** A10 (S22): the triggering event's identity, carried onto the StackItem. */
  eventContext?: { objectId?: string; cardId?: string; player?: PlayerId; amount?: number };
}

export interface CombatState {
  attackers: string[]; // object ids, declaration order
  /** blocker id -> attacker id */
  blocks: { blocker: string; attacker: string }[];
  /** attacker id -> ordered blocker ids (damage order) */
  blockOrder: Record<string, string[]>;
  /** attackers that were blocked (stays true even if blockers leave) */
  blocked: Record<string, boolean>;
}

export function emptyCombat(): CombatState {
  return { attackers: [], blocks: [], blockOrder: {}, blocked: {} };
}

export interface GameResult {
  winner: PlayerId | null;
  reason: "LIFE" | "DECKED" | "CONCEDE" | "MAX_TURNS" | "DRAW";
}

export interface GameState {
  /** S12: the life both players began at (world life in the overworld); agents read it from the view. */
  startingLife: number;
  turn: number;
  activePlayer: PlayerId;
  step: Step;
  players: [PlayerState, PlayerState];
  objects: Record<string, GameObject>;
  battlefield: string[]; // shared, in timestamp order
  stack: StackItem[]; // index 0 = bottom
  continuousEffects: StoredContinuousEffect[];
  pendingTriggers: PendingTrigger[];
  combat: CombatState;
  timestamp: number; // monotonic, for continuous-effect ordering
  result: GameResult | null;
  /** A10 word 3 (S22): temporary reanimations awaiting their end-step sacrifice. `dueTurn` = the
   * first turn whose END step collects it (created at/after END → the next turn's). The id is the
   * battlefield object; if it left (died, bounced, blinked — the launder) the entry is inert. */
  endStepSacrifices: { objectId: string; dueTurn: number }[];
}

export function initialPlayerState(life: number): PlayerState {
  return {
    life,
    library: [],
    hand: [],
    graveyard: [],
    exile: [],
    ante: [],
    manaPool: emptyPool(),
    landsPlayedThisTurn: 0,
    mulligans: 0,
    attemptedDrawFromEmpty: false,
    lost: false,
    lostReason: null,
  };
}

export function initialGameState(startingLife: number): GameState {
  return {
    startingLife,
    turn: 0,
    activePlayer: 0,
    step: "CLEANUP", // advanced to turn 1 UNTAP by the game loop
    players: [initialPlayerState(startingLife), initialPlayerState(startingLife)],
    objects: {},
    battlefield: [],
    stack: [],
    continuousEffects: [],
    pendingTriggers: [],
    combat: emptyCombat(),
    timestamp: 0,
    result: null,
    endStepSacrifices: [],
  };
}

export function getObject(state: GameState, id: string): GameObject {
  const obj = state.objects[id];
  if (!obj) throw new Error(`No such object: ${id}`);
  return obj;
}

export function nextTimestamp(state: GameState): number {
  state.timestamp += 1;
  return state.timestamp;
}

/** The card pool the game reads definitions from. */
export interface DefSource {
  def(cardId: string): CardDef;
}

export function makeDefSource(cards: Map<string, CardDef>): DefSource {
  return {
    def(cardId: string): CardDef {
      const d = cards.get(cardId);
      if (!d) throw new Error(`Unknown cardId: ${cardId}`);
      return d;
    },
  };
}
