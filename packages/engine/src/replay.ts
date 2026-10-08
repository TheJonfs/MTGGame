import { ArrayLog, ReplayRng, SeededRng, type ActionLogEntry, type Rng, type RngPurpose } from "@shandalar/core";
import type { CardDef } from "@shandalar/cards";
import type { Action } from "./actions.js";
import { Game, DEFAULT_RULES, type ActionRequest, type ActionSource, type GameRules } from "./game.js";
import type { Agent } from "./agent.js";
import type { GameView } from "./view.js";
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

/**
 * S58 (Part 2, the play diff — ADR-167's probe of a person's play): a logged game replayed to decision `index`, and
 * PLAYED ON from there by agents. Decisions before `index` are the log's (with the log's own randomness); at `index`
 * the answer is `forced` when given, else the seat's agent's; every decision after it is an agent's, and randomness
 * from there on is a fresh stream from `seed` (the log's draws no longer line up once the game departs from it).
 * `onDecision` sees each live decision. Returns the result and the live actions taken.
 */
export async function replayThenPlay(
  cards: Map<string, CardDef>,
  decklists: [string[], string[]],
  log: ActionLogEntry<Action>[],
  index: number,
  forced: Action | null,
  agents: [Agent, Agent],
  seed: number,
  rules: GameRules = DEFAULT_RULES,
  modifiers: Modifier[] = [],
  onDecision?: (req: ActionRequest, view: GameView, action: Action, n: number) => void,
  /** Each REPLAYED decision (before `index`), with its place in the log. */
  onReplayed?: (req: ActionRequest, view: GameView, action: Action, cursor: number) => void,
): Promise<{ winner: 0 | 1 | null; reason: string; turns: number; life: [number, number]; played: { player: 0 | 1; action: Action }[] }> {
  const actionEntries = log.filter((e) => e.t === "ACTION");
  const rngEntries = log.filter((e) => e.t === "RNG").map((e) => ({ purpose: e.purpose as RngPurpose, value: e.value }));
  const sink = new ArrayLog<Action>();
  const replay = new ReplayRng(rngEntries, sink), fresh = new SeededRng(seed, sink);
  let live = false, cursor = 0;
  const rng: Rng = { int: (n, p) => (live ? fresh : replay).int(n, p), shuffle: (xs, p) => (live ? fresh : replay).shuffle(xs, p), pick: (xs, p) => (live ? fresh : replay).pick(xs, p) };
  const played: { player: 0 | 1; action: Action }[] = [];
  const source: ActionSource = async (req, view) => {
    if (cursor < index) {
      const entry = actionEntries[cursor];
      if (!entry) throw new Error(`replayThenPlay: the log ends at decision ${cursor}, before ${index}`);
      if (entry.player !== req.player) throw new Error(`replayThenPlay: divergence at decision ${cursor}`);
      onReplayed?.(req, view, entry.action, cursor);
      cursor++;
      return entry.action;
    }
    live = true;
    const action = cursor === index && forced ? forced : await agents[req.player].chooseAction(view, req);
    onDecision?.(req, view, action, cursor - index);
    cursor++;
    played.push({ player: req.player as 0 | 1, action });
    return action;
  };
  const game = new Game(cards, decklists, rng, sink, source, rules);
  await game.run(modifiers);
  const r = game.state.result ?? { winner: null, reason: "DRAW" as const };
  return { winner: r.winner as 0 | 1 | null, reason: r.reason, turns: game.state.turn, life: [game.state.players[0].life, game.state.players[1].life], played };
}
