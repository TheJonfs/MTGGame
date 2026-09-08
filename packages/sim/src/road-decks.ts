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
};
