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
import { ABZAN_FORMAT, BANT_FORMAT, SULTAI_FORMAT, TEMUR_FORMAT, type ConstructedFormat } from "./formats.js";
import { cardLegal } from "./constructed-builder.js";
import { checkDeck } from "./legality.js";

/** S69 (Part 1): the shallow batch — each its colours and the land rule, and an event played headless to the end. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const deps = { cards, packs, rating: read("card-rating.json"), knobs: defaultKnobs(), library: authoredLists(ROOT) };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));
const FACES = Array.from({ length: 40 }, (_, i) => ({ portrait: `face${i}`, colors: "WUBRG"[i % 5]! }));

const TRIADS: { f: ConstructedFormat; seed: number; lord: string; inn: string[]; out: string[]; offMana: string }[] = [
  { f: SULTAI_FORMAT, seed: 6901, lord: "the_reeve", inn: ["island", "swamp", "forest", "underground_sea", "bayou", "tropical_island", "watery_grave", "overgrown_tomb", "breeding_pool", "wrackroot", "mox_jet", "mox_sapphire", "mox_emerald", "clio_lady_of_the_depths", "putrefy"], out: ["plains", "mountain", "scrubland", "volcanic_island", "cairnbrand", "mox_pearl", "mox_ruby", "lightning_bolt", "wrath_of_god", "pyroclasm"], offMana: "mox_ruby" },
  { f: ABZAN_FORMAT, seed: 6902, lord: "the_warden", inn: ["plains", "swamp", "forest", "scrubland", "savannah", "bayou", "godless_shrine", "temple_garden", "overgrown_tomb", "obsidian_observatory", "mox_pearl", "mox_jet", "mox_emerald", "vindicate", "putrefy"], out: ["island", "mountain", "tundra", "badlands", "tallyflame_court", "mox_sapphire", "mox_ruby", "counterspell", "lightning_bolt", "clio_lady_of_the_depths"], offMana: "mox_sapphire" },
  { f: TEMUR_FORMAT, seed: 6903, lord: "the_unwinder", inn: ["island", "mountain", "forest", "volcanic_island", "tropical_island", "taiga", "steam_vents", "stomping_ground", "breeding_pool", "tallyflame_court", "wrackroot", "mox_sapphire", "mox_ruby", "mox_emerald", "counterspell"], out: ["plains", "swamp", "bayou", "scrubland", "cairnbrand", "mox_jet", "mox_pearl", "swords_to_plowshares", "doom_blade", "clio_lady_of_the_depths"], offMana: "mox_jet" },
  { f: BANT_FORMAT, seed: 6904, lord: "the_sower", inn: ["island", "plains", "forest", "tundra", "savannah", "tropical_island", "hallowed_fountain", "temple_garden", "breeding_pool", "shevelport", "wrackroot", "mox_sapphire", "mox_pearl", "mox_emerald", "counterspell"], out: ["swamp", "mountain", "bayou", "volcanic_island", "obsidian_observatory", "mox_jet", "mox_ruby", "lightning_bolt", "doom_blade", "pyroclasm"], offMana: "mox_ruby" },
];

describe("the shallow triads at the door (S69)", () => {
  for (const t of TRIADS) {
    const legal = (id: string) => cardLegal(cards.get(id)!, t.f.rule);
    it(`${t.f.name}: its colours and the land rule — ${t.lord} in`, () => {
      for (const id of [...t.inn, t.lord]) expect(legal(id), id).toBe(true);
      for (const id of t.out) expect(legal(id), id).toBe(false);
      const c = checkDeck([{ cardId: t.inn[0]!, count: 59 }, { cardId: t.offMana, count: 1 }], null, t.f.rule, cards);
      expect(c.problems.join(" ")).toMatch(new RegExp(`makes? mana outside ${t.f.name}'s colours`));
    });
    it(`${t.f.name}: a Constructed event — every seat one of its own lists (ADR-184), legal; played to a champion`, async () => {
      const start = newConstructedEvent({ seed: t.seed, format: t.f, names: convocationNames(15), faces: FACES, library: deps.library, seats: 16, rounds: 2, top8: false }, deps);
      expect(start.formatId).toBe(t.f.id);
      const e = await runHeadless(start, deps, agents);
      expect(e.phase).toBe("over");
      for (const s of e.field) for (const x of [...s.deck, ...s.sideboard]) expect(legal(x.cardId), `${s.name}: ${x.cardId}`).toBe(true);
      for (const s of e.field) if (s.list) expect(s.list.startsWith(`${t.f.id}:`), s.list).toBe(true);
      expect(e.results.length).toBeGreaterThan(0);
    }, 240_000);
  }
});
