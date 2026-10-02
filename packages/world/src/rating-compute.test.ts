import { describe, expect, it } from "vitest";
import type { CardDef } from "@shandalar/cards";
import { computeRating, type RatingGameLike } from "./rating-compute.js";

/** S52 (ADR-151): the rating pipeline, tested. The fixture is the S49–S51 bug's own shape — two Sealed runs whose
 * decks share names — and the check is the one that found it: the same statistic computed a second way. */
const card = (id: string, tier: 1 | 2 | 3): CardDef => ({ id, name: id, source: "custom", manaCost: "{1}", types: ["Creature"], power: 1, toughness: 1, shopTier: tier, art: { fallback: "rendered" } }) as unknown as CardDef;
const rated = [card("alpha", 1), card("beta", 1), card("gamma", 2), card("unseen", 3)];
const g = (a: string, b: string, winner: "a" | "b", seenA: string[], seenB: string[]): RatingGameLike => ({ a, b, winner, seenA, usedA: seenA, seenB, usedB: seenB });
const times = <T,>(n: number, x: T) => Array.from({ length: n }, () => x);

// Run 1: pool:0 is a STRONG deck (wins 8 of 10) and holds alpha. Run 2: pool:0 is a WEAK deck (wins 2 of 10) and
// holds beta. Within each run the card is seen in every game of its deck, so its true lift is exactly zero.
const run1 = [...times(8, g("pool:0", "pool:1", "a", ["alpha"], [])), ...times(2, g("pool:0", "pool:1", "b", ["alpha"], []))];
const run2 = [...times(2, g("pool:0", "pool:1", "a", ["beta"], [])), ...times(8, g("pool:0", "pool:1", "b", ["beta"], []))];
const authored = [...times(6, g("list:x", "list:y", "a", ["gamma"], [])), ...times(4, g("list:x", "list:y", "b", ["gamma"], []))];
const lists = [{ key: "list:x", decklist: [{ cardId: "gamma", count: 4 }] }, { key: "list:y", decklist: [{ cardId: "alpha", count: 2 }] }];

describe("the rating pipeline (ADR-151)", () => {
  it("two runs whose decks share names keep their records apart: a card seen in every game of its deck has zero lift in either run", () => {
    const r = computeRating({ authored, lists, sealedRuns: [run1, run2], rated });
    expect(r.sealedGames).toBe(20);
    expect([r.cards.alpha!.sealedSeen, r.cards.alpha!.sealedLift]).toEqual([10, 0]);
    expect([r.cards.beta!.sealedSeen, r.cards.beta!.sealedLift]).toEqual([10, 0]);
  });

  it("the bug's shape, for the record: the same games POOLED as one run give the strong deck's card +0.3 and the weak deck's −0.3", () => {
    const pooled = computeRating({ authored, lists, sealedRuns: [[...run1, ...run2]], rated });
    expect(pooled.cards.alpha!.sealedLift).toBe(0.3); // 0.8 against a merged record of 0.5
    expect(pooled.cards.beta!.sealedLift).toBe(-0.3);
  });

  it("the same statistic a second way: a run's lift recomputed by hand from its games equals the pipeline's", () => {
    // run 3: deck pool:0 wins 6 of 10; delta is in hand in 5 games, 4 of them wins → lift = 4/5 − 6/10 = +0.2
    const run3 = [...times(4, g("pool:0", "pool:1", "a", ["alpha", "beta"], [])), ...times(2, g("pool:0", "pool:1", "a", ["alpha"], [])), g("pool:0", "pool:1", "b", ["alpha", "beta"], []), ...times(3, g("pool:0", "pool:1", "b", ["alpha"], []))];
    const r = computeRating({ authored, lists, sealedRuns: [run3], rated });
    const mine = run3.filter((x) => x.seenA.includes("beta")), wins = mine.filter((x) => x.winner === "a").length;
    const byHand = wins / mine.length - run3.filter((x) => x.winner === "a").length / run3.length;
    expect(byHand).toBeCloseTo(0.2);
    expect(r.cards.beta!.sealedLift).toBeCloseTo(byHand);
    expect(r.cards.beta!.sealedSeen).toBe(5);
    expect(r.cards.alpha!.sealedLift).toBe(0); // in hand every game
  });

  it("the build's output on the fixture is pinned: presence, the field, the priors, a card nothing saw", () => {
    const r = computeRating({ authored, lists, sealedRuns: [run1, run2], rated });
    expect(r.field).toBe(0.5);
    expect(r.rec["list:x"]).toEqual({ n: 10, w: 6 });
    expect(r.cards.gamma).toMatchObject({ prior: 1.5, lists: 1, seen: 10, presence: 0.1, lift: 0, castWhenDrawn: 1 });
    expect(r.cards.alpha).toMatchObject({ prior: 1, lists: 1, presence: -0.1, seen: 0, lift: null });
    expect(r.cards.unseen).toEqual({ rating: 2, prior: 2, lists: 0, seen: 0, presence: null, lift: null, castWhenDrawn: null, sealedSeen: 0, sealedLift: null });
    expect(r.cards.gamma!.rating).toBeGreaterThan(1.5); // a winning list's card sits above its prior
    expect(r.cards.alpha!.rating).toBeLessThan(1); // a losing list's card below
    expect(Object.keys(r.cards)).toEqual(["alpha", "beta", "gamma", "unseen"]);
    expect(computeRating({ authored, lists, sealedRuns: [run1, run2], rated })).toEqual(r);
    // an authored-only build (v0) carries no Sealed columns
    expect(computeRating({ authored, lists, sealedRuns: null, rated }).cards.gamma).not.toHaveProperty("sealedSeen");
  });
});
