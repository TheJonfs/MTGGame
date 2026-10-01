/**
 * S46 (ADR-142): the Convocation's formats as data — a Constructed format is a `deckRule` set (the door-rule engine's
 * vocabulary, S37/S40, plus S46's restricted and banned lists) that the editor, the Lab and later the builder all
 * read. The first is the Open (formats doc §1.1): 60 minimum, 4-of, basics uncapped, the restricted list at one, the
 * laws banned, the legends at four, prizeOnly legal for the player, the Manafleur and the Cinquefont legal and watched.
 */
import type { DeckRule } from "./legality.js";

export interface ConstructedFormat {
  id: string;
  name: string;
  kind: "constructed";
  rule: DeckRule;
  /** A line for the editor's picker and the reference. */
  note: string;
}
/** S48 (ADR-145): a Limited format — a set and a recipe from data/convocation, a pool shape, and the build rule
 * (the pool is the collection and the copy cap; basics unlimited). */
export interface LimitedFormat {
  id: string;
  name: string;
  kind: "limited";
  shape: "sealed" | "draft";
  set: string;
  recipe: string;
  packs: number;
  rule: DeckRule;
  note: string;
}
export type Format = ConstructedFormat | LimitedFormat;

/** The five High Grounds — legendary lands, restricted for consistency (formats doc §1.1). */
export const HIGH_GROUNDS = ["tallyflame_court", "wrackroot", "shevelport", "obsidian_observatory", "cairnbrand"] as const;
/** The five laws — not player cards until phase three; banned in every Convocation format. */
export const LAW_IDS = ["law_intake", "law_tithe", "law_toll", "law_risen_tide", "law_season"] as const;

export const OPEN_FORMAT: ConstructedFormat = {
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

/** Sealed from the Plane: six Classic packs, forty cards (formats doc §2.3). */
export const SEALED_PLANE: LimitedFormat = {
  id: "sealed-plane",
  name: "Sealed — the Plane",
  kind: "limited",
  shape: "sealed",
  set: "plane",
  recipe: "classic",
  packs: 6,
  note: "six Classic packs from the Plane; forty cards from the pool and any basics",
  rule: { label: "Sealed", minCards: 40, poolIsCap: true },
};

/** The Constructed formats (the editor's doors read these). */
export const FORMATS: readonly ConstructedFormat[] = [OPEN_FORMAT];
export const LIMITED_FORMATS: readonly LimitedFormat[] = [SEALED_PLANE];
