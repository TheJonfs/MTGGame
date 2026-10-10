import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "@shandalar/world/loader";
import { OUTBOX_PREFIX, deserializeWorld, readOutbox, type ConvocationPackData } from "@shandalar/world";
import { ConvocationController } from "./convocation-controller.js";
import { SAVE_KEY, WorldController } from "../world/world-controller.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json");
/** One browser's localStorage, as both pages see it. `failRemove` makes the next removals throw (a page closing mid-drain). */
function storage() {
  const m = new Map<string, string>(); const st = { failRemove: 0, m,
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => { if (st.failRemove > 0) { st.failRemove -= 1; throw new Error("closed"); } m.delete(k); },
    get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null };
  return st;
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const journey = (s: ReturnType<typeof storage>, seed = 5911) => { const w = new WorldController(pool, catalog, s as never); w.newGame({ starter: "green", difficulty: "standard", seed }); return w; };
const hall = (s: ReturnType<typeof storage>) => new ConvocationController(pool, packs, rating, catalog, s as never, () => "2026-10-10T00:00:00Z");
const outbox = (s: ReturnType<typeof storage>) => readOutbox(s).map((e) => e.id);
/** A journey event the tests can finish in seconds: the eight-seat Sealed (three rounds, no Umbel), entered by the letter. */
async function winByLetter(c: ConvocationController, invitationId: string, seed = 7): Promise<void> {
  (c as unknown as { pendingOrigin: unknown }).pendingOrigin = { origin: "journey", invitationId };
  c.newEvent(seed); c.suggestDeck(); c.register();
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
}

/** S59 (ADR-172) — the two pages over one storage: the letter, the spend, the finish posting home, the drain. */
describe("S59 — the journey and the Convocation over one storage (ADR-172)", () => {
  it("the letter: a journey past its thousandth step holds one; the door reads it and never writes the journey's save; entering posts the spend and stamps the event; a menu event is stamped so and posts nothing", () => {
    const s = storage(), w = journey(s);
    expect(w.invitation()).toBeNull();
    expect(hall(s).invitation()).toBeNull();
    w.world!.player.stepsTaken = 1002; w.save();
    expect(w.invitation()).toMatchObject({ id: "5911-p1-s1", shape: "short", until: 2000 });
    expect(w.linkNote).toBe("The Convocation sits. A letter under seal admits you — two days. It stands until step 2000.");
    const bytes = s.getItem(SAVE_KEY)!;
    const c = hall(s);
    expect(c.invitation()!.id).toBe("5911-p1-s1");
    // a menu event first: the same mode, its origin the menu, nothing in the outbox
    c.newEvent(3);
    expect([c.event!.origin, c.event!.invitationId, outbox(s)]).toEqual(["menu", undefined, []]);
    expect(c.enterByInvitation()).toBe(false); // an event is in progress
    c.abandon();
    expect(c.enterByInvitation({ seed: 59, first: "open" })).toBe(true);
    expect([c.event!.origin, c.event!.invitationId, c.event!.stages?.length, c.event!.field.length]).toEqual(["journey", "5911-p1-s1", 2, 128]); // the short Convocation
    expect(outbox(s)).toEqual(["5911-p1-s1:spent"]);
    expect(c.invitation()).toBeNull(); // spent here, before the journey has heard
    expect(hall(s).invitation()).toBeNull(); // and after a reload of the hall
    expect(s.getItem(SAVE_KEY)).toBe(bytes); // the hall never wrote the journey's save
    // the journey hears on focus: the letter is spent, the entry gone
    w.syncConvocation();
    expect([w.invitation(), outbox(s)]).toEqual([null, []]);
    expect(deserializeWorld(s.getItem(SAVE_KEY)!).invitations![0]).toMatchObject({ id: "5911-p1-s1", spent: true });
  }, 120_000);

  it("a finish posts; the journey drains once; a reload between the post and the drain loses nothing; a page closed between the save and the delete applies nothing twice; another journey takes nothing", async () => {
    const s = storage(), w = journey(s);
    w.world!.player.stepsTaken = 1000; w.save();
    const inv = w.invitation()!.id, gold0 = w.world!.player.gold;
    const c = hall(s);
    await winByLetter(c, inv);
    expect([c.event!.phase, c.event!.origin]).toEqual(["over", "journey"]);
    expect(c.prize()).toEqual({ band: "champion", gold: 150, cards: 1 }); // a single event: half the champion's 300
    expect(c.ledger()[0]).toMatchObject({ origin: "journey", invitationId: inv, prizeGold: 150, place: 1 });
    expect(outbox(s)).toEqual([`${inv}:prize`]);
    c.keep("black_lotus"); // the fence, and not in the pool besides
    const card = c.event!.field[0]!.pool.find((id) => c.keepable(id))!;
    c.keep(card);
    expect(outbox(s)).toEqual([`${inv}:kept:1`, `${inv}:prize`]);
    new ConvocationController(pool, packs, rating, catalog, s as never).resume(); // a reload at the prize posts nothing again
    expect(readOutbox(s)).toHaveLength(2);
    // another journey (another seed) in the same browser is not paid
    const s2 = storage(); for (const [k, v] of s.m) if (k.startsWith(OUTBOX_PREFIX)) s2.setItem(k, v);
    const other = journey(s2, 4242); other.syncConvocation(); other.save();
    expect([other.world!.player.gold, readOutbox(s2)]).toEqual([gold0, readOutbox(s)]);
    // the journey's page was closed all along: a RELOAD from its autosave finds the entries
    const held = (w.world!.player.collection[card] ?? 0);
    const back = new WorldController(pool, catalog, s as never);
    s.failRemove = 2; // …and closes again after its save, before the entries are deleted
    expect(back.continueFromAutosave()).toBe(true);
    expect([back.world!.player.gold - gold0, (back.world!.player.collection[card] ?? 0) - held]).toEqual([150, 1]);
    expect(back.linkNote).toBe(`From the Convocation: 150 gold, ${pool.get(card)!.name}.`);
    expect(readOutbox(s)).toHaveLength(2); // still posted: the delete never happened
    expect(deserializeWorld(s.getItem(SAVE_KEY)!).player.gold - gold0).toBe(150); // but the save holds it
    // the next load applies nothing twice, and now deletes
    const again = new WorldController(pool, catalog, s as never);
    again.continueFromAutosave();
    expect([again.world!.player.gold - gold0, (again.world!.player.collection[card] ?? 0) - held, outbox(s)]).toEqual([150, 1, []]);
    expect(again.world!.provenance.filter((p) => p.source === "convocation")).toEqual([{ cardId: card, source: "convocation", step: 1000 }]);
    again.syncConvocation(); again.save();
    expect(again.world!.player.gold - gold0).toBe(150);
  }, 240_000);

  it("two tabs: the hall posts while the journey autosaves from memory — the entry is neither lost nor overwritten, and is applied at the journey's next save", () => {
    const s = storage(), w = journey(s);
    w.world!.player.stepsTaken = 1000; w.save();
    const inv = w.invitation()!.id, gold0 = w.world!.player.gold;
    const posts = hall(s);
    // the journey's tab holds its world in memory; the hall posts between two of its autosaves
    w.save();
    (posts as unknown as { storage: { setItem(k: string, v: string): void } }).storage.setItem(OUTBOX_PREFIX + `${inv}:prize`, JSON.stringify({ id: `${inv}:prize`, kind: "prize", invitationId: inv, gold: 75 }));
    expect(outbox(s)).toEqual([`${inv}:prize`]);
    w.save(); // the whole save rewritten from memory: the outbox is another key, and this very save takes the entry in
    expect([w.world!.player.gold - gold0, outbox(s), deserializeWorld(s.getItem(SAVE_KEY)!).player.gold - gold0]).toEqual([75, [], 75]);
    // a post landing AFTER the journey read the outbox but before it deleted: only the ids it applied are removed
    (posts as unknown as { storage: { setItem(k: string, v: string): void } }).storage.setItem(OUTBOX_PREFIX + `${inv}:kept:1`, JSON.stringify({ id: `${inv}:kept:1`, kind: "kept", invitationId: inv, cards: ["grizzly_bears"] }));
    const bears = w.world!.player.collection.grizzly_bears ?? 0;
    const st = (w as unknown as { linkToDelete: string[] });
    expect(st.linkToDelete).toEqual([]);
    w.save();
    expect([(w.world!.player.collection.grizzly_bears ?? 0) - bears, outbox(s)]).toEqual([1, []]);
  });
});
