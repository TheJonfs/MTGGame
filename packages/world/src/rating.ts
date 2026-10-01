/**
 * S47 (Part 2, ADR-145): the card rating — a QUALITY number per card (shopPrice is mana value × tier: rarity). v0 is
 * measured (pnpm rating:run → rating:build → data/convocation/card-rating.json) and blended with a prior by tier, so
 * a card no list plays still has a number. The Limited builder's and the drafter's base rating; the table is handed
 * in (browser-safe), and a card missing from it reads its tier's prior.
 */
import type { CardDef } from "@shandalar/cards";

export const RATING_PRIOR = { "1": 1.0, "2": 1.5, "3": 2.0, R: 2.5, prize: 2.5 } as const;
export interface CardRatingRow { rating: number; prior: number; lists: number; seen: number; presence: number | null; lift: number | null; castWhenDrawn: number | null; /** v1 (S48): the Sealed sim's sample and lift. */ sealedSeen?: number; sealedLift?: number | null }
export interface CardRatingTable { cards: Record<string, CardRatingRow> }

/** The tier prior: 1 → 1.0, 2 → 1.5, 3 → 2.0, R → 2.5; a prize card (no tier) reads as R. */
export function ratingPrior(def: Pick<CardDef, "shopTier" | "prizeOnly">): number {
  return def.shopTier === undefined ? RATING_PRIOR.prize : RATING_PRIOR[String(def.shopTier) as "1" | "2" | "3" | "R"];
}

export function cardRating(def: CardDef, table: CardRatingTable): number {
  return table.cards[def.id]?.rating ?? ratingPrior(def);
}
