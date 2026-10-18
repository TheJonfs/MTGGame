import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { FORMAT_DECKS } from "@shandalar/sim/open-decks";
import { GUIDE_SHAPES, aiSideboard, guideFor, guideOfList, sideboardTermsFor } from "./sideboard-ai.js";
import { LIST_GUIDES, SIDEBOARD_GUIDES } from "./sideboard-guides.generated.js";
import { formatView, type CardRatingTable } from "./rating.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = formatView(JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable, "mardu");
type L = { decklist: { cardId: string; count: number }[]; sideboard?: { cardId: string; count: number }[] };
const decks = FORMAT_DECKS as Record<string, Record<string, L>>;

/** S67 (ADR-188): a guide belongs to its list, and generation checks every shape before it writes. */
describe("ADR-188 — guides by list", () => {
  it("every registered list whose fifteen has a guide is mapped to it by key, and only those", () => {
    for (const [f, ls] of Object.entries(decks)) for (const [k, l] of Object.entries(ls)) {
      const byFifteen = l.sideboard ? guideFor(l.sideboard)?.key : undefined;
      expect(LIST_GUIDES[`${f}:${k}`], `${f}:${k}`).toBe(byFifteen);
    }
    expect(guideOfList("mardu:witch")?.key).toBe("mardu:witch");
    expect(guideOfList("mardu:marducontrol")?.key).toBe("marducontrol"); // reused whole from the Open: the Open's guide
  });
  it("a varied fifteen keeps its list's guide when the caller names it (and loses it when matched by fifteen)", () => {
    const w = decks.mardu!.witch!, opp = decks.mardu!.pall!.decklist;
    const varied = w.sideboard!.map((e) => (e.cardId === "faerie_macabre" ? { ...e, cardId: "vigil_keeper" } : e));
    const terms = sideboardTermsFor("mardu");
    const byKey = aiSideboard(w.decklist, varied, opp, cards, rating, { ...terms, guide: guideOfList("mardu:witch")! });
    const byFifteen = aiSideboard(w.decklist, varied, opp, cards, rating, terms);
    expect(byKey.swaps.filter((s) => s.rule === "guide").map((s) => s.in)).toEqual(["tormods_crypt", "tormods_crypt", "tormods_crypt"]); // the Macabre rows find none
    expect(byFifteen.swaps.some((s) => s.rule === "guide")).toBe(false); // the S66 trap: the guide silently gone
    expect(aiSideboard(w.decklist, w.sideboard!, opp, cards, rating, { ...terms, guide: null }).swaps.some((s) => s.rule === "guide")).toBe(false);
  });
  it("the shapes are one list: every guide names only GUIDE_SHAPES", () => {
    for (const g of SIDEBOARD_GUIDES) for (const r of g.rows) for (const w of [...r.when, ...(r.unless ?? [])]) expect(GUIDE_SHAPES as readonly string[]).toContain(w);
  });
});
