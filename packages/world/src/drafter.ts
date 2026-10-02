/**
 * S49 (Part 3, ADR-145): the drafter's DATA — a pick rule the draft sim runs, not yet a screen. A pick's worth is
 * the card's rating plus two terms keyed on the seat's picks so far (never on a card's name):
 *  - COLOUR COMMITMENT: picks 1–3 by rating alone. From pick 4 a bonus to cards castable in the seat's two colours
 *    with the most rated picks so far (colourless cards too), growing by pick (+0.1 a pick, to a cap). Until pick 8
 *    the third colour draws half the bonus; at pick 8 it is cut.
 *  - THE CURVE: from pick 20, a seat short of two-drops in its colours rates them up.
 * A land is worth its rating only when it taps inside the seat's colours (after the cut); a basic-fetching land a little.
 */
import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { packColors, rollPack, resolveSet, type ConvocationPackData, type PackColor, type Recipe, type SetDef } from "./packs.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { WorldRng } from "./rng.js";

export const DRAFT_TERMS = { freePicks: 3, bonusPerPick: 0.1, bonusCap: 1.2, cutAt: 8, thirdShare: 0.5, curveFrom: 20, twoDropsWanted: 5, curveBonus: 0.3 } as const;
const COLORS: readonly PackColor[] = ["W", "U", "B", "R", "G"];

/** The seat's colours by the summed rating of its picks (a gold card counts to each of its colours), best first. */
export function colourRanks(picks: readonly string[], rating: CardRatingTable, cards: Map<string, CardDef>): PackColor[] {
  const sum: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const id of picks) { const d = cards.get(id)!; if (d.types.includes("Land")) continue; for (const c of cardColors(d)) sum[c]! += cardRating(d, rating); }
  return [...COLORS].sort((a, b) => sum[b]! - sum[a]! || COLORS.indexOf(a) - COLORS.indexOf(b));
}

/** What a card is worth to a seat at this pick (1-based across the whole draft). */
export function pickValue(cardId: string, picks: readonly string[], pick: number, rating: CardRatingTable, cards: Map<string, CardDef>): number {
  const d = cards.get(cardId)!, base = cardRating(d, rating);
  if (pick <= DRAFT_TERMS.freePicks) return base;
  const ranks = colourRanks(picks, rating, cards), main = ranks.slice(0, 2), third = ranks[2]!;
  const bonus = Math.min(DRAFT_TERMS.bonusCap, DRAFT_TERMS.bonusPerPick * (pick - DRAFT_TERMS.freePicks));
  const cs = d.types.includes("Land") ? packColors(d) : cardColors(d);
  const inMain = cs.every((c) => main.includes(c)), inThree = cs.every((c) => main.includes(c) || c === third);
  if (d.types.includes("Land")) return base + (cs.length >= 2 && inMain ? bonus : cs.length === 0 ? 0 : -bonus); // a land outside the colours is worth less as the seat commits
  let v = base + (inMain ? bonus : pick < DRAFT_TERMS.cutAt && inThree ? bonus * DRAFT_TERMS.thirdShare : 0);
  if (pick >= DRAFT_TERMS.curveFrom && inMain && manaValue(parseManaCost(d.manaCost)) <= 2) {
    const twos = picks.filter((id) => { const p = cards.get(id)!; return !p.types.includes("Land") && manaValue(parseManaCost(p.manaCost)) <= 2 && cardColors(p).every((c) => main.includes(c)); }).length;
    if (twos < DRAFT_TERMS.twoDropsWanted) v += DRAFT_TERMS.curveBonus;
  }
  return v;
}

export function draftPick(pack: readonly string[], picks: readonly string[], pick: number, rating: CardRatingTable, cards: Map<string, CardDef>): string {
  return [...pack].sort((a, b) => pickValue(b, picks, pick, rating, cards) - pickValue(a, picks, pick, rating, cards) || a.localeCompare(b))[0]!;
}

export interface DraftResult { picks: string[][]; /** For each seat: the pick at which its top two colours last changed. */ settledAt: number[] }
/** A pod's draft: `seats` seats, `rounds` packs each, passed left, right, left; every seat picks by `draftPick`. */
export function runDraft(set: SetDef, recipe: Recipe, data: ConvocationPackData, cards: Map<string, CardDef>, rating: CardRatingTable, seed: number, seats = 8, rounds = 3): DraftResult {
  const tiers = resolveSet(set, cards, data.power), rng = new WorldRng(seed);
  const picks: string[][] = Array.from({ length: seats }, () => []);
  const settledAt = Array.from({ length: seats }, () => 1), lastTop: string[] = Array.from({ length: seats }, () => "");
  let n = 0;
  for (let r = 0; r < rounds; r++) {
    let packs = Array.from({ length: seats }, () => rollPack(tiers, recipe, rng));
    const dir = r % 2 === 0 ? 1 : -1;
    while (packs[0]!.length > 0) {
      n += 1;
      for (let s = 0; s < seats; s++) {
        const choice = draftPick(packs[s]!, picks[s]!, n, rating, cards);
        packs[s]!.splice(packs[s]!.indexOf(choice), 1); picks[s]!.push(choice);
        const top = colourRanks(picks[s]!, rating, cards).slice(0, 2).sort().join("");
        if (top !== lastTop[s]) { lastTop[s] = top; settledAt[s] = n; }
      }
      packs = packs.map((_, s) => packs[(s - dir + seats) % seats]!);
    }
  }
  return { picks, settledAt };
}
