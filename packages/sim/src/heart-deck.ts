/**
 * S27 (the-bloom-gauntlet-v1.md v1.4; ADR-093): THE MANAFLEUR'S DECK — sixty, every authored card
 * in the game in one pile: the ten ABU duals, the ten shocks (the five basics are the ROOTS, ADR-096); the Manafleur ×3,
 * the five ministers, the five court, the five mono customs, the five Moxen, the ten flowing-pair
 * golds, two flex (Wrath of God, Control Magic — strawmen). Half mana, greedy and explosive; the
 * Arzakon texture. All prizeOnly cards legal under the never-stakes ruling. heart-sim tunes.
 */
export type HeartDecklist = { cardId: string; count: number }[];
const one = (ids: string[]): HeartDecklist => ids.map((cardId) => ({ cardId, count: 1 }));

export const HEART_DECK: { name: string; archetype: "aggro" | "midrange" | "control"; signature: string; decklist: HeartDecklist } = {
  name: "The Manafleur",
  archetype: "midrange",
  signature: "the_manafleur",
  decklist: [
    { cardId: "the_manafleur", count: 3 },
    ...one(["tundra", "underground_sea", "badlands", "taiga", "savannah", "scrubland", "volcanic_island", "bayou", "plateau", "tropical_island"]),
    ...one(["hallowed_fountain", "watery_grave", "blood_crypt", "stomping_ground", "temple_garden", "godless_shrine", "steam_vents", "overgrown_tomb", "sacred_foundry", "breeding_pool"]),
    // ADR-096 (S28): the five basics LEFT the sixty — they are the ROOTS, on the battlefield before
    // turn one (heartRootModifiers) — and five defensive one-per-colour slots took their place
    // (Chris's five: the flower buys time for the petals; it does not race).
    ...one(["disenchant", "counterspell", "doom_blade", "lightning_bolt", "prey_upon"]),
    ...one(["lumen_the_hearth_fire", "clio_lady_of_the_depths", "seraphina_the_initiative", "yuloke_the_animus", "faldor_the_muster"]),
    ...one(["the_pearl_cleric", "the_sapphire_sage", "the_jet_witch", "the_ruby_tyrant", "the_emerald_keeper"]),
    ...one(["cunning_tactician", "thundersnake", "gaean_wurm", "traumatizer", "gallows_djinn"]),
    ...one(["mox_pearl", "mox_sapphire", "mox_jet", "mox_ruby", "mox_emerald"]),
    // S27 r2 (Chris): Experimental Overload OUT (cast into an empty graveyard — the count is nothing in a
    // 60 with three instants and sorceries), Faerie Formation IN (a flex slot; the "every gold" conceit bends).
    ...one(["aether_mutation", "aetherbolt", "graceful_restoration", "phyrexian_purge", "faerie_formation", "glare_of_subdual", "vindicate", "temporal_spring", "frondland_felidar", "mystic_snake"]),
    ...one(["wrath_of_god", "control_magic"]),
  ],
};
{
  const n = HEART_DECK.decklist.reduce((s, e) => s + e.count, 0);
  if (n !== 60) throw new Error(`heart deck: ${n} cards (the gauntlet doc says 60)`);
}

/** S42a (ADR-131): THE CINQUEFONT'S DECK — the Manafleur's sixty with the three Manafleurs replaced by three
 * Cinquefonts; the ring's conceit unchanged. The tide's order rides the card (`createLaw.order`), so the list
 * needs nothing else; the duel declares `lawSequence` mode `tide`. */
export const FOUNT_DECK: typeof HEART_DECK = {
  name: "The Cinquefont",
  archetype: HEART_DECK.archetype,
  signature: "the_cinquefont",
  decklist: HEART_DECK.decklist.map((e) => (e.cardId === HEART_DECK.signature ? { cardId: "the_cinquefont", count: e.count } : { ...e })),
};
/** The tide's order (ADR-132): the Risen Tide, the Season, the Intake, the Tithe, the Toll. */
export const TIDE_ORDER = ["law_risen_tide", "law_season", "law_intake", "law_tithe", "law_toll"];
