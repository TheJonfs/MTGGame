import { ArrayLog, ReplayRng, type ActionLogEntry, type RngPurpose } from "@shandalar/core";
import type { CardDef } from "@shandalar/cards";
import type { Action } from "./actions.js";
import { Game, DEFAULT_RULES, type ActionRequest, type ActionSource, type GameRules } from "./game.js";
import type { Modifier } from "./modifiers.js";
import { stableStringify } from "./serialize.js";
import type { GameState } from "./state.js";

/**
 * Replay (engine-design §14): reconstruct a game from its log with no agents,
 * feeding logged ACTION entries back at each decision point and logged RNG
 * draws at each randomness point. Returns the canonical final state, which
 * callers assert is byte-identical to the live run's.
 */
export async function replayGame(
  cards: Map<string, CardDef>,
  decklists: [string[], string[]],
  log: ActionLogEntry<Action>[],
  rules: GameRules = DEFAULT_RULES,
  modifiers: Modifier[] = [],
): Promise<string> {
  const actionEntries = log.filter((e) => e.t === "ACTION");
  const rngEntries = log
    .filter((e) => e.t === "RNG")
    .map((e) => ({ purpose: e.purpose as RngPurpose, value: e.value }));

  let cursor = 0;
  const source: ActionSource = (req) => {
    const entry = actionEntries[cursor];
    if (!entry) throw new Error(`Replay: log exhausted at decision ${cursor} (wanted player ${req.player})`);
    if (entry.player !== req.player) {
      throw new Error(
        `Replay divergence at decision ${cursor}: log has player ${entry.player}, game asked player ${req.player}`,
      );
    }
    cursor++;
    return Promise.resolve(entry.action);
  };

  const replayLog = new ArrayLog<Action>();
  const rng = new ReplayRng(rngEntries, replayLog);
  const game = new Game(cards, decklists, rng, replayLog, source, rules);
  await game.run(modifiers);
  return stableStringify(game.state);
}

class StopReplay extends Error {}

export interface DecisionPoint {
  /** State at the moment of decision `index` (before its action is applied), or final state. */
  state: GameState;
  /** The request whose answer is ACTION entry `index`; null when the game ended first. */
  request: ActionRequest | null;
  /** The logged action taken at this point (null past the end of the log). */
  taken: Action | null;
  gameOver: boolean;
}

/**
 * Prefix replay for viewers (ADR-040, S6): reconstruct the game up to the
 * decision that produced ACTION entry `index`, returning the state at that
 * moment plus the full DecisionRequest — the enumerated alternatives ADR-014
 * chose not to log. `index` equal to the ACTION count runs to game end.
 *
 * The viewer never re-implements rules: this IS the engine playing the log.
 */
export async function replayToDecision(
  cards: Map<string, CardDef>,
  decklists: [string[], string[]],
  log: ActionLogEntry<Action>[],
  index: number,
  rules: GameRules = DEFAULT_RULES,
  modifiers: Modifier[] = [],
): Promise<DecisionPoint> {
  const actionEntries = log.filter((e) => e.t === "ACTION");
  const rngEntries = log
    .filter((e) => e.t === "RNG")
    .map((e) => ({ purpose: e.purpose as RngPurpose, value: e.value }));

  let cursor = 0;
  let captured: ActionRequest | null = null;
  const source: ActionSource = (req) => {
    if (cursor === index) {
      captured = req;
      throw new StopReplay();
    }
    const entry = actionEntries[cursor];
    if (!entry) throw new StopReplay(); // log exhausted before reaching index
    if (entry.player !== req.player) {
      throw new Error(
        `Replay divergence at decision ${cursor}: log has player ${entry.player}, game asked player ${req.player}`,
      );
    }
    cursor++;
    return Promise.resolve(entry.action);
  };

  const replayLog = new ArrayLog<Action>();
  const rng = new ReplayRng(rngEntries, replayLog);
  const game = new Game(cards, decklists, rng, replayLog, source, rules);
  try {
    await game.run(modifiers);
  } catch (e) {
    if (!(e instanceof StopReplay)) throw e;
  }
  return {
    state: game.state,
    request: captured,
    taken: actionEntries[index]?.action ?? null,
    gameOver: game.state.result !== null,
  };
}
