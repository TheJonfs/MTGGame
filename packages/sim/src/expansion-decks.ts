/**
 * Expansion 1 beast decklists (docs/expansion-1-cards-and-decks.md, planner-authored) as sim
 * infrastructure: fuzz/ladder coverage of the S17 batch in random and heuristic lines before the
 * S18 bestiary catalog adopts them. 30 cards each as listed (ADR-074 says 40 — flagged in the S17
 * handoff; the planner reconciles in S18). Not read by the world package.
 */
export type ExpansionDecklist = { cardId: string; count: number }[];
const d = (pairs: [string, number][]): ExpansionDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

export const EXPANSION_DECKS: Record<string, { name: string; color: string; tier: 1 | 2 | 3; archetype: "aggro" | "midrange" | "control"; decklist: ExpansionDecklist }> = {
  grizzly: { name: "A Grizzly Bear", color: "G", tier: 1, archetype: "midrange", decklist: d([["forest", 13], ["grizzly_bears", 4], ["little_bear", 3], ["mother_bear", 2], ["werebear", 2], ["rumbling_baloth", 2], ["centaur_courser", 2], ["giant_growth", 2]]) },
  recluse: { name: "The Deadly Recluse", color: "G", tier: 1, archetype: "midrange", decklist: d([["forest", 13], ["deadly_recluse", 4], ["moss_viper", 3], ["treetop_snarespinner", 3], ["giant_growth", 3], ["prey_upon", 2], ["elvish_visionary", 2]]) },
  manowar: { name: "A Bloom of Man-o'-War", color: "U", tier: 1, archetype: "control", decklist: d([["island", 12], ["man_o_war", 4], ["mist_raven", 3], ["waterfront_bouncer", 2], ["boomerang", 3], ["essence_scatter", 2], ["wind_drake", 2], ["cloudkin_seer", 2]]) },
  tactician: { name: "The Cunning Tactician", color: "W", tier: 1, archetype: "aggro", decklist: d([["plains", 12], ["cunning_tactician", 4], ["master_decoy", 3], ["scepter_of_dominance", 2], ["fencing_ace", 3], ["savannah_lions", 2], ["raise_the_alarm", 2], ["pacifism", 2]]) },
  warband: { name: "The Boggart Warband", color: "R", tier: 2, archetype: "aggro", decklist: d([["mountain", 12], ["boggart_brute", 4], ["raging_goblin", 3], ["goblin_piker", 3], ["skirk_prospector", 2], ["hordeling_outburst", 2], ["goblin_chieftain", 2], ["goblin_grenade", 2]]) },
  nighthawk: { name: "A Vampire Nighthawk", color: "B", tier: 2, archetype: "midrange", decklist: d([["swamp", 12], ["vampire_nighthawk", 4], ["child_of_night", 3], ["indulgent_aristocrat", 2], ["blood_artist", 2], ["typhoid_rats", 2], ["doom_blade", 2], ["mind_rot", 2], ["tendrils_of_corruption", 1]]) },
  gale: { name: "The Living Gale", color: "U", tier: 2, archetype: "control", decklist: d([["island", 12], ["air_elemental", 3], ["wind_drake", 3], ["cloudkin_seer", 2], ["aven_fisher", 2], ["gravitational_shift", 2], ["aether_channeler", 2], ["counterspell", 2], ["boomerang", 2]]) },
  siegegang: { name: "The Siege-Gang", color: "R", tier: 3, archetype: "aggro", decklist: d([["mountain", 12], ["siege_gang_commander", 3], ["goblin_matron", 3], ["goblin_chieftain", 3], ["skirk_prospector", 2], ["hordeling_outburst", 2], ["boggart_brute", 2], ["goblin_grenade", 2], ["lightning_bolt", 1]]) },
  specter: { name: "The Hypnotic Specter", color: "B", tier: 3, archetype: "midrange", decklist: d([["swamp", 12], ["hypnotic_specter", 4], ["dark_ritual", 2], ["hymn_to_tourach", 2], ["duress", 2], ["waste_not", 2], ["doom_blade", 2], ["phyrexian_rager", 2], ["mind_rot", 1], ["tendrils_of_corruption", 1]]) },
  serra: { name: "The Serra Angel", color: "W", tier: 3, archetype: "control", decklist: d([["plains", 12], ["serra_angel", 3], ["youthful_valkyrie", 3], ["inspiring_overseer", 2], ["restoration_angel", 2], ["glorious_anthem", 2], ["swords_to_plowshares", 2], ["pacifism", 2], ["wrath_of_god", 1], ["raise_the_alarm", 1]]) },
  wurm: { name: "The Pelakka Wurm", color: "G", tier: 3, archetype: "midrange", decklist: d([["forest", 12], ["pelakka_wurm", 3], ["gaean_wurm", 3], ["baru_wurmspeaker", 2], ["llanowar_elves", 3], ["rampant_growth", 3], ["rumbling_baloth", 2], ["prey_upon", 2]]) },
};
