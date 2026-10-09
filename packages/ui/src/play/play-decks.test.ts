import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { checkDeck } from "@shandalar/world";
import { OPEN_FIELD } from "@shandalar/sim/open-decks";
import { BUILD_RULE, PLAY_CATEGORIES, buildPool, deckSummary, deleteBuiltDeck, playChoices, readBuiltDecks, saveBuiltDeck } from "./play-decks.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
function memStorage() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; }

/** Post-S58 (Chris): the single match's setup — a category and a deck in it, and decks built for either side. */
describe("the single match's decks (post-S58)", () => {
  it("the choices come by category: the Open's active lists (every one, revealed), the mages and the beasts; a fresh browser hides the lists that hold a prize card it has not met", () => {
    const all = playChoices(pool, { storage: memStorage(), revealAll: true });
    expect(all.filter((c) => c.group === "open").map((c) => c.key).sort()).toEqual(Object.keys(OPEN_FIELD).map((k) => `open:${k}`).sort());
    expect(all.filter((c) => c.group === "mages")).toHaveLength(15);
    expect(new Set(all.map((c) => c.group)).size).toBeGreaterThanOrEqual(4);
    for (const c of all) expect(PLAY_CATEGORIES.some((g) => g.group === c.group), c.key).toBe(true);
    const fresh = playChoices(pool, { storage: memStorage() });
    expect(fresh.filter((c) => c.group === "open").every((c) => c.decklist.every((e) => !pool.get(e.cardId)?.prizeOnly))).toBe(true);
    expect(fresh.filter((c) => c.group === "mages")).toHaveLength(15);
  });

  it("a built deck is kept in the browser under its name, offered first, replaced by a deck of the same name, and deleted", () => {
    const s = memStorage(), deck = [{ cardId: "grizzly_bears", count: 4 }, { cardId: "forest", count: 36 }];
    saveBuiltDeck(s, { name: "Bears", archetype: "aggro", decklist: deck });
    saveBuiltDeck(s, { name: "Other", archetype: "control", decklist: deck });
    saveBuiltDeck(s, { name: "Bears", archetype: "midrange", decklist: [...deck, { cardId: "hill_giant", count: 0 }] });
    expect(readBuiltDecks(s).map((d) => [d.name, d.archetype, d.decklist.length])).toEqual([["Other", "control", 2], ["Bears", "midrange", 2]]);
    const c = playChoices(pool, { storage: s, revealAll: true });
    expect(c.slice(0, 2).map((x) => x.key)).toEqual(["built:Other", "built:Bears"]);
    expect(deckSummary(c[1]!.decklist, pool)).toBe("40 cards · G");
    deleteBuiltDeck(s, "Other");
    expect(readBuiltDecks(s).map((d) => d.name)).toEqual(["Bears"]);
    expect(readBuiltDecks({ getItem: () => "not json", setItem: () => undefined })).toEqual([]);
  });

  it("the build pool is every card legal in the Open at its cap there (the Lotus at one, a common at four, no basics: they are free); the rule asks forty cards", () => {
    const p = buildPool(pool);
    expect([p.black_lotus, p.lightning_bolt, p.forest]).toEqual([1, 4, undefined]);
    expect(checkDeck([{ cardId: "grizzly_bears", count: 4 }, { cardId: "forest", count: 36 }], null, BUILD_RULE, pool).ok).toBe(true);
    expect(checkDeck([{ cardId: "grizzly_bears", count: 4 }, { cardId: "forest", count: 30 }], null, BUILD_RULE, pool).ok).toBe(false);
    expect(checkDeck([{ cardId: "black_lotus", count: 2 }, { cardId: "forest", count: 40 }], null, BUILD_RULE, pool).ok).toBe(false);
  });
});
