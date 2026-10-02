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

/** S52 (formats doc §1.2–1.3): Pauper, and the courts' five gates as tournaments. The gate formats are the Open
 * (its pool, its restricted list) with the court's rule on top; sixty cards. */
const OPEN_BASE = { minCards: 60, restricted: OPEN_FORMAT.rule.restricted!, banned: OPEN_FORMAT.rule.banned! };
const constructed = (id: string, name: string, note: string, rule: Omit<DeckRule, "label">): ConstructedFormat => ({ id, name, kind: "constructed", note, rule: { label: name.replace(/^The /, "the "), ...rule } });
export const PAUPER_FORMAT = constructed("pauper", "Pauper", "tier 1 only — honest creatures and spells", { minCards: 60, maxTier: 1, banned: OPEN_FORMAT.rule.banned! });
export const BODIES_FORMAT = constructed("bodies", "Bodies", "Odile's gate: twenty-four creatures in sixty", { ...OPEN_BASE, minCreatures: 24 });
export const NOTHING_SMALL_FORMAT = constructed("nothing-small", "Nothing Small", "Zinnia's gate: every creature's power two or more", { ...OPEN_BASE, minCreaturePower: 2 });
export const NOTHING_SUDDEN_FORMAT = constructed("nothing-sudden", "Nothing Sudden", "Ovna's gate: no instants", { ...OPEN_BASE, bannedTypes: ["Instant"] });
export const HALF_GROUND_FORMAT = constructed("half-ground", "Half Ground", "Isaura's gate: half the deck is land", { ...OPEN_BASE, minLandFraction: 0.5 });
export const NOTHING_DEAR_FORMAT = constructed("nothing-dear", "Nothing Dear", "Meliyan's gate: nothing above mana value four", { ...OPEN_BASE, maxManaValue: 4 });
/** Every Constructed format the builder passes its tests for (S52); the door offers the Open, the rest are data. */
export const CONSTRUCTED_FORMATS: readonly ConstructedFormat[] = [OPEN_FORMAT, PAUPER_FORMAT, BODIES_FORMAT, NOTHING_SMALL_FORMAT, NOTHING_SUDDEN_FORMAT, HALF_GROUND_FORMAT, NOTHING_DEAR_FORMAT];

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

/** S51: a draft from the Plane — three Classic packs a seat, forty cards from the picks and any basics. */
export const DRAFT_PLANE: LimitedFormat = {
  id: "draft-plane",
  name: "Draft — the Plane",
  kind: "limited",
  shape: "draft",
  set: "plane",
  recipe: "classic",
  packs: 3,
  note: "three Classic packs from the Plane, picked and passed; forty cards from the picks and any basics",
  rule: { label: "Draft", minCards: 40, poolIsCap: true },
};

/** The Constructed formats (the editor's doors read these). */
export const FORMATS: readonly ConstructedFormat[] = [OPEN_FORMAT];
export const LIMITED_FORMATS: readonly LimitedFormat[] = [SEALED_PLANE, DRAFT_PLANE];
