import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
/** The study's Mentor: Karmic Mentor's return widened to any permanent card, Auras included (R-114). */
export const mentorAura = (cards: Map<string, CardDef>): CardDef => {
  const m = JSON.parse(JSON.stringify(cards.get("karmic_mentor")!)) as CardDef & { abilities: { targets?: { predicate: string }[] }[] };
  m.id = "karmic_mentor_aura"; m.name = "Karmic Mentor (Auras)";
  m.abilities[0]!.targets![0]!.predicate = "permanentCardInYourGraveyard";
  return m as CardDef;
};
export const poolWithMentorAura = () => { const cards = loadCardPool(CARDS_DIR).cards; cards.set("karmic_mentor_aura", mentorAura(cards)); return cards; };

/**
 * Post-S65 fuzz-before-fixtures — an Aura entering without being cast (R-114, CR 303.4f-g): the Mentor's return of an
 * Aura card, its host chosen as it enters (not targeted: hexproof does not stop it), or no host and it stays. The lists
 * put the five returnable Auras (Pacifism, Rancor, Spirit Link, Protocol, Curiosity) beside hexproof creatures (Gladecover
 * Scout, Dungrove Elder), removal and a sweeper that empty the board (no legal host), Rancor's own return to hand, and the
 * blink of a Mentor (Restoration Angel) — and an opponent with no creatures at all.
 */
export const S65A_LISTS = (): { name: string; decklist: { cardId: string; count: number }[] }[] => [
  { name: "aura-white", decklist: D({ karmic_mentor_aura: 4, pacifism: 4, spirit_link: 4, youthful_valkyrie: 4, restoration_angel: 4, swords_to_plowshares: 4, wrath_of_god: 2, plains: 22, rancor: 4, savannah: 4, forest: 4 }) },
  { name: "aura-ug", decklist: D({ karmic_mentor_aura: 4, protocol: 4, curiosity: 4, rancor: 4, gladecover_scout: 4, dungrove_elder: 4, tundra: 4, tropical_island: 4, island: 8, forest: 8, plains: 4, doom_blade: 4, swamp: 4 }) },
  { name: "no-creatures", decklist: D({ wrath_of_god: 4, swords_to_plowshares: 4, plains: 52 }) },
];

