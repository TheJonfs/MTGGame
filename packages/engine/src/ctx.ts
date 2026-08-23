import type { EventBus, IdGen, LogSink, Rng } from "@shandalar/core";
import type { GameEventMap } from "./events.js";
import type { DefSource, GameState, PlayerId } from "./state.js";
import type { Action } from "./actions.js";

/** Bundle passed between engine internals. The Game class owns one. */
export interface EngineCtx {
  state: GameState;
  defs: DefSource;
  ids: IdGen;
  bus: EventBus<GameEventMap>;
  log: LogSink<Action>;
  rng: Rng;
  /** ADR-076 (S17): look-back for simultaneous leaves — objects that left the battlefield in the
   * current batch (SBA deaths, Wrath) still "see" the other deaths (Blood Artist dying with the
   * rest). Transient, never serialised: set by the batch mover, cleared after. */
  lookback?: Map<string, { cardId: string; controller: PlayerId; currentId?: string }>;
}
