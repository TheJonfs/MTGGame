/**
 * S28 (Part 2c): the END-GAME references — real decks players have walked to the Heart with,
 * reconstructed for heart-sim and for the dev-only single-battle option (Chris pilots them against
 * the rooted Manafleur). Each carries the entrance it fought with: its manalink basics and its world
 * life at the door. Every id is validated against the pool where it is used.
 */
export type RoadDecklist = { cardId: string; count: number }[];
const d = (pairs: [string, number][]): RoadDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

export const ROAD_DECKS: Record<string, { name: string; archetype: "aggro" | "midrange" | "control"; life: number; entrance: string[]; decklist: RoadDecklist }> = {
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
