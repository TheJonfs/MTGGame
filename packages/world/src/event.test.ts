import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { defaultKnobs } from "./knobs.js";
import { draftDirection, draftPack, draftStep, newDraftEvent, suggestedPick, lifeModifiers, advanceBracket, aliveInBracket, bracketRound, bracketRoundComplete, bracketWinner, finalPlaces, playBracketFieldRound, recordBracketSeries, startBracket, advanceEvent, checkEventDeck, closeRound, deserializeEvent, ledgerEntry, newSealedEvent, pairingOf, playFieldRound, playSeriesHeadless, recordSeries, registerDeck, roundComplete, serializeEvent, seriesSetup, standings, type ConvocationEvent, type SeatAgents } from "./event.js";
import { buildLimitedDeck, LIMITED_TARGETS } from "./limited-builder.js";
import { rollSealedPool, type ConvocationPackData } from "./packs.js";
import { convocationSeat } from "./matchup.js";
import { aiSideboard, answersCreatures, answersRelics, isCounter } from "./sideboard-ai.js";
import { resolveKnobs, DIFFICULTIES } from "./knobs.js";
import { CONVOCATION_NAMES } from "./event.js";

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

describe("the builder and a card that needs a tribe (post-S49 — Goblin Grenade stranded in 54% of the games it was drawn)", () => {
  const base = ["mountain", "savannah_lions", "savannah_lions", "soul_warden", "soul_warden", "suntail_hawk", "suntail_hawk", "master_decoy", "master_decoy", "serra_angel", "inspiring_overseer", "inspiring_overseer", "youthful_valkyrie", "youthful_valkyrie", "hill_giant", "hill_giant", "gray_ogre", "gray_ogre", "pacifism", "lightning_bolt", "shock", "char", "goblin_grenade", "goblin_grenade"];
  const has = (pool: string[], id: string) => buildLimitedDeck(pool, rating, cards, { forcePair: ["W", "R"] }).deck.some((e) => e.cardId === id);
  it("a card whose additional cost sacrifices a Goblin is played only beside five Goblin creatures", () => {
    expect(has(base, "goblin_grenade")).toBe(false); // no Goblin to sacrifice
    expect(has([...base, "goblin_piker", "goblin_piker", "raging_goblin"], "goblin_grenade")).toBe(false); // three is not a tribe
    expect(has([...base, "goblin_piker", "goblin_piker", "raging_goblin", "boggart_brute", "goblin_chieftain", "goblin_matron"], "goblin_grenade")).toBe(true);
    expect(has(base, "lightning_bolt")).toBe(true); // ordinary burn is untouched
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

  it("the ladder (ADR-148): Sealed's entrance is life only — Standard +0 / +2 / +4 / +4 / +6 by round, Easy flat, Hard +2 / +4 / +6; it reaches the AI seat against the human only", () => {
    const e = register(fresh(48)), mine = pairingOf(e, 0)!;
    expect(seriesSetup(e, mine.a, mine.b!, knobs)).toEqual({ life: [20, 20], modifiers: [] }); // round one: flat
    const at = (round: number, k = knobs) => seriesSetup({ ...e, round }, mine.a, mine.b!, k);
    expect([at(2).life, at(3).life, at(4).life, at(5).life, at(7).life]).toEqual([[20, 22], [20, 24], [20, 24], [20, 26], [20, 26]]); // S50: five rows; past the table, its last
    expect(at(3).modifiers).toEqual([]); // life only: no basic in play
    expect(lifeModifiers(at(3).life)).toEqual([{ type: "startingLife", player: 1, value: 24 }]);
    const easy = resolveKnobs({ difficulty: DIFFICULTIES.easy }), hard = resolveKnobs({ difficulty: DIFFICULTIES.hard });
    expect([at(1, easy).life[1], at(3, easy).life[1]]).toEqual([20, 20]);
    expect([at(1, hard).life[1], at(2, hard).life[1], at(3, hard).life[1]]).toEqual([22, 24, 26]);
    const hot = { convocationEntrance: { 1: { life: 4, basics: 2 } } };
    const s = seriesSetup(e, mine.a, mine.b!, hot);
    expect(s.life).toEqual([20, 24]);
    expect(s.modifiers).toHaveLength(2);
    expect(s.modifiers.every((m) => m.type === "permanentOnBattlefield" && m.player === 1)).toBe(true);
    const field = e.pairings.find((p) => p.a !== 0)!;
    expect(seriesSetup(e, field.a, field.b!, hot)).toEqual({ life: [20, 20], modifiers: [] }); // AI against AI is flat
    expect(convocationSeat(9, ["W", "B"], hot)).toEqual({ life: 24, entrance: ["plains", "swamp"] }); // past the table: its last row
  });

describe("sixteen seats, five rounds, a Top 8 (S49 Part 2)", () => {
  const big = (seed: number, seats = 16) => newSealedEvent({ seed, seats, rounds: 5, top8: true, names: CONVOCATION_NAMES, faces: FACES }, deps);
  const sdeps = { cards, knobs, rating };
  async function swiss(e: ConvocationEvent): Promise<ConvocationEvent> {
    for (let round = 1; round <= e.rounds; round++) {
      const mine = pairingOf(e, 0)!;
      if (mine.b !== null) e = recordSeries(e, mine.a, mine.b, await playSeriesHeadless(e, mine.a, mine.b, sdeps, agents));
      e = advanceEvent(closeRound(await playFieldRound(e, sdeps, agents)));
    }
    return e;
  }
  async function bracket(e: ConvocationEvent): Promise<ConvocationEvent> {
    while (e.phase === "bracket") {
      const mine = bracketRound(e).find((m) => m.a === 0 && m.winner === undefined);
      if (mine) e = recordBracketSeries(e, mine.a, mine.b, await playSeriesHeadless(e, mine.a, mine.b, sdeps, agents));
      e = advanceBracket(await playBracketFieldRound(e, sdeps, agents));
    }
    return e;
  }

  it("the planner's sixteen names: fifteen AI seats, all different", () => {
    expect(CONVOCATION_NAMES).toHaveLength(16);
    const e = big(49);
    expect(e.field).toHaveLength(16);
    expect(new Set(e.field.map((s) => s.name)).size).toBe(16);
  });

  it("a full event headless: five Swiss rounds of eight series with no rematch, the bracket seeded 1v8 / 4v5 / 2v7 / 3v6, three bracket rounds, the finish by the bracket for the eight and by the standings for the rest; saved and resumed in the bracket", async () => {
    let e = await swiss(register(big(49)));
    expect(e.results).toHaveLength(40);
    expect(new Set(e.results.map((r) => [r.a, r.b].sort((x, y) => x - y).join("-"))).size).toBe(40);
    expect(e.phase).toBe("bracket");
    const table = standings(e), seeds = e.bracket!.seeds;
    expect(seeds).toEqual(table.slice(0, 8).map((r) => r.seat));
    const pair = (m: { a: number; b: number }) => [seeds.indexOf(m.a) + 1, seeds.indexOf(m.b) + 1].sort((x, y) => x - y);
    expect(bracketRound(e).map(pair)).toEqual([[1, 8], [4, 5], [2, 7], [3, 6]]);
    for (const m of bracketRound(e)) if (m.a === 0 || m.b === 0) expect(m.a).toBe(0); // the human is seat 0 of its series
    // the quarter-finals, then a save in the middle of the bracket
    const mine = bracketRound(e).find((m) => m.a === 0);
    if (mine) e = recordBracketSeries(e, mine.a, mine.b, await playSeriesHeadless(e, mine.a, mine.b, sdeps, agents));
    e = await playBracketFieldRound(e, sdeps, agents);
    expect(bracketRoundComplete(e)).toBe(true);
    const whole = await bracket(e);
    const back = await bracket(deserializeEvent(serializeEvent(e))!);
    expect(back).toEqual(whole);
    expect(whole.phase).toBe("over");
    expect(whole.bracket!.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    // the semi-finals are the quarter-finals' neighbours
    const qf = whole.bracket!.rounds[0]!, sf = whole.bracket!.rounds[1]!;
    expect([sf[0]!.a, sf[0]!.b].sort()).toEqual([qf[0]!.winner!, qf[1]!.winner!].sort());
    const places = finalPlaces(whole), final = whole.bracket!.rounds[2]![0]!;
    expect(places.map((p) => p.place)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(places[0]!.seat).toBe(final.winner);
    expect(new Set(places.slice(0, 8).map((p) => p.seat))).toEqual(new Set(seeds));
    expect(places.slice(8).map((p) => p.seat)).toEqual(table.slice(8).map((r) => r.seat)); // 9th–16th: the standings
    const line = ledgerEntry(whole, "2026-10-03T00:00:00Z");
    expect(line.place).toBe(places.find((p) => p.seat === 0)!.place);
    expect(line.top8).toBe(true);
    expect(line.field.map((f) => f.place)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(aliveInBracket(whole, final.winner!)).toBe(false); // over
  }, 400_000);

  it("the bracket's entrance: +4 / +6 / +8 life against the human by bracket round (Standard); a drawn bracket series goes to the higher seed", () => {
    let e = register(big(49));
    e = startBracket({ ...e, round: 5, phase: "standings" });
    const withHuman = { ...e, bracket: { seeds: [0, ...e.bracket!.seeds.filter((s) => s !== 0)].slice(0, 8), rounds: [[{ a: 0, b: 5 }]] } } as ConvocationEvent;
    expect(seriesSetup(withHuman, 0, 5, knobs).life).toEqual([20, 24]);
    const semi = { ...withHuman, bracket: { ...withHuman.bracket!, rounds: [[], [{ a: 0, b: 5 }]] } } as ConvocationEvent;
    const fin = { ...withHuman, bracket: { ...withHuman.bracket!, rounds: [[], [], [{ a: 0, b: 5 }]] } } as ConvocationEvent;
    expect([seriesSetup(semi, 0, 5, knobs).life[1], seriesSetup(fin, 0, 5, knobs).life[1]]).toEqual([26, 28]);
    expect(seriesSetup({ ...withHuman, bracket: { ...withHuman.bracket!, rounds: [[{ a: 3, b: 5 }]] } } as ConvocationEvent, 3, 5, knobs).life).toEqual([20, 20]); // AI against AI: flat
    const drawn = { seed: 1, bestOf: 3, games: [], wins: [1, 1] as [number, number], draws: 1, done: true, winner: "draw" as const };
    const [hi, lo] = [e.bracket!.seeds[0]!, e.bracket!.seeds[7]!];
    expect(bracketWinner(e, hi, lo, drawn)).toBe(hi);
    expect(bracketWinner(e, lo, hi, drawn)).toBe(hi);
  });

  it("byes: fifteen seats — one bye a round to the lowest seat without one, never twice; a bye is a win of three points with no games", async () => {
    let e = register(big(15, 15));
    expect(e.field).toHaveLength(15);
    for (let round = 1; round <= 3; round++) {
      expect(e.pairings.filter((p) => p.b === null)).toHaveLength(1);
      expect(e.pairings).toHaveLength(8);
      const mine = pairingOf(e, 0)!;
      if (mine.b !== null) e = recordSeries(e, mine.a, mine.b, await playSeriesHeadless(e, mine.a, mine.b, sdeps, agents));
      e = closeRound(await playFieldRound(e, sdeps, agents));
      const t = standings(e);
      expect(t.reduce((n, r) => n + r.wins + r.losses + r.draws, 0)).toBe(round * 15);
      e = advanceEvent(e);
    }
    expect(new Set(e.byes!.map((b) => b.seat)).size).toBe(e.byes!.length);
    const first = e.byes![0]!, row = standings({ ...e, results: e.results.filter((r) => r.round === 1), byes: [first] }).find((r) => r.seat === first.seat)!;
    expect([row.points, row.gamesPlayed]).toEqual([3, 0]);
  }, 300_000);
});

describe("the AI's sideboarding (S49 Part 2 — shape-keyed, from the seat's unused playables)", () => {
  const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
  const base = D({ plains: 17, savannah_lions: 4, suntail_hawk: 4, soul_warden: 4, master_decoy: 4, serra_angel: 3, glorious_anthem: 4 });
  const side = D({ disenchant: 2, swords_to_plowshares: 2, terror: 1, wrath_of_god: 1 });
  const creatures = D({ forest: 17, grizzly_bears: 4, little_bear: 4, wood_elves: 4, centaur_courser: 4, hill_giant: 4, giant_growth: 3 });
  const relics = D({ forest: 17, grizzly_bears: 4, wood_elves: 4, rancor: 3, blanchwood_armor: 3, bonesplitter: 3, giant_growth: 6 });

  it("the shapes: Disenchant answers relics; Swords, Terror and Shock answer creatures; Counterspell is a counter", () => {
    const d = (id: string) => cards.get(id)!;
    expect([answersRelics(d("disenchant")), answersCreatures(d("disenchant"))]).toEqual([true, false]);
    expect(["swords_to_plowshares", "terror", "shock", "putrefy"].map((id) => answersCreatures(d(id)))).toEqual([true, true, true, true]);
    expect(answersRelics(d("terror"))).toBe(false);
    expect([isCounter(d("counterspell")), isCounter(d("essence_scatter")), isCounter(d("shock"))]).toEqual([true, true, false]);
  });

  it("against fifteen or more creatures the creature removal comes in (in colour only); the deck stays forty and its lands stand", () => {
    const sb = aiSideboard(base, side, creatures, cards, rating);
    expect(sb.swaps.filter((x) => x.rule === "creatures").map((x) => x.in)).toEqual(["swords_to_plowshares", "swords_to_plowshares"]); // Terror is black: not castable
    expect(sb.swaps.some((x) => x.rule === "relics")).toBe(false);
    expect(sb.deck.reduce((n, e) => n + e.count, 0)).toBe(40);
    expect(sb.deck.find((e) => e.cardId === "plains")!.count).toBe(17);
    expect(sb.sideboard.reduce((n, e) => n + e.count, 0)).toBe(6);
    expect(aiSideboard(base, side, creatures, cards, rating)).toEqual(sb);
  });

  it("against auras and equipment the Disenchants come in; against neither shape nothing moves", () => {
    const sb = aiSideboard(base, side, relics, cards, rating);
    expect(sb.swaps.map((x) => [x.rule, x.in])).toEqual([["relics", "disenchant"], ["relics", "disenchant"]]);
    const quiet = aiSideboard(base, side, D({ island: 17, counterspell: 4, essence_scatter: 4, boomerang: 4, wall_of_air: 4, air_elemental: 4, ponder: 3 }), cards, rating);
    expect(quiet.swaps).toEqual([]);
    expect(quiet.deck).toEqual(base);
  });

  it("counters go out against a creature deck, for the best playables left", () => {
    const blue = D({ island: 17, counterspell: 2, wall_of_air: 4, air_elemental: 4, wind_drake: 4, man_o_war: 4, boomerang: 5 });
    const sb = aiSideboard(blue, D({ aether_channeler: 2 }), creatures, cards, rating);
    expect(sb.swaps.filter((x) => x.rule === "counters").map((x) => [x.out, x.in])).toEqual([["counterspell", "aether_channeler"], ["counterspell", "aether_channeler"]]);
    expect(sb.deck.some((e) => e.cardId === "counterspell")).toBe(false);
  });

  it("in a series: from game two an AI seat plays its sideboarded deck; the human's seat plays as registered", async () => {
    const { seatForGame } = await import("./event.js");
    const e = register(fresh(48)), opp = pairingOf(e, 0)!.b!;
    expect(seatForGame(e, 0, opp, { cards, rating })).toBe(e.field[0]);
    const them = seatForGame(e, opp, 0, { cards, rating });
    expect(them.deck.reduce((n, x) => n + x.count, 0)).toBe(40);
    expect(seatForGame(e, opp, 0, { cards })).toBe(e.field[opp]); // without the rating: no sideboarding (the S48 behaviour)
  });
});

describe("the drafter's data (S49 Part 3)", () => {
  it("a pod's draft: eight seats, forty-five picks each, deterministic by seed; picks one to three by rating alone; the colour bonus from pick four, a third colour cut at pick eight; the curve term from pick twenty", async () => {
    const { runDraft, pickValue, colourRanks, DRAFT_TERMS } = await import("./drafter.js");
    const { cardRating } = await import("./rating.js");
    const set = packs.sets.find((s) => s.id === "plane")!, recipe = packs.recipes.find((r) => r.id === "classic")!;
    const d = runDraft(set, recipe, packs, cards, rating, 49);
    expect(d.picks).toHaveLength(8);
    for (const p of d.picks) expect(p).toHaveLength(45);
    expect(runDraft(set, recipe, packs, cards, rating, 49)).toEqual(d);
    expect(runDraft(set, recipe, packs, cards, rating, 50).picks).not.toEqual(d.picks);
    for (const p of d.picks) { const b = buildLimitedDeck(p, rating, cards); expect(b.deck.reduce((n, e) => n + e.count, 0)).toBe(40); }
    const r = (id: string) => cardRating(cards.get(id)!, rating);
    const white = ["savannah_lions", "serra_angel", "soul_warden"], wb = [...white, "terror", "vampire_nighthawk", "gravedigger"];
    expect(pickValue("shock", white, 2, rating, cards)).toBe(r("shock")); // picks 1–3: the rating alone
    expect(colourRanks(wb, rating, cards).slice(0, 2).sort()).toEqual(["B", "W"]);
    expect(pickValue("suntail_hawk", wb, 7, rating, cards)).toBeCloseTo(r("suntail_hawk") + DRAFT_TERMS.bonusPerPick * 4 * DRAFT_TERMS.earlySlope); // in the colours: half the slope before the cut (S50)
    expect(pickValue("suntail_hawk", wb, 8, rating, cards)).toBeCloseTo(r("suntail_hawk") + DRAFT_TERMS.bonusPerPick * 5); // the full slope from the cut
    expect(pickValue("shock", wb, 7, rating, cards)).toBe(r("shock")); // a fourth colour: nothing
    const wbu = [...wb, "wind_drake"];
    expect(pickValue("counterspell", wbu, 7, rating, cards)).toBeCloseTo(r("counterspell") + DRAFT_TERMS.bonusPerPick * 4 * DRAFT_TERMS.earlySlope * DRAFT_TERMS.thirdShare); // the third colour: half again, before the cut
    // S50: a land is flat and low until the cut — a dual is never a first pick over a playable; from the cut, its rating inside the colours
    expect(pickValue("scrubland", [], 1, rating, cards)).toBe(DRAFT_TERMS.landFlat);
    expect(pickValue("scrubland", [], 1, rating, cards)).toBeLessThan(pickValue("savannah_lions", [], 1, rating, cards));
    expect(pickValue("scrubland", wb, 9, rating, cards)).toBe(r("scrubland"));
    expect(pickValue("taiga", wb, 9, rating, cards)).toBeLessThan(DRAFT_TERMS.landFlat);
    expect(pickValue("counterspell", wbu, 8, rating, cards)).toBe(r("counterspell")); // the cut at pick eight
    expect(pickValue("mind_stone", wb, 12, rating, cards)).toBeCloseTo(r("mind_stone") + DRAFT_TERMS.bonusPerPick * 9); // colourless: castable
    const short = pickValue("suntail_hawk", wb, 20, rating, cards), plenty = pickValue("suntail_hawk", [...wb, "soul_warden", "soul_warden", "savannah_lions", "suntail_hawk"], 20, rating, cards);
    expect(short - plenty).toBeCloseTo(DRAFT_TERMS.curveBonus); // short of two-drops from pick twenty
  });
});

describe("the draft event (S51 Part 1)", () => {
  const sdeps = { cards, knobs, rating };
  const start = (seed: number) => newDraftEvent({ seed, seats: 8, rounds: 5, top8: true, names: CONVOCATION_NAMES, faces: FACES }, deps);
  const auto = (e: ConvocationEvent, n = 999) => { for (let i = 0; i < n && e.phase === "draft"; i++) e = draftStep(e, suggestedPick(e, deps), deps, FACES); return e; };

  it("the pod: eight seats, fifteen-card packs; a pick takes one card from every pack and passes them left — the human's next pack is the one the seat on their right held; no pick outside the pack", () => {
    const e = start(51);
    expect(e.phase).toBe("draft");
    expect(e.field).toHaveLength(8);
    expect(e.draft!.packs.map((p) => p.length)).toEqual(Array(8).fill(15));
    expect(draftDirection(e)).toBe("left");
    expect(() => draftStep(e, "black_lotus", deps)).toThrow();
    const mine = draftPack(e)[0]!, rightNeighbour = e.draft!.packs[7]!;
    const n = draftStep(e, mine, deps);
    expect(n.draft!.picks[0]).toEqual([mine]);
    expect(n.draft!.pick).toBe(2);
    expect(n.draft!.packs.map((p) => p.length)).toEqual(Array(8).fill(14));
    expect(draftPack(n).every((c) => rightNeighbour.includes(c))).toBe(true); // the pack came from seat 7 (it went left)
    expect(rightNeighbour.filter((c) => !draftPack(n).includes(c)).length).toBeLessThanOrEqual(1); // less its pick (a duplicate name aside)
    for (const p of n.draft!.picks) expect(p).toHaveLength(1);
    expect(start(51)).toEqual(e); // the seed is the pod
  });

  it("three packs, left-right-left, forty-five picks; then the picks are the pools, the seven AI decks are built, and the event stands at the build", () => {
    let e = start(51);
    e = auto(e, 15);
    expect(e.draft!.round).toBe(1); expect(e.draft!.pick).toBe(16); expect(draftDirection(e)).toBe("right");
    expect(e.draft!.packs.map((p) => p.length)).toEqual(Array(8).fill(15));
    e = auto(e, 15);
    expect(draftDirection(e)).toBe("left");
    e = auto(e);
    expect(e.phase).toBe("build");
    expect(e.draft).toBeUndefined();
    for (const seat of e.field) expect(seat.pool).toHaveLength(45);
    expect(e.field[0]!.deck).toEqual([]);
    for (const seat of e.field.slice(1)) { expect(seat.deck.reduce((n, x) => n + x.count, 0)).toBe(40); expect(checkEventDeck(e, e.field.indexOf(seat), seat.deck, cards).ok).toBe(true); expect(seat.face).toBeDefined(); }
    expect(auto(start(51))).toEqual(e);
  });

  it("a full draft event headless — the pod drafts, eight decks, five rounds, the Umbel — saved and resumed mid-draft and mid-round, ending as the uninterrupted event", async () => {
    const play = async (e: ConvocationEvent): Promise<ConvocationEvent> => {
      e = auto(e);
      if (e.phase === "build") { const r = registerDeck(e, 0, buildLimitedDeck(e.field[0]!.pool, rating, cards).deck, cards); if (!r.ok) throw new Error(r.problems.join("; ")); e = r.event; }
      while (e.phase === "round" || e.phase === "standings") {
        if (e.phase === "standings") { e = advanceEvent(e); continue; }
        const mine = pairingOf(e, 0)!;
        if (mine.b !== null && !e.results.some((r) => r.round === e.round && r.a === mine.a && r.b === mine.b)) e = recordSeries(e, mine.a, mine.b, await playSeriesHeadless(e, mine.a, mine.b, sdeps, agents, e.current));
        e = closeRound(await playFieldRound(e, sdeps, agents));
      }
      while (e.phase === "bracket") {
        const m = bracketRound(e).find((x) => x.a === 0 && x.winner === undefined);
        if (m) e = recordBracketSeries(e, m.a, m.b, await playSeriesHeadless(e, m.a, m.b, sdeps, agents));
        e = advanceBracket(await playBracketFieldRound(e, sdeps, agents));
      }
      return e;
    };
    const whole = await play(start(52));
    expect(whole.phase).toBe("over");
    expect(whole.results).toHaveLength(20); // five rounds of four series
    expect(new Set(whole.results.map((r) => [r.a, r.b].sort((x, y) => x - y).join("-"))).size).toBe(20); // no rematch in five rounds of eight
    expect(whole.bracket!.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(whole.bracket!.seeds.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); // eight seats: all in the Umbel, seeded by the Swiss
    expect(ledgerEntry(whole, "2026-10-04T00:00:00Z")).toMatchObject({ formatId: "draft-plane", seats: 8, rounds: 5, top8: true });
    // mid-draft: twenty picks in, through the save
    const midDraft = deserializeEvent(serializeEvent(auto(start(52), 20)))!;
    expect(midDraft.draft!.pick).toBe(21);
    expect(midDraft.draft!.picks[0]).toHaveLength(20);
    expect(await play(midDraft)).toEqual(whole);
    // mid-round: round two, the human's series one game in
    let e = auto(start(52));
    e = (registerDeck(e, 0, buildLimitedDeck(e.field[0]!.pool, rating, cards).deck, cards) as { event: ConvocationEvent }).event;
    const m1 = pairingOf(e, 0)!;
    e = advanceEvent(closeRound(await playFieldRound(recordSeries(e, m1.a, m1.b!, await playSeriesHeadless(e, m1.a, m1.b!, sdeps, agents)), sdeps, agents)));
    const m2 = pairingOf(e, 0)!, full = await playSeriesHeadless(e, m2.a, m2.b!, sdeps, agents);
    e = deserializeEvent(serializeEvent({ ...e, current: { ...full, games: full.games.slice(0, 1), done: false, winner: null } }))!;
    expect(await play(e)).toEqual(whole);
  }, 600_000);
});
});
