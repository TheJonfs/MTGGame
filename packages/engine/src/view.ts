import type { EngineCtx } from "./ctx.js";
import { getObject, opponentOf, type PlayerId } from "./state.js";

/**
 * The state as one player may see it (engine-design §12): opponent hand and
 * both libraries are counts only. Agents never receive GameState directly.
 */
export interface GameView {
  you: PlayerId;
  turn: number;
  step: string;
  activePlayer: PlayerId;
  life: [number, number];
  hand: { objectId: string; cardId: string }[];
  opponentHandCount: number;
  librarySizes: [number, number];
  battlefield: {
    id: string;
    cardId: string;
    controller: PlayerId;
    tapped: boolean;
    damage: number;
    attachedTo: string | null;
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
    hand: s.players[player].hand.map((id) => ({ objectId: id, cardId: getObject(s, id).cardId })),
    opponentHandCount: s.players[opp].hand.length,
    librarySizes: [s.players[0].library.length, s.players[1].library.length],
    battlefield: s.battlefield.map((id) => {
      const o = getObject(s, id);
      return {
        id,
        cardId: o.cardId,
        controller: o.controller,
        tapped: o.tapped,
        damage: o.damage,
        attachedTo: o.attachedTo,
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
