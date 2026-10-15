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
import { defaultStages, eventFormat, newConstructedEvent, newConvocation, shortStages, type ConvocationEvent, type SeatAgents } from "./event.js";
import type { ConvocationPackData } from "./packs.js";
import { PEASANT_FORMAT } from "./formats.js";
import { cardLegal } from "./constructed-builder.js";
import { formatView } from "./rating.js";

/** S62 (ADR-176, Part 4): Peasant at the door — a five-round event and a Convocation day, played headless to the end. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json");
const library = authoredLists(ROOT);
const deps = { cards, packs, rating, knobs: defaultKnobs(), library };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));
const FACES = Array.from({ length: 40 }, (_, i) => ({ portrait: `face${i}`, colors: "WUBRG"[i % 5]! }));
const peasantOnly = (e: ConvocationEvent) => {
  for (const s of e.field) {
    if (s.list) expect(s.list.startsWith("peasant:"), s.list).toBe(true);
    for (const x of [...s.deck, ...s.sideboard]) expect(cardLegal(cards.get(x.cardId)!, PEASANT_FORMAT.rule), `${s.name}: ${x.cardId}`).toBe(true);
    expect(s.deck.reduce((n, x) => n + x.count, 0)).toBeGreaterThanOrEqual(60);
  }
};

describe("Peasant at the door (S62, ADR-176)", () => {
  it("a Constructed event in Peasant: every seat a Peasant list with a Peasant fifteen, no list on more than a tenth of the seats; played to a champion", async () => {
    const start = newConstructedEvent({ seed: 6201, format: PEASANT_FORMAT, names: convocationNames(15), faces: FACES, library, seats: 16, rounds: 2, top8: false }, deps);
    expect(start.formatId).toBe("peasant");
    const e = await runHeadless(start, deps, agents);
    expect(e.phase).toBe("over");
    peasantOnly(e);
    const by = new Map<string, number>(); for (const s of e.field) if (s.list) by.set(s.list, (by.get(s.list) ?? 0) + 1);
    expect(Math.max(...by.values())).toBeLessThanOrEqual(2); // a tenth of sixteen seats, rounded up
    expect(e.results.length).toBeGreaterThan(0);
  }, 240_000);

  it("a short Convocation whose Constructed day is Peasant: the draft, then the Peasant day with Peasant lists; the four-day stages take Peasant on either Constructed day", async () => {
    const stages = shortStages("peasant").map((st) => ({ ...st, rounds: 1 }));
    expect(stages.some((s) => s.formatId === "peasant")).toBe(true);
    const e = await runHeadless(newConvocation({ seed: 6202, stages, seats: 32, names: convocationNames(31), faces: FACES, library }, deps), deps, agents);
    expect(e.phase).toBe("over");
    expect(eventFormat(e.formatId).id).toBe("peasant");
    peasantOnly(e);
    expect(defaultStages("peasant", "open").filter((s) => s.kind === "constructed").map((s) => s.formatId)).toEqual(["open", "peasant"]);
    expect(defaultStages("open", "peasant").filter((s) => s.kind === "constructed").map((s) => s.formatId)).toEqual(["peasant", "open"]);
  }, 300_000);

  it("the Peasant score (ADR-153's column): a reader of the format sees each card's Peasant number as its rating; the Open's reader sees the table as it was", () => {
    const p = formatView(rating, "peasant");
    expect(p.cards.vampire_nighthawk!.rating).toBe((rating.cards.vampire_nighthawk as { peasant: number }).peasant);
    expect(p.cards.vampire_nighthawk!.rating).not.toBe(rating.cards.vampire_nighthawk.rating);
    expect(formatView(rating, "open")).toBe(rating); // no column of that name: the table itself
    expect(p.cards.black_lotus).toBe(rating.cards.black_lotus); // not a Peasant card: its row is untouched
    const legal = [...cards.values()].filter((d) => !d.types.includes("Land") && cardLegal(d, PEASANT_FORMAT.rule) && !["plains", "island", "swamp", "mountain", "forest"].includes(d.id));
    // every legal card has a score as of the last `pnpm rating:format --write` (a card added after it reads its tier's prior until the next: name it here)
    const unscored = legal.filter((d) => typeof (rating.cards[d.id] as { peasant?: number } | undefined)?.peasant !== "number").map((d) => d.id).sort();
    expect(unscored).toEqual(["basilisk_collar", "karmic_mentor", "mentor_of_the_meek", "retribution_of_the_meek", "wall_of_razors"]); // post-S62: the Collar, the Wall and the Retribution are newer than the score (tier interim; in no list) — rebuilt when the seeds change
    const xs = legal.filter((d) => !unscored.includes(d.id)).map((d) => p.cards[d.id]!.rating).sort((a, b) => a - b);
    expect(xs[Math.floor(0.9 * xs.length)]! - xs[Math.floor(0.1 * xs.length)]!).toBeGreaterThan(1.2); // a real spread (the Limited score sat inside half a point on this shelf)
  });
});
