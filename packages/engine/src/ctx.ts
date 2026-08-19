import type { EventBus, IdGen, LogSink, Rng } from "@shandalar/core";
import type { GameEventMap } from "./events.js";
import type { DefSource, GameState } from "./state.js";
import type { Action } from "./actions.js";

/** Bundle passed between engine internals. The Game class owns one. */
export interface EngineCtx {
  state: GameState;
  defs: DefSource;
  ids: IdGen;
  bus: EventBus<GameEventMap>;
  log: LogSink<Action>;
  rng: Rng;
}
