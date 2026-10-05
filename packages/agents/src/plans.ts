/**
 * S55 (ADR-161): a combo list's PLAN — what the deck is trying to do, carried as data on the list (authored with it:
 * `data/convocation/open-contributed.json`; `pnpm open:gen` writes `plans.generated.ts`). The `combo` archetype reads
 * its own plan to pilot the deck; every agent reads its OPPONENT's plan, as it reads the opponent's list (ADR-051), to
 * play against it. A plan is matched to a decklist by its cards, so a player's own build of the deck is recognised
 * too. The heuristic agent's own loop recognition (book 99) stands beside it: a plan is a shortcut, not the only route.
 */
export interface ComboPlan {
  /** The list it was authored with. */
  key: string;
  /** The loop's piece: the card the plan puts in a graveyard and returns (The Usher). */
  piece: string;
  /** What sets it up, and what that card should put in the graveyard ("Buried Alive → the graveyard: The Usher ×3"). */
  setup: { card: string; bury: { card: string; count: number }[] }[];
  /** What starts it: a card that returns the piece ("Zombify on The Usher"), or the piece itself cast ("cast The Usher"). */
  start: { card: string; on: string }[];
  /** What finds the missing half (the draw engine, the tutor). */
  dig: string[];
  /** Acceleration that is spent only on the plan (Dark Ritual, the Lotus, the Moxen). */
  fuel: string[];
  /** What an opponent should hold. */
  answers: { /** spells worth a counter ahead of any other */ counter: string[]; /** exile the returning piece's target / the graveyard */ graveyardExile: boolean; /** discard is worth most before this turn of the deck's own */ discardBeforeTurn: number };
}

type Decklist = readonly { cardId: string; count: number }[];
const copies = (deck: Decklist, id: string) => deck.reduce((n, e) => n + (e.cardId === id ? e.count : 0), 0);

/** The plan a decklist follows: it holds a setup card, a start card, and at least two of the piece. */
export function matchPlan(deck: Decklist | undefined, plans: readonly ComboPlan[]): ComboPlan | undefined {
  if (!deck) return undefined;
  return plans.find((p) => copies(deck, p.piece) >= 2 && p.setup.some((s) => copies(deck, s.card) > 0) && p.start.some((s) => copies(deck, s.card) > 0));
}
