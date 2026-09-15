import type { CardDef } from "@shandalar/cards";
import { labDecks, savedWorldDecks, type LabDeck } from "../lab/lab-decks.js";
import { deckUnlocked, readUnlocked } from "../seen.js";

/**
 * S37 (ADR-123; Chris): the production single-match picker — the Lab's catalogue (the mages, the beasts,
 * the bosses) plus the world save's SAVED DECKS, behind the gallery's unlock rule: a deck is offered only
 * when every prizeOnly card in it has been met in a duel or is owned. `revealAll` is the deploy's `?all=1`
 * bypass, as in the gallery. The saved decks pass by construction (their cards are owned).
 */
export const PLAY_GROUPS: { group: LabDeck["group"]; title: string }[] = [
  { group: "saved", title: "Your saved decks" },
  { group: "mages", title: "The mages" },
  { group: "beasts", title: "The beasts" },
  { group: "bosses", title: "The bosses you have met" },
];

export function playRoster(pool: Map<string, CardDef>, opts: { revealAll?: boolean; storage?: Pick<Storage, "getItem" | "setItem"> | null } = {}): LabDeck[] {
  const storage = opts.storage === undefined ? (typeof localStorage !== "undefined" ? localStorage : null) : opts.storage;
  const unlocked = readUnlocked(storage);
  const all = [...savedWorldDecks(storage), ...labDecks("standard")];
  return all.filter((d) => PLAY_GROUPS.some((g) => g.group === d.group)).filter((d) => opts.revealAll || deckUnlocked(d.decklist, pool, unlocked));
}
