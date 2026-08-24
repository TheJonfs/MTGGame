/**
 * S20 (dungeon-design §9, Chris-verdicted): the five Mox-dungeon guardian decklists — 40 cards,
 * signature ×3, full pool including the R drawer. Reya carries Chris's swap (Restoration Angel →
 * Cunning Tactician). Sim infrastructure first (fuzz coverage of the four new legendaries before
 * fixtures); the dungeon content layer references these by key.
 */
export type GuardianDecklist = { cardId: string; count: number }[];
const d = (pairs: [string, number][]): GuardianDecklist => pairs.map(([cardId, count]) => ({ cardId, count }));

export const GUARDIAN_DECKS: Record<string, { name: string; color: "W" | "U" | "B" | "R" | "G"; archetype: "aggro" | "midrange" | "control"; decklist: GuardianDecklist }> = {
  reya: {
    name: "Reya Dawnbringer", color: "W", archetype: "control",
    decklist: d([["plains", 16], ["reya_dawnbringer", 3], ["serra_angel", 2], ["wrath_of_god", 2], ["swords_to_plowshares", 3], ["pacifism", 3], ["cunning_tactician", 2], ["inspiring_overseer", 2], ["youthful_valkyrie", 3], ["master_decoy", 2], ["raise_the_alarm", 2]]),
  },
  arcanis: {
    name: "Arcanis the Omnipotent", color: "U", archetype: "control",
    decklist: d([["island", 17], ["arcanis_the_omnipotent", 3], ["air_elemental", 2], ["faerie_formation", 2], ["man_o_war", 3], ["mist_raven", 2], ["aether_channeler", 2], ["wind_drake", 2], ["cloudkin_seer", 2], ["divination", 2], ["essence_scatter", 2], ["control_magic", 1]]),
  },
  drana: {
    name: "Drana, Kalastria Bloodchief", color: "B", archetype: "midrange",
    decklist: d([["swamp", 16], ["drana_kalastria_bloodchief", 3], ["hypnotic_specter", 2], ["nekrataal", 2], ["doom_blade", 2], ["terror", 2], ["hymn_to_tourach", 2], ["demonic_tutor", 1], ["phyrexian_rager", 2], ["vampire_nighthawk", 2], ["child_of_night", 2], ["gravedigger", 2], ["zombify", 2]]),
  },
  drakuseth: {
    name: "Drakuseth, Maw of Flames", color: "R", archetype: "midrange",
    decklist: d([["mountain", 17], ["drakuseth_maw_of_flames", 3], ["siege_gang_commander", 2], ["lightning_bolt", 3], ["shock", 2], ["pyroclasm", 2], ["blaze", 2], ["hill_giant", 2], ["boggart_brute", 2], ["goblin_chieftain", 2], ["hordeling_outburst", 2], ["gray_ogre", 1]]),
  },
  titania: {
    name: "Titania, Protector of Argoth", color: "G", archetype: "midrange",
    decklist: d([["forest", 12], ["evolving_wilds", 4], ["tranquil_thicket", 3], ["titania_protector_of_argoth", 3], ["pelakka_wurm", 2], ["gaean_wurm", 2], ["llanowar_elves", 3], ["rampant_growth", 2], ["rumbling_baloth", 2], ["prey_upon", 2], ["giant_growth", 2], ["werebear", 2], ["baru_wurmspeaker", 1]]),
  },
};
for (const [k, g] of Object.entries(GUARDIAN_DECKS)) {
  const n = g.decklist.reduce((s, e) => s + e.count, 0);
  if (n !== 40) throw new Error(`guardian ${k}: ${n} cards (§9 says 40)`);
}
