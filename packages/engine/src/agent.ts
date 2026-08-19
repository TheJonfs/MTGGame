import type { Action } from "./actions.js";
import type { ActionRequest } from "./game.js";
import type { GameView } from "./view.js";

/**
 * The one interface agents implement (manifest §1a). It lives in `engine`
 * because engine calls it and `agents` depends on `engine`, never the
 * reverse. Every decision — priority, declarations, mulligans, discards,
 * trigger targets — arrives as a pick-one-of-these-actions request, so every
 * decision is a loggable, replayable Action.
 */
export interface Agent {
  chooseAction(view: GameView, request: ActionRequest): Promise<Action>;
}
