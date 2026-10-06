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
  /** S57 (ADR-165, the Larder — the vocabulary's second customer): what the plan is after. `loop` (the default): the
   * piece returns itself and the plan wants two of it within reach. `once`: one of the `pieces` reanimated is the
   * whole plan (an Artisan of Kozilek on turn three) — one in the graveyard is set up, and the start is any of them. */
  goal?: "loop" | "once";
  /** S57: the cards a `once` plan is content to return (the first is `piece`). */
  pieces?: string[];
  /** What sets it up, and what that card should put in the graveyard ("Buried Alive → the graveyard: The Usher ×3"). */
  setup: { card: string; bury: { card: string; count: number }[] }[];
  /** What starts it: a card that returns the piece ("Zombify on The Usher"), or the piece itself cast ("cast The Usher"). */
  start: { card: string; on: string }[];
  /** What finds the missing half (the draw engine, the tutor). */
  dig: string[];
  /** Acceleration that is spent only on the plan (Dark Ritual, the Lotus, the Moxen). */
  fuel: string[];
  /** Post-S55 (Chris's Coin study): when the OPPONENT's list also holds the piece, the setup arms both players (the
   * Usher returns a creature card from either graveyard — 42 of the Coin's 48 loop wins began from the Pall's own
   * graveyard, and whoever landed the first Usher won nine games in ten). With this set, the setup is held against
   * such a list — once they have the mana for the piece — until the start can be cast the same turn.
   * MEASURED AND LEFT OFF FOR THE PALL (2026-10-06, 720 matches against the Coin, the Hearth and the Loop): held from
   * turn one it cost nine points of matches (50% → 41%: it gave up the race for the first Usher); held only once the
   * opponent could cast the piece, 50% → 47% (within noise). The option stays for a plan — or a pilot — it suits. */
  holdSetupAgainstPiece?: boolean;
  /** S57 (the brief's Part 1: "a Ritual kept for the start when lands pay the setup"): with a start in hand, fuel is
   * not spent on the SETUP when our lands alone will pay for the setup next turn (the mana sources now, one more for
   * a land in hand) — it is kept for the start, the dearer half. Measured before it was set on any plan (the handoff). */
  fuelKeptForStart?: boolean;
  /** What an opponent should hold. */
  answers: { /** spells worth a counter ahead of any other */ counter: string[]; /** exile the returning piece's target / the graveyard */ graveyardExile: boolean; /** discard is worth most before this turn of the deck's own */ discardBeforeTurn: number };
}

/** The cards the plan returns: its `pieces`, or its one piece. */
export const planPieces = (p: ComboPlan): string[] => p.pieces ?? [p.piece];

type Decklist = readonly { cardId: string; count: number }[];
const copies = (deck: Decklist, id: string) => deck.reduce((n, e) => n + (e.cardId === id ? e.count : 0), 0);

/** The plan a decklist follows: it holds a setup card, a start card, and at least two of the piece. */
export function matchPlan(deck: Decklist | undefined, plans: readonly ComboPlan[]): ComboPlan | undefined {
  if (!deck) return undefined;
  return plans.find((p) => planPieces(p).reduce((n, id) => n + copies(deck, id), 0) >= 2 && p.setup.some((s) => copies(deck, s.card) > 0) && p.start.some((s) => copies(deck, s.card) > 0));
}
