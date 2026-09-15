import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "@shandalar/world/loader";
import { newWorld, serializeWorld } from "@shandalar/world";
import { markSeen } from "../seen.js";
import { playRoster } from "./play-roster.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("S37 (Chris): the production picker carries the gallery's unlock rule", () => {
  it("a fresh browser: every mage and beast (no prizeOnly cards in them), no boss, no saved deck", () => {
    const r = playRoster(pool, { storage: memStorage() });
    expect(r.filter((d) => d.group === "mages")).toHaveLength(15);
    expect(r.filter((d) => d.group === "beasts").length).toBeGreaterThanOrEqual(15);
    expect(r.filter((d) => d.group === "bosses")).toEqual([]);
    expect(r.filter((d) => d.group === "saved")).toEqual([]);
    expect(r.every((d) => d.decklist.every((e) => !pool.get(e.cardId)?.prizeOnly))).toBe(true);
  });
  it("meeting a boss's signature in a duel unlocks that boss's deck and no other; ?all=1 shows everything", () => {
    const storage = memStorage();
    markSeen(["the_usher"], storage);
    const r = playRoster(pool, { storage });
    const bosses = r.filter((d) => d.group === "bosses");
    expect(bosses.map((d) => d.key)).toEqual(["boss:lord:usher"]);
    expect(playRoster(pool, { storage, revealAll: true }).filter((d) => d.group === "bosses").length).toBeGreaterThan(10);
  });
  it("the world save's decks are offered (owned cards are unlocked by construction), the active one marked", () => {
    const storage = memStorage();
    const w = newWorld({ seed: 37, catalog, starter: "green", difficulty: "standard", playerName: "P" });
    w.decks["Second"] = [{ cardId: "forest", count: 30 }];
    storage.setItem("shandalar-world-save", serializeWorld(w, { compact: true }));
    const saved = playRoster(pool, { storage }).filter((d) => d.group === "saved");
    expect(saved.map((d) => d.key).sort()).toEqual([`saved:${w.activeDeckName}`, "saved:Second"].sort());
    expect(saved.find((d) => d.key === `saved:${w.activeDeckName}`)!.label).toMatch(/active/);
    expect(saved.find((d) => d.key === "saved:Second")!.label).not.toMatch(/active/);
  });
});
