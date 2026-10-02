import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, manaValue, parseManaCost } from "@shandalar/cards";
import { CONSTRUCTED_FORMATS, OPEN_FORMAT, PAUPER_FORMAT, BODIES_FORMAT, HALF_GROUND_FORMAT, NOTHING_DEAR_FORMAT, NOTHING_SMALL_FORMAT, NOTHING_SUDDEN_FORMAT } from "./formats.js";
import { authoredLists } from "./authored-lists.js";
import { buildConstructedDeck, cardLegal, copyCap, legalShare, OPEN_MEANS } from "./constructed-builder.js";
import { checkDeck } from "./legality.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8"));
const library = authoredLists(ROOT);
const size = (l: { count: number }[]) => l.reduce((n, e) => n + e.count, 0);
const count = (l: { cardId: string; count: number }[], f: (id: string) => boolean) => l.reduce((n, e) => n + (f(e.cardId) ? e.count : 0), 0);
const d = (id: string) => cards.get(id)!;

/** S52 (Part 1): Constructed by select-and-repair. */
describe("the Constructed builder (S52)", () => {
  it("the Open: every seed yields a legal sixty from one of the five strongest lists; a seed is a deck; the noise makes five seats five decks", () => {
    const top = Object.entries(OPEN_MEANS).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const builds = Array.from({ length: 60 }, (_, i) => buildConstructedDeck(OPEN_FORMAT, rating, i + 1, library, cards));
    for (const b of builds) {
      expect(b.check.problems, b.from).toEqual([]);
      expect(size(b.deck)).toBe(60);
      expect(top).toContain(b.from);
      expect(b.legalShare).toBe(1);
      expect(b.swaps.length).toBeGreaterThanOrEqual(1);
    }
    expect(new Set(builds.map((b) => b.from)).size).toBe(5); // the field varies
    const levy = builds.filter((b) => b.from === "open:levy");
    expect(new Set(levy.map((b) => JSON.stringify(b.deck))).size).toBeGreaterThan(1); // one archetype, several decks
    expect(buildConstructedDeck(OPEN_FORMAT, rating, 7, library, cards)).toEqual(builds[6]);
    // the restricted list holds through repair and noise
    for (const b of builds) for (const e of b.deck) expect(e.count).toBeLessThanOrEqual(copyCap(e.cardId, OPEN_FORMAT.rule));
  });

  it("the campaign's forties and a thirty-card list are repaired to a legal sixty in their own colours and proportions", () => {
    for (const key of ["mage:oriel", "starter:red", "lord:usher", "beast:wurm"]) {
      const src = library.find((l) => l.key === key)!;
      const b = buildConstructedDeck(OPEN_FORMAT, rating, 52, [src], cards);
      expect(b.from).toBe(key);
      expect(b.check.problems, key).toEqual([]);
      expect(size(b.deck)).toBe(60);
      const colours = new Set(src.decklist.filter((e) => !d(e.cardId).types.includes("Land")).flatMap((e) => cardColors(d(e.cardId))));
      for (const e of b.deck) for (const c of cardColors(d(e.cardId))) expect(colours.has(c), `${key}: ${e.cardId}`).toBe(true);
      const landShare = (l: { cardId: string; count: number }[]) => count(l, (id) => d(id).types.includes("Land")) / size(l);
      expect(Math.abs(landShare(b.deck) - landShare(src.decklist))).toBeLessThan(0.06); // a land for a land
      expect(size(b.added)).toBeGreaterThanOrEqual(60 - size(src.decklist) - 1);
    }
  });

  it("Pauper and the five gates: every seed yields a deck the format's own check passes, and the rule is visibly met", () => {
    for (const f of CONSTRUCTED_FORMATS) for (let seed = 1; seed <= 25; seed++) {
      const b = buildConstructedDeck(f, rating, seed, library, cards);
      expect(b.check.problems, `${f.id} seed ${seed} from ${b.from}`).toEqual([]);
      expect(checkDeck(b.deck, null, f.rule, cards).ok).toBe(true);
      expect(size(b.deck)).toBeGreaterThanOrEqual(60);
      for (const e of b.deck) expect(cardLegal(d(e.cardId), f.rule), `${f.id}: ${e.cardId}`).toBe(true);
    }
    const one = (f: typeof OPEN_FORMAT) => buildConstructedDeck(f, rating, 3, library, cards).deck;
    expect(one(PAUPER_FORMAT).every((e) => ["plains", "island", "swamp", "mountain", "forest"].includes(e.cardId) || d(e.cardId).shopTier === 1)).toBe(true);
    expect(count(one(BODIES_FORMAT), (id) => d(id).types.includes("Creature"))).toBeGreaterThanOrEqual(24);
    expect(one(NOTHING_SMALL_FORMAT).every((e) => !d(e.cardId).types.includes("Creature") || (d(e.cardId).power ?? 0) >= 2)).toBe(true);
    expect(one(NOTHING_SUDDEN_FORMAT).some((e) => d(e.cardId).types.includes("Instant"))).toBe(false);
    expect(count(one(HALF_GROUND_FORMAT), (id) => d(id).types.includes("Land")) * 2).toBeGreaterThanOrEqual(size(one(HALF_GROUND_FORMAT)));
    expect(one(NOTHING_DEAR_FORMAT).every((e) => d(e.cardId).types.includes("Land") || manaValue(parseManaCost(d(e.cardId).manaCost)) <= 4)).toBe(true);
  });

  it("the repair cuts what a rule forbids and fills role for role: a list with instants under Nothing Sudden, a list with big spells under Nothing Dear, the extras of a restricted card", () => {
    const tally = library.find((l) => l.key === "open:tally")!; // an instants-and-sorceries deck
    const b = buildConstructedDeck(NOTHING_SUDDEN_FORMAT, rating, 1, [tally], cards);
    expect(b.cut.every((c) => d(c.cardId).types.includes("Instant") || b.swaps.some((s) => s.out === c.cardId))).toBe(true);
    expect(size(b.cut)).toBeGreaterThan(4);
    expect(b.check.ok).toBe(true);
    const wurm = library.find((l) => l.key === "open:wurmspeaker")!;
    const w = buildConstructedDeck(NOTHING_DEAR_FORMAT, rating, 1, [wurm], cards);
    expect(w.cut.some((c) => manaValue(parseManaCost(d(c.cardId).manaCost)) > 4)).toBe(true);
    expect(w.check.ok).toBe(true);
    const lotus = { key: "x", archetype: "midrange" as const, decklist: [{ cardId: "black_lotus", count: 4 }, { cardId: "swamp", count: 24 }, { cardId: "vampire_nighthawk", count: 4 }, { cardId: "terror", count: 4 }] };
    expect(legalShare(lotus.decklist, OPEN_FORMAT.rule, cards)).toBeCloseTo(33 / 36);
    const l = buildConstructedDeck(OPEN_FORMAT, rating, 1, [lotus], cards);
    expect(l.deck.find((e) => e.cardId === "black_lotus")?.count ?? 0).toBeLessThanOrEqual(1);
    expect(l.check.ok).toBe(true);
    expect(legalShare([{ cardId: "serra_angel", count: 4 }], PAUPER_FORMAT.rule, cards)).toBe(0); // tier 3
    expect(legalShare([{ cardId: "savannah_lions", count: 4 }, { cardId: "plains", count: 4 }], PAUPER_FORMAT.rule, cards)).toBe(1);
  });
});
