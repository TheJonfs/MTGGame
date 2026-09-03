import { describe, expect, it } from "vitest";
import { encounteredCards, markSeen, readSeen } from "./seen.js";

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
});
