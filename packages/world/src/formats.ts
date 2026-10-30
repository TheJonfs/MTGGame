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

/** The High Grounds — legendary lands, restricted for consistency (formats doc §1.1). S70 (ADR-192): the still pairs'
 * five join the flowing pairs' five — the restricted list's first growth. */
export const HIGH_GROUNDS = ["tallyflame_court", "wrackroot", "shevelport", "obsidian_observatory", "cairnbrand", "hearthspire", "volmaw", "nightbower", "ranksmere", "burnfallow"] as const;
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
    restricted: ["black_lotus", "mox_pearl", "mox_sapphire", "mox_jet", "mox_ruby", "mox_emerald", "time_walk", ...HIGH_GROUNDS, "demonic_tutor", "library_of_alexandria", "balance", "wheel_of_fortune"], // post-S70 (Chris): Balance and Wheel of Fortune, restricted as in Vintage
    banned: [...LAW_IDS],
  },
};

/** S52 (formats doc §1.2–1.3): Pauper, and the courts' five gates as tournaments. The gate formats are the Open
 * (its pool, its restricted list) with the court's rule on top; sixty cards. */
const OPEN_BASE = { minCards: 60, restricted: OPEN_FORMAT.rule.restricted!, banned: OPEN_FORMAT.rule.banned! };
const constructed = (id: string, name: string, note: string, rule: Omit<DeckRule, "label">): ConstructedFormat => ({ id, name, kind: "constructed", note, rule: { label: name.replace(/^The /, "the "), ...rule } });
/** S62 (ADR-176): Peasant — the second Constructed format with a field of its own. Tier two and below; no restricted
 * list (nothing restrictable is in it); the laws banned as everywhere. (Pauper, tier one alone, stays as data: 75
 * cards, no dual land, one counterspell — too small a pool to build a field in.) */
export const PEASANT_FORMAT = constructed("peasant", "Peasant", "tier two and below — no power, no legends; sixty cards, four of a kind. Tiers are the shop's, not rarity", { minCards: 60, maxTier: 2, banned: OPEN_FORMAT.rule.banned! });
/** S64 (ADR-181): Naya — the first triad. Red, green and white; a land or a mana artifact makes only those colours
 * (Chris: the off-colour Moxen are out, Black Lotus in, as Birds of Paradise); the Open's restricted list; sixty, four of a kind. */
export const NAYA_FORMAT = constructed("naya", "Naya", "red, green and white. No counterspell lives here; the creatures decide it", { ...OPEN_BASE, colorsWithin: ["R", "G", "W"], manaWithin: true });
/** S65: Esper — the second triad. White, blue and black; the land rule (ADR-181); the Open's restricted list where it
 * applies; sixty, four of a kind. The Usher is Mardu's and not here: no loop. */
export const ESPER_FORMAT = constructed("esper", "Esper", "white, blue and black. Counters, sweepers and the long game; the finishers are few", { ...OPEN_BASE, colorsWithin: ["W", "U", "B"], manaWithin: true });
/** S66: Mardu — the third triad. Red, white and black; the land rule (ADR-181); the Open's restricted list where it
 * applies (the Lotus; Mox Pearl, Ruby and Jet; the Observatory and Cairnbrand; Demonic Tutor; the Library); the laws
 * banned. The Usher's home: the loop lives here. */
export const MARDU_FORMAT = constructed("mardu", "Mardu", "red, white and black. The Usher's loop lives here, and the race that beats it", { ...OPEN_BASE, colorsWithin: ["R", "W", "B"], manaWithin: true });
/** S67: the deep triads as a batch — each the land rule (ADR-181), the Open's restricted list where it applies, the
 * laws banned. Grixis: no Swords and no Vindicate; Jund: no counterspell; Jeskai: counters and sweepers both. */
export const GRIXIS_FORMAT = constructed("grixis", "Grixis", "blue, black and red. Counters, burn and the dead — and nothing white to undo them", { ...OPEN_BASE, colorsWithin: ["U", "B", "R"], manaWithin: true });
export const JUND_FORMAT = constructed("jund", "Jund", "black, red and green. The Reaper sows a snake each dawn, and nothing here can counter it", { ...OPEN_BASE, colorsWithin: ["B", "R", "G"], manaWithin: true });
export const JESKAI_FORMAT = constructed("jeskai", "Jeskai", "blue, red and white. Counters and sweepers both — every answer, and the Bailiff to serve them", { ...OPEN_BASE, colorsWithin: ["U", "R", "W"], manaWithin: true });
/** S69: the shallow batch — the land rule (ADR-181), the Open's restricted list, the laws banned. Sultai has no sweeper
 * in the pool (every sweeper is white or red); Sultai, Abzan and Bant have no Rabble. */
export const SULTAI_FORMAT = constructed("sultai", "Sultai", "black, green and blue. No sweeper reaches here — the creatures own it, or the counters hold it", { ...OPEN_BASE, colorsWithin: ["B", "G", "U"], manaWithin: true });
export const ABZAN_FORMAT = constructed("abzan", "Abzan", "white, black and green. The Warden keeps the gate, and life is the coin", { ...OPEN_BASE, colorsWithin: ["W", "B", "G"], manaWithin: true });
export const TEMUR_FORMAT = constructed("temur", "Temur", "green, blue and red. Great bodies, bounce and burn — the Unwinder sends it all home", { ...OPEN_BASE, colorsWithin: ["G", "U", "R"], manaWithin: true });
export const BANT_FORMAT = constructed("bant", "Bant", "green, white and blue. Angels and auras, and the Sower plants a forest for every land", { ...OPEN_BASE, colorsWithin: ["G", "W", "U"], manaWithin: true });
/** The formats that have a field of their own lists (data/convocation/formats/<id>/), a table of record and a door. */
export const FIELD_FORMAT_IDS = ["open", "peasant", "naya", "esper", "mardu", "grixis", "jund", "jeskai", "sultai", "abzan", "temur", "bant"] as const;
export const PAUPER_FORMAT = constructed("pauper", "Pauper", "tier 1 only — honest creatures and spells", { minCards: 60, maxTier: 1, banned: OPEN_FORMAT.rule.banned! });
export const BODIES_FORMAT = constructed("bodies", "Bodies", "Odile's gate: twenty-four creatures in sixty", { ...OPEN_BASE, minCreatures: 24 });
export const NOTHING_SMALL_FORMAT = constructed("nothing-small", "Nothing Small", "Zinnia's gate: every creature's power two or more", { ...OPEN_BASE, minCreaturePower: 2 });
export const NOTHING_SUDDEN_FORMAT = constructed("nothing-sudden", "Nothing Sudden", "Ovna's gate: no instants", { ...OPEN_BASE, bannedTypes: ["Instant"] });
export const HALF_GROUND_FORMAT = constructed("half-ground", "Half Ground", "Isaura's gate: half the deck is land", { ...OPEN_BASE, minLandFraction: 0.5 });
export const NOTHING_DEAR_FORMAT = constructed("nothing-dear", "Nothing Dear", "Meliyan's gate: nothing above mana value four", { ...OPEN_BASE, maxManaValue: 4 });
/** Every Constructed format the builder passes its tests for (S52); the door offers the Open, the rest are data. */
export const CONSTRUCTED_FORMATS: readonly ConstructedFormat[] = [OPEN_FORMAT, PEASANT_FORMAT, NAYA_FORMAT, ESPER_FORMAT, MARDU_FORMAT, GRIXIS_FORMAT, JUND_FORMAT, JESKAI_FORMAT, SULTAI_FORMAT, ABZAN_FORMAT, TEMUR_FORMAT, BANT_FORMAT, PAUPER_FORMAT, BODIES_FORMAT, NOTHING_SMALL_FORMAT, NOTHING_SUDDEN_FORMAT, HALF_GROUND_FORMAT, NOTHING_DEAR_FORMAT];

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
