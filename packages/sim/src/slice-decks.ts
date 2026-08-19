/**
 * Slice decklists, as adjusted by the S3 brief Part 3 (S2: Deck C added;
 * Rumbling Baloth replaces the S2 brief's Rhox Brute — {2}{R}{G}, uncastable
 * mono-green; Chris-approved).
 */

export const DECK_A_MONO_RED: { cardId: string; count: number }[] = [
  { cardId: "mountain", count: 17 },
  { cardId: "raging_goblin", count: 4 },
  { cardId: "goblin_piker", count: 2 },
  { cardId: "lightning_bolt", count: 3 },
  { cardId: "shock", count: 2 },
  { cardId: "blaze", count: 2 },
  { cardId: "boggart_brute", count: 3 },
  { cardId: "siege_gang_commander", count: 2 },
  { cardId: "bonesplitter", count: 2 },
  { cardId: "goblin_chieftain", count: 2 },
  { cardId: "pyroclasm", count: 1 },
];

export const DECK_B_WU_SKIES: { cardId: string; count: number }[] = [
  { cardId: "plains", count: 8 },
  { cardId: "island", count: 9 },
  { cardId: "savannah_lions", count: 2 },
  { cardId: "serra_angel", count: 2 },
  { cardId: "man_o_war", count: 2 },
  { cardId: "cloudkin_seer", count: 2 },
  { cardId: "counterspell", count: 2 },
  { cardId: "pacifism", count: 1 },
  { cardId: "raise_the_alarm", count: 1 },
  { cardId: "glorious_anthem", count: 1 },
  { cardId: "fencing_ace", count: 3 },
  { cardId: "loxodon_warhammer", count: 1 },
  { cardId: "mind_stone", count: 1 },
  { cardId: "swords_to_plowshares", count: 2 },
  { cardId: "wrath_of_god", count: 1 },
  { cardId: "curiosity", count: 2 },
];

export const DECK_C_MONO_GREEN: { cardId: string; count: number }[] = [
  { cardId: "forest", count: 17 },
  { cardId: "grizzly_bears", count: 1 },
  { cardId: "elvish_visionary", count: 3 },
  { cardId: "timberland_guide", count: 3 },
  { cardId: "centaur_courser", count: 2 },
  { cardId: "rumbling_baloth", count: 2 },
  { cardId: "pelakka_wurm", count: 2 },
  { cardId: "giant_growth", count: 2 },
  { cardId: "prey_upon", count: 3 },
  { cardId: "deadly_recluse", count: 2 },
  { cardId: "gladecover_scout", count: 2 },
  { cardId: "blurred_mongoose", count: 1 },
];

export const DECK_D_MONO_BLACK: { cardId: string; count: number }[] = [
  { cardId: "swamp", count: 17 },
  { cardId: "typhoid_rats", count: 3 },
  { cardId: "child_of_night", count: 3 },
  { cardId: "vampire_nighthawk", count: 3 },
  { cardId: "phyrexian_rager", count: 3 },
  { cardId: "nekrataal", count: 3 },
  { cardId: "doom_blade", count: 2 },
  { cardId: "terror", count: 2 },
  { cardId: "duress", count: 2 },
  { cardId: "mind_rot", count: 1 },
  { cardId: "hymn_to_tourach", count: 1 },
];

export const DECKS = {
  A: { name: "Red Aggro", decklist: DECK_A_MONO_RED },
  B: { name: "WU Skies", decklist: DECK_B_WU_SKIES },
  C: { name: "Mono Green", decklist: DECK_C_MONO_GREEN },
  D: { name: "Mono Black", decklist: DECK_D_MONO_BLACK },
} as const;

export type DeckKey = keyof typeof DECKS;

export const PAIRINGS: [DeckKey, DeckKey][] = [
  ["A", "B"],
  ["A", "C"],
  ["A", "D"],
  ["B", "C"],
  ["B", "D"],
  ["C", "D"],
];
