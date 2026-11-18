import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { FORMAT_DECKS } from "@shandalar/sim/open-decks";
import { CONSTRUCTED_FORMATS } from "./formats.js";
import { castableIn, deltaFor, listColours, readAt, type PoolHistory } from "./vintage.js";
import { loadMetas } from "./vintage-audit-cli.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const history = JSON.parse(readFileSync(join(ROOT, "data/convocation/pool-history.json"), "utf8")) as PoolHistory;
const metas = loadMetas(ROOT);

describe("S73 (ADR-199): the pool vintage", () => {
  it("every card of the pool has a row in the pool history, and the history names no other", () => {
    expect(Object.keys(history.cards).filter((id) => !pool.has(id))).toEqual([]);
    expect([...pool.keys()].filter((id) => !history.cards[id])).toEqual([]);
    expect(Math.max(...Object.values(history.cards).map((c) => c.pool))).toBe(pool.size);
  });
  it("every registered list carries its poolAt, and every portOf chain ends at a list", () => {
    for (const [format, lists] of Object.entries(FORMAT_DECKS)) for (const key of Object.keys(lists)) {
      const v = readAt(`${format}:${key}`, metas);
      expect(v.readAt, `${format}:${key}`).toBeGreaterThan(0);
      expect(v.readAt, `${format}:${key}`).toBeLessThanOrEqual(metas[`${format}:${key}`]!.poolAt!);
    }
  });
  it("a port is read at its root's vintage: Nothing Dear's Levy at the Open's seed", () => {
    const v = readAt("nothing-dear:levy", metas);
    expect(v.root).toBe("open:levy");
    expect(v.readAt).toBe(metas["open:levy"]!.poolAt);
    expect(metas["nothing-dear:levy"]!.poolAt).toBe(315);
  });
  it("a hybrid card is a candidate for each of its colours; a gold card needs both", () => {
    expect(castableIn(pool.get("clutch_guard")!, ["G"])).toBe(true);
    expect(castableIn(pool.get("clutch_guard")!, ["U", "B"])).toBe(true);
    expect(castableIn(pool.get("clutch_guard")!, ["R", "W"])).toBe(false);
    expect(castableIn(pool.get("vindicate")!, ["W"])).toBe(false);
  });
  it("the delta keeps to the format's rule, the list's colours and its curve", () => {
    const nd = CONSTRUCTED_FORMATS.find((f) => f.id === "nothing-dear")!, levy = FORMAT_DECKS["nothing-dear"]!.levy!;
    const delta = deltaFor(levy.decklist, readAt("nothing-dear:levy", metas).readAt, nd.rule, pool, history).filter((c) => !c.inList);
    const colours = listColours(levy.decklist, pool);
    expect(colours).toEqual(["W", "B"]);
    expect(delta.map((c) => c.id)).toContain("banishing_cleric");
    expect(delta.map((c) => c.id)).toContain("revivalist");
    expect(delta.some((c) => !c.land && c.mv > 4)).toBe(false);
    expect(delta.map((c) => c.id)).not.toContain("storm_shaman");
  });
});
