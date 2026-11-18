import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, castableWith, castingColours } from "@shandalar/cards";
import { FORMAT_FIELD } from "@shandalar/sim/open-decks";
import { NOTHING_DEAR_FORMAT } from "./formats.js";
import { buildSideboard } from "./constructed-builder.js";
import { aiSideboard, answersCreatures, answersRelics, sideboardTermsFor } from "./sideboard-ai.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8"));
const def = (id: string) => cards.get(id)!;

/**
 * S73 (handoff concern 59, found by the vintage audit): the field's sideboard builder, its tinker and its sideboarding
 * read a list's colours from `cardColors`, so a list holding an off-colour HYBRID card was treated as a deck of both its
 * colours — BR Removal with a {W/B} Revivalist was built a fifteen of white cards. They read the colours the list
 * CASTS with (`castingColours`). The gates still read `cardColors` (ADR-197).
 */
describe("S73: the colours a list casts with", () => {
  it("a hybrid card adds no colour when the pile already pays it, and both when nothing does", () => {
    expect([...castingColours([def("doom_blade"), def("lightning_bolt"), def("revivalist")])].sort()).toEqual(["B", "R"]);
    expect([...castingColours([def("llanowar_elves"), def("clutch_guard")])]).toEqual(["G"]);
    expect([...castingColours([def("lightning_bolt"), def("clutch_guard")])].sort()).toEqual(["G", "R", "U"]);
    expect(cardColors(def("revivalist")).sort()).toEqual(["B", "W"]); // the gate's read is unchanged
  });
  it("a hybrid card is castable with either of its colours; a gold card needs both", () => {
    expect(castableWith(def("revivalist"), ["B", "R"])).toBe(true);
    expect(castableWith(def("revivalist"), ["R", "G"])).toBe(false);
    expect(castableWith(def("vindicate"), ["B", "R"])).toBe(false);
    expect(castableWith(def("tormods_crypt"), [])).toBe(true);
  });
  it("BR Removal with four Revivalists is built a fifteen it can cast: nothing in it needs white", () => {
    const br = FORMAT_FIELD["nothing-dear"]!.br!.decklist;
    const swapped = br.map((e) => (e.cardId === "gravedigger" || e.cardId === "reassembling_skeleton" ? { cardId: e.cardId === "gravedigger" ? "revivalist" : "__", count: 4 } : e)).filter((e) => e.cardId !== "__");
    expect(swapped.reduce((n, e) => n + e.count, 0)).toBe(60);
    const base = buildSideboard(br, NOTHING_DEAR_FORMAT, rating, cards, answersRelics, answersCreatures);
    const fifteen = buildSideboard(swapped, NOTHING_DEAR_FORMAT, rating, cards, answersRelics, answersCreatures);
    expect(fifteen.filter((e) => !castableWith(def(e.cardId), ["B", "R"])).map((e) => e.cardId)).toEqual([]);
    expect(fifteen).toEqual(base); // the swap changes no slot: the Revivalist is a black card to this list
  });
  it("sideboarding never brings in a card the sixty cannot cast because of a hybrid card's other colour", () => {
    const br = FORMAT_FIELD["nothing-dear"]!.br!.decklist.map((e) => (e.cardId === "child_of_night" ? { cardId: "revivalist", count: 4 } : e));
    const side = [{ cardId: "swords_to_plowshares", count: 4 }, { cardId: "doom_blade", count: 0 }, { cardId: "terror", count: 3 }].filter((e) => e.count > 0);
    const opp = FORMAT_FIELD["nothing-dear"]!.emeraldsnakes!.decklist;
    const sb = aiSideboard(br, side, opp, cards, rating, sideboardTermsFor("nothing-dear"));
    expect(sb.deck.some((e) => e.cardId === "swords_to_plowshares")).toBe(false);
  });
});
