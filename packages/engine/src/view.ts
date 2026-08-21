import { characteristics } from "./characteristics.js";
import type { EngineCtx } from "./ctx.js";
import { getObject, opponentOf, type PlayerId } from "./state.js";

/**
 * The state as one player may see it (engine-design §12): opponent hand and
 * both libraries are counts only. Agents never receive GameState directly.
 * ADR-048: battlefield objects carry live characteristics (effective P/T +
 * keywords as the engine computes them), combat state is visible, and the
 * viewing seat sees its own mulligan count. The redaction invariant is
 * unchanged and pinned by a permanent no-peeking test.
 */
export interface GameView {
  you: PlayerId;
  turn: number;
  step: string;
  activePlayer: PlayerId;
  life: [number, number];
  /** S12: starting life of this game (world life in the overworld) — agents key race heuristics off it. */
  startingLife: number;
  hand: { objectId: string; cardId: string }[];
  opponentHandCount: number;
  librarySizes: [number, number];
  /** London mulligans the viewing seat has taken (ADR-048). */
  mulliganCount: number;
  /** Public combat state (ADR-048): staged/committed declarations included. */
  combat: { attackers: string[]; blocks: { blocker: string; attacker: string }[] };
  battlefield: {
    id: string;
    cardId: string;
    controller: PlayerId;
    tapped: boolean;
    damage: number;
    attachedTo: string | null;
    /** Live characteristics (ADR-048); power/toughness null for non-creatures. */
    power: number | null;
    toughness: number | null;
    keywords: string[];
  }[];
  stack: { id: string; kind: string; cardId: string; controller: PlayerId }[];
  graveyards: [string[], string[]]; // cardIds, public zone
}

export function buildView(ctx: EngineCtx, player: PlayerId): GameView {
  const s = ctx.state;
  const opp = opponentOf(player);
  return {
    you: player,
    turn: s.turn,
    step: s.step,
    activePlayer: s.activePlayer,
    life: [s.players[0].life, s.players[1].life],
    startingLife: s.startingLife,
    hand: s.players[player].hand.map((id) => ({ objectId: id, cardId: getObject(s, id).cardId })),
    opponentHandCount: s.players[opp].hand.length,
    librarySizes: [s.players[0].library.length, s.players[1].library.length],
    mulliganCount: s.players[player].mulligans,
    combat: {
      attackers: [...s.combat.attackers],
      blocks: s.combat.blocks.map((b) => ({ blocker: b.blocker, attacker: b.attacker })),
    },
    battlefield: s.battlefield.map((id) => {
      const o = getObject(s, id);
      const chars = characteristics(ctx, id);
      const isCreature = chars.types.includes("Creature");
      return {
        id,
        cardId: o.cardId,
        controller: o.controller,
        tapped: o.tapped,
        damage: o.damage,
        attachedTo: o.attachedTo,
        power: isCreature ? chars.power : null,
        toughness: isCreature ? chars.toughness : null,
        keywords: [...chars.keywords].sort(),
      };
    }),
    stack: s.stack.map((item) => ({
      id: item.id,
      kind: item.kind,
      cardId: item.sourceCardId,
      controller: item.controller,
    })),
    graveyards: [
      s.players[0].graveyard.map((id) => getObject(s, id).cardId),
      s.players[1].graveyard.map((id) => getObject(s, id).cardId),
    ],
  };
}
