/**
 * S47 (Part 4, ADR-145): a MATCH SERIES — best-of-N over single games. The series is a small state machine (the
 * record, whose turn it is to choose play or draw, each game's seed from the series seed); it knows nothing of how a
 * game is played. `runSeries` drives it headless over `runMatch` (the background field, the Lab, the tests); the UI
 * drives the same object over `MatchController`s — the world's `start → finish` pattern one level up — with its
 * sideboard screen in the `betweenGames` hook.
 *
 * The rules (S47 brief Part 4; interim where the brief is silent — logged in the handoff):
 *  - CR 103.1: game one's starting player is the series seed's coin (or given — the coin's winner is read as having
 *    chosen to play); after a decided game its LOSER chooses who goes first; after a drawn game the seat that made the
 *    choice in that game chooses again;
 *  - a game with no winner (the turn cap; both players losing at once — CR 104.4a) is a DRAWN GAME;
 *  - the series ends when a seat holds a majority of N, or after N games: then the seat with more wins has it, and
 *    level wins are a DRAWN SERIES. Standings: 3 for a win, 1 for a draw, 0 for a loss.
 */
import { runMatch, type Agent, type MatchResult, type MatchSpec } from "@shandalar/engine";
import type { CardDef } from "@shandalar/cards";
import { WorldRng } from "./rng.js";

export type Seat = 0 | 1;
export type Decklist = { cardId: string; count: number }[];
export interface SeriesGame { index: number; seed: number; startingPlayer: Seat; chooser: Seat | null; winner: Seat | null; reason: string; turns: number }
export interface SeriesState { seed: number; bestOf: number; games: SeriesGame[]; wins: [number, number]; draws: number; done: boolean; winner: Seat | "draw" | null }
export const SERIES_POINTS = { win: 3, draw: 1, loss: 0 } as const;

export class MatchSeries {
  readonly seed: number;
  readonly bestOf: number;
  readonly games: SeriesGame[] = [];
  private readonly seeds: number[];
  private readonly firstPlayer: Seat;

  constructor(opts: { seed: number; bestOf?: number; firstPlayer?: Seat; games?: SeriesGame[] }) {
    this.seed = opts.seed;
    this.bestOf = opts.bestOf ?? 3;
    if (!Number.isInteger(this.bestOf) || this.bestOf < 1 || this.bestOf % 2 === 0) throw new Error(`MatchSeries: bestOf must be a positive odd integer, got ${this.bestOf}`);
    const rng = new WorldRng(opts.seed);
    const coin = rng.int(2) as Seat;
    this.firstPlayer = opts.firstPlayer ?? coin;
    this.seeds = Array.from({ length: this.bestOf }, () => rng.int(0x7fffffff));
    for (const g of opts.games ?? []) this.games.push({ ...g }); // a resumed series (the save holds the games played)
  }

  get wins(): [number, number] { return [this.games.filter((g) => g.winner === 0).length, this.games.filter((g) => g.winner === 1).length]; }
  get draws(): number { return this.games.filter((g) => g.winner === null).length; }
  get done(): boolean { const [a, b] = this.wins, need = Math.floor(this.bestOf / 2) + 1; return a >= need || b >= need || this.games.length >= this.bestOf; }
  /** The series' result once done: the seat with more wins, or a draw. */
  get winner(): Seat | "draw" | null { if (!this.done) return null; const [a, b] = this.wins; return a > b ? 0 : b > a ? 1 : "draw"; }
  /** Standings points for a seat once done. */
  points(seat: Seat): number { const w = this.winner; return w === null ? 0 : w === "draw" ? SERIES_POINTS.draw : w === seat ? SERIES_POINTS.win : SERIES_POINTS.loss; }
  state(): SeriesState { return { seed: this.seed, bestOf: this.bestOf, games: this.games.map((g) => ({ ...g })), wins: this.wins, draws: this.draws, done: this.done, winner: this.winner }; }

  /** Who chooses play or draw for the next game: nobody for game one (the coin); the last decided game's loser; after
   * a drawn game, whoever chose (or the coin's player) before it. */
  nextChooser(): Seat | null {
    const last = this.games[this.games.length - 1];
    if (!last) return null;
    if (last.winner !== null) return (1 - last.winner) as Seat;
    return last.chooser ?? last.startingPlayer;
  }

  /** The next game's seed and starting player, given the chooser's call (ignored for game one). */
  nextGame(choice: "play" | "draw" = "play"): { index: number; seed: number; startingPlayer: Seat; chooser: Seat | null } {
    if (this.done) throw new Error("MatchSeries: the series is over");
    const index = this.games.length, chooser = this.nextChooser();
    const startingPlayer = chooser === null ? this.firstPlayer : choice === "play" ? chooser : ((1 - chooser) as Seat);
    return { index, seed: this.seeds[index]!, startingPlayer, chooser };
  }

  record(game: { index: number; seed: number; startingPlayer: Seat; chooser: Seat | null }, result: Pick<MatchResult, "winner" | "reason" | "turns">): void {
    if (game.index !== this.games.length) throw new Error(`MatchSeries: game ${game.index} recorded out of order`);
    this.games.push({ ...game, winner: result.winner as Seat | null, reason: result.reason, turns: result.turns });
  }
}

export interface RunSeriesOptions {
  seed: number;
  bestOf?: number;
  firstPlayer?: Seat;
  /** The two seats' lists for game one. */
  decklists: [Decklist, Decklist];
  /** Fresh agents per game (an agent's memo is per game). */
  agents: (game: { index: number; seed: number }, decklists: [Decklist, Decklist]) => [Agent, Agent];
  rules?: Partial<MatchSpec["rules"]>;
  modifiers?: MatchSpec["modifiers"];
  /** The chooser's call; the default is to play. */
  choosePlayDraw?: (chooser: Seat, state: SeriesState) => "play" | "draw";
  /** Between games — the sideboard screen's place: return the lists for the next game (or nothing to keep them). */
  betweenGames?: (state: SeriesState, decklists: [Decklist, Decklist]) => Promise<[Decklist, Decklist] | void> | [Decklist, Decklist] | void;
}

/** A series headless: `runMatch` per game, the hook between games. */
export async function runSeries(opts: RunSeriesOptions, cards: Map<string, CardDef>): Promise<SeriesState> {
  const series = new MatchSeries({ seed: opts.seed, ...(opts.bestOf !== undefined ? { bestOf: opts.bestOf } : {}), ...(opts.firstPlayer !== undefined ? { firstPlayer: opts.firstPlayer } : {}) });
  let lists = opts.decklists;
  while (!series.done) {
    const chooser = series.nextChooser();
    const game = series.nextGame(chooser === null ? "play" : (opts.choosePlayDraw?.(chooser, series.state()) ?? "play"));
    const spec: MatchSpec = {
      seed: game.seed,
      players: [{ name: "seat 0", decklist: lists[0], agent: "series" }, { name: "seat 1", decklist: lists[1], agent: "series" }],
      rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100, ...opts.rules, startingPlayer: game.startingPlayer },
      modifiers: opts.modifiers ?? [],
    };
    series.record(game, await runMatch(spec, cards, opts.agents(game, lists)));
    if (!series.done) lists = (await opts.betweenGames?.(series.state(), lists)) ?? lists;
  }
  return series.state();
}
