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

/** S53 (Part 1): the full Convocation — a list of stages, the record carried, the draft rounds inside their pods. */
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

describe("the full Convocation (S53)", () => {
  it("the default is the Pro Tour's shape at 128 seats: a draft, the Open, a draft, a second Constructed format — sixteen Swiss rounds", () => {
    expect(CONVOCATION_SEATS).toBe(128);
    const st = defaultStages("pauper");
    expect(st.map((s) => [s.kind, s.formatId, s.rounds])).toEqual([["draft", "draft-plane", 3], ["constructed", "open", 5], ["draft", "draft-plane", 3], ["constructed", "pauper", 5]]);
    expect(stageLastRound({ stages: st }, 3)).toBe(16);
  });

  it("four stages headless: the pods of eight, the draft rounds inside them, the second draft's pods by the standings, the record carried, no rematch, one face a seat, the Umbel in the last format, the finish and its title", async () => {
    let e = make(531);
    // the decklists first (Chris: registered at the start, locked through the Umbel): both days are the Open — one deck
    expect([e.phase, e.registering, e.formatId]).toEqual(["build", ["open"], "open"]);
    e = await stepHeadless(e, deps, agents);
    expect(e.registering).toBeUndefined();
    expect(Object.keys(e.decklists!)).toEqual(["open"]);
    expect(e.phase).toBe("draft");
    expect(e.pods!.length).toBe(4);
    expect(new Set(e.pods!.flat()).size).toBe(32);
    expect(e.draft!.pod![0]).toBe(0);
    const faces = e.field.map((s) => s.face);
    expect(faces.slice(1).every(Boolean)).toBe(true); // the portraits recycle: every opponent has a face
    let day2: ConvocationEvent | null = null;
    const seen: { stage: number; phase: string; round: number }[] = [];
    let secondPods: number[][] | null = null, standingsBefore: number[] | null = null;
    while (e.phase !== "over") {
      const before = e;
      e = await stepHeadless(e, deps, agents);
      if (before.phase === "draft" && e.phase !== "draft") { // the draft is done: every seat holds its own forty-five and a deck from them (the live pod's included)
        for (const [s, seat] of e.field.entries()) { expect(seat.pool.length, `seat ${s}`).toBe(45); if (s > 0) expect(seat.deck.reduce((n, x) => n + x.count, 0), `seat ${s}`).toBeGreaterThanOrEqual(40); }
        const live = before.draft!.pod!;
        for (const [s, seat] of before.field.entries()) {
          if (live.includes(s)) expect(seat.pool, `live seat ${s} drafts live`).toEqual([]);
          else expect(e.field[s]!.pool, `seat ${s} keeps its pod's picks`).toEqual(seat.pool);
        }
      }
      if (before.phase === "interlude" && e.stage === 2) { secondPods = e.pods!; standingsBefore = standings(before).map((r) => r.seat); }
      if (before.phase === "interlude" && e.stage === 1) { expect(e.phase).toBe("round"); day2 = e; } // the registered deck plays: no build
      if (before.phase === "interlude" && e.stage === 3) { // Day 4 in the same format: every seat plays its Day 2 deck
        expect(e.phase).toBe("round");
        expect(e.field.map((x) => x.deck)).toEqual(day2!.field.map((x) => x.deck));
      }
      if (e.phase === "round" && before.phase !== "round" && e.stages![e.stage!]!.kind === "draft") { // a draft round's pairings stay inside the pods
        for (const p of e.pairings) expect(e.pods!.some((pod) => pod.includes(p.a) && pod.includes(p.b!))).toBe(true);
      }
      seen.push({ stage: e.stage!, phase: e.phase, round: e.round });
    }
    expect(seen.filter((x) => x.phase === "interlude").map((x) => x.stage)).toEqual([0, 1, 2]); // the days end three times
    expect(e.round).toBe(4);
    // the second draft's pods are the standings in eights
    expect(secondPods!.map((pod) => [...pod].sort((a, b) => a - b))).toEqual([0, 1, 2, 3].map((q) => standingsBefore!.slice(q * 8, q * 8 + 8).sort((a, b) => a - b)));
    // the record carried: every seat played four Swiss series (no byes at 32), no rematch across the event
    const table = standings(e);
    for (const r of table) expect(r.wins + r.losses + r.draws).toBe(4);
    const pairs = e.results.map((r) => [r.a, r.b].sort((x, y) => x - y).join("-"));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(e.field.map((s) => s.face)).toEqual(faces); // one face for the whole event
    // the Umbel: the eight by the carried standings, in the last stage's format (the Open)
    expect(e.formatId).toBe("open");
    expect(e.bracket!.seeds).toEqual(table.slice(0, 8).map((r) => r.seat));
    expect(e.field.filter((s) => !s.human).every((s) => s.list)).toBe(true); // the field's last decks are Constructed
    // the human's four registrations
    expect(e.history!.map((h) => [h.stage, h.formatId])).toEqual([[0, "draft-plane"], [1, "open"], [2, "draft-plane"], [3, "open"]]);
    expect(e.history![3]!.deck).toEqual(e.decklists!.open); // the Umbel plays the registered deck
    expect(e.field[0]!.deck).toEqual(e.decklists!.open);
    expect(e.history![0]!.pool.length).toBe(45);
    expect(e.history![2]!.pool).not.toEqual(e.history![0]!.pool); // the second draft is its own
    // the finish
    const place = finalPlaces(e).find((p) => p.seat === 0)!.place, line = ledgerEntry(e, "now");
    expect(line.title).toBe(finishTitle(place, 32));
    expect(line.decks!.length).toBe(4);
    expect(line.stages!.length).toBe(4);
    expect(keepAllowance(e)).toBe(place === 1 ? 2 : place <= 8 ? 1 : 0);
    expect(lastLimitedPool(e)).toEqual(e.history![2]!.pool);
  }, 120_000);

  it("saved and resumed after every transition — inside a draft, between stages, in the bracket — the event ends as the uninterrupted one", async () => {
    const straight = await runHeadless(make(532), deps, agents);
    let saves = 0;
    const resumed = await runHeadless(make(532), deps, agents, (e) => { saves += 1; const back = deserializeEvent(serializeEvent(e)); expect(back).not.toBeNull(); return back!; });
    expect(saves).toBeGreaterThan(100); // ninety draft picks among them
    expect(resumed.results).toEqual(straight.results);
    expect(resumed.bracket).toEqual(straight.bracket);
    expect(finalPlaces(resumed)).toEqual(finalPlaces(straight));
  }, 240_000);

  it("a Sealed stage deals every seat its own pool and the field varies its pair (ADR-154); a Constructed stage builds the field by select-and-repair", async () => {
    let e = make(533, [{ kind: "sealed", formatId: "sealed-plane", rounds: 1 }, { kind: "constructed", formatId: "open", rounds: 1 }], 16);
    expect(e.registering).toEqual(["open"]);
    e = await stepHeadless(e, deps, agents); // the Open's decklist; then the Sealed day deals
    expect(e.phase).toBe("build");
    expect(e.pods).toBeUndefined();
    expect(new Set(e.field.map((s) => s.pool.join())).size).toBe(16);
    expect(e.field.slice(1).every((s) => s.deck.length > 0)).toBe(true);
    expect(() => make(534, [{ kind: "constructed", formatId: "sealed-plane", rounds: 1 }], 16)).toThrow(/stage constructed/);
  });

  it("two Constructed formats: two decklists before Day 1, in the stages' order; an illegal one is refused", async () => {
    const { registerDecklist, suggestedConstructedDeck } = await import("./event.js");
    let e = make(536, [{ kind: "sealed", formatId: "sealed-plane", rounds: 1 }, { kind: "constructed", formatId: "pauper", rounds: 1 }, { kind: "constructed", formatId: "open", rounds: 1 }], 16);
    expect(e.registering).toEqual(["pauper", "open"]);
    const bad = registerDecklist(e, [{ cardId: "black_lotus", count: 1 }], deps, library);
    expect(bad.ok).toBe(false);
    const r1 = registerDecklist(e, suggestedConstructedDeck(e, library, deps), deps, library); if (!r1.ok) throw new Error(r1.problems.join());
    expect([r1.event.registering, r1.event.formatId, r1.event.phase]).toEqual([["open"], "open", "build"]);
    const r2 = registerDecklist(r1.event, suggestedConstructedDeck(r1.event, library, deps), deps, library); if (!r2.ok) throw new Error(r2.problems.join());
    e = r2.event;
    expect(Object.keys(e.decklists!)).toEqual(["pauper", "open"]);
    expect([e.formatId, e.phase, e.stage]).toEqual(["sealed-plane", "build", 0]);
  });

  it("a v1 save (a single event) still loads; the save is now v2", () => {
    const e = make(535, [{ kind: "sealed", formatId: "sealed-plane", rounds: 1 }], 8);
    const text = serializeEvent(e);
    expect(JSON.parse(text).format).toBe("convocation-event-v2");
    const v1 = JSON.stringify({ format: "convocation-event-v1", event: { ...e, version: 1, stages: undefined, stage: undefined } });
    expect(deserializeEvent(v1)!.version).toBe(2);
    expect(deserializeEvent(JSON.stringify({ format: "convocation-event-v3", event: e }))).toBeNull();
  });

  it("the titles", () => {
    expect([1, 2, 3, 4, 5, 8, 9, 21, 22, 23, 111, 112].map((p) => finishTitle(p, 128))).toEqual(["Champion of the Umbel", "the Umbel's second stalk", "a semi-finalist", "a semi-finalist", "an Umbel seat", "an Umbel seat", "9th of 128", "21st of 128", "22nd of 128", "23rd of 128", "111th of 128", "112th of 128"]);
  });

  // ---------- S54 ----------

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
