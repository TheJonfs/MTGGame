import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "@shandalar/world/loader";
import { EVENT_SAVE_KEY, LEDGER_KEY, type ConvocationPackData } from "@shandalar/world";
import { ConvocationController } from "./convocation-controller.js";
import { SAVE_KEY, WorldController } from "../world/world-controller.js";

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

  /** Drive one series: the human wins (auto-win) or loses (concede) every game. */
  async function series(c: ConvocationController, win: boolean): Promise<void> {
    c.playMatch();
    for (let guard = 0; guard < 2000 && (c.screen.kind === "playDraw" || c.screen.kind === "match" || c.screen.kind === "between" || c.screen.kind === "field"); guard++) {
      if (c.screen.kind === "playDraw") c.choose("play");
      else if (c.screen.kind === "match") { if (win) c.match!.autoWin(); else c.match!.concede(); await tick(20); }
      else if (c.screen.kind === "between") c.nextGame();
      else await tick(40);
    }
  }

  it("S49 — sixteen seats, five rounds, the Top 8 with the human in it: the bracket's entrance (+4 / +6 / +8 life), a reload in the bracket, the win — 'first of sixteen', the ledger's line", async () => {
    const { s, c } = make();
    c.newEvent(49, { seats: 16, rounds: 5, top8: true });
    expect(c.event!.field).toHaveLength(16);
    c.suggestDeck(); c.register();
    const lives: number[] = [];
    for (let round = 1; round <= 5; round++) {
      c.playMatch(); if (c.screen.kind === "playDraw") c.choose("play");
      lives.push(c.match!.spec.modifiers.find((m) => m.type === "startingLife")?.value ?? 20);
      c.match!.autoWin(); await tick(20);
      await series(c, true);
      expect(c.screen.kind).toBe("standings");
      expect(c.event!.results.filter((r) => r.round === round)).toHaveLength(8);
      c.next();
    }
    expect(lives).toEqual([20, 20, 20, 20, 20]); // post-S52 (Chris): the life buffs are suppressed — flat
    expect(c.screen.kind).toBe("bracket");
    expect(c.event!.bracket!.seeds[0]).toBe(0); // 5–0: the first seed
    expect(c.ledger()).toHaveLength(0);
    const bracketLives: number[] = [];
    for (let r = 0; r < 3; r++) {
      expect(c.opponentSeat()).not.toBeNull();
      if (r === 1) { const again = new ConvocationController(pool, packs, rating, catalog, s, () => "2026-10-03T00:00:00Z"); again.resume(); expect(again.screen.kind).toBe("bracket"); expect(again.opponentSeat()).toBe(c.opponentSeat()); }
      c.playMatch(); if (c.screen.kind === "playDraw") c.choose("play");
      bracketLives.push(c.match!.spec.modifiers.find((m) => m.type === "startingLife")?.value ?? 20);
      c.match!.autoWin(); await tick(20);
      await series(c, true);
      expect(c.screen.kind).toBe("bracket");
    }
    expect(bracketLives).toEqual([20, 20, 20]);
    expect(c.event!.phase).toBe("over");
    expect(c.event!.bracket!.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(c.places()[0]!.seat).toBe(0);
    expect(c.ledger()).toHaveLength(1);
    expect(c.ledger()[0]).toMatchObject({ place: 1, seats: 16, rounds: 5, top8: true });
    c.toPrize(); expect(c.screen.kind).toBe("prize");
  }, 300_000);

  it("S49 — the human outside the eight watches the bracket resolve and takes the standings' finish; a human who loses the quarter-final finishes fifth to eighth", async () => {
    const { c } = make();
    c.newEvent(50, { seats: 16, rounds: 5, top8: true });
    c.suggestDeck(); c.register();
    for (let round = 1; round <= 5; round++) { await series(c, false); c.next(); }
    expect(c.screen.kind).toBe("bracket");
    expect(c.event!.bracket!.seeds).not.toContain(0);
    expect(c.opponentSeat()).toBeNull();
    await c.resolveBracket();
    expect(c.event!.phase).toBe("over");
    expect(c.screen.kind).toBe("bracket");
    const place = c.places().find((p) => p.seat === 0)!.place;
    expect(place).toBeGreaterThanOrEqual(9);
    expect(place).toBe(c.standings().find((r) => r.seat === 0)!.place);
    expect(c.ledger()[0]!.place).toBe(place);

    const q = make().c;
    q.newEvent(51, { seats: 16, rounds: 5, top8: true });
    q.suggestDeck(); q.register();
    for (let round = 1; round <= 5; round++) { await series(q, true); q.next(); }
    await series(q, false); // the quarter-final, lost
    expect(q.screen.kind).toBe("bracket");
    expect(q.opponentSeat()).toBeNull();
    expect(q.event!.phase).toBe("bracket"); // the semi-finals are still to play
    await q.resolveBracket();
    expect(q.event!.phase).toBe("over");
    const qp = q.places().find((p) => p.seat === 0)!.place;
    expect(qp).toBeGreaterThanOrEqual(5); expect(qp).toBeLessThanOrEqual(8);
  }, 400_000);

  it("S49 — the AI sideboards from game two: the deck it brings to game two is forty cards from its own pool", async () => {
    const { c } = make();
    c.newEvent(48); c.suggestDeck(); c.register();
    c.playMatch(); if (c.screen.kind === "playDraw") c.choose("play");
    const g1 = c.match!.spec.players[1].decklist;
    c.match!.autoWin(); await tick(20); c.nextGame(); if (c.screen.kind === "playDraw") c.choose("play");
    const g2 = c.match!.spec.players[1].decklist, opp = c.event!.field[c.opponentSeat()!]!;
    expect(size(g1)).toBe(40); expect(size(g2)).toBe(40);
    const owned: Record<string, number> = {}; for (const id of opp.pool) owned[id] = (owned[id] ?? 0) + 1;
    for (const e of g2) if (!["plains", "island", "swamp", "mountain", "forest"].includes(e.cardId)) expect(owned[e.cardId] ?? 0).toBeGreaterThanOrEqual(e.count);
  }, 60_000);

  it("S51 — the draft: a pod of eight, the pack in hand, a pick by click (no take-backs, nothing outside the pack), the pass, a reload mid-draft, forty-five picks into the build; then the event as before", async () => {
    const { s, c } = make();
    c.newEvent(51, { draft: true });
    expect(c.screen.kind).toBe("draft");
    expect(c.isDraft()).toBe(true);
    let v = c.draftView()!;
    expect([v.pick, v.total, v.packRound, v.packs, v.direction, v.pack.length, v.picks.length]).toEqual([1, 45, 1, 3, "left", 15, 0]);
    c.pickCard("black_lotus"); // not in the pack: nothing happens
    expect(c.draftView()!.pick).toBe(1);
    const first = v.pack[0]!;
    c.pickCard(first);
    v = c.draftView()!;
    expect([v.pick, v.pack.length, v.picks]).toEqual([2, 14, [first]]);
    expect(c.passNote).toBe("The pack goes left.");
    expect(c.editorHost()).toBeNull(); // no build before the draft is done
    for (let i = 0; i < 16; i++) c.pickCard(c.suggestedPick()!);
    expect(c.draftView()!.packRound).toBe(2);
    expect(c.draftView()!.direction).toBe("right");
    // a reload mid-draft
    const again = new ConvocationController(pool, packs, rating, catalog, s, () => "2026-10-04T00:00:00Z");
    again.resume();
    expect(again.screen.kind).toBe("draft");
    expect(again.draftView()!.pick).toBe(18);
    expect(again.draftView()!.picks).toEqual(c.draftView()!.picks);
    while (again.screen.kind === "draft") again.pickCard(again.suggestedPick()!);
    expect(again.screen).toEqual({ kind: "build", sideboarding: false });
    expect(again.event!.phase).toBe("build");
    expect(again.event!.draft).toBeUndefined();
    expect(again.event!.field[0]!.pool).toHaveLength(45);
    expect(again.editorHost()!.title).toBe("Your picks — build forty");
    expect(Object.values(again.editorHost()!.source.collection).reduce((a, b) => a + b, 0)).toBe(45);
    for (const seat of again.event!.field.slice(1)) expect(size(seat.deck)).toBe(40);
    again.suggestDeck(); again.register();
    expect(again.screen.kind).toBe("pairings");
    expect(again.event!.pairings).toHaveLength(4);
    await series(again, true);
    expect(again.screen.kind).toBe("standings");
    expect(again.event!.top8).toBe(true);
    expect(s.getItem(EVENT_SAVE_KEY)).toContain("draft-plane");
  }, 120_000);

  it("S52 (ADR-152) — the Open: the editor over the format's whole legal pool (the restricted at one, the laws absent), a suggested deck, a saved deck from the journey checked by the format, the field of fifteen, the event as before; the journey's save is read and never written", async () => {
    const s = memStorage();
    const world = new WorldController(pool, catalog, s as never);
    world.newGame({ starter: "white", difficulty: "standard", seed: 5201 });
    const worldBytes = s.getItem(SAVE_KEY)!;
    expect(worldBytes).toBeTruthy();
    const c = new ConvocationController(pool, packs, rating, catalog, s, () => "2026-10-05T00:00:00Z");
    c.newEvent(52, { constructed: "open" });
    expect(c.screen).toEqual({ kind: "build", sideboarding: false });
    expect(c.isConstructed()).toBe(true);
    expect(c.event!.field).toHaveLength(16);
    for (const seat of c.event!.field.slice(1)) { expect(size(seat.deck)).toBe(60); expect(seat.list).toBeDefined(); }
    const host = c.editorHost()!;
    expect(host.title).toBe("The Open — build 60");
    expect(host.source.collection.black_lotus).toBe(1);
    expect(host.source.collection.serra_angel).toBe(4);
    expect(host.source.collection.clio_lady_of_the_depths).toBe(4); // prizeOnly is legal for the player (S47)
    expect(host.source.collection.law_intake).toBeUndefined();
    expect(host.source.collection.plains).toBeUndefined(); // basics are free, not owned
    for (let i = 0; i < 5; i++) c.editorHost()!.add("serra_angel");
    expect(c.draft.find((e) => e.cardId === "serra_angel")!.count).toBe(4);
    c.editorHost()!.add("black_lotus"); c.editorHost()!.add("black_lotus");
    expect(c.draft.find((e) => e.cardId === "black_lotus")!.count).toBe(1);
    c.register(); expect(c.screen.kind).toBe("build"); expect(c.notice).toMatch(/the Open asks 60/);
    // a saved deck from the journey: offered with the format's verdict (a thirty-card starter is not legal here)
    const saved = c.savedDecks();
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0]!.ok).toBe(false);
    c.useSavedDeck(saved[0]!.name);
    expect(size(c.draft)).toBe(30);
    c.register(); expect(c.screen.kind).toBe("build");
    // the suggestion: a legal sixty; registering opens round one
    c.suggestDeck();
    expect(size(c.draft)).toBe(60); expect(c.editorLegality().ok).toBe(true);
    c.register();
    expect(c.screen.kind).toBe("pairings");
    expect(c.event!.pairings).toHaveLength(8);
    c.playMatch(); if (c.screen.kind === "playDraw") c.choose("play");
    expect(size(c.match!.spec.players[1].decklist)).toBe(60);
    c.match!.autoWin(); await tick(20);
    expect(c.screen.kind).toBe("between");
    c.openSideboard(); expect(c.screen.kind).toBe("between"); // no sideboard in Constructed this session
    // a reload mid-round resumes; the journey's save is byte for byte what it was
    const again = new ConvocationController(pool, packs, rating, catalog, s);
    again.resume();
    expect(again.screen.kind).toBe("between");
    expect(again.isConstructed()).toBe(true);
    await series(again, true);
    expect(again.screen.kind).toBe("standings");
    expect(again.event!.results).toHaveLength(8);
    expect(s.getItem(SAVE_KEY)).toBe(worldBytes);
  }, 180_000);

  it("post-S52 (Chris) — thirty-two seats: a draft is four pods (the player's live, three drafted at the start), the Open draws on all twelve lists, thirty-one different names and faces, sixteen pairings and no rematch in five rounds", async () => {
    const d = make().c;
    d.newEvent(532, { draft: true, seats: 32, rounds: 5, top8: true });
    expect(d.event!.field).toHaveLength(32);
    expect(d.draftView()!.pack).toHaveLength(15);
    expect(d.event!.draft!.packs).toHaveLength(8); // the player's pod
    for (const seat of d.event!.field.slice(8)) { expect(seat.pool).toHaveLength(45); expect(size(seat.deck)).toBe(40); }
    for (const seat of d.event!.field.slice(1, 8)) expect(seat.pool).toHaveLength(0); // still drafting with the player
    while (d.screen.kind === "draft") d.pickCard(d.suggestedPick()!);
    for (const seat of d.event!.field.slice(1)) { expect(seat.pool).toHaveLength(45); expect(size(seat.deck)).toBe(40); }
    expect(new Set(d.event!.field.map((x) => x.name)).size).toBe(32);
    expect(new Set(d.event!.field.slice(1).map((x) => x.face)).size).toBe(31);
    d.suggestDeck(); d.register();
    expect(d.event!.pairings).toHaveLength(16);
    for (let round = 1; round <= 5; round++) { await series(d, true); expect(d.event!.results.filter((r) => r.round === round)).toHaveLength(16); d.next(); }
    expect(new Set(d.event!.results.map((r) => [r.a, r.b].sort((x, y) => x - y).join("-"))).size).toBe(80); // no rematch
    expect(d.screen.kind).toBe("bracket");
    expect(d.event!.bracket!.seeds).toHaveLength(8);
    expect(d.fieldMs).not.toBeNull();

    const o = make().c;
    o.newEvent(533, { constructed: "open", seats: 32, rounds: 5, top8: true });
    expect(o.event!.field).toHaveLength(32);
    const lists = new Set(o.event!.field.slice(1).map((x) => x.list));
    expect(lists.size).toBeGreaterThanOrEqual(9); // thirty-one draws over twelve lists
    for (const l of lists) expect(l).toMatch(/^open:/);
    expect(new Set(o.event!.field.slice(1).map((x) => x.tinker))).toEqual(new Set(["stock", "light", "heavy"]));
  }, 600_000);
});
