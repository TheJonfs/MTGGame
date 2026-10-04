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

/** S54: the difficulty, the field's strength, the ledger trim and the short Convocation. Its own file: a test file's
 * synchronous work must stay under vitest's 60 s RPC window ("Timeout calling onTaskUpdate"), and the S53 file is near it. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json");
const library = authoredLists(ROOT);
const deps = { cards, packs, rating, knobs: defaultKnobs(), library };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck));
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
});
