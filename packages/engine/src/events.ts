import type { PlayerId, ZoneName } from "./state.js";

/** Engine event map (engine-design §4). Emitted at CR-meaningful moments. */
export interface GameEventMap extends Record<string, unknown> {
  ZONE_CHANGE: {
    oldId: string;
    newId: string;
    cardId: string;
    from: ZoneName | null;
    to: ZoneName;
    owner: PlayerId;
    /** Controller after the move (post-move object). */
    controller: PlayerId;
    /** Controller before the move (ADR-016) — DIES/LTB trigger ownership reads this. */
    controllerBefore: PlayerId;
  };
  LAND_ENTERS_UNDER_YOUR_CONTROL: { objectId: string; controller: PlayerId };
  /** S12 (R-043): a player's ante stakes were set aside at setup. Logged → facts.ante. */
  ANTE_SET: { player: PlayerId; cardIds: string[]; objectIds: string[] };
  /** ADR-026: every attach/unattach/re-attach. EVENT-stream only; no trigger consumes it yet. */
  ATTACHED: {
    objectId: string;
    previousHost: string | null;
    newHost: string | null;
    cause: "aura-enter" | "equip" | "sba-unattach" | "host-left";
  };
  DAMAGE: {
    sourceId: string;
    sourceCardId: string;
    sourceController: PlayerId;
    target: { kind: "player"; player: PlayerId } | { kind: "object"; id: string };
    /** cardId of the damaged object (ADR-044) — objects may be gone by log-read time. */
    targetCardId?: string;
    amount: number;
    combat: boolean;
  };
  LIFE_CHANGE: { player: PlayerId; delta: number; total: number };
  SPELL_CAST: { cardId: string; controller: PlayerId };
  CARD_DRAWN: { player: PlayerId };
  /** ADR-070 Amendment 3: one per milled card (after its ZONE_CHANGE library→graveyard). */
  MILLED: { player: PlayerId; objectId: string; cardId: string };
  /** ADR-076 (S17): a card left a hand for the graveyard as a discard (effects, cleanup, costs, cycling).
   * Carries the card's characteristics so Waste Not's triggers can read them. */
  DISCARD: { player: PlayerId; objectId: string; cardId: string; types: string[] };
  /** ADR-076 (S17): beginning of a player's upkeep (Bitterblossom). */
  UPKEEP_BEGIN: { player: PlayerId };
  STEP_BEGIN: { step: string; turn: number; activePlayer: PlayerId };
  ATTACKERS_DECLARED: { attackers: string[] };
  BLOCKERS_DECLARED: { blocks: { blocker: string; attacker: string }[] };
  TAPPED: { objectId: string };
  UNTAPPED: { objectId: string };
  /** A10 (S22): the play-land special action announced itself. Distinct from
   * LAND_ENTERS_UNDER_YOUR_CONTROL — effect-placed lands do not fire it (the Sower's counterplay). */
  LAND_PLAYED: { objectId: string; controller: PlayerId };
}
