/**
 * S25 (mox-court.md, Chris-designed, planner-drafted v1; ADR-088): the Mox court's decklists —
 * 40 cards, mono, Moxen-class, signature ×3. The great swap: the five real legends (and their
 * S20 decks in guardian-decks.ts) moved to the power-dungeons; these five guard the Moxen.
 * guardian-sim tunes them; the world content layer references them by key.
 */
export type CourtDecklist = { cardId: string; count: number }[];
const d = (pairs: [string, number][]): CourtDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

export const COURT_DECKS: Record<string, { name: string; color: "W" | "U" | "B" | "R" | "G"; archetype: "aggro" | "midrange" | "control"; decklist: CourtDecklist }> = {
  pearl_cleric: {
    name: "The Pearl Cleric", color: "W", archetype: "control",
    decklist: d([["plains", 16], ["the_pearl_cleric", 3], ["serra_angel", 2], ["restoration_angel", 2], ["pacifism", 3], ["swords_to_plowshares", 2], ["master_decoy", 2], ["youthful_valkyrie", 2], ["inspiring_overseer", 2], ["fencing_ace", 2], ["raise_the_alarm", 2], ["glorious_anthem", 2]]),
  },
  sapphire_sage: {
    name: "The Sapphire Sage", color: "U", archetype: "control",
    decklist: d([["island", 16], ["the_sapphire_sage", 3], ["air_elemental", 2], ["man_o_war", 2], ["mist_raven", 2], ["aether_channeler", 2], ["cloudkin_seer", 2], ["wind_drake", 2], ["counterspell", 2], ["essence_scatter", 2], ["boomerang", 2], ["divination", 2], ["control_magic", 1]]),
  },
  jet_witch: {
    name: "The Jet Witch", color: "B", archetype: "midrange",
    decklist: d([["swamp", 16], ["the_jet_witch", 3], ["hypnotic_specter", 2], ["vampire_nighthawk", 2], ["doom_blade", 2], ["terror", 2], ["duress", 2], ["child_of_night", 2], ["phyrexian_rager", 2], ["gravedigger", 2], ["mind_rot", 2], ["tendrils_of_corruption", 2], ["hymn_to_tourach", 1]]),
  },
  ruby_tyrant: {
    name: "The Ruby Tyrant", color: "R", archetype: "aggro",
    decklist: d([["mountain", 16], ["the_ruby_tyrant", 3], ["lightning_bolt", 3], ["shock", 2], ["goblin_chieftain", 2], ["boggart_brute", 2], ["hill_giant", 2], ["hordeling_outburst", 2], ["pyroclasm", 2], ["blaze", 2], ["brute_force", 2], ["thundersnake", 2]]),
  },
  emerald_keeper: {
    name: "The Emerald Keeper", color: "G", archetype: "midrange",
    decklist: d([["forest", 17], ["the_emerald_keeper", 3], ["llanowar_elves", 3], ["rampant_growth", 2], ["elvish_visionary", 2], ["grizzly_bears", 2], ["centaur_courser", 2], ["rumbling_baloth", 2], ["gaean_wurm", 2], ["giant_growth", 2], ["prey_upon", 2], ["pelakka_wurm", 1]]),
  },
};
for (const [k, g] of Object.entries(COURT_DECKS)) {
  const n = g.decklist.reduce((s, e) => s + e.count, 0);
  if (n !== 40) throw new Error(`court ${k}: ${n} cards (mox-court.md says 40)`);
}
