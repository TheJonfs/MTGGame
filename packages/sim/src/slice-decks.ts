/**
 * Slice decklists. S1 counts were an implementer interim; S2 brief Part 2
 * adjusts A and B and adds mono-green Deck C. Rumbling Baloth replaces the
 * brief's Rhox Brute, which is actually {2}{R}{G} and uncastable in a
 * mono-green deck (Chris-approved substitution; see S2 handoff).
 */

export const DECK_A_MONO_RED: { cardId: string; count: number }[] = [
  { cardId: "mountain", count: 17 },
  { cardId: "raging_goblin", count: 4 },
  { cardId: "goblin_piker", count: 4 },
  { cardId: "gray_ogre", count: 3 },
  { cardId: "hill_giant", count: 3 },
  { cardId: "lightning_bolt", count: 3 },
  { cardId: "shock", count: 2 },
  { cardId: "brute_force", count: 2 },
  { cardId: "blaze", count: 2 },
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
  { cardId: "boomerang", count: 1 },
  { cardId: "pacifism", count: 1 },
  { cardId: "raise_the_alarm", count: 1 },
  { cardId: "glorious_anthem", count: 1 },
];

export const DECK_C_MONO_GREEN: { cardId: string; count: number }[] = [
  { cardId: "forest", count: 17 },
  { cardId: "grizzly_bears", count: 4 },
  { cardId: "elvish_visionary", count: 3 },
  { cardId: "timberland_guide", count: 3 },
  { cardId: "centaur_courser", count: 4 },
  { cardId: "rumbling_baloth", count: 3 },
  { cardId: "pelakka_wurm", count: 2 },
  { cardId: "giant_growth", count: 4 },
];

export const DECKS = {
  A: { name: "Red Aggro", decklist: DECK_A_MONO_RED },
  B: { name: "WU Skies", decklist: DECK_B_WU_SKIES },
  C: { name: "Mono Green", decklist: DECK_C_MONO_GREEN },
} as const;

export type DeckKey = keyof typeof DECKS;

export const PAIRINGS: [DeckKey, DeckKey][] = [
  ["A", "B"],
  ["A", "C"],
  ["B", "C"],
];
