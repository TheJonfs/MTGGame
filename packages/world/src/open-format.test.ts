import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { buildLoop, parseOpenLists } from "@shandalar/sim/open-lists";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";
import { checkDeck } from "./legality.js";
import { FORMATS, HIGH_GROUNDS, LAW_IDS, OPEN_FORMAT } from "./formats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const idOf = new Map([...pool.values()].map((d) => [d.name, d.id]));

describe("S46 (ADR-142/143): the Open format and its twelve seed lists", () => {
  it("open-decks.ts is in sync with the planner's document + the S46 amendments + the Loop + the lists contributed from play (run `pnpm open:gen` after an edit)", () => {
    const lists = parseOpenLists(readFileSync(join(ROOT, "docs/convocation/convocation-open-lists-draft-2.md"), "utf8"), (n) => idOf.get(n));
    lists.push(buildLoop(lists.find((l) => l.key === "coin")!, (n) => idOf.get(n)));
    // post-S53 (Chris): data/convocation/open-contributed.json, after the twelve
    for (const c of (JSON.parse(readFileSync(join(ROOT, "data/convocation/open-contributed.json"), "utf8")) as { lists: { key: string; decklist: { cardId: string; count: number }[] }[] }).lists) lists.push({ key: c.key, decklist: c.decklist } as never);
    expect(Object.keys(OPEN_DECKS)).toEqual(lists.map((l) => l.key));
    for (const l of lists) expect(OPEN_DECKS[l.key]!.decklist, l.key).toEqual(l.decklist);
  });

  it("every list is sixty and legal in the Open; the Loop is Mardu only (no blue card)", () => {
    for (const l of Object.values(OPEN_DECKS)) {
      expect(l.decklist.reduce((n, e) => n + e.count, 0), l.key).toBe(60);
      expect(checkDeck(l.decklist, null, OPEN_FORMAT.rule, pool).problems, l.key).toEqual([]);
    }
    const loop = OPEN_DECKS.loop!;
    expect(loop.decklist.some((e) => /\{U\}/.test(pool.get(e.cardId)?.manaCost ?? ""))).toBe(false);
    expect(loop.decklist.find((e) => e.cardId === "vampire_nighthawk")).toBeUndefined();
    expect(loop.decklist.find((e) => e.cardId === "meliyan_the_torment")?.count).toBe(1);
  });

  it("the Open's rule: every restricted and banned id exists; a second Black Lotus is refused, a law is refused, a legend at four is fine, basics uncapped, 59 cards refused", () => {
    for (const id of [...OPEN_FORMAT.rule.restricted!, ...OPEN_FORMAT.rule.banned!]) expect(pool.has(id), id).toBe(true);
    expect(HIGH_GROUNDS.every((g) => pool.get(g)?.supertypes?.includes("Legendary"))).toBe(true);
    expect(LAW_IDS.length).toBe(5);
    const base = OPEN_DECKS.muster!.decklist;
    const with_ = (id: string, n: number) => [...base.filter((e) => e.cardId !== id), { cardId: id, count: n }];
    expect(checkDeck(with_("black_lotus", 2), null, OPEN_FORMAT.rule, pool).failed).toContain("restricted");
    expect(checkDeck([...base, { cardId: "law_toll", count: 1 }], null, OPEN_FORMAT.rule, pool).failed).toContain("banned");
    expect(checkDeck([...base.filter((e) => e.cardId !== "plains"), { cardId: "plains", count: 12 }], null, OPEN_FORMAT.rule, pool).ok).toBe(true); // basics uncapped
    const sixtyLess = base.map((e) => (e.cardId === "plains" ? { ...e, count: e.count - 1 } : e));
    expect(checkDeck(sixtyLess, null, OPEN_FORMAT.rule, pool).failed).toContain("minCards");
    expect(FORMATS.map((f) => f.id)).toEqual(["open"]);
  });
});
