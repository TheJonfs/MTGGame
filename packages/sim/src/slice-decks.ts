/**
 * Session 1 slice decklists (manifest §6 shapes; exact counts are an
 * implementer interim pending planner ratification — see handoff).
 * Every slice card appears at least once; 40 cards per deck.
 */

export const DECK_A_MONO_RED: { cardId: string; count: number }[] = [
  { cardId: "mountain", count: 17 },
  { cardId: "raging_goblin", count: 4 },
  { cardId: "goblin_piker", count: 4 },
  { cardId: "gray_ogre", count: 3 },
  { cardId: "hill_giant", count: 3 },
  { cardId: "lightning_bolt", count: 3 },
  { cardId: "shock", count: 3 },
  { cardId: "brute_force", count: 3 },
];

export const DECK_B_WU_SKIES: { cardId: string; count: number }[] = [
  { cardId: "plains", count: 9 },
  { cardId: "island", count: 9 },
  { cardId: "savannah_lions", count: 4 },
  { cardId: "suntail_hawk", count: 3 },
  { cardId: "wind_drake", count: 3 },
  { cardId: "serra_angel", count: 2 },
  { cardId: "man_o_war", count: 2 },
  { cardId: "cloudkin_seer", count: 2 },
  { cardId: "counterspell", count: 2 },
  { cardId: "boomerang", count: 2 },
  { cardId: "pacifism", count: 1 },
  { cardId: "divination", count: 1 },
];
