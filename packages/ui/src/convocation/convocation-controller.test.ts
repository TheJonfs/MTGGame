import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "@shandalar/world/loader";
import { EVENT_SAVE_KEY, LEDGER_KEY, type ConvocationPackData } from "@shandalar/world";
import { ConvocationController } from "./convocation-controller.js";
import { SAVE_KEY } from "../world/world-controller.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json");
function memStorage(seed: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(seed));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), keys: () => [...m.keys()], m };
}
const make = (s = memStorage()) => ({ s, c: new ConvocationController(pool, packs, rating, catalog, s, () => "2026-10-02T00:00:00Z") });
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const size = (d: { count: number }[]) => d.reduce((n, e) => n + e.count, 0);

/** S48 (Parts 1 & 4): the event's editor is the world's editor over the event's source; the series over the match. */
describe("the Convocation controller (S48)", () => {
  it("the event editor: the pool is the source, the draft saves to the EVENT — a world save in the same storage is never read or written", () => {
    const WORLD = "{\"sentinel\":true}";
    const { s, c } = make(memStorage({ [SAVE_KEY]: WORLD }));
    c.newEvent(48);
    expect(c.screen).toEqual({ kind: "build", sideboarding: false });
    const host = c.editorHost()!;
    expect(host.saveLabel).toBe("Register the deck");
    expect(host.decks).toBeUndefined(); // one deck: no picker
    expect(host.close).toBeUndefined(); // the build is left by registering
    expect(Object.values(host.source.collection).reduce((a, b) => a + b, 0)).toBe(90);
    // a card of the pool is added and removed; one outside it is refused
    const mine = c.event!.field[0]!.pool[0]!;
    host.add(mine); expect(c.draft).toEqual([{ cardId: mine, count: 1 }]);
    c.editorHost()!.add("black_lotus"); expect(c.notice).toBe("no spare copy owned"); expect(size(c.draft)).toBe(1);
    c.editorHost()!.remove(mine); expect(c.draft).toEqual([]);
    // an illegal draft is not registered
    c.editorHost()!.add("plains"); c.register();
    expect(c.screen.kind).toBe("build"); expect(c.notice).toMatch(/Sealed asks 40/);
    expect(c.event!.phase).toBe("build");
    // the builder's suggestion is legal; registering opens round one
    c.suggestDeck();
    expect(size(c.draft)).toBe(40); expect(c.editorLegality().ok).toBe(true);
    c.editorHost()!.save();
    expect(c.screen.kind).toBe("pairings");
    expect(c.event!.phase).toBe("round");
    expect(size(c.event!.field[0]!.deck)).toBe(40);
    expect(size(c.event!.field[0]!.sideboard)).toBeGreaterThan(40);
    // the storage: the event under its own key; the world's bytes untouched
    expect(s.getItem(EVENT_SAVE_KEY)).toContain("convocation-event-v1");
    expect(s.getItem(SAVE_KEY)).toBe(WORLD);
    expect(s.keys().sort()).toEqual([EVENT_SAVE_KEY, SAVE_KEY].sort());
  });

  it("a Limited source adds past four copies when the pool holds them (the pool is the cap)", () => {
    const { c } = make();
    c.newEvent(48);
    const e = c.event!;
    c.event = { ...e, field: [{ ...e.field[0]!, pool: [...e.field[0]!.pool, ...Array(5).fill("shock")] }, ...e.field.slice(1)] };
    const had = e.field[0]!.pool.filter((x) => x === "shock").length;
    for (let i = 0; i < had + 5; i++) c.editorHost()!.add("shock");
    expect(c.draft.find((x) => x.cardId === "shock")!.count).toBe(had + 5);
    c.editorHost()!.add("shock");
    expect(c.notice).toBe("no spare copy owned");
  });

  it("the series over the match: the coin's winner chooses; a won game saves the series; a reload resumes it; sideboarding changes the next game's deck; the round ends at the standings", async () => {
    const { s, c } = make();
    c.newEvent(48); c.suggestDeck(); c.register();
    c.playMatch();
    if (c.series!.firstChooser === 0) { expect(c.screen.kind).toBe("playDraw"); c.choose("draw"); expect(c.match!.spec.rules.startingPlayer).toBe(1); }
    else expect(c.match!.spec.rules.startingPlayer).toBe(1); // the AI won the coin and plays
    expect(c.screen.kind).toBe("match");
    expect(c.match!.spec.rules.startingLife).toBe(20);
    c.match!.autoWin(); await tick(20);
    expect(c.screen.kind).toBe("between");
    expect(c.series!.wins).toEqual([1, 0]);
    // a reload: a new controller over the same storage stands between games, one game in
    const again = new ConvocationController(pool, packs, rating, catalog, s);
    expect(again.hasSave()).toBe(true);
    again.resume();
    expect(again.screen.kind).toBe("between");
    expect(again.series!.wins).toEqual([1, 0]);
    // sideboarding: the editor again, over the pool; the next game plays the changed deck
    again.openSideboard();
    expect(again.editorHost()!.title).toMatch(/Sideboard/);
    expect(again.editorHost()!.close).toBeDefined();
    again.editorHost()!.add("swamp"); again.register();
    expect(again.screen.kind).toBe("between");
    again.nextGame(); // the AI lost game one: it chooses, and plays
    expect(again.screen.kind).toBe("match");
    expect(again.match!.spec.rules.startingPlayer).toBe(1);
    expect(size(again.match!.spec.players[0].decklist)).toBe(41);
    again.match!.autoWin();
    for (let i = 0; i < 400 && again.screen.kind !== "standings"; i++) await tick(25);
    expect(again.screen.kind).toBe("standings");
    expect(again.event!.results).toHaveLength(4);
    expect(again.event!.current).toBeUndefined();
    expect(again.standings().find((r) => r.seat === 0)!.points).toBe(3);
    expect(again.fieldMs).not.toBeNull();
  }, 120_000);

  it("the finish: three rounds, the prize screen, the ledger's line written once, a kept card, the save cleared on leaving", async () => {
    const { s, c } = make();
    c.newEvent(7); c.suggestDeck(); c.register();
    for (let round = 1; round <= 3; round++) {
      c.playMatch();
      while (c.screen.kind !== "standings") {
        if (c.screen.kind === "playDraw") c.choose("play");
        if (c.screen.kind === "match") { c.match!.autoWin(); await tick(20); }
        if (c.screen.kind === "between") c.nextGame();
        if (c.screen.kind === "field") await tick(50);
      }
      c.next();
    }
    expect(c.screen.kind).toBe("prize");
    expect(c.event!.phase).toBe("over");
    const ledger = c.ledger();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ place: 1, record: "3–0", seed: 7, seats: 8, rounds: 3, formatId: "sealed-plane", when: "2026-10-02T00:00:00Z" });
    c.keep("black_lotus"); expect(c.event!.kept).toBeUndefined(); // not in the pool
    const card = c.event!.field[0]!.pool[3]!;
    c.keep(card); c.keep(c.event!.field[0]!.pool[4]!);
    expect(c.event!.kept).toBe(card);
    expect(c.ledger()[0]!.kept).toBe(card);
    new ConvocationController(pool, packs, rating, catalog, s).resume(); // a reload at the prize does not write the ledger again
    expect(c.ledger()).toHaveLength(1);
    c.leave();
    expect(s.getItem(EVENT_SAVE_KEY)).toBeNull();
    expect(s.getItem(LEDGER_KEY)).not.toBeNull();
    expect(c.screen.kind).toBe("door");
  }, 180_000);
});
