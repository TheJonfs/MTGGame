/**
 * S40 (ADR-128; docs/phase-two-legends-working.md §8, the planner's drafts after Chris's pass): the flood's ten
 * lists — five stronghold lords and five court ministers, forty cards each, generated from the document's
 * code blocks (every name resolved against the pool). `law` is the seat's law colour; a court carries its High
 * Ground as `ground` — on the entrance, never in the list (§6: the courts fight on their own ground). S41 moves
 * these into the catalog; until then they are the fuzz's and the Lab's decks.
 */
export type FloodDecklist = { cardId: string; count: number }[];
const d = (pairs: [string, number][]): FloodDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

export const FLOOD_DECKS: Record<string, { name: string; seat: string; law: "W" | "U" | "B" | "R" | "G"; kind: "lord" | "court"; ground?: string; decklist: FloodDecklist }> = {
  bailiff: {
    name: "The Bailiff", seat: "Tidelock Weir", law: "W", kind: "lord",
    decklist: d([["plains", 4], ["island", 3], ["mountain", 3], ["tundra", 1], ["plateau", 1], ["volcanic_island", 1], ["hallowed_fountain", 1], ["sacred_foundry", 1], ["steam_vents", 1], ["secluded_steppe", 1], ["the_bailiff", 3], ["static_sphere", 2], ["sacred_helix", 2], ["plumecreed_escort", 2], ["restoration_angel", 1], ["man_o_war", 2], ["aether_channeler", 1], ["serra_angel", 1], ["master_decoy", 1], ["cunning_tactician", 1], ["lightning_bolt", 2], ["swords_to_plowshares", 1], ["counterspell", 2], ["essence_scatter", 1], ["boomerang", 1]]),
  },
  reeve: {
    name: "The Reeve", seat: "Marrowfen", law: "B", kind: "lord",
    decklist: d([["swamp", 4], ["island", 3], ["forest", 3], ["underground_sea", 1], ["bayou", 1], ["tropical_island", 1], ["watery_grave", 1], ["overgrown_tomb", 1], ["breeding_pool", 1], ["barren_moor", 1], ["the_reeve", 3], ["glimpse_the_unthinkable", 2], ["putrefy", 2], ["hedron_crab", 3], ["thought_scour", 2], ["buried_alive", 1], ["zombify", 1], ["gravedigger", 1], ["gaean_wurm", 2], ["pelakka_wurm", 1], ["artisan_of_kozilek", 1], ["nekrataal", 1], ["deadly_recluse", 1], ["doom_blade", 1], ["counterspell", 1]]),
  },
  fordkeeper: {
    name: "The Fordkeeper", seat: "Emberford", law: "R", kind: "lord",
    decklist: d([["mountain", 4], ["plains", 3], ["forest", 3], ["plateau", 1], ["taiga", 1], ["savannah", 1], ["sacred_foundry", 1], ["stomping_ground", 1], ["temple_garden", 1], ["forgotten_cave", 1], ["evolving_wilds", 1], ["the_fordkeeper", 3], ["powerstone_minefield", 2], ["savage_twister", 2], ["lightning_bolt", 2], ["shock", 1], ["blaze", 1], ["pyroclasm", 1], ["abrade", 1], ["rampant_growth", 2], ["wood_elves", 2], ["llanowar_elves", 1], ["glare_of_subdual", 1], ["rumbling_baloth", 1], ["frondland_felidar", 1], ["serra_angel", 1]]),
  },
  dredger: {
    name: "The Dredger", seat: "Lockmere", law: "U", kind: "lord",
    decklist: d([["island", 3], ["plains", 3], ["swamp", 3], ["tundra", 1], ["scrubland", 1], ["underground_sea", 1], ["hallowed_fountain", 1], ["godless_shrine", 1], ["watery_grave", 1], ["lonely_sandbar", 1], ["secluded_steppe", 1], ["barren_moor", 1], ["the_dredger", 3], ["undermine", 2], ["absorb", 2], ["wrath_of_god", 1], ["vindicate", 2], ["swords_to_plowshares", 1], ["doom_blade", 1], ["counterspell", 1], ["hymn_to_tourach", 1], ["duress", 1], ["graceful_restoration", 1], ["divination", 1], ["brainstorm", 1], ["serra_angel", 1], ["restoration_angel", 1], ["vampire_nighthawk", 1], ["air_elemental", 1]]),
  },
  reaper: {
    name: "The Reaper", seat: "Harrowmoor", law: "G", kind: "lord",
    decklist: d([["forest", 4], ["swamp", 3], ["mountain", 3], ["bayou", 1], ["taiga", 1], ["badlands", 1], ["overgrown_tomb", 1], ["stomping_ground", 1], ["blood_crypt", 1], ["tranquil_thicket", 1], ["the_reaper", 3], ["poison_tip_archer", 2], ["voracious_cobra", 2], ["moss_viper", 1], ["skirk_prospector", 2], ["hordeling_outburst", 1], ["bitterblossom", 1], ["blood_artist", 1], ["indulgent_aristocrat", 1], ["char", 1], ["llanowar_elves", 1], ["deadly_recluse", 1], ["rumbling_baloth", 1], ["gaean_wurm", 1], ["gravedigger", 1], ["rancor", 1], ["lightning_bolt", 1], ["terror", 1]]),
  },
  odile: {
    name: "Odile, the Tallyflame", seat: "Tallyflame Court", law: "W", kind: "court", ground: "tallyflame_court",
    decklist: d([["island", 7], ["mountain", 6], ["volcanic_island", 1], ["steam_vents", 1], ["lonely_sandbar", 1], ["forgotten_cave", 1], ["odile_the_tallyflame", 3], ["brainstorm", 2], ["thought_scour", 2], ["divination", 1], ["cloudkin_seer", 2], ["curiosity", 1], ["young_pyromancer", 2], ["arc_mage", 1], ["man_o_war", 1], ["wind_drake", 1], ["air_elemental", 1], ["lightning_bolt", 2], ["shock", 1], ["pyroclasm", 1], ["counterspell", 1], ["aetherbolt", 1]]),
  },
  zinnia: {
    name: "Zinnia, the Undertow", seat: "The Wrackroot Shallows", law: "B", kind: "court", ground: "wrackroot",
    decklist: d([["island", 7], ["forest", 6], ["tropical_island", 1], ["breeding_pool", 1], ["evolving_wilds", 1], ["tranquil_thicket", 1], ["zinnia_the_undertow", 3], ["man_o_war", 2], ["mist_raven", 1], ["aether_channeler", 1], ["boomerang", 2], ["temporal_spring", 1], ["aether_mutation", 1], ["mystic_snake", 1], ["hedron_crab", 2], ["prey_upon", 2], ["altar_of_dementia", 1], ["rampant_growth", 1], ["wall_of_blossoms", 2], ["rumbling_baloth", 1], ["essence_scatter", 1], ["counterspell", 1]]),
  },
  ovna: {
    name: "Ovna, the Enchantress", seat: "Shevelport Green", law: "R", kind: "court", ground: "shevelport",
    decklist: d([["forest", 6], ["plains", 6], ["savannah", 1], ["temple_garden", 1], ["secluded_steppe", 1], ["tranquil_thicket", 1], ["evolving_wilds", 1], ["ovna_the_enchantress", 3], ["pacifism", 3], ["glare_of_subdual", 2], ["blanchwood_armor", 2], ["rancor", 2], ["spirit_link", 2], ["glorious_anthem", 1], ["gladecover_scout", 2], ["blurred_mongoose", 1], ["frondland_felidar", 1], ["soul_warden", 1], ["inspiring_overseer", 1], ["wall_of_blossoms", 1], ["swords_to_plowshares", 1]]),
  },
  isaura: {
    name: "Isaura, the Levy", seat: "The Obsidian Observatory", law: "U", kind: "court", ground: "obsidian_observatory",
    decklist: d([["plains", 5], ["swamp", 5], ["secluded_steppe", 4], ["barren_moor", 4], ["scrubland", 1], ["godless_shrine", 1], ["isaura_the_levy", 3], ["raise_the_alarm", 3], ["shadow_summoning", 2], ["bitterblossom", 2], ["soul_warden", 1], ["blood_artist", 1], ["indulgent_aristocrat", 1], ["vampire_nighthawk", 1], ["serra_angel", 1], ["glorious_anthem", 1], ["vindicate", 2], ["graceful_restoration", 1], ["swords_to_plowshares", 1]]),
  },
  meliyan: {
    name: "Meliyan, the Torment", seat: "Cairnbrand Pyre", law: "G", kind: "court", ground: "cairnbrand",
    decklist: d([["swamp", 7], ["mountain", 6], ["badlands", 1], ["blood_crypt", 1], ["barren_moor", 1], ["forgotten_cave", 1], ["meliyan_the_torment", 3], ["tainted_phoenix", 2], ["phyrexian_purge", 1], ["typhoid_rats", 2], ["reassembling_skeleton", 1], ["child_of_night", 1], ["vampire_nighthawk", 1], ["goblin_piker", 1], ["boggart_brute", 1], ["goblin_chieftain", 1], ["thundersnake", 1], ["hordeling_outburst", 2], ["goblin_grenade", 1], ["blood_artist", 1], ["indulgent_aristocrat", 1], ["lightning_bolt", 1], ["shock", 1], ["terror", 1]]),
  },
};
