import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
/** S66: the pool with the cards under study (data/cards-proposed — Hallowed Rites and the four Sextons). */
export const poolWithProposed = () => {
  const cards = loadCardPool(join(ROOT, "data/cards")).cards;
  for (const f of readdirSync(join(ROOT, "data/cards-proposed")).filter((x) => x.endsWith(".json"))) { const d = JSON.parse(readFileSync(join(ROOT, "data/cards-proposed", f), "utf8")) as CardDef; cards.set(d.id, d); }
  return cards;
};
/**
 * S66 fuzz-before-fixtures — R-115 (a graveyard card to the bottom of its owner's library): Hallowed Rites and the four
 * Sextons beside everything that returns, uses or moves graveyard cards — the Usher's loop, Zombify, Buried Alive,
 * Entomb, Gravedigger, Karmic Mentor, Reassembling Skeleton's own return, Rancor's return to hand — and the other
 * graveyard hate (Tormod's Crypt, Faerie Macabre) racing it for the same card.
 */
export const S66H_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "hallow-white", decklist: D({ hallowed_rites: 4, sexton_sac: 2, sexton_tap: 2, sexton_tap_nolife: 2, sexton_paid: 2, karmic_mentor: 4, raise_the_alarm: 4, swords_to_plowshares: 4, tormods_crypt: 2, plains: 20, savannah: 4, rancor: 2, reassembling_skeleton: 4, scrubland: 4 }) },
  { name: "hallow-control", decklist: D({ hallowed_rites: 4, sexton_paid: 4, sexton_sac: 2, wrath_of_god: 2, swords_to_plowshares: 4, vindicate: 4, the_usher: 2, vampire_nighthawk: 4, blood_artist: 4, scrubland: 4, plateau: 4, badlands: 4, plains: 8, swamp: 10 }) },
  { name: "pyre-red", decklist: D({ pyre_rites: 4, pyre_rites_3: 2, pyre_rites_r: 2, pyre_rites_split: 4, goblin_chieftain: 4, raging_goblin: 4, young_pyromancer: 4, seasoned_pyromancer: 2, lightning_bolt: 4, mountain: 18, badlands: 4, tormods_crypt: 2, reassembling_skeleton: 2, gravedigger: 2, swamp: 2 }) },
  { name: "warder-white", decklist: D({ hallowed_warder_14: 2, hallowed_warder_23: 2, vigil_keeper_22: 2, vigil_keeper_13: 2, wrath_of_god: 2, swords_to_plowshares: 4, blood_artist: 4, raise_the_alarm: 4, lightning_bolt: 4, goblin_chieftain: 2, siege_gang_commander: 2, plains: 14, plateau: 4, mountain: 6, scrubland: 4, swamp: 2 }) },
  { name: "usher-loop", decklist: D({ the_usher: 4, zombify: 4, buried_alive: 4, entomb: 2, gravedigger: 4, reassembling_skeleton: 4, faerie_macabre: 2, hallowed_rites: 2, sexton_tap: 2, scrubland: 4, badlands: 4, plateau: 4, swamp: 12, plains: 4, mountain: 4 }) },
];
