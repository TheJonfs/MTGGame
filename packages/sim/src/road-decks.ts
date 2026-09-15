/**
 * S28 (Part 2c): the END-GAME references — real decks players have walked to the Heart with,
 * reconstructed for heart-sim and for the dev-only single-battle option (Chris pilots them against
 * the rooted Manafleur). Each carries the entrance it fought with: its manalink basics and its world
 * life at the door. Every id is validated against the pool where it is used.
 */
export type RoadDecklist = { cardId: string; count: number }[];
const d = (pairs: [string, number][]): RoadDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

export const ROAD_DECKS: Record<string, { name: string; archetype: "aggro" | "midrange" | "control"; life: number; entrance: string[]; decklist: RoadDecklist }> = {
  /** S32 (ADR-111, the tier yardstick): the MID-ROAD references — a starter as a mid-road player would
   * hold it (the amended list plus eight tier-1/2 shop cards, one basic in play as a manalink, 12 life,
   * journeyman). `road-mid-W` = Dawn Levy + 2 Swords, 1 Anthem, 1 Serra, 1 Resto, 1 Soul Warden,
   * 1 Master Decoy, 1 Plains; `road-mid-B` = the Pallid Court + 2 Doom Blade, 1 Hymn, 1 Nighthawk,
   * 1 Gravedigger, 1 Unearth, 1 Dark Ritual, 1 Swamp (38 each). A world test keeps each in sync with
   * its starter (data/world/starters.json) — edit the starter, then these. */
  roadMidW: {
    name: "road-mid-W", archetype: "aggro", life: 12, entrance: ["plains"],
    decklist: d([
      ["plains", 14], ["suntail_hawk", 4], ["fencing_ace", 2], ["savannah_lions", 2], ["cunning_tactician", 1], ["raise_the_alarm", 1],
      ["pacifism", 2], ["swords_to_plowshares", 3], ["glorious_anthem", 2], ["youthful_valkyrie", 1], ["inspiring_overseer", 1], ["master_decoy", 2],
      ["serra_angel", 1], ["restoration_angel", 1], ["soul_warden", 1],
    ]),
  },
  roadMidB: {
    name: "road-mid-B", archetype: "midrange", life: 12, entrance: ["swamp"],
    decklist: d([
      ["swamp", 14], ["typhoid_rats", 3], ["child_of_night", 3], ["vampire_nighthawk", 3], ["phyrexian_rager", 2], ["duress", 2], ["mind_rot", 2],
      ["doom_blade", 3], ["terror", 1], ["gravedigger", 2], ["hymn_to_tourach", 1], ["unearth", 1], ["dark_ritual", 1],
    ]),
  },
  /** Chris's final-fight deck from the black road (v1's first clean run; S28 brief 2c): 30 cards, four
   * basics in play (no Forest), 17 world life. */
  chrisRoadB: {
    name: "chris-road-B", archetype: "midrange", life: 17, entrance: ["plains", "island", "swamp", "mountain"],
    decklist: d([
      ["badlands", 2], ["plateau", 2], ["scrubland", 1],
      ["mox_jet", 1], ["mox_ruby", 1], ["mox_pearl", 1], ["mox_emerald", 1], ["mox_sapphire", 1], ["black_lotus", 1],
      ["lightning_bolt", 2], ["abrade", 1], ["blaze", 2], ["vindicate", 2],
      ["thundersnake", 1], ["the_ruby_tyrant", 1], ["restoration_angel", 1], ["serra_angel", 2],
      ["the_jet_witch", 1], ["vampire_nighthawk", 2], ["the_usher", 1], ["the_stoker", 1],
      ["lumen_the_hearth_fire", 1], ["clio_lady_of_the_depths", 1],
    ]),
  },
  /** S39 (ADR-126, the brief's Part 4): the SALVAGE YARDSTICKS — phase two's floor: two decks from the salvage
   * pack (data/world/salvage-pack.json) plus one pick set each (two duals), thirty cards, twelve lands, 12 life,
   * journeyman, no basics in play, no legends. What the flood's player holds before the shop and the road. */
  salvageWR: {
    name: "salvage-WR", archetype: "aggro", life: 12, entrance: [],
    decklist: d([
      ["plateau", 1], ["sacred_foundry", 1], ["plains", 5], ["mountain", 5],
      ["savannah_lions", 1], ["suntail_hawk", 1], ["soul_warden", 1], ["fencing_ace", 1], ["youthful_valkyrie", 1], ["inspiring_overseer", 1], ["pacifism", 1], ["swords_to_plowshares", 1],
      ["young_pyromancer", 1], ["goblin_piker", 1], ["boggart_brute", 1], ["goblin_chieftain", 1], ["thundersnake", 1], ["lightning_bolt", 1], ["shock", 1], ["abrade", 1], ["hordeling_outburst", 1],
      ["bonesplitter", 1],
    ]),
  },
  salvageUB: {
    name: "salvage-UB", archetype: "midrange", life: 12, entrance: [],
    decklist: d([
      ["underground_sea", 1], ["watery_grave", 1], ["island", 5], ["swamp", 5],
      ["plumecreed_escort", 1], ["man_o_war", 1], ["cloudkin_seer", 1], ["wind_drake", 1], ["aether_channeler", 1], ["air_elemental", 1], ["brainstorm", 1], ["counterspell", 1], ["essence_scatter", 1],
      ["typhoid_rats", 1], ["child_of_night", 1], ["vampire_nighthawk", 1], ["phyrexian_rager", 1], ["gravedigger", 1], ["nekrataal", 1], ["terror", 1], ["doom_blade", 1],
      ["mind_stone", 1],
    ]),
  },
};
