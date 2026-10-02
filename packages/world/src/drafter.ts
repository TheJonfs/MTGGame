/**
 * S49 (Part 3, ADR-145): the drafter's DATA — a pick rule the draft sim runs, not yet a screen. A pick's worth is
 * the card's rating plus two terms keyed on the seat's picks so far (never on a card's name):
 *  - COLOUR COMMITMENT: picks 1–3 by rating alone. From pick 4 a bonus to cards castable in the seat's two colours
 *    with the most rated picks so far (colourless cards too), growing by pick — at HALF its slope until the cut
 *    (S50, a slower commitment), at the full slope from pick 8 (S51: +0.07 a pick — 0.35 at the cut, was 0.50), to a cap. Until pick 8 the third
 *    colour draws half the bonus; at pick 8 it is cut.
 *  - LANDS (S50): a land is worth a flat low value until the cut (a dual is never a first pick over a playable —
 *    its rating is Constructed's); from pick 8 its rating when it taps inside the seat's colours, the flat value less
 *    the bonus when it taps outside them.
 *  - THE CURVE: from pick 20, a seat short of two-drops in its colours rates them up.
 */
import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { packColors, rollPack, resolveSet, type ConvocationPackData, type PackColor, type Recipe, type SetDef } from "./packs.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { WorldRng } from "./rng.js";

// S52: the pack-reading term's weights are ZERO — measured (seven variants, 50 pods each) it never beat the rule
// without it (42–45% against Sealed decks where the rule alone makes 46%), so it ships switched off; `pnpm draft-sim
// --terms signalFlow=0.06,signalCut=0.08` turns it on for the next attempt.
export const DRAFT_TERMS = { signalFlow: 0, signalCut: 0, signalCap: 0.6, signalLate: 6, signalBase: 0.2, freePicks: 3, bonusPerPick: 0.07, /* S51: the bonus at the cut 0.50 → 0.35 */ earlySlope: 0.5, bonusCap: 1.2, cutAt: 8, thirdShare: 0.5, landFlat: 0.5, curveFrom: 20, twoDropsWanted: 5, curveBonus: 0.3, signalAfterCut: 1, signalNormalise: 0 };
/** S52: the draft sim's tuning hook (`pnpm draft-sim --terms key=value,…`) — never called by the game. */
export function tuneDraftTerms(over: Partial<Record<keyof typeof DRAFT_TERMS, number>>): void { Object.assign(DRAFT_TERMS, over); }
const COLORS: readonly PackColor[] = ["W", "U", "B", "R", "G"];

/** The seat's colours by the summed rating of its picks (a gold card counts to each of its colours), best first. */
export function colourRanks(picks: readonly string[], rating: CardRatingTable, cards: Map<string, CardDef>): PackColor[] {
  const sum: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const id of picks) { const d = cards.get(id)!; if (d.types.includes("Land")) continue; for (const c of cardColors(d)) sum[c]! += cardRating(d, rating); }
  return [...COLORS].sort((a, b) => sum[b]! - sum[a]! || COLORS.indexOf(a) - COLORS.indexOf(b));
}

/** S52 (Chris's ruling: the AI has PERFECT MEMORY of every pack it sees — the whole pack each time). A pack as a seat
 * saw it: the pack round, its position in the round (0 = the pack the seat opened), the cards in it then. */
export interface SeenPack { round: number; index: number; cards: string[] }
export type ColourSignals = Record<PackColor, number>;

/** S52 — the drafter reads what is passed. From everything a seat has seen:
 *  - FLOW: a rated card still in a pack several picks in says its colour is not being taken upstream — each such card
 *    adds its rating above a common's to its colours, weighted by how late in the round it is still there;
 *  - CUT: when a pack comes back round the table (the wheel — `seats` picks later), the cards missing since the seat
 *    last saw it (its own pick aside) were taken by the others — each adds to its colours' cut, a rated card more than
 *    a common (a small base for any card, plus its rating above a common's).
 * The signal is flow less cut, centred across the five colours: positive is a colour coming to the seat, negative a
 * colour being fought over. `picks` are the seat's own (to leave its own pick out of the missing). */
export function colourSignals(memory: readonly SeenPack[], picks: readonly string[], seats: number, rating: CardRatingTable, cards: Map<string, CardDef>): ColourSignals {
  const s: ColourSignals = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const excess = (id: string) => Math.max(0, cardRating(cards.get(id)!, rating) - 1);
  const coloursOf = (id: string) => { const d = cards.get(id)!; return d.types.includes("Land") ? [] : cardColors(d); };
  // A colour whose cards simply rate higher (black, under v1.1) would always look as if it were flowing: each card's
  // excess is read against its colour's own mean excess over every card the seat has seen.
  const norm: Record<string, { n: number; x: number }> = {};
  if (DRAFT_TERMS.signalNormalise) for (const m of memory) for (const id of m.cards) for (const c of coloursOf(id)) { const k = (norm[c] ??= { n: 0, x: 0 }); k.n += 1; k.x += excess(id); }
  const rel = (id: string, c: string) => { const k = norm[c]; return DRAFT_TERMS.signalNormalise && k && k.x > 0 ? excess(id) / (k.x / k.n) : excess(id); };
  memory.forEach((m, at) => {
    const late = Math.min(1, m.index / DRAFT_TERMS.signalLate);
    if (late > 0) for (const id of m.cards) for (const c of coloursOf(id)) s[c] += DRAFT_TERMS.signalFlow * late * rel(id, c);
    if (m.index >= seats) {
      const before = memory.find((x) => x.round === m.round && x.index === m.index - seats);
      if (!before) return;
      const left = [...m.cards], gone: string[] = [];
      for (const id of before.cards) { const i = left.indexOf(id); if (i >= 0) left.splice(i, 1); else gone.push(id); }
      const mine = picks[memory.indexOf(before)]; // the seat's own pick from that pack (memory and picks run in step)
      const i = mine === undefined ? -1 : gone.indexOf(mine); if (i >= 0) gone.splice(i, 1);
      for (const id of gone) for (const c of coloursOf(id)) s[c] -= DRAFT_TERMS.signalCut * (DRAFT_TERMS.signalBase + rel(id, c));
    }
    void at;
  });
  const mean = (s.W + s.U + s.B + s.R + s.G) / 5;
  for (const c of COLORS) s[c] -= mean;
  return s;
}

/** What a card is worth to a seat at this pick (1-based across the whole draft). `signals` (S52): what the seat has
 * read from the packs — added to a card in a colour that is flowing, taken from one in a colour being cut. */
export function pickValue(cardId: string, picks: readonly string[], pick: number, rating: CardRatingTable, cards: Map<string, CardDef>, signals?: ColourSignals): number {
  return pickValueBase(cardId, picks, pick, rating, cards) + signalTerm(cardId, pick, cards, signals);
}
function signalTerm(cardId: string, pick: number, cards: Map<string, CardDef>, signals?: ColourSignals): number {
  if (!signals) return 0;
  const d = cards.get(cardId)!; if (d.types.includes("Land")) return 0;
  const cs = cardColors(d); if (!cs.length) return 0;
  const v = (cs.reduce((n, c) => n + signals[c], 0) / cs.length) * (pick >= DRAFT_TERMS.cutAt ? DRAFT_TERMS.signalAfterCut : 1);
  return Math.max(-DRAFT_TERMS.signalCap, Math.min(DRAFT_TERMS.signalCap, v));
}
function pickValueBase(cardId: string, picks: readonly string[], pick: number, rating: CardRatingTable, cards: Map<string, CardDef>): number {
  const d = cards.get(cardId)!, base = cardRating(d, rating), land = d.types.includes("Land");
  if (land && pick < DRAFT_TERMS.cutAt) return DRAFT_TERMS.landFlat; // S50: flat and low until the colours settle
  if (pick <= DRAFT_TERMS.freePicks) return base;
  const ranks = colourRanks(picks, rating, cards), main = ranks.slice(0, 2), third = ranks[2]!;
  const slope = DRAFT_TERMS.bonusPerPick * (pick < DRAFT_TERMS.cutAt ? DRAFT_TERMS.earlySlope : 1); // S50: half the slope before the cut
  const bonus = Math.min(DRAFT_TERMS.bonusCap, slope * (pick - DRAFT_TERMS.freePicks));
  const cs = land ? packColors(d) : cardColors(d);
  const inMain = cs.every((c) => main.includes(c)), inThree = cs.every((c) => main.includes(c) || c === third);
  if (land) return cs.length >= 1 && inMain ? base : DRAFT_TERMS.landFlat - (cs.length ? bonus : 0); // the rating inside the colours; less than flat outside them
  let v = base + (inMain ? bonus : pick < DRAFT_TERMS.cutAt && inThree ? bonus * DRAFT_TERMS.thirdShare : 0);
  if (pick >= DRAFT_TERMS.curveFrom && inMain && manaValue(parseManaCost(d.manaCost)) <= 2) {
    const twos = picks.filter((id) => { const p = cards.get(id)!; return !p.types.includes("Land") && manaValue(parseManaCost(p.manaCost)) <= 2 && cardColors(p).every((c) => main.includes(c)); }).length;
    if (twos < DRAFT_TERMS.twoDropsWanted) v += DRAFT_TERMS.curveBonus;
  }
  return v;
}

export function draftPick(pack: readonly string[], picks: readonly string[], pick: number, rating: CardRatingTable, cards: Map<string, CardDef>, signals?: ColourSignals): string {
  return [...pack].sort((a, b) => pickValue(b, picks, pick, rating, cards, signals) - pickValue(a, picks, pick, rating, cards, signals) || a.localeCompare(b))[0]!;
}

/** A whole pod's draft, headless: every seat's picks (the event's other pods — post-S52). */
export function runDraftPacks(set: SetDef, recipe: Recipe, data: ConvocationPackData, cards: Map<string, CardDef>, rating: CardRatingTable, seed: number, seats: number, rounds: number): string[][] {
  return runDraft(set, recipe, data, cards, rating, seed, seats, rounds).picks;
}

export interface DraftResult { picks: string[][]; /** For each seat: the pick at which its top two colours last changed. */ settledAt: number[] }
/** A pod's draft: `seats` seats, `rounds` packs each, passed left, right, left; every seat picks by `draftPick`. */
export function runDraft(set: SetDef, recipe: Recipe, data: ConvocationPackData, cards: Map<string, CardDef>, rating: CardRatingTable, seed: number, seats = 8, rounds = 3, read = true): DraftResult {
  const tiers = resolveSet(set, cards, data.power), rng = new WorldRng(seed);
  const picks: string[][] = Array.from({ length: seats }, () => []);
  const memory: SeenPack[][] = Array.from({ length: seats }, () => []);
  const settledAt = Array.from({ length: seats }, () => 1), lastTop: string[] = Array.from({ length: seats }, () => "");
  let n = 0;
  for (let r = 0; r < rounds; r++) {
    let packs = Array.from({ length: seats }, () => rollPack(tiers, recipe, rng));
    const dir = r % 2 === 0 ? 1 : -1;
    let index = 0;
    while (packs[0]!.length > 0) {
      n += 1;
      for (let s = 0; s < seats; s++) {
        memory[s]!.push({ round: r, index, cards: [...packs[s]!] });
        const choice = draftPick(packs[s]!, picks[s]!, n, rating, cards, read ? colourSignals(memory[s]!, picks[s]!, seats, rating, cards) : undefined);
        packs[s]!.splice(packs[s]!.indexOf(choice), 1); picks[s]!.push(choice);
        const top = colourRanks(picks[s]!, rating, cards).slice(0, 2).sort().join("");
        if (top !== lastTop[s]) { lastTop[s] = top; settledAt[s] = n; }
      }
      packs = packs.map((_, s) => packs[(s - dir + seats) % seats]!);
      index += 1;
    }
  }
  return { picks, settledAt };
}
