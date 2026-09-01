/**
 * S26 (the-bloom-gauntlet-v1.md v1.2, planner-drafted around Chris's skeletons; ADR-091): the
 * Corolla's five still-pair decks — 40 cards, the pair's ABU dual + shock, signature ×3. Each
 * fights at its petal's tip under the chamber's returned law (the still pair is the complement of
 * the lord whose law it is). petal-sim tunes them; the world content layer references them by key.
 */
export type CorollaDecklist = { cardId: string; count: number }[];
const d = (pairs: [string, number][]): CorollaDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

export type StillPair = "WR" | "UB" | "BG" | "RG" | "WU";

export const COROLLA_DECKS: Record<string, { name: string; pair: StillPair; signature: string; archetype: "aggro" | "midrange" | "control"; decklist: CorollaDecklist }> = {
  lumen: {
    name: "Lumen, the Hearth Fire", pair: "WR", signature: "lumen_the_hearth_fire", archetype: "aggro",
    decklist: d([["plains", 6], ["mountain", 6], ["plateau", 2], ["sacred_foundry", 2], ["lumen_the_hearth_fire", 3], ["lightning_bolt", 3], ["shock", 2], ["savannah_lions", 2], ["fencing_ace", 2], ["master_decoy", 2], ["boggart_brute", 2], ["hordeling_outburst", 2], ["glorious_anthem", 2], ["swords_to_plowshares", 2], ["pacifism", 2]]),
  },
  clio: {
    name: "Clio, Lady of the Depths", pair: "UB", signature: "clio_lady_of_the_depths", archetype: "control",
    decklist: d([["island", 6], ["swamp", 6], ["underground_sea", 2], ["watery_grave", 2], ["clio_lady_of_the_depths", 3], ["counterspell", 2], ["essence_scatter", 2], ["doom_blade", 2], ["terror", 2], ["mind_rot", 2], ["hymn_to_tourach", 2], ["man_o_war", 2], ["phyrexian_rager", 2], ["divination", 2], ["air_elemental", 2], ["hypnotic_specter", 1]]),
  },
  seraphina: {
    name: "Seraphina, the Initiative", pair: "BG", signature: "seraphina_the_initiative", archetype: "midrange",
    decklist: d([["swamp", 6], ["forest", 6], ["bayou", 2], ["overgrown_tomb", 2], ["seraphina_the_initiative", 3], ["doom_blade", 2], ["duress", 2], ["prey_upon", 2], ["deadly_recluse", 2], ["moss_viper", 2], ["llanowar_elves", 2], ["vampire_nighthawk", 2], ["gravedigger", 2], ["werebear", 2], ["rumbling_baloth", 2], ["pelakka_wurm", 1]]),
  },
  yuloke: {
    name: "Yuloke, the Animus", pair: "RG", signature: "yuloke_the_animus", archetype: "aggro",
    decklist: d([["forgotten_cave", 4], ["tranquil_thicket", 4], ["evolving_wilds", 4], ["mountain", 3], ["forest", 3], ["taiga", 2], ["stomping_ground", 2], ["yuloke_the_animus", 3], ["llanowar_elves", 3], ["rampant_growth", 2], ["lightning_bolt", 2], ["gaean_wurm", 2], ["rumbling_baloth", 2], ["giant_growth", 2], ["thundersnake", 2]]),
  },
  faldor: {
    name: "Faldor, the Muster", pair: "WU", signature: "faldor_the_muster", archetype: "midrange",
    decklist: d([["plains", 6], ["island", 6], ["tundra", 2], ["hallowed_fountain", 2], ["faldor_the_muster", 3], ["divination", 2], ["cloudkin_seer", 2], ["inspiring_overseer", 2], ["aether_channeler", 2], ["restoration_angel", 2], ["raise_the_alarm", 2], ["glorious_anthem", 2], ["counterspell", 2], ["swords_to_plowshares", 2], ["pacifism", 2], ["serra_angel", 1]]),
  },
};
for (const [k, g] of Object.entries(COROLLA_DECKS)) {
  const n = g.decklist.reduce((s, e) => s + e.count, 0);
  if (n !== 40) throw new Error(`corolla ${k}: ${n} cards (the gauntlet doc says 40)`);
}
