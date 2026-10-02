/**
 * S52 (ADR-151): the card rating's arithmetic as a pure function — the CLI (rating-build-cli) reads the runs and
 * writes the files; this computes. Tested (rating-compute.test.ts) with the fixture that the S49–S51 bug would have
 * failed: two Sealed runs whose decks share names must keep their records apart.
 *
 *   rating = prior(tier) + 0.5 × ½( presence′/σP + lift′/σL ) [+ 0.25 × colour/σP — v1.2, when asked]
 *
 * PRESENCE — across the authored lists that play a card, the list's win rate less the field's, weighted by copies ×
 * games, shrunk by lists/(lists+2). LIFT — over the games in which a pilot saw the card in hand, the result less
 * THAT DECK's own win rate, authored and Sealed sightings pooled, shrunk by seen/(seen+300). A deck's win rate is
 * computed within its own run: a deck key means nothing across runs.
 *
 * COLOUR (post-S52, Chris — "update black's rating"): the rating told every drafting seat black was best while black's
 * decks were the pod's worst (46% for a black seat; a seat that left black in a crowded pod gained seven points). The
 * presence and lift terms cannot see that: presence is the authored lists' (black was strong at sixty cards), and
 * lift is measured against the deck's own average. So a third term: for each colour, the mean RESULT (less one half)
 * of the Sealed games in which a mono-coloured card of that colour was seen in hand — a colour's decks' record, read
 * off the same sample — in units of σP, at the other terms' weight. A gold card takes the mean of its colours; a
 * colourless card and a land take none.
 */
import type { CardDef } from "@shandalar/cards";
import { cardColors } from "@shandalar/cards";
import { ratingPrior, type CardRatingRow } from "./rating.js";

export interface RatingGameLike { a: string; b: string; winner: "a" | "b" | "draw"; seenA: string[]; usedA: string[]; seenB: string[]; usedB: string[] }
export interface RatingInput {
  /** The authored-list run (presence, and the authored half of lift). */
  authored: RatingGameLike[];
  lists: { key: string; decklist: { cardId: string; count: number }[] }[];
  /** The Sealed runs, EACH RUN ITS OWN ARRAY (null: an authored-only build — v0). */
  sealedRuns: RatingGameLike[][] | null;
  /** The cards to rate (no tokens, basics or laws). */
  rated: CardDef[];
  /** v1.2: add the colour term (needs Sealed runs). */
  colourTerm?: boolean;
}
export interface RatingOutput { cards: Record<string, CardRatingRow>; rec: Record<string, { n: number; w: number }>; field: number; sigmaPresence: number; sigmaLift: number; sealedGames: number; /** v1.2: each colour's Sealed result less one half (null without the term). */ colourRates: Record<string, number> | null }

const sides = (g: RatingGameLike) => [[g.a, g.winner === "a" ? 1 : g.winner === "draw" ? 0.5 : 0, g.seenA, g.usedA], [g.b, g.winner === "b" ? 1 : g.winner === "draw" ? 0.5 : 0, g.seenB, g.usedB]] as [string, number, string[], string[]][];
const records = (games: RatingGameLike[]) => { const rec: Record<string, { n: number; w: number }> = {}; for (const g of games) for (const [k, r] of sides(g)) { const x = (rec[k] ??= { n: 0, w: 0 }); x.n += 1; x.w += r; } return rec; };
const r3 = (x: number) => Math.round(x * 1000) / 1000 || 0; // never −0

export function computeRating(input: RatingInput): RatingOutput {
  const rec = records(input.authored);
  const wr = (k: string) => rec[k]!.w / rec[k]!.n;
  const totalN = Object.values(rec).reduce((a, x) => a + x.n, 0);
  const field = totalN ? Object.values(rec).reduce((a, x) => a + x.w, 0) / totalN : 0.5;
  const seen: Record<string, { n: number; d: number; used: number }> = {};
  for (const g of input.authored) for (const [k, r, s, u] of sides(g)) for (const c of s) { const x = (seen[c] ??= { n: 0, d: 0, used: 0 }); x.n += 1; x.d += r - wr(k); if (u.includes(c)) x.used += 1; }
  const sealed: Record<string, { n: number; d: number }> = {};
  const colour: Record<string, { n: number; x: number }> = {};
  const defOf = new Map(input.rated.map((d) => [d.id, d]));
  const monoColour = (id: string) => { const d = defOf.get(id); if (!d || d.types.includes("Land")) return null; const cs = cardColors(d); return cs.length === 1 ? cs[0]! : null; };
  let sealedGames = 0;
  for (const run of input.sealedRuns ?? []) { // each run's decks against that run's own records
    sealedGames += run.length;
    const srec = records(run);
    for (const g of run) for (const [k, r, s] of sides(g)) for (const c of s) {
      const x = (sealed[c] ??= { n: 0, d: 0 }); x.n += 1; x.d += r - srec[k]!.w / srec[k]!.n;
      const col = monoColour(c); if (col) { const y = (colour[col] ??= { n: 0, x: 0 }); y.n += 1; y.x += r - 0.5; }
    }
  }
  const liftN = (id: string) => (seen[id]?.n ?? 0) + (sealed[id]?.n ?? 0), liftD = (id: string) => (seen[id]?.d ?? 0) + (sealed[id]?.d ?? 0);
  const pres: Record<string, { w: number; d: number; lists: number }> = {};
  for (const l of input.lists) { if (!rec[l.key]) continue; for (const e of l.decklist) { const x = (pres[e.cardId] ??= { w: 0, d: 0, lists: 0 }); const w = e.count * rec[l.key]!.n; x.w += w; x.d += w * (wr(l.key) - field); x.lists += 1; } }
  const sd = (xs: number[]) => { if (!xs.length) return 1; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1; };
  const P = (id: string) => (pres[id] ? (pres[id]!.d / pres[id]!.w) * (pres[id]!.lists / (pres[id]!.lists + 2)) : 0);
  const L = (id: string) => (liftN(id) ? (liftD(id) / liftN(id)) * (liftN(id) / (liftN(id) + 300)) : 0);
  const rated = [...input.rated].sort((a, b) => a.id.localeCompare(b.id));
  const sdP = sd(rated.filter((d) => pres[d.id]).map((d) => P(d.id))), sdL = sd(rated.filter((d) => liftN(d.id)).map((d) => L(d.id)));
  const colourRates = input.colourTerm && input.sealedRuns ? Object.fromEntries(Object.entries(colour).map(([c, v]) => [c, v.n ? v.x / v.n : 0])) : null;
  const Cterm = (d: CardDef) => { if (!colourRates || d.types.includes("Land")) return 0; const cs = cardColors(d); return cs.length ? cs.reduce((n, c) => n + (colourRates[c] ?? 0), 0) / cs.length : 0; };
  const cards: Record<string, CardRatingRow> = {};
  for (const d of rated) {
    const prior = ratingPrior(d), signal = 0.5 * (P(d.id) / sdP + L(d.id) / sdL) + 0.5 * (Cterm(d) / sdP);
    cards[d.id] = {
      rating: r3(prior + 0.5 * signal), prior, lists: pres[d.id]?.lists ?? 0, seen: seen[d.id]?.n ?? 0,
      presence: pres[d.id] ? r3(pres[d.id]!.d / pres[d.id]!.w) : null, lift: seen[d.id] ? r3(seen[d.id]!.d / seen[d.id]!.n) : null,
      castWhenDrawn: seen[d.id] ? r3(seen[d.id]!.used / seen[d.id]!.n) : null,
      ...(input.sealedRuns ? { sealedSeen: sealed[d.id]?.n ?? 0, sealedLift: sealed[d.id] ? r3(sealed[d.id]!.d / sealed[d.id]!.n) : null } : {}),
      ...(colourRates ? { colour: r3(Cterm(d)) } : {}),
    };
  }
  return { cards, rec, field, sigmaPresence: sdP, sigmaLift: sdL, sealedGames, colourRates: colourRates ? Object.fromEntries(Object.entries(colourRates).map(([c, v]) => [c, r3(v)])) : null };
}
