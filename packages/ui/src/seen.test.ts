import { describe, expect, it } from "vitest";
import { deckUnlocked, encounteredCards, markSeen, readSeen, readUnlocked } from "./seen.js";

describe("S27 r3 — the gallery's progressive reveal (the seen store)", () => {
  it("encounteredCards: cast cards and every public-zone object at the end count; libraries, hands and stakes do not", () => {
    const result = {
      winner: 0 as const, reason: "LIFE" as const, turns: 5, finalLife: [10, 0] as [number, number],
      facts: { damageDealt: [0, 0] as [number, number], creaturesLost: [0, 0] as [number, number], cardsDrawn: [0, 0] as [number, number], spellsCast: {}, ante: [[], []] as [string[], string[]] },
      log: [{ t: "EVENT", name: "SPELL_CAST", payload: { cardId: "the_manafleur", controller: 1 } }, { t: "ACTION", action: {} }],
      finalStateSerialized: JSON.stringify({ objects: { a: { cardId: "law_intake", zone: "battlefield" }, b: { cardId: "mox_jet", zone: "library" }, c: { cardId: "the_usher", zone: "hand" }, d: { cardId: "black_lotus", zone: "graveyard" }, e: { cardId: "reya_dawnbringer", zone: "ante" } } }),
    };
    expect(encounteredCards(result as never).sort()).toEqual(["black_lotus", "law_intake", "the_manafleur"]);
  });
  it("markSeen accumulates across calls in the given storage; readSeen tolerates garbage", () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    markSeen(["the_usher"], storage);
    markSeen(["the_usher", "mox_jet"], storage);
    expect([...readSeen(storage)].sort()).toEqual(["mox_jet", "the_usher"]);
    m.set("shandalar-seen", "not json");
    expect(readSeen(storage).size).toBe(0);
  });
  it("S37: readUnlocked is the seen store plus the world autosave's collection; deckUnlocked gates a deck on its prizeOnly cards only", () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    markSeen(["the_usher"], storage);
    m.set("shandalar-world-save", JSON.stringify({ format: "world-save-v7", world: { player: { collection: { mox_jet: 1, plains: 9 } } } }));
    expect([...readUnlocked(storage)].sort()).toEqual(["mox_jet", "plains", "the_usher"]);
    m.set("shandalar-world-save", "garbage");
    expect([...readUnlocked(storage)]).toEqual(["the_usher"]);
    const pool = new Map<string, { prizeOnly?: boolean }>([["the_usher", { prizeOnly: true }], ["mox_jet", { prizeOnly: true }], ["plains", {}], ["serra_angel", { prizeOnly: false }]]);
    const unlocked = new Set(["the_usher"]);
    expect(deckUnlocked([{ cardId: "plains" }, { cardId: "serra_angel" }], pool, unlocked)).toBe(true); // nothing prizeOnly
    expect(deckUnlocked([{ cardId: "plains" }, { cardId: "the_usher" }], pool, unlocked)).toBe(true); // met
    expect(deckUnlocked([{ cardId: "plains" }, { cardId: "mox_jet" }], pool, unlocked)).toBe(false); // not yet
    expect(deckUnlocked([{ cardId: "unknown_card" }], pool, unlocked)).toBe(true); // the pool lacks it: no gate
  });
});
