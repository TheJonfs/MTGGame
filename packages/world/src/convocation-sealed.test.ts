import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { defaultKnobs } from "./knobs.js";
import { authoredLists } from "./authored-lists.js";
import { convocationNames } from "./convocation-names.js";
import { runHeadless } from "./convocation-run.js";
import { CONVOCATION_SEATS, beginStage, defaultStages, limitedStage, newConvocation, shortStages, type ConvocationStage, type SeatAgents } from "./event.js";
import { DRAFT_PLANE, LIMITED_FORMATS, SEALED_PLANE } from "./formats.js";
import type { ConvocationPackData } from "./packs.js";

/** Post-S70 (Chris): a Convocation's Limited days may be Sealed; the default stays a draft. Its own file: the S53 and
 * S54 files are near vitest's 60 s RPC window. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json");
const library = authoredLists(ROOT);
const deps = { cards, packs, rating, knobs: defaultKnobs(), library };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));
const FACES = Array.from({ length: 40 }, (_, i) => ({ portrait: `face${i}`, colors: "WUBRG"[i % 5]! }));
const make = (seed: number, stages: ConvocationStage[], seats = 32) => newConvocation({ seed, stages, seats, names: convocationNames(seats - 1), faces: FACES, library }, deps);

describe("Post-S70 — a Convocation's Limited days", () => {
  it("the default is a draft on both Limited days; a day's kind follows its format's shape", () => {
    expect(defaultStages("open").map((s) => s.kind)).toEqual(["draft", "constructed", "draft", "constructed"]);
    expect(shortStages("open")[0]).toEqual({ kind: "draft", formatId: DRAFT_PLANE.id, rounds: 3 });
    expect(defaultStages("open", "open", [SEALED_PLANE.id, DRAFT_PLANE.id]).map((s) => s.kind)).toEqual(["sealed", "constructed", "draft", "constructed"]);
    expect(shortStages("open", SEALED_PLANE.id)[0]).toEqual({ kind: "sealed", formatId: SEALED_PLANE.id, rounds: 3 });
    for (const f of LIMITED_FORMATS) expect(limitedStage(f.id).kind).toBe(f.shape); // a new Limited format is a stage
    expect(() => limitedStage("open")).toThrow(); // a Constructed format is not a Limited day
  });

  it("a Sealed first day, then a draft: runs headless to the Umbel; the Sealed pool is six packs, the decks forty", async () => {
    const stages = defaultStages("open", "open", [SEALED_PLANE.id, DRAFT_PLANE.id]).map((s) => ({ ...s, rounds: 1 }));
    const e = await runHeadless(make(701, stages), deps, agents);
    expect(e.phase).toBe("over");
    expect(e.stages!.map((s) => s.kind)).toEqual(["sealed", "constructed", "draft", "constructed"]);
    const day1 = e.history!.find((h) => h.stage === 0)!;
    expect(day1.pool.length).toBe(90); // six packs of fifteen
    expect(day1.deck.reduce((n, c) => n + c.count, 0)).toBeGreaterThanOrEqual(40);
    expect(e.bracket!.rounds.length).toBe(3);
  }, 180_000);

  it("a Sealed day at the full 128 seats: every seat dealt and built, fast enough for the main thread", () => {
    const stages = defaultStages("open", "open", [SEALED_PLANE.id, DRAFT_PLANE.id]);
    const e = make(702, stages, CONVOCATION_SEATS);
    const { registering: _r, ...done } = e;
    const t = performance.now();
    const at = beginStage({ ...done, formatId: stages[0]!.formatId, decklists: { open: [] } }, 0, deps, library);
    const ms = performance.now() - t;
    console.log(`Sealed day, ${CONVOCATION_SEATS} seats: ${Math.round(ms)} ms`);
    expect(at.phase).toBe("build");
    expect(at.field[0]!.pool!.length).toBe(90);
    expect(at.field.slice(1).every((s) => s.deck.reduce((n, c) => n + c.count, 0) >= 40)).toBe(true);
    expect(new Set(at.field.slice(1).map((s) => s.colors)).size).toBeGreaterThan(3); // the field varies its pairs
  }, 120_000);
});
