import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "@shandalar/world/loader";
import { HIGH_GROUNDS, STILL_GROUNDS, groundPrize, postOutbox, readOutbox, type ConvocationEvent, type ConvocationPackData } from "@shandalar/world";
import { ConvocationController } from "./convocation-controller.js";
import { WorldController } from "../world/world-controller.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json");
function storage() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null };
}
const journey = (s: ReturnType<typeof storage>) => { const w = new WorldController(pool, catalog, s as never); w.newGame({ starter: "green", difficulty: "standard", seed: 5911 }); w.world!.player.stepsTaken = 1000; w.save(); return w; };
/** A hall at the prize screen of a finished journey Convocation won by the human: the event's shape is all the prize reads. */
function champion(s: ReturnType<typeof storage>, invitationId: string, o: { full: boolean; hard: boolean }): ConvocationController {
  const c = new ConvocationController(pool, packs, rating, catalog, s as never, () => "2026-11-03T00:00:00Z");
  const stages = Array.from({ length: o.full ? 4 : 2 }, () => ({ kind: "sealed", formatId: "sealed-plane", rounds: 3 }));
  (c as unknown as { event: Partial<ConvocationEvent> }).event = { phase: "over", origin: "journey", invitationId, stages, difficulty: o.hard ? "hard" : "normal", field: [], seed: 1 } as Partial<ConvocationEvent>;
  (c as unknown as { prize: () => unknown }).prize = () => ({ band: "champion", gold: 0, cards: 2 });
  (c as unknown as { set: (e: ConvocationEvent) => void }).set = (e) => { (c as unknown as { event: ConvocationEvent }).event = e; };
  return c;
}

/** S71 (ADR-194): the champion's High Ground. The full Convocation's champion chooses one of the ten; the short one's one
 * of the five still-pair grounds; Hard pays the choice of a second. A prize passes the fence; each ground at most once a journey. */
describe("S71 (ADR-194) — the prize flow: the champion's High Ground", () => {
  it("the table: ten after the full, the still five after the short, two on Hard; the grounds already paid are not offered", () => {
    expect(groundPrize("full", false, [])).toEqual({ choices: [...HIGH_GROUNDS], count: 1 });
    expect(groundPrize("short", false, [])).toEqual({ choices: [...STILL_GROUNDS], count: 1 });
    expect(groundPrize("short", true, []).count).toBe(2);
    expect(groundPrize("short", true, ["hearthspire", "volmaw", "nightbower", "ranksmere"])).toEqual({ choices: ["burnfallow"], count: 1 });
    expect(STILL_GROUNDS.every((g) => (HIGH_GROUNDS as readonly string[]).includes(g) && pool.get(g)?.prizeOnly)).toBe(true);
  });

  it("walked: a champion chooses a ground; the journey drains it; a second win cannot choose it again", () => {
    const s = storage(), w = journey(s), inv = w.invitation()!.id;
    const c = champion(s, inv, { full: false, hard: true });
    expect(c.groundPrize()).toEqual({ choices: [...STILL_GROUNDS], count: 2, chosen: [] });
    c.chooseGround("tallyflame_court"); // a flowing ground: not the short Convocation's
    c.chooseGround("hearthspire");
    c.chooseGround("hearthspire"); // chosen already
    c.chooseGround("volmaw");
    c.chooseGround("ranksmere"); // past the two
    expect(c.groundPrize()!.chosen).toEqual(["hearthspire", "volmaw"]);
    expect(readOutbox(s).filter((e) => e.kind === "ground").map((e) => e.cards)).toEqual([["hearthspire"], ["volmaw"]]);
    // a second Convocation before the journey has drained: the pending entries already count
    const next = `${inv.replace(/-s\d+$/, "")}-s99`;
    expect(champion(s, next, { full: true, hard: false }).groundPrize()!.choices).toEqual(HIGH_GROUNDS.filter((g) => g !== "hearthspire" && g !== "volmaw"));
    // the journey drains: both grounds are in the collection, and the world remembers them
    const held = w.world!.player.collection.hearthspire ?? 0;
    w.syncConvocation(); w.save();
    expect([(w.world!.player.collection.hearthspire ?? 0) - held, w.world!.player.collection.volmaw ?? 0]).toEqual([1, 1]);
    expect(w.world!.convocation!.grounds).toEqual(["hearthspire", "volmaw"]);
    // a ground posted again (another sitting) is not paid twice; a ground sent as a KEPT card never passes the fence
    postOutbox(s, { id: `${next}:ground:1`, kind: "ground", invitationId: next, cards: ["hearthspire"] });
    postOutbox(s, { id: `${next}:kept:1`, kind: "kept", invitationId: next, cards: ["nightbower"] });
    w.syncConvocation(); w.save();
    expect([(w.world!.player.collection.hearthspire ?? 0) - held, w.world!.player.collection.nightbower ?? 0]).toEqual([1, 0]);
    // and after the drain, a later champion reads them from the journey's save
    expect(champion(s, `${inv.replace(/-s\d+$/, "")}-s100`, { full: false, hard: false }).groundPrize()).toEqual({ choices: ["nightbower", "ranksmere", "burnfallow"], count: 1, chosen: [] });
  });

  it("no ground for a menu event, a single event, or a finish below the top", () => {
    const s = storage(), w = journey(s), inv = w.invitation()!.id;
    const c = champion(s, inv, { full: true, hard: false });
    (c as unknown as { prize: () => unknown }).prize = () => ({ band: "eight", gold: 0, cards: 1 });
    expect(c.groundPrize()).toBeNull();
    const single = champion(s, inv, { full: true, hard: false });
    const { stages: _s, ...rest } = single.event!; (single as unknown as { event: Partial<ConvocationEvent> }).event = rest;
    expect(single.groundPrize()).toBeNull();
  });
});
