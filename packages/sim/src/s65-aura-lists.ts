import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
/** Post-S65: the study's Mentor (Auras allowed) is the printed Mentor now — the pool as it stands. */
export const poolWithMentorAura = () => loadCardPool(CARDS_DIR).cards;

/**
 * Post-S65 fuzz-before-fixtures — an Aura entering without being cast (R-114, CR 303.4f-g): the Mentor's return of an
 * Aura card, its host chosen as it enters (not targeted: hexproof does not stop it), or no host and it stays. The lists
 * put the five returnable Auras (Pacifism, Rancor, Spirit Link, Protocol, Curiosity) beside hexproof creatures (Gladecover
 * Scout, Dungrove Elder), removal and a sweeper that empty the board (no legal host), Rancor's own return to hand, and the
 * blink of a Mentor (Restoration Angel) — and an opponent with no creatures at all.
 */
export const S65A_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "aura-white", decklist: D({ karmic_mentor: 4, pacifism: 4, spirit_link: 4, youthful_valkyrie: 4, restoration_angel: 4, swords_to_plowshares: 4, wrath_of_god: 2, plains: 22, rancor: 4, savannah: 4, forest: 4 }) },
  { name: "aura-ug", decklist: D({ karmic_mentor: 4, protocol: 4, curiosity: 4, rancor: 4, gladecover_scout: 4, dungrove_elder: 4, tundra: 4, tropical_island: 4, island: 8, forest: 8, plains: 4, doom_blade: 4, swamp: 4 }) },
  { name: "no-creatures", decklist: D({ wrath_of_god: 4, swords_to_plowshares: 4, plains: 52 }) },
];

