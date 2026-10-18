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
import { GRIXIS_FORMAT, JESKAI_FORMAT, JUND_FORMAT, type ConstructedFormat } from "./formats.js";
import { cardLegal } from "./constructed-builder.js";
import { checkDeck } from "./legality.js";

/** S67 (Part 2): the deep triads as a batch — each its colours and the land rule, and an event played headless to the end. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const deps = { cards, packs, rating: read("card-rating.json"), knobs: defaultKnobs(), library: authoredLists(ROOT) };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));
const FACES = Array.from({ length: 40 }, (_, i) => ({ portrait: `face${i}`, colors: "WUBRG"[i % 5]! }));

const TRIADS: { f: ConstructedFormat; seed: number; lord: string; inn: string[]; out: string[]; offMana: string }[] = [
  { f: GRIXIS_FORMAT, seed: 6701, lord: "the_stoker", inn: ["island", "swamp", "mountain", "volcanic_island", "badlands", "underground_sea", "watery_grave", "tallyflame_court", "cairnbrand", "mox_sapphire", "mox_jet", "mox_ruby", "counterspell", "clio_lady_of_the_depths", "lightning_bolt"], out: ["plains", "forest", "scrubland", "bayou", "obsidian_observatory", "mox_pearl", "mox_emerald", "swords_to_plowshares", "vindicate", "manaba"], offMana: "mox_pearl" },
  { f: JUND_FORMAT, seed: 6702, lord: "the_reaper", inn: ["swamp", "mountain", "forest", "badlands", "bayou", "taiga", "blood_crypt", "overgrown_tomb", "stomping_ground", "cairnbrand", "mox_jet", "mox_ruby", "mox_emerald", "manaba", "putrefy"], out: ["island", "plains", "volcanic_island", "tropical_island", "tallyflame_court", "shevelport", "mox_sapphire", "mox_pearl", "counterspell", "swords_to_plowshares"], offMana: "mox_sapphire" },
  { f: JESKAI_FORMAT, seed: 6703, lord: "the_bailiff", inn: ["island", "mountain", "plains", "tundra", "volcanic_island", "plateau", "hallowed_fountain", "steam_vents", "sacred_foundry", "tallyflame_court", "mox_sapphire", "mox_ruby", "mox_pearl", "counterspell", "wrath_of_god"], out: ["swamp", "forest", "badlands", "taiga", "cairnbrand", "obsidian_observatory", "mox_jet", "mox_emerald", "doom_blade", "manaba"], offMana: "mox_jet" },
];

describe("the deep triads at the door (S67)", () => {
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
