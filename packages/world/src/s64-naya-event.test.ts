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
import { newConstructedEvent, type SeatAgents } from "./event.js";
import type { ConvocationPackData } from "./packs.js";
import { NAYA_FORMAT } from "./formats.js";
import { cardLegal } from "./constructed-builder.js";
import { checkDeck } from "./legality.js";

/** S64 (ADR-181, Part 3): Naya, the first triad — the land rule, and a five-round event played headless to the end. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const deps = { cards, packs, rating: read("card-rating.json"), knobs: defaultKnobs(), library: authoredLists(ROOT) };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));
const FACES = Array.from({ length: 40 }, (_, i) => ({ portrait: `face${i}`, colors: "WUBRG"[i % 5]! }));
const legal = (id: string) => cardLegal(cards.get(id)!, NAYA_FORMAT.rule);

describe("Naya at the door (S64, ADR-181)", () => {
  it("the land rule: a land or a mana artifact makes only red, green and white — off-colour basics, duals, High Grounds and Moxen are out; Black Lotus and Birds of Paradise stay", () => {
    for (const id of ["mountain", "forest", "plains", "plateau", "taiga", "savannah", "stomping_ground", "shevelport", "mox_ruby", "mox_pearl", "mox_emerald", "black_lotus", "birds_of_paradise", "evolving_wilds"]) expect(legal(id), id).toBe(true);
    for (const id of ["island", "swamp", "badlands", "volcanic_island", "tropical_island", "tallyflame_court", "cairnbrand", "mox_jet", "mox_sapphire", "counterspell", "the_reaper"]) expect(legal(id), id).toBe(false);
    const c = checkDeck([{ cardId: "mountain", count: 56 }, { cardId: "mox_jet", count: 1 }, { cardId: "badlands", count: 3 }], null, NAYA_FORMAT.rule, cards);
    expect(c.problems.join(" ")).toMatch(/make mana outside Naya's colours/);
  });
  it("a Constructed event in Naya: every seat legal in Naya, most of them its own lists; played to a champion", async () => {
    const start = newConstructedEvent({ seed: 6401, format: NAYA_FORMAT, names: convocationNames(15), faces: FACES, library: deps.library, seats: 16, rounds: 2, top8: false }, deps);
    expect(start.formatId).toBe("naya");
    const e = await runHeadless(start, deps, agents);
    expect(e.phase).toBe("over");
    for (const s of e.field) {
      for (const x of [...s.deck, ...s.sideboard]) expect(legal(x.cardId), `${s.name}: ${x.cardId}`).toBe(true);
    }
    // most seats are Naya's own lists; a legal list from the authored library may sit too (the Fordkeeper's stronghold deck is Naya-legal)
    expect(e.field.filter((s) => s.list?.startsWith("naya:")).length).toBeGreaterThan(e.field.length / 2);
    expect(e.results.length).toBeGreaterThan(0);
  }, 240_000);
});
