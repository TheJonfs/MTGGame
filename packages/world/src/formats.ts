/**
 * S46 (ADR-142): the Convocation's formats as data — a Constructed format is a `deckRule` set (the door-rule engine's
 * vocabulary, S37/S40, plus S46's restricted and banned lists) that the editor, the Lab and later the builder all
 * read. The first is the Open (formats doc §1.1): 60 minimum, 4-of, basics uncapped, the restricted list at one, the
 * laws banned, the legends at four, prizeOnly legal for the player, the Manafleur and the Cinquefont legal and watched.
 */
import type { DeckRule } from "./legality.js";

export interface Format {
  id: string;
  name: string;
  kind: "constructed";
  rule: DeckRule;
  /** A line for the editor's picker and the reference. */
  note: string;
}

/** The five High Grounds — legendary lands, restricted for consistency (formats doc §1.1). */
export const HIGH_GROUNDS = ["tallyflame_court", "wrackroot", "shevelport", "obsidian_observatory", "cairnbrand"] as const;
/** The five laws — not player cards until phase three; banned in every Convocation format. */
export const LAW_IDS = ["law_intake", "law_tithe", "law_toll", "law_risen_tide", "law_season"] as const;

export const OPEN_FORMAT: Format = {
  id: "open",
  name: "The Open",
  kind: "constructed",
  note: "the Vintage of the plane — every card legal, power restricted to one",
  rule: {
    label: "the Open",
    minCards: 60,
    restricted: ["black_lotus", "mox_pearl", "mox_sapphire", "mox_jet", "mox_ruby", "mox_emerald", "time_walk", ...HIGH_GROUNDS, "demonic_tutor", "library_of_alexandria"],
    banned: [...LAW_IDS],
  },
};

export const FORMATS: readonly Format[] = [OPEN_FORMAT];
