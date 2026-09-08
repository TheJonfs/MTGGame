import type { Archetype, Profile } from "./lab-decks.js";

/**
 * A starting bonus — the Lab's face of the engine's modifier vocabulary (data-model §5): a permanent
 * in play (a basic, a token, a law, anything), a card brought to hand after the mulligans (the lord's
 * entrance), bonus cards, the Heart's law ring. `both` applies it to both seats (the Mox court's
 * symmetric laws). Future modifier kinds slot in here without touching the grid.
 */
export type LabBonus =
  | { type: "permanent"; cardId: string; both?: boolean }
  | { type: "cardInHand"; cardId: string; both?: boolean }
  | { type: "extraCards"; count: number; both?: boolean }
  | { type: "lawSequence"; both?: boolean };

export interface LabSide {
  /** A catalogue key (`mage:corvane`, `boss:heart`, …) or a custom deck (`custom:<name>`). */
  deck: string;
  life: number;
  /** Entrance basics by the S33 pip rule (on top of any explicit permanents in `bonuses`). */
  basics: number;
  profile: Profile;
  bonuses: LabBonus[];
}

/** A side fully resolved by the page — the worker runs it as given and knows no catalogue. */
export interface ResolvedSide {
  name: string;
  decklist: { cardId: string; count: number }[];
  archetype: Archetype;
  life: number;
  profile: Profile;
  entrance: string[];
  bonuses: LabBonus[];
}

export interface LabJob {
  id: string;
  seed: number;
  games: number;
  a: ResolvedSide;
  b: ResolvedSide;
}

/** One cell's tally. Everything is derived from MatchResult — the Lab re-implements no rules. */
export interface LabCell {
  id: string;
  games: number;
  aWins: number;
  bWins: number;
  draws: number;
  /** Wins by seat: [as the first player, as the second player] — the play/draw split. */
  aWinsBySeat: [number, number];
  gamesBySeat: [number, number];
  aDecked: number;
  bDecked: number;
  turns: number[];
  /** The winner's life left, per game (the margin). */
  aMargin: number[];
  bMargin: number[];
  aEntrance: string[];
  bEntrance: string[];
  errors: number;
}
export type WorkerIn = { type: "run"; job: LabJob };
export type WorkerOut = { type: "progress" | "done"; cell: LabCell } | { type: "error"; id: string; message: string };
