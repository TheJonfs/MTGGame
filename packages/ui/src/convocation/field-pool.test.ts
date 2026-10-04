import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "@shandalar/world/loader";
import { limitedView, runDraftPacks, type ConvocationEvent, type ConvocationPackData, type SeriesState } from "@shandalar/world";
import { FieldPool } from "./field-pool.js";
import { ConvocationController } from "./convocation-controller.js";

/** Post-S53 (Chris: the field hung at "0 of 63" after a redeploy): the pool breaks rather than respawning forever, and
 * the controller plays the round on the main thread — the same series. Fake workers stand in for the browser's. */
type Handler = ((ev: { data: unknown }) => void) | null;
class FakeWorker {
  onmessage: Handler = null; onerror: (() => void) | null = null; terminated = false;
  constructor(private readonly mode: "dead" | "silent" | "ok") {
    if (mode === "dead") setTimeout(() => this.onerror?.(), 0);
    if (mode === "ok") setTimeout(() => this.onmessage?.({ data: { type: "ready" } }), 0);
  }
  postMessage(msg: { id: number }): void {
    if (this.mode !== "ok") return;
    const series: SeriesState = { seed: 1, bestOf: 3, games: [], wins: [2, 0], draws: 0, done: true, winner: 0 } as unknown as SeriesState;
    setTimeout(() => this.onmessage?.({ data: { type: "done", id: msg.id, series } }), 0);
  }
  terminate(): void { this.terminated = true; }
}
const asWorker = (w: FakeWorker) => w as unknown as Worker;
const event = { field: [{}, {}, {}], results: [], history: [] } as unknown as ConvocationEvent;
const knobs = {} as never;

describe("the field's workers fail safe (post-S53)", () => {
  it("workers that cannot start break the pool — the waiting series is rejected, later ones refused — instead of respawning forever", async () => {
    let made = 0;
    const pool = new FieldPool(3, () => { made += 1; return asWorker(new FakeWorker("dead")); });
    await expect(pool.series(event, 1, 2, knobs)).rejects.toThrow(/could not start/);
    expect(pool.broken).toMatch(/could not start/);
    expect(made).toBeLessThanOrEqual(5); // three, and at most a couple of replacements — not a loop
    await expect(pool.series(event, 1, 2, knobs)).rejects.toThrow();
    pool.dispose();
  });

  it("workers that never say ready break the pool after the ready window", async () => {
    const pool = new FieldPool(2, () => asWorker(new FakeWorker("silent")), 30);
    await expect(pool.series(event, 1, 2, knobs)).rejects.toThrow(/no field worker started/);
    pool.dispose();
  });

  it("healthy workers play the series", async () => {
    const pool = new FieldPool(2, () => asWorker(new FakeWorker("ok")));
    const s = await pool.series(event, 1, 2, knobs);
    expect(s.done).toBe(true);
    expect(pool.broken).toBeNull();
    pool.dispose();
  });

  it("the controller plays a round whose workers are broken on the main thread, with the same results as without workers", async () => {
    const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const pool = loadCardPool(join(ROOT, "data/cards")).cards, catalog = loadCatalog(join(ROOT, "data/world"));
    const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
    const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
    const rating = read("card-rating.json");
    const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
    const play = async (broken: boolean) => {
      const c = new ConvocationController(pool, packs, rating, catalog, mem(), () => "2026-10-03T00:00:00Z");
      c.newEvent(61, { seats: 16, rounds: 1 });
      c.suggestDeck(); c.register();
      if (broken) (c as unknown as { fieldPool: FieldPool | null }).fieldPool = new FieldPool(2, () => asWorker(new FakeWorker("dead")));
      c.playMatch();
      for (let g = 0; g < 2000 && c.screen.kind !== "standings"; g++) {
        if (c.screen.kind === "playDraw") c.choose("play");
        else if (c.screen.kind === "match") { c.match!.autoWin(); await new Promise((r) => setTimeout(r, 20)); }
        else if (c.screen.kind === "between") c.nextGame();
        else await new Promise((r) => setTimeout(r, 40));
      }
      return c;
    };
    const plain = await play(false), fallen = await play(true);
    expect(fallen.screen.kind).toBe("standings"); // not stranded on the field screen
    expect((fallen as unknown as { fieldPool: FieldPool | null }).fieldPool).toBeNull(); // the page stops using them
    expect(fallen.event!.results).toEqual(plain.event!.results); // the same series, a series being its seed's
  }, 120_000);

  it("S54 (Concern 6): a draft stage's other pods draft on the workers — the field the main thread would draft", async () => {
    const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const pool = loadCardPool(join(ROOT, "data/cards")).cards, catalog = loadCatalog(join(ROOT, "data/world"));
    const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
    const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
    const rating = read("card-rating.json");
    let drafted = 0;
    // a worker that drafts in-process: what convocation-worker.ts does with a draft job
    class DraftWorker extends FakeWorker {
      constructor() { super("ok"); }
      override postMessage(msg: { id: number; kind?: string; seed?: number; setId?: string; recipeId?: string; packs?: number; seats?: number }): void {
        if (msg.kind !== "draft") return super.postMessage(msg);
        const set = packs.sets.find((x) => x.id === msg.setId)!, recipe = packs.recipes.find((r) => r.id === msg.recipeId)!;
        const picks = runDraftPacks(set, recipe, packs, pool, limitedView(rating), msg.seed!, msg.seats!, msg.packs!);
        drafted += 1;
        setTimeout(() => this.onmessage?.({ data: { type: "drafted", id: msg.id, picks } }), 0);
      }
    }
    const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
    const day1 = async (workers: boolean) => {
      const c = new ConvocationController(pool, packs, rating, catalog, mem(), () => "2026-10-03T00:00:00Z");
      if (workers) (c as unknown as { fieldPool: FieldPool | null }).fieldPool = new FieldPool(2, () => asWorker(new DraftWorker()));
      c.newConvocation(83, { short: true, seats: 32 });
      expect(c.screen.kind).toBe("build"); // the Open's decklist first
      c.suggestDeck(); await c.register();
      expect(c.screen.kind).toBe("draft");
      return c.event!;
    };
    const plain = await day1(false), worked = await day1(true);
    expect(drafted).toBe(3); // 32 seats: four pods, the human's drafts live
    expect(worked.field).toEqual(plain.field);
  }, 120_000);
});
