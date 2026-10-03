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
  CONVOCATION_SEATS, defaultStages, deserializeEvent, finalPlaces, finishTitle, keepAllowance, lastLimitedPool, ledgerEntry, newConvocation, serializeEvent, stageLastRound, standings,
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
    expect(e.phase).toBe("draft");
    expect(e.pods!.length).toBe(4);
    expect(new Set(e.pods!.flat()).size).toBe(32);
    expect(e.draft!.pod![0]).toBe(0);
    const faces = e.field.map((s) => s.face);
    const seen: { stage: number; phase: string; round: number }[] = [];
    let secondPods: number[][] | null = null, standingsBefore: number[] | null = null;
    while (e.phase !== "over") {
      const before = e;
      e = await stepHeadless(e, deps, agents);
      if (before.phase === "interlude" && e.stage === 2) { secondPods = e.pods!; standingsBefore = standings(before).map((r) => r.seat); }
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

  it("a Sealed stage deals every seat its own pool and the field varies its pair (ADR-154); a Constructed stage builds the field by select-and-repair", () => {
    const e = make(533, [{ kind: "sealed", formatId: "sealed-plane", rounds: 1 }, { kind: "constructed", formatId: "open", rounds: 1 }], 16);
    expect(e.phase).toBe("build");
    expect(e.pods).toBeUndefined();
    expect(new Set(e.field.map((s) => s.pool.join())).size).toBe(16);
    expect(e.field.slice(1).every((s) => s.deck.length > 0)).toBe(true);
    expect(() => make(534, [{ kind: "constructed", formatId: "sealed-plane", rounds: 1 }], 16)).toThrow(/stage constructed/);
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
});
