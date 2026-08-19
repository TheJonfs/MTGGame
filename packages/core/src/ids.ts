/**
 * Deterministic sequential id generation. One IdGen per game; ids are stable
 * across replays because generation order is part of the game's determinism.
 */
export class IdGen {
  private counter = 0;

  next(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }
}
