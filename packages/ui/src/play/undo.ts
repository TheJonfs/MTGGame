/**
 * Post-S54 (Chris: a misclick mid-loop cost a match): the TAKE-BACK's bookkeeping. One switch (`UNDO_ENABLED`) and one
 * small ledger; the match controller does the rewinding (a replay of the game's own log — the engine knows nothing of
 * it). To remove the feature: set the switch to false (the button disappears and nothing is recorded).
 *
 * The rule (Chris): an action can be taken back only while nothing irreversible has happened since — no card has left
 * a library (a draw, a mill, a search), nothing has been shuffled or drawn at random, no hidden card has been shown,
 * no damage has been dealt and no life total has moved, and the opponent has done nothing but pass priority (a spell cast, an ability, a block or a choice of theirs seals;
 * letting ours resolve does not). The ledger keeps a SEAL counter that grows at each of those moments; a mark
 * (the decision the player was shown, as a count of the log's actions before it) can be taken back only while the
 * seal still reads what it read when the mark was made. Taking a mark back returns the game to that moment, where the
 * seal read the same — so the mark before it can be judged by the same comparison.
 */
export const UNDO_ENABLED = true;

export interface UndoMark { /** ACTION entries in the log before the decision */ actions: number; seal: number; label: string }

export class UndoLedger {
  private seal = 0;
  private marks: UndoMark[] = [];
  /** Something irreversible happened: every mark made before now is spent. */
  sealNow(): void { this.seal += 1; this.marks = []; }
  mark(actions: number, label: string): void {
    const top = this.marks[this.marks.length - 1];
    if (top && top.actions === actions) { top.label = label; return; } // the same decision, answered again after a take-back
    this.marks.push({ actions, seal: this.seal, label });
  }
  /** The decision that can be taken back now, or null. */
  top(): UndoMark | null { const m = this.marks[this.marks.length - 1]; return m && m.seal === this.seal ? m : null; }
  pop(): UndoMark | null { const m = this.top(); if (m) this.marks.pop(); return m; }
  clear(): void { this.marks = []; }
}
