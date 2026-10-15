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
import { ESPER_FORMAT } from "./formats.js";
import { cardLegal } from "./constructed-builder.js";
import { checkDeck } from "./legality.js";

/** S65 (Part 1): Esper, the second triad — its colours and the land rule, and a five-round event played headless to the end. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const deps = { cards, packs, rating: read("card-rating.json"), knobs: defaultKnobs(), library: authoredLists(ROOT) };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));
const FACES = Array.from({ length: 40 }, (_, i) => ({ portrait: `face${i}`, colors: "WUBRG"[i % 5]! }));
const legal = (id: string) => cardLegal(cards.get(id)!, ESPER_FORMAT.rule);

describe("Esper at the door (S65)", () => {
  it("the colours and the land rule: white, blue and black — the Usher (Mardu) and the Reeve (BUG) are out; Clio, the Dredger, the Moxen of its colours and Black Lotus are in; off-colour duals and basics out", () => {
    for (const id of ["plains", "island", "swamp", "tundra", "underground_sea", "scrubland", "obsidian_observatory", "mox_pearl", "mox_sapphire", "mox_jet", "black_lotus", "clio_lady_of_the_depths", "the_dredger", "isaura_the_levy", "counterspell", "wrath_of_god"]) expect(legal(id), id).toBe(true);
    for (const id of ["mountain", "forest", "badlands", "bayou", "tropical_island", "mox_ruby", "mox_emerald", "the_usher", "the_reeve", "lightning_bolt", "wrackroot"]) expect(legal(id), id).toBe(false);
    const c = checkDeck([{ cardId: "island", count: 56 }, { cardId: "mox_ruby", count: 1 }, { cardId: "bayou", count: 3 }], null, ESPER_FORMAT.rule, cards);
    expect(c.problems.join(" ")).toMatch(/make mana outside Esper's colours/);
  });
  it("a Constructed event in Esper: every seat one of its own lists (ADR-184), legal; played to a champion", async () => {
    const start = newConstructedEvent({ seed: 6501, format: ESPER_FORMAT, names: convocationNames(15), faces: FACES, library: deps.library, seats: 16, rounds: 2, top8: false }, deps);
    expect(start.formatId).toBe("esper");
    const e = await runHeadless(start, deps, agents);
    expect(e.phase).toBe("over");
    for (const s of e.field) {
      for (const x of [...s.deck, ...s.sideboard]) expect(legal(x.cardId), `${s.name}: ${x.cardId}`).toBe(true);
    }
    // S65 (ADR-184): a triad's field is its own registered lists — no campaign deck (the Fordkeeper's stronghold list is Naya-legal and once sat)
    for (const s of e.field) if (s.list) expect(s.list.startsWith("esper:"), s.list).toBe(true);
    expect(e.results.length).toBeGreaterThan(0);
  }, 240_000);
});
