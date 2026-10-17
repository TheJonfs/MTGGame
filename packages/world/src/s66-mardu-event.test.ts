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
import { MARDU_FORMAT } from "./formats.js";
import { cardLegal } from "./constructed-builder.js";
import { checkDeck } from "./legality.js";

/** S66 (Part 1): Mardu, the third triad — its colours and the land rule, and an event played headless to the end. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const deps = { cards, packs, rating: read("card-rating.json"), knobs: defaultKnobs(), library: authoredLists(ROOT) };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));
const FACES = Array.from({ length: 40 }, (_, i) => ({ portrait: `face${i}`, colors: "WUBRG"[i % 5]! }));
const legal = (id: string) => cardLegal(cards.get(id)!, MARDU_FORMAT.rule);

describe("Mardu at the door (S66)", () => {
  it("the colours and the land rule: red, white and black — the Usher, Mox Ruby, Pearl and Jet, Badlands, Scrubland, Plateau, the Observatory and Cairnbrand are in; blue and green cards, Volcanic Island, Mox Sapphire and the Tallyflame Court out", () => {
    for (const id of ["plains", "mountain", "swamp", "badlands", "scrubland", "plateau", "blood_crypt", "godless_shrine", "sacred_foundry", "obsidian_observatory", "cairnbrand", "mox_pearl", "mox_ruby", "mox_jet", "black_lotus", "the_usher", "vindicate", "lightning_bolt", "wrath_of_god"]) expect(legal(id), id).toBe(true);
    for (const id of ["island", "forest", "volcanic_island", "bayou", "tallyflame_court", "mox_sapphire", "mox_emerald", "counterspell", "clio_lady_of_the_depths", "manaba"]) expect(legal(id), id).toBe(false);
    const c = checkDeck([{ cardId: "mountain", count: 56 }, { cardId: "mox_sapphire", count: 1 }, { cardId: "volcanic_island", count: 3 }], null, MARDU_FORMAT.rule, cards);
    expect(c.problems.join(" ")).toMatch(/make mana outside Mardu's colours/);
  });
  it("a Constructed event in Mardu: every seat one of its own lists (ADR-184), legal; played to a champion", async () => {
    const start = newConstructedEvent({ seed: 6601, format: MARDU_FORMAT, names: convocationNames(15), faces: FACES, library: deps.library, seats: 16, rounds: 2, top8: false }, deps);
    expect(start.formatId).toBe("mardu");
    const e = await runHeadless(start, deps, agents);
    expect(e.phase).toBe("over");
    for (const s of e.field) {
      for (const x of [...s.deck, ...s.sideboard]) expect(legal(x.cardId), `${s.name}: ${x.cardId}`).toBe(true);
    }
    // ADR-184: a triad's field is its own registered lists
    for (const s of e.field) if (s.list) expect(s.list.startsWith("mardu:"), s.list).toBe(true);
    expect(e.results.length).toBeGreaterThan(0);
  }, 240_000);
});
