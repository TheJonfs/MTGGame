import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { defaultKnobs } from "./knobs.js";
import { advanceEvent, checkEventDeck, closeRound, deserializeEvent, ledgerEntry, newSealedEvent, pairingOf, playFieldRound, playSeriesHeadless, recordSeries, registerDeck, roundComplete, serializeEvent, seriesSetup, standings, type ConvocationEvent, type SeatAgents } from "./event.js";
import { buildLimitedDeck, LIMITED_TARGETS } from "./limited-builder.js";
import { rollSealedPool, type ConvocationPackData } from "./packs.js";
import { convocationSeat } from "./matchup.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json");
const deps = { cards, packs, rating }, knobs = defaultKnobs();
const NAMES = ["Ansel", "Brida", "Corwen", "Dessa", "Edmar", "Fenna", "Garrick", "Hesper"];
const FACES = [{ portrait: "oriel", colors: "W" }, { portrait: "tessaly", colors: "U" }, { portrait: "edric", colors: "B" }, { portrait: "brann", colors: "R" }, { portrait: "hask", colors: "G" }, { portrait: "vael", colors: "WB" }, { portrait: "kessa", colors: "UR" }];
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck));
const fresh = (seed: number) => newSealedEvent({ seed, names: NAMES, faces: FACES }, deps);
/** The human's seat played by a heuristic: its deck by the builder, its series headless. */
const register = (e: ConvocationEvent) => { const r = registerDeck(e, 0, buildLimitedDeck(e.field[0]!.pool, rating, cards).deck, cards); if (!r.ok) throw new Error(r.problems.join("; ")); return r.event; };
async function playRound(e: ConvocationEvent): Promise<ConvocationEvent> {
  const mine = pairingOf(e, 0)!;
  e = recordSeries(e, mine.a, mine.b!, await playSeriesHeadless(e, mine.a, mine.b!, { cards, knobs }, agents, e.current));
  e = await playFieldRound(e, { cards, knobs }, agents);
  return closeRound(e);
}

describe("the Limited builder (S48 Part 2)", () => {
  it("over 150 sealed pools: forty cards, legal against the pool, at least fifteen lands, no third colour without two fixers, deterministic", () => {
    const set = packs.sets.find((s) => s.id === "plane")!, recipe = packs.recipes.find((r) => r.id === "classic")!;
    for (let seed = 1; seed <= 150; seed++) {
      const pool = rollSealedPool(set, recipe, cards, packs.power, seed).flat();
      const b = buildLimitedDeck(pool, rating, cards);
      const e = { ...fresh(1), field: [{ ...fresh(1).field[0]!, pool }] } as ConvocationEvent;
      expect(b.deck.reduce((n, x) => n + x.count, 0), `seed ${seed}`).toBe(LIMITED_TARGETS.deck);
      expect(checkEventDeck(e, 0, b.deck, cards).problems, `seed ${seed}`).toEqual([]);
      expect(b.lands).toBeGreaterThanOrEqual(15);
      expect(b.curve.slice(6).reduce((a, x) => a + x, 0)).toBeLessThanOrEqual(LIMITED_TARGETS.sixPlusCap);
      if (b.splash) {
        const fixers = pool.filter((id) => { const d = cards.get(id)!; return d.types.includes("Land") && JSON.stringify(d.abilities ?? []).includes(b.splash === null ? "~" : '"basicLand"') || (d.types.includes("Land") && JSON.stringify(d.abilities ?? []).includes(`{${b.splash}}`)); }).length;
        expect(fixers, `seed ${seed}`).toBeGreaterThanOrEqual(LIMITED_TARGETS.fixersForSplash);
      }
      expect(buildLimitedDeck(pool, rating, cards)).toEqual(b);
      // the sideboard is the rest of the pool
      expect(b.sideboard.reduce((n, x) => n + x.count, 0) + b.deck.filter((x) => !["plains", "island", "swamp", "mountain", "forest"].includes(x.cardId)).reduce((n, x) => n + x.count, 0)).toBe(pool.length);
    }
  });
});

describe("a Sealed Convocation of eight (S48 Part 3)", () => {
  it("the field: eight seats from one seed — ninety-card pools, seven built decks with names and faces, the human's deck unbuilt", () => {
    const e = fresh(48);
    expect(e.field).toHaveLength(8);
    expect(e.phase).toBe("build");
    for (const s of e.field) expect(s.pool).toHaveLength(90);
    expect(e.field[0]!.human && e.field[0]!.deck.length === 0).toBe(true);
    for (const s of e.field.slice(1)) { expect(s.deck.reduce((n, x) => n + x.count, 0)).toBe(40); expect(s.face).toBeDefined(); expect(NAMES).toContain(s.name); }
    expect(new Set(e.field.map((s) => s.name)).size).toBe(8);
    expect(new Set(e.field.slice(1).map((s) => s.face)).size).toBe(7);
    expect(fresh(48)).toEqual(e);
    expect(fresh(49).field[0]!.pool).not.toEqual(e.field[0]!.pool);
  });

  it("registration: an illegal deck is refused with its problems; a legal one opens round one — four pairings, the human seat first in its own", () => {
    const e = fresh(48);
    const short = registerDeck(e, 0, [{ cardId: "plains", count: 20 }], cards);
    expect(short.ok).toBe(false);
    const stolen = registerDeck(e, 0, [{ cardId: "plains", count: 39 }, { cardId: "black_lotus", count: 1 }], cards);
    expect(stolen.ok).toBe(false);
    const r = register(e);
    expect(r.phase).toBe("round");
    expect(r.round).toBe(1);
    expect(r.pairings).toHaveLength(4);
    expect(new Set(r.pairings.flatMap((p) => [p.a, p.b])).size).toBe(8);
    expect(pairingOf(r, 0)!.a).toBe(0);
  });

  it("a full event headless — three Swiss rounds, no rematch, the standings add up, the ledger's line; the same seed is the same event", async () => {
    let e = register(fresh(48));
    for (let round = 1; round <= 3; round++) {
      expect(e.round).toBe(round);
      e = await playRound(e);
      expect(roundComplete(e)).toBe(true);
      expect(e.phase).toBe("standings");
      e = advanceEvent(e);
    }
    expect(e.phase).toBe("over");
    expect(e.results).toHaveLength(12);
    const met = new Set(e.results.map((r) => [r.a, r.b].sort().join("-")));
    expect(met.size).toBe(12); // no rematch
    const table = standings(e);
    expect(table.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const drawn = e.results.filter((r) => r.series.winner === "draw").length;
    expect(table.reduce((n, r) => n + r.points, 0)).toBe(3 * (12 - drawn) + 2 * drawn);
    for (const r of table) expect(r.wins + r.losses + r.draws).toBe(3);
    for (let i = 1; i < table.length; i++) expect(table[i - 1]!.points).toBeGreaterThanOrEqual(table[i]!.points);
    const line = ledgerEntry(e, "2026-10-02T00:00:00Z");
    expect(line.place).toBe(table.find((r) => r.seat === 0)!.place);
    expect(line.field).toHaveLength(8);
    expect(line.deck.reduce((n, x) => n + x.count, 0)).toBe(40);
    // determinism
    let f = register(fresh(48));
    for (let round = 1; round <= 3; round++) f = advanceEvent(await playRound(f));
    expect(f).toEqual(e);
  }, 240_000);

  it("saved and resumed mid-round — after the human's first game, and with the field's series half played — ends as the uninterrupted event", async () => {
    let whole = register(fresh(7));
    for (let round = 1; round <= 3; round++) whole = advanceEvent(await playRound(whole));

    let e = register(fresh(7));
    e = advanceEvent(await playRound(e)); // round one whole
    // round two: the human's series one game in, then the save
    const mine = pairingOf(e, 0)!;
    const full = await playSeriesHeadless(e, mine.a, mine.b!, { cards, knobs }, agents);
    e = { ...e, current: { ...full, games: full.games.slice(0, 1), done: false, winner: null } };
    // …and one field series recorded
    const other = e.pairings.find((p) => p.a !== 0)!;
    e = recordSeries(e, other.a, other.b!, await playSeriesHeadless(e, other.a, other.b!, { cards, knobs }, agents));
    const text = serializeEvent(e);
    let back = deserializeEvent(text)!;
    expect(back).toEqual(e);
    expect(back.current!.games).toHaveLength(1);
    back = advanceEvent(await playRound(back)); // resumes the series from its one game; skips the recorded field series
    back = advanceEvent(await playRound(back));
    // the same event: the results in a different order within round two (a field series was recorded first)
    const norm = (x: ConvocationEvent) => ({ ...x, results: [...x.results].sort((p, q) => p.round - q.round || p.a - q.a) });
    expect(norm(back)).toEqual(norm(whole));
    expect(standings(back)).toEqual(standings(whole));
    expect(deserializeEvent("{}")).toBeNull();
    expect(deserializeEvent(JSON.stringify({ format: "convocation-event-v1", event: { version: 2, field: [] } }))).toBeNull();
  }, 240_000);

  it("the ladder: convocationEntrance is wired and all zeros — twenty life, no basics; a filled row reaches the AI seat against the human only", () => {
    const e = register(fresh(48)), mine = pairingOf(e, 0)!;
    expect(seriesSetup(e, mine.a, mine.b!, knobs)).toEqual({ life: [20, 20], modifiers: [] });
    const hot = { convocationEntrance: { 1: { life: 4, basics: 2 } } };
    const s = seriesSetup(e, mine.a, mine.b!, hot);
    expect(s.life).toEqual([20, 24]);
    expect(s.modifiers).toHaveLength(2);
    expect(s.modifiers.every((m) => m.type === "permanentOnBattlefield" && m.player === 1)).toBe(true);
    const field = e.pairings.find((p) => p.a !== 0)!;
    expect(seriesSetup(e, field.a, field.b!, hot)).toEqual({ life: [20, 20], modifiers: [] }); // AI against AI is flat
    expect(convocationSeat(9, ["W", "B"], hot)).toEqual({ life: 24, entrance: ["plains", "swamp"] }); // past the table: its last row
  });
});
