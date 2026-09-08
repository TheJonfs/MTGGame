import type { Profile } from "./lab-decks.js";

export interface LabSide {
  deck: string;
  life: number;
  basics: number;
  profile: Profile;
}
export interface LabJob {
  id: string;
  seed: number;
  games: number;
  a: LabSide;
  b: LabSide;
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
  /** A's basics as resolved (the entrance the cell actually used). */
  aEntrance: string[];
  bEntrance: string[];
  errors: number;
}
export type WorkerIn = { type: "run"; job: LabJob };
export type WorkerOut = { type: "progress" | "done"; cell: LabCell } | { type: "error"; id: string; message: string };
