/**
 * Action-log types (data-model §6). The log is the replay artifact: replay
 * consumes ACTION and RNG entries only; EVENT entries exist for viewers.
 *
 * Core does not know the engine's Action type, so the entry type is generic.
 */

export type RngPurpose = "shuffle" | "discard" | "coin" | "pick" | "entrance" | "lawSequence"; // S22b: the lord's entrance swap

export type RngLogValue =
  | { kind: "int"; value: number }
  | { kind: "permutation"; value: number[] };

export type ActionLogEntry<A> =
  | { t: "ACTION"; turn: number; step: string; player: number; action: A }
  | { t: "RNG"; purpose: RngPurpose; value: RngLogValue }
  /** seq/afterAction (ADR-040): stamped by ArrayLog so viewers can align events
   *  to the action timeline without re-simulating. Replay ignores EVENT entries. */
  | { t: "EVENT"; name: string; payload: unknown; seq?: number; afterAction?: number };

/** Anything that accepts log entries; the engine owns the actual array. */
export interface LogSink<A> {
  append(entry: ActionLogEntry<A>): void;
}

export class ArrayLog<A> implements LogSink<A> {
  readonly entries: ActionLogEntry<A>[] = [];
  private eventSeq = 0;
  private actionCount = 0;
  append(entry: ActionLogEntry<A>): void {
    if (entry.t === "ACTION") this.actionCount += 1;
    if (entry.t === "EVENT") {
      // afterAction = index of the last ACTION entry emitted before this event
      // (-1 for pre-game events such as setup zone changes).
      entry = { ...entry, seq: this.eventSeq++, afterAction: this.actionCount - 1 };
    }
    this.entries.push(entry);
  }
}

/** Discards entries. For RNG consumers whose draws must NOT enter the game log (e.g. agent-internal randomness). */
export class NullLog<A> implements LogSink<A> {
  append(_entry: ActionLogEntry<A>): void {}
}
