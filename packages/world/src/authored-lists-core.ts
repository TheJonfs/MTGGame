/**
 * S47 (Part 2): every authored list in one table — the slices, the starters, the mages (both phases), the beasts, the
 * roads, the guardians, the courts, the lords, the Corolla, the Heart and the Fount, the flood's seats, the Open's
 * twelve. The card rating's field today; the Constructed builder's library later (the overview's "forty-odd lists").
 * Node-side (reads data/world); the Lab's browser catalogue (ui/lab/lab-decks) stays its own.
 */
import { DECKS, DECK_ARCHETYPES } from "@shandalar/sim/decks";
import { MAGE_DECKS, mageListFor } from "@shandalar/sim/mage-decks";
import { EXPANSION_DECKS } from "@shandalar/sim/expansion-decks";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { GUARDIAN_DECKS } from "@shandalar/sim/guardian-decks";
import { COURT_DECKS } from "@shandalar/sim/court-decks";
import { LORD_DECKS } from "@shandalar/sim/lord-decks";
import { COROLLA_DECKS } from "@shandalar/sim/corolla-decks";
import { HEART_DECK, FOUNT_DECK } from "@shandalar/sim/heart-deck";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";

export type Archetype = "aggro" | "midrange" | "control";
export interface AuthoredList { key: string; group: string; archetype: Archetype; decklist: { cardId: string; count: number }[] }

export type StarterRow = { id: string; archetype: Archetype; decklist: readonly { cardId: string; count: number }[] };
export type FloodRow = { archetype: Archetype; decklist: readonly { cardId: string; count: number }[] };

/** S52: browser-safe — the same table from the catalog's data (the Convocation's Constructed field builds from it). */
export function authoredListsFrom(starters: readonly StarterRow[], floodDecks: Record<string, FloodRow>): AuthoredList[] {
  const out: AuthoredList[] = [];
  const add = (group: string, key: string, archetype: Archetype | undefined, decklist: readonly { cardId: string; count: number }[]) =>
    out.push({ key: `${group}:${key}`, group, archetype: archetype ?? "midrange", decklist: decklist.map((e) => ({ ...e })) });
  for (const [k, d] of Object.entries(DECKS)) add("slice", k, (DECK_ARCHETYPES as Record<string, Archetype>)[k], d.decklist);
  for (const s of starters) add("starter", s.id, s.archetype, s.decklist);
  for (const [k, d] of Object.entries(MAGE_DECKS)) {
    add("mage", k, d.archetype, d.decklist);
    const flood = mageListFor(k, 2)!;
    if (JSON.stringify(flood.decklist) !== JSON.stringify(d.decklist)) add("mage2", k, flood.archetype, flood.decklist);
  }
  for (const [k, d] of Object.entries(EXPANSION_DECKS)) add("beast", k, d.archetype, d.decklist);
  for (const [k, d] of Object.entries(ROAD_DECKS)) add("road", k, d.archetype, d.decklist);
  for (const [k, d] of Object.entries(GUARDIAN_DECKS)) add("guardian", k, d.archetype, d.decklist);
  for (const [k, d] of Object.entries(COURT_DECKS)) add("court", k, d.archetype, d.decklist);
  for (const [k, d] of Object.entries(LORD_DECKS)) add("lord", k, d.archetype, d.decklist);
  for (const [k, d] of Object.entries(COROLLA_DECKS)) add("corolla", k, d.archetype, d.decklist);
  add("heart", "manafleur", HEART_DECK.archetype, HEART_DECK.decklist);
  add("heart", "fount", FOUNT_DECK.archetype, FOUNT_DECK.decklist);
  for (const [k, d] of Object.entries(floodDecks)) add("flood", k, d.archetype, d.decklist);
  for (const [k, d] of Object.entries(OPEN_DECKS)) add("open", k, d.archetype as Archetype, d.decklist);
  return out;
}
