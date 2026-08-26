/**
 * S22b (stronghold-bosses.md §decklists, planner v1; Chris warned these get the most
 * back-and-forth — the lord-sim tables under the laws are the iteration instrument): the five
 * stronghold lord decklists — 40 cards, signature ×3, full pool including R and the duals (the
 * first AI dual users, ADR-079's promise cashed). The stronghold content layer references these
 * by key; S22a's batch fuzz ran them under random play before any fixture existed.
 */
export type LordDecklist = { cardId: string; count: number }[];
const d = (pairs: [string, number][]): LordDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

export const LORD_DECKS: Record<string, { name: string; color: "W" | "U" | "B" | "R" | "G"; archetype: "aggro" | "midrange" | "control"; decklist: LordDecklist }> = {
  unwinder: {
    name: "The Unwinder", color: "U", archetype: "control",
    decklist: d([["island", 5], ["mountain", 1], ["forest", 1], ["volcanic_island", 2], ["tropical_island", 2], ["taiga", 1], ["steam_vents", 2], ["breeding_pool", 2], ["stomping_ground", 1],
      ["the_unwinder", 3], ["aetherbolt", 2], ["aether_mutation", 2], ["temporal_spring", 2], ["man_o_war", 3], ["mist_raven", 2], ["waterfront_bouncer", 2], ["boomerang", 2], ["aether_channeler", 2], ["lightning_bolt", 2], ["shock", 1]]),
  },
  usher: {
    name: "The Usher", color: "B", archetype: "midrange",
    decklist: d([["swamp", 6], ["plains", 1], ["mountain", 1], ["scrubland", 2], ["badlands", 2], ["plateau", 1], ["godless_shrine", 2], ["blood_crypt", 1], ["sacred_foundry", 1],
      ["the_usher", 3], ["phyrexian_purge", 2], ["graceful_restoration", 2], ["blood_artist", 2], ["indulgent_aristocrat", 2], ["vampire_nighthawk", 2], ["child_of_night", 2], ["doom_blade", 1], ["zombify", 1], ["restoration_angel", 1], ["swords_to_plowshares", 2], ["hymn_to_tourach", 1], ["wrath_of_god", 1], ["vindicate", 1]]),
  },
  warden: {
    name: "The Warden", color: "W", archetype: "midrange",
    decklist: d([["plains", 6], ["forest", 1], ["swamp", 1], ["savannah", 2], ["scrubland", 2], ["temple_garden", 2], ["godless_shrine", 1], ["bayou", 1], ["overgrown_tomb", 1],
      ["the_warden", 3], ["glare_of_subdual", 2], ["frondland_felidar", 2], ["master_decoy", 2], ["scepter_of_dominance", 2], ["cunning_tactician", 2], ["serra_angel", 2], ["pacifism", 2], ["swords_to_plowshares", 2], ["glorious_anthem", 2], ["wrath_of_god", 1], ["vindicate", 1]]),
  },
  stoker: {
    name: "The Stoker", color: "R", archetype: "control",
    decklist: d([["mountain", 5], ["swamp", 1], ["island", 1], ["badlands", 2], ["volcanic_island", 2], ["blood_crypt", 2], ["steam_vents", 2], ["watery_grave", 1], ["forgotten_cave", 1],
      ["the_stoker", 3], ["tainted_phoenix", 2], ["experimental_overload", 2], ["lightning_bolt", 3], ["shock", 2], ["pyroclasm", 1], ["blaze", 2], ["hymn_to_tourach", 2], ["doom_blade", 2], ["essence_scatter", 2], ["counterspell", 1], ["dark_ritual", 1]]),
  },
  sower: {
    name: "The Sower", color: "G", archetype: "midrange",
    decklist: d([["forest", 5], ["plains", 1], ["island", 1], ["tropical_island", 2], ["savannah", 2], ["temple_garden", 2], ["breeding_pool", 2], ["tundra", 1], ["hallowed_fountain", 1],
      ["the_sower", 3], ["frondland_felidar", 2], ["temporal_spring", 2], ["llanowar_elves", 3], ["rampant_growth", 2], ["elvish_visionary", 2], ["gaean_wurm", 2], ["pelakka_wurm", 1], ["serra_angel", 1], ["faerie_formation", 1], ["essence_scatter", 2], ["swords_to_plowshares", 2]]),
  },
};
for (const [k, g] of Object.entries(LORD_DECKS)) {
  const n = g.decklist.reduce((s, e) => s + e.count, 0);
  if (n !== 40) throw new Error(`lord ${k}: ${n} cards (the boss doc says 40)`);
}
