/**
 * Action-log types (data-model §6). The log is the replay artifact: replay
 * consumes ACTION and RNG entries only; EVENT entries exist for viewers.
 *
 * Core does not know the engine's Action type, so the entry type is generic.
 */

export type RngPurpose = "shuffle" | "discard" | "coin" | "pick";

export type RngLogValue =
  | { kind: "int"; value: number }
  | { kind: "permutation"; value: number[] };

export type ActionLogEntry<A> =
  | { t: "ACTION"; turn: number; step: string; player: number; action: A }
  | { t: "RNG"; purpose: RngPurpose; value: RngLogValue }
  | { t: "EVENT"; name: string; payload: unknown };

/** Anything that accepts log entries; the engine owns the actual array. */
export interface LogSink<A> {
  append(entry: ActionLogEntry<A>): void;
}

export class ArrayLog<A> implements LogSink<A> {
  readonly entries: ActionLogEntry<A>[] = [];
  append(entry: ActionLogEntry<A>): void {
    this.entries.push(entry);
  }
}

/** Discards entries. For RNG consumers whose draws must NOT enter the game log (e.g. agent-internal randomness). */
export class NullLog<A> implements LogSink<A> {
  append(_entry: ActionLogEntry<A>): void {}
}
