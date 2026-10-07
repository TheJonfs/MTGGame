import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, manaValue, parseManaCost } from "@shandalar/cards";
import { CONSTRUCTED_FORMATS, OPEN_FORMAT, PAUPER_FORMAT, BODIES_FORMAT, HALF_GROUND_FORMAT, NOTHING_DEAR_FORMAT, NOTHING_SMALL_FORMAT, NOTHING_SUDDEN_FORMAT } from "./formats.js";
import { authoredLists } from "./authored-lists.js";
import { buildConstructedDeck, cardLegal, copyCap, legalShare, OPEN_MEANS, selectCandidates, tuneVariation, VARIATION_TERMS } from "./constructed-builder.js";
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
  it("S56 (ADR-164): an archived list stays in the data and is out of the field — the Loop is in the library with its flag, in no seat's candidates, in no strength table, and never a seat's list", () => {
    const loop = library.find((l) => l.key === "open:loop")!;
    expect(loop.archived).toBe(true);
    expect(loop.decklist.reduce((n, e) => n + e.count, 0)).toBe(60); // kept whole
    expect(OPEN_MEANS["open:loop"]).toBeUndefined();
    expect(selectCandidates(OPEN_FORMAT, rating, library, cards).map((c) => c.l.key)).not.toContain("open:loop");
    expect(library.filter((l) => l.archived).map((l) => l.key).sort()).toEqual(["open:larder", "open:loop"]); // post-S57: the Larder (ADR-165's exit)
    for (let i = 1; i <= 200; i++) expect(buildConstructedDeck(OPEN_FORMAT, rating, i, library, cards).from).not.toBe("open:loop");
    expect(buildConstructedDeck(OPEN_FORMAT, rating, 1, library, cards, { from: "open:loop" }).from).toBe("open:loop"); // asked for by key (a study, a seat in an older save) it still builds
  });
  it("the Open: every seed yields a legal sixty from one of the TWELVE Open lists; a seed is a deck; a quarter of the seats play their list as written, the rest tinker lightly or heavily", () => {
    const top = Object.keys(OPEN_MEANS);
    const builds = Array.from({ length: 120 }, (_, i) => buildConstructedDeck(OPEN_FORMAT, rating, i + 1, library, cards));
    for (const b of builds) {
      expect(b.check.problems, b.from).toEqual([]);
      expect(size(b.deck)).toBe(60);
      expect(top).toContain(b.from);
      expect(b.legalShare).toBe(1);
      const stock = library.find((l) => l.key === b.from)!.decklist, moved = b.deck.reduce((n, e) => n + Math.max(0, e.count - (stock.find((x) => x.cardId === e.cardId)?.count ?? 0)), 0);
      if (b.tinker === "stock") { expect(b.swaps).toEqual([]); expect(moved).toBe(0); } // the list as written
      if (b.tinker === "light") expect(moved).toBeLessThanOrEqual(3);
      if (b.tinker === "heavy") expect(b.swaps.length).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(builds.map((b) => b.from)).size).toBe(Object.keys(OPEN_MEANS).length); // every measured Open list is in the field (twelve, and post-S53 the contributed)
    const share = (t: string) => builds.filter((b) => b.tinker === t).length / builds.length;
    expect(share("stock")).toBeGreaterThan(0.12); expect(share("stock")).toBeLessThan(0.4);
    expect(share("light")).toBeGreaterThan(0.35); expect(share("heavy")).toBeGreaterThan(0.12);
    expect(buildConstructedDeck(OPEN_FORMAT, rating, 9, library, cards, { tinker: "heavy", from: "open:larder" })).toMatchObject({ from: "open:larder", tinker: "heavy" });
    const levy = builds.filter((b) => b.from === "open:levy");
    expect(new Set(levy.map((b) => JSON.stringify(b.deck))).size).toBeGreaterThan(1); // one archetype, several decks
    expect(buildConstructedDeck(OPEN_FORMAT, rating, 7, library, cards)).toEqual(builds[6]);
    void levy;
    // the restricted list holds through repair and noise
    for (const b of builds) for (const e of b.deck) expect(e.count).toBeLessThanOrEqual(copyCap(e.cardId, OPEN_FORMAT.rule));
  });

  it("post-S52 — the plan rules: a four-of is never swapped out or cut; a swap's card shares an authored list with the card it replaces; the land-down move adds a card the deck already plays; off, the noise is S52's", () => {
    const before = { ...VARIATION_TERMS };
    const isLand = (id: string) => d(id).types.includes("Land");
    try {
      const off = Array.from({ length: 40 }, (_, i) => buildConstructedDeck(OPEN_FORMAT, rating, 500 + i, library, cards, { tinker: "heavy", from: "open:undertow" }));
      tuneVariation({ plan: 1 });
      for (const from of ["open:undertow", "open:larder", "open:levy"]) for (let i = 0; i < 40; i++) {
        const b = buildConstructedDeck(OPEN_FORMAT, rating, 500 + i, library, cards, { tinker: "heavy", from });
        const src = library.find((l) => l.key === from)!.decklist, n = (l: { cardId: string; count: number }[], id: string) => l.find((e) => e.cardId === id)?.count ?? 0;
        expect(b.check.problems).toEqual([]);
        for (const e of src) if (e.count >= 4 && !isLand(e.cardId)) expect(n(b.deck, e.cardId), `${from} ${e.cardId}`).toBe(4); // the plan stands
        for (const sw of b.swaps) {
          if (isLand(sw.out)) expect(n(src, sw.in) > 0 || b.swaps.some((x) => x.in === sw.in && x !== sw), `${from}: the land-down move adds ${sw.in}`).toBe(true);
          else if (!isLand(sw.in)) expect(library.some((l) => l.decklist.some((e) => e.cardId === sw.out) && l.decklist.some((e) => e.cardId === sw.in)), `${from}: ${sw.out} → ${sw.in}`).toBe(true);
        }
        expect(b.swaps.length).toBeGreaterThanOrEqual(3); // still a heavy tinkerer
      }
      tuneVariation({ plan: 0 });
      expect(Array.from({ length: 40 }, (_, i) => buildConstructedDeck(OPEN_FORMAT, rating, 500 + i, library, cards, { tinker: "heavy", from: "open:undertow" }))).toEqual(off);
    } finally { tuneVariation(before); }
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
