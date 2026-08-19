import { NullLog, SeededRng } from "@shandalar/core";
import type { Action, ActionRequest, Agent, GameView } from "@shandalar/engine";

/**
 * Picks uniformly from the legal actions. Its randomness uses a private
 * seeded PRNG, NOT the game's logged RNG service: agent decisions are
 * captured in the log as ACTION entries, and replay never calls agents, so
 * agent draws must not appear as RNG entries (they'd desync ReplayRng).
 */
export class RandomAgent implements Agent {
  private readonly rng: SeededRng;

  constructor(seed: number) {
    this.rng = new SeededRng(seed, new NullLog());
  }

  chooseAction(_view: GameView, request: ActionRequest): Promise<Action> {
    return Promise.resolve(this.rng.pick(request.actions, "pick"));
  }
}
