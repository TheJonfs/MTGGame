import { ArrayLog, ReplayRng, type ActionLogEntry, type RngPurpose } from "@shandalar/core";
import type { CardDef } from "@shandalar/cards";
import type { Action } from "./actions.js";
import { Game, DEFAULT_RULES, type ActionSource, type GameRules } from "./game.js";
import type { Modifier } from "./modifiers.js";
import { stableStringify } from "./serialize.js";

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
