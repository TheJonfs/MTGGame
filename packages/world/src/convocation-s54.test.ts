import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { defaultKnobs } from "./knobs.js";
import { authoredLists } from "./authored-lists.js";
import { convocationNames } from "./convocation-names.js";
import { runHeadless, stepHeadless } from "./convocation-run.js";
import {
  CONVOCATION_SEATS, defaultStages, shortStages, hardLife, dayScale, seatStrength, eventDifficulty, LEDGER_FIELD, newSealedEvent, deserializeEvent, finalPlaces, finishTitle, keepAllowance, lastLimitedPool, ledgerEntry, newConvocation, serializeEvent, stageLastRound, standings,
  type ConvocationEvent, type ConvocationStage, type SeatAgents,
} from "./event.js";
import type { ConvocationPackData } from "./packs.js";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";
import { OPEN_FORMAT } from "./formats.js";
import { buildSideboard } from "./constructed-builder.js";
import { AI_SIDEBOARD_CONSTRUCTED, aiSideboard, answersCreatures, answersRelics } from "./sideboard-ai.js";
import { checkEventDeck, checkSideboard, newConstructedEvent, recordSeries, registerDeck, registerDecklist, seatForGame } from "./event.js";

/** S54: the difficulty, the field's strength, the ledger trim and the short Convocation. Its own file: a test file's
 * synchronous work must stay under vitest's 60 s RPC window ("Timeout calling onTaskUpdate"), and the S53 file is near it. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json");
const library = authoredLists(ROOT);
const deps = { cards, packs, rating, knobs: defaultKnobs(), library };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));
const FACES = Array.from({ length: 40 }, (_, i) => ({ portrait: `face${i}`, colors: "WUBRG"[i % 5]! }));
/** The default's shape, one round a stage (the test's size; the measure plays the full sixteen). */
const SHORT: ConvocationStage[] = defaultStages("open").map((s) => ({ ...s, rounds: 1 }));
const make = (seed: number, stages = SHORT, seats = 32) => newConvocation({ seed, stages, seats, names: convocationNames(seats - 1), faces: FACES, library }, deps);

describe("the Convocation after S54", () => {
  it("S54 (ADR-157) — Hard's life: ADR-148's rows by Swiss round within a day, times the day (four days ×0 / ×0.5 / ×1 / ×1; a single event and a short Convocation's last day ×1), the bracket +4/+6/+8; Normal none; a retired 'standard' or 'easy' is Normal", () => {
    const ev = (o: Partial<ConvocationEvent>) => ({ difficulty: "hard", phase: "round", round: 1, field: [], results: [], ...o }) as ConvocationEvent;
    const four = defaultStages("open"), short = shortStages("open");
    expect([1, 2, 3].map((round) => hardLife(ev({ stages: four, stage: 0, round })))).toEqual([0, 0, 0]); // Day 1 ×0
    expect([4, 5, 6, 7, 8].map((round) => hardLife(ev({ stages: four, stage: 1, round })))).toEqual([0, 1, 2, 2, 3]); // Day 2 ×0.5 of 0/2/4/4/6
    expect([9, 10, 11].map((round) => hardLife(ev({ stages: four, stage: 2, round })))).toEqual([0, 2, 4]); // Day 3 ×1
    expect([12, 16].map((round) => hardLife(ev({ stages: four, stage: 3, round })))).toEqual([0, 6]);
    expect([4, 8].map((round) => hardLife(ev({ stages: short, stage: 1, round })))).toEqual([0, 6]); // the short's last day ×1
    expect([1, 3, 5].map((round) => hardLife(ev({ round })))).toEqual([0, 4, 6]); // a single event: one full day
    expect([1, 2, 3].map((n) => hardLife(ev({ phase: "bracket", bracket: { seeds: [], rounds: Array.from({ length: n }, () => []) } })))).toEqual([4, 6, 8]);
    expect(hardLife(ev({ difficulty: "normal", stages: four, stage: 3, round: 16 }))).toBe(0);
    expect(["standard", "easy", "normal"].map((difficulty) => eventDifficulty({ difficulty }))).toEqual(["normal", "normal", "normal"]);
    expect(dayScale({ stages: four, stage: 1, phase: "round" })).toBe(0.5);
  });

  it("S54 (ADR-158) — the field's strength: seeded by seat, every pilot master (Chris), builders about a quarter stock / half light / quarter heavy, Limited noise 0 / 0.2 / 0.4 by thirds; recorded on the seat and kept across stages; a noisy builder builds a different deck from the same cards", async () => {
    const xs = Array.from({ length: 1200 }, (_, s) => seatStrength(77, s + 1));
    expect(xs.every((x) => x.pilot === "master")).toBe(true);
    const share = (f: (x: (typeof xs)[number]) => boolean) => xs.filter(f).length / xs.length;
    expect(share((x) => x.builder === "stock")).toBeGreaterThan(0.2); expect(share((x) => x.builder === "stock")).toBeLessThan(0.3);
    expect(share((x) => x.builder === "light")).toBeGreaterThan(0.44); expect(share((x) => x.builder === "light")).toBeLessThan(0.56);
    for (const n of [0, 0.2, 0.4]) { expect(share((x) => x.noise === n)).toBeGreaterThan(0.28); expect(share((x) => x.noise === n)).toBeLessThan(0.39); }
    expect(seatStrength(77, 5)).toEqual(seatStrength(77, 5));
    let e = make(541);
    expect(e.field[0]!.builder).toBeUndefined(); // the human's seat has none
    const before = e.field.map((x) => [x.builder, x.noise]);
    e = await stepHeadless(e, deps, agents); // the decklists; Day 1 begins
    for (let g = 0; g < 2000 && e.stage === 0; g++) e = await stepHeadless(e, deps, agents);
    expect(e.field.map((x) => [x.builder, x.noise])).toEqual(before); // kept into Day 2
    // the single Sealed event: a noisy seat's deck differs from the plain builder's on its own pool at least sometimes
    const sealed = newSealedEvent({ seed: 542, seats: 32, names: convocationNames(31), faces: FACES }, deps);
    const { buildLimitedDeck } = await import("./limited-builder.js"), { limitedView } = await import("./rating.js");
    const noisy = sealed.field.filter((x) => (x.noise ?? 0) > 0);
    expect(noisy.length).toBeGreaterThan(10);
    // the noise itself, unconfounded by the pair choice: the same pool, the same best pair, σ 0 against σ 0.4
    const { WorldRng } = await import("./rng.js");
    const g = (r: InstanceType<typeof WorldRng>) => Math.sqrt(-2 * Math.log(Math.max(1e-12, r.float()))) * Math.cos(2 * Math.PI * r.float());
    const differs = noisy.filter((x, i) => { const r = new WorldRng(9000 + i); return JSON.stringify(buildLimitedDeck(x.pool, limitedView(rating), cards).deck) !== JSON.stringify(buildLimitedDeck(x.pool, limitedView(rating), cards, { noise: () => 0.4 * g(r) }).deck); }).length;
    expect(differs).toBeGreaterThan(noisy.length / 2); // σ 0.4 changes most builds
  }, 120_000);

  it("S54 — the ledger line keeps the field's top sixteen and the player; the short Convocation runs headless to its Umbel in its Constructed format", async () => {
    const e = await runHeadless(make(543, shortStages("open").map((st) => ({ ...st, rounds: 1 })), 32), deps, agents);
    expect(e.stages!.length).toBe(2);
    expect(e.formatId).toBe("open");
    expect(e.bracket!.rounds.length).toBe(3);
    const line = ledgerEntry(e, "now");
    expect(line.field.length).toBeLessThanOrEqual(LEDGER_FIELD + 1);
    expect(line.field.some((r) => r.name === e.field[0]!.name)).toBe(true);
    expect(line.field.filter((r) => r.place <= LEDGER_FIELD).length).toBe(LEDGER_FIELD);
  }, 120_000);

  // ---------- post-S54 (Chris): Constructed sideboards ----------

  it("post-S54 — the sideboard's rule: fifteen at most; the format's limits on a card hold over the seventy-five (the copy cap, the restricted list, the bans); the sixty's shape is the sixty's alone", () => {
    const e = newConstructedEvent({ seed: 5401, names: convocationNames(15), faces: FACES, library, seats: 16 }, deps);
    const deck = OPEN_DECKS.muster!.decklist, has = (id: string) => deck.find((x) => x.cardId === id)?.count ?? 0;
    expect(checkSideboard(e, deck, [], cards).ok).toBe(true);
    expect(checkSideboard(e, deck, [{ cardId: "disenchant", count: 4 }, { cardId: "doom_blade", count: 4 }, { cardId: "counterspell", count: 4 }, { cardId: "hill_giant", count: 3 }], cards).ok).toBe(true); // any colour: the format's cards, not the deck's
    expect(checkSideboard(e, deck, [{ cardId: "disenchant", count: 4 }, { cardId: "doom_blade", count: 4 }, { cardId: "counterspell", count: 4 }, { cardId: "hill_giant", count: 4 }], cards).problems.join()).toMatch(/16 cards.*allows 15/);
    const four = deck.find((x) => x.count === 4 && !["plains", "island", "swamp", "mountain", "forest"].includes(x.cardId))!;
    expect(checkSideboard(e, deck, [{ cardId: four.cardId, count: 1 }], cards).problems.join()).toMatch(/with the sideboard: .*×5 exceeds the 4-copy cap/);
    expect(has("black_lotus")).toBe(1);
    expect(checkSideboard(e, deck, [{ cardId: "black_lotus", count: 1 }], cards).problems.join()).toMatch(/restricted to one copy/);
    expect(checkSideboard(e, deck, [{ cardId: "law_toll", count: 1 }], cards).problems.join()).toMatch(/banned/);
    expect(checkSideboard(e, deck, [{ cardId: "plains", count: 15 }], cards).ok).toBe(true); // basics uncapped, as in the sixty
  });

  it("post-S54 — the field's fifteen: every Constructed seat registers one, legal beside its sixty, the same for the same deck; from game two it sideboards within its seventy-five (creature answers in against a creature deck) and its deck stays sixty and legal", () => {
    const e = newConstructedEvent({ seed: 5402, names: convocationNames(31), faces: FACES, library, seats: 32 }, deps);
    const again = newConstructedEvent({ seed: 5402, names: convocationNames(31), faces: FACES, library, seats: 32 }, deps);
    const n = (l: { count: number }[]) => l.reduce((k, x) => k + x.count, 0);
    for (let s = 1; s < 32; s++) {
      const seat = e.field[s]!;
      expect(n(seat.sideboard), seat.list).toBe(15);
      expect(checkSideboard(e, seat.deck, seat.sideboard, cards).problems, seat.list).toEqual([]);
      expect(seat.sideboard).toEqual(again.field[s]!.sideboard);
    }
    // the stage of a full Convocation builds them too
    const staged = make(5403, [{ kind: "constructed", formatId: "open", rounds: 1 }], 16);
    const live = staged.registering?.length ? registerDecklist(staged, OPEN_DECKS.levy!.decklist, deps, library, undefined, [{ cardId: "disenchant", count: 2 }]) : null;
    expect(live?.ok).toBe(true);
    if (live?.ok) {
      expect(live.event.field[0]!.sideboard).toEqual([{ cardId: "disenchant", count: 2 }]);
      expect(live.event.sideboards!.open).toEqual([{ cardId: "disenchant", count: 2 }]);
      for (const seat of live.event.field.slice(1)) expect(n(seat.sideboard)).toBe(15);
    }
    // sideboarding: some seat changes its sixty against some opponent, within its seventy-five
    let changed = 0;
    for (let a = 1; a < 12; a++) for (let b = 1; b < 12; b++) {
      if (a === b) continue;
      const g2 = seatForGame(e, a, b, { cards, rating });
      if (g2 === e.field[a]) continue;
      changed += 1;
      expect(n(g2.deck)).toBe(n(e.field[a]!.deck));
      expect(checkEventDeck(e, a, g2.deck, cards).problems).toEqual([]);
      const all = (d: typeof g2.deck, sb: typeof g2.deck) => { const m: Record<string, number> = {}; for (const x of [...d, ...sb]) m[x.cardId] = (m[x.cardId] ?? 0) + x.count; return m; };
      expect(all(g2.deck, g2.sideboard)).toEqual(all(e.field[a]!.deck, e.field[a]!.sideboard));
    }
    expect(changed).toBeGreaterThan(20);
  });

  it("post-S54 — the player's fifteen: registered with the sixty; between games the deck is remade only from the registered seventy-five (a card from outside, or a basic too many, is refused); the next match starts from the registered sixty again", () => {
    let e = newConstructedEvent({ seed: 5404, names: convocationNames(15), faces: FACES, library, seats: 16, rounds: 2 }, deps);
    const deck = OPEN_DECKS.levy!.decklist, side = [{ cardId: "grizzly_bears", count: 3 }, { cardId: "hill_giant", count: 2 }];
    const bad = registerDeck(e, 0, deck, cards, [{ cardId: "law_toll", count: 1 }]);
    expect(bad.ok).toBe(false);
    const r = registerDeck(e, 0, deck, cards, side); if (!r.ok) throw new Error(r.problems.join());
    e = r.event;
    expect(e.phase).toBe("round");
    expect(e.field[0]!.sideboard).toEqual(side);
    expect(e.decklists!.open).toEqual(deck); expect(e.sideboards!.open).toEqual(side);
    // between games: two Bears in for two copies of a spell
    const out = deck.find((x) => !cards.get(x.cardId)!.types.includes("Land") && x.count >= 2)!;
    const swapped = [...deck.map((x) => (x.cardId === out.cardId ? { ...x, count: x.count - 2 } : { ...x })).filter((x) => x.count > 0), { cardId: "grizzly_bears", count: 2 }];
    const g2 = registerDeck(e, 0, swapped, cards); if (!g2.ok) throw new Error(g2.problems.join());
    expect(g2.event.field[0]!.deck).toEqual(swapped);
    expect(g2.event.field[0]!.sideboard).toEqual([{ cardId: "grizzly_bears", count: 1 }, { cardId: out.cardId, count: 2 }, { cardId: "hill_giant", count: 2 }].sort((a, b) => a.cardId.localeCompare(b.cardId)));
    expect(g2.event.decklists!.open).toEqual(deck); // the registration stands
    const outside = registerDeck(e, 0, [...deck, { cardId: "counterspell", count: 1 }], cards);
    expect(outside.ok).toBe(false); if (!outside.ok) expect(outside.problems.join()).toMatch(/Counterspell: the deck has 1, your registered seventy-five has 0/);
    const basic = deck.find((x) => ["plains", "island", "swamp", "mountain", "forest"].includes(x.cardId));
    if (basic) { const more = registerDeck(e, 0, deck.map((x) => (x.cardId === basic.cardId ? { ...x, count: x.count + 1 } : x)), cards); expect(more.ok).toBe(false); }
    // the series recorded: the registered sixty and fifteen again
    const p = e.pairings.find((x) => x.a === 0 || x.b === 0)!;
    const done = { seed: 1, bestOf: 3, games: [], wins: [2, 0], draws: 0, done: true, winner: 0 } as never;
    const after = recordSeries(g2.event, p.a, p.b!, done);
    expect(after.field[0]!.deck).toEqual(deck);
    expect(after.field[0]!.sideboard).toEqual(side);
  });

  it("post-S55 (Chris's matchup study) — sideboarding reads plans: the Pall never sideboards out a card of its own plan (it was cutting two Buried Alives for two Tendrils); against the Pall the graveyard exile comes in and STAYS in, and counterspells are not taken out", () => {
    const pall = OPEN_DECKS.pall!, n = (l: { cardId: string; count: number }[], id: string) => l.find((e) => e.cardId === id)?.count ?? 0;
    for (const k of ["coin", "muster", "undertow", "levy", "wurmspeaker"]) {
      const sb = aiSideboard(pall.decklist, [...pall.sideboard!], OPEN_DECKS[k]!.decklist, cards, rating, AI_SIDEBOARD_CONSTRUCTED);
      for (const id of ["buried_alive", "zombify", "the_usher", "the_jet_witch", "demonic_tutor", "dark_ritual", "black_lotus"]) expect(n(sb.deck, id), `${id} against ${k}`).toBe(n(pall.decklist, id));
      expect(sb.deck.reduce((a, e) => a + e.count, 0)).toBe(60);
    }
    for (const k of ["levy", "sweep", "hearth", "coin", "locks", "muster"]) {
      const o = OPEN_DECKS[k]!, fifteen = buildSideboard(o.decklist, OPEN_FORMAT, rating, cards, answersRelics, answersCreatures);
      expect(n(fifteen, "tormods_crypt") + n(fifteen, "faerie_macabre"), k).toBe(4);
      const sb = aiSideboard(o.decklist, fifteen, pall.decklist, cards, rating, AI_SIDEBOARD_CONSTRUCTED);
      expect(n(sb.deck, "tormods_crypt") + n(sb.deck, "faerie_macabre"), `the hate stays in for ${k}`).toBe(4); // the black lists' creature answers used to swap three back out
      for (const c of ["counterspell", "undermine", "absorb", "essence_scatter"]) expect(n(sb.deck, c), `${c} in ${k}`).toBe(n(o.decklist, c));
    }
    // and against a list with no plan the Locks' counters still go out for a creature deck, as before
    const locks = OPEN_DECKS.locks!, sb = aiSideboard(locks.decklist, buildSideboard(locks.decklist, OPEN_FORMAT, rating, cards, answersRelics, answersCreatures), OPEN_DECKS.muster!.decklist, cards, rating, AI_SIDEBOARD_CONSTRUCTED);
    expect(sb.swaps.some((x) => x.rule === "counters")).toBe(true);
  });
});
