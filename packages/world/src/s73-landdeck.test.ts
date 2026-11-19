import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { FORMAT_FIELD } from "@shandalar/sim/open-decks";
import { aiSideboard, GUIDE_SHAPES, landDoesMore, LANDDECK_AT, sideboardTermsFor, type SideboardGuide } from "./sideboard-ai.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8"));
const open = FORMAT_FIELD.open!;
const doesMore = (key: string) => open[key]!.decklist.reduce((n, e) => n + (landDoesMore(cards.get(e.cardId)!) ? e.count : 0), 0);

/**
 * S73 Part 3 (the brief's ruling on concern 13; ADR-188's list of shapes): `landdeck` — four or more lands that do more
 * than make mana. A land counts when it has a non-mana ability it stays on the battlefield to use (Valakut, a High
 * Ground, the Library); a land that sacrifices or discards itself (Evolving Wilds, the cycling lands) does not.
 */
describe("S73: the landdeck guide shape", () => {
  it("is one of the shapes a guide may name", () => { expect(GUIDE_SHAPES).toContain("landdeck"); });
  it("a land that does more: Valakut, a High Ground, the Library — not a dual, a basic, Evolving Wilds or a cycling land", () => {
    for (const id of ["valakut_the_molten_pinnacle", "hearthspire", "tallyflame_court", "library_of_alexandria", "thawing_glaciers"]) expect(landDoesMore(cards.get(id)!), id).toBe(true);
    for (const id of ["taiga", "sacred_foundry", "mountain", "evolving_wilds", "barren_moor", "tranquil_thicket", "lightning_bolt"]) expect(landDoesMore(cards.get(id)!), id).toBe(false);
  });
  it("S73a: it fires at six — the land decks, the Fun Police and Lumen Clio, and no list that only plays four grounds", () => {
    expect(LANDDECK_AT).toBe(6);
    const has = Object.keys(open).filter((k) => doesMore(k) >= LANDDECK_AT).sort();
    expect(has).toEqual(["earthrise", "funpolice", "lumenclio", "minefield", "pinnacle"]);
  });
  it("the three land decks have the shape; the Levy (four Evolving Wilds) and the Depths (twelve duals) do not", () => {
    for (const k of ["pinnacle", "minefield", "earthrise"]) expect(doesMore(k), k).toBeGreaterThanOrEqual(LANDDECK_AT);
    for (const k of ["levy", "depths", "muster", "wurmspeaker"]) expect(doesMore(k), k).toBeLessThan(LANDDECK_AT);
  });
  it("a row keyed on it comes in against the Pinnacle and stays in the fifteen against the Levy", () => {
    const sixty = open.warband!.decklist, fifteen = [{ cardId: "molten_rain", count: 2 }, { cardId: "terrain_collapse", count: 2 }, { cardId: "pyroclasm", count: 3 }];
    const guide: SideboardGuide = { key: "t", fifteen, rows: [{ in: "molten_rain", n: 2, out: ["goblin_piker"], when: ["landdeck"] }] };
    const terms = { ...sideboardTermsFor("open"), guide };
    const count = (k: string) => aiSideboard(sixty, fifteen, open[k]!.decklist, cards, rating, terms).deck.find((e) => e.cardId === "molten_rain")?.count ?? 0;
    expect(count("pinnacle")).toBe(2);
    expect(count("levy")).toBe(0);
  });
});
