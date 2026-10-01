import type { Collection, DeckCheck, Decklist } from "@shandalar/world";

/**
 * S48 (Part 1, ADR-145): the deck editor over a SOURCE OBJECT — the collection it may draw from, the saved deck it
 * edits, where a save goes. The world provides its own (`worldEditorHost`: the player's collection, the world's decks,
 * the doors); a Convocation event provides its sealed pool and its one deck. The spares grid, the counts, the stats
 * and the door picker are the S14–S46 editor's, unchanged.
 */
export interface DeckEditorHost {
  title: string;
  /** The draft being edited, its name, and a notice line (a refused edit). */
  draft: Decklist;
  name: string;
  notice: string | null;
  /** The source: what may be added, and what the draft is measured against for "unsaved". */
  source: { collection: Collection; savedDeck: Decklist; activeDeckName: string };
  legality(): DeckCheck;
  add(cardId: string): void;
  remove(cardId: string): void;
  reset(): void;
  save(): void;
  saveLabel: string;
  /** Absent: the editor cannot be left without saving (an event's registration). */
  close?: () => void;
  closeLabel?: string;
  /** Set (the reason shown): closing is refused while the draft is illegal. */
  mustLeaveLegal?: string | undefined;
  /** Absent: the deck's name is fixed. */
  rename?: (name: string) => void;
  /** Several saved decks (the world); absent for a source with one deck. */
  decks?: { names(): string[]; switch(name: string): void; create(name: string): boolean; duplicate(name: string): boolean; remove(name: string): boolean };
  /** Doors and formats the draft can be checked against; a door never blocks a save. */
  doors?: { list(): { id: string; name: string; label: string }[]; selected: string | null; select(id: string | null): void; check(): { label: string; description: string; check: DeckCheck } | null };
  sparesLabel?: string;
}
