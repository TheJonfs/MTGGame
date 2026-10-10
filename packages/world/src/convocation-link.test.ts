import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { loadCatalog } from "./loader.js";
import { defaultKnobs } from "./knobs.js";
import { deserializeWorld, newWorld, serializeWorld } from "./state.js";
import { OUTBOX_PREFIX, POWER_SLOT, applyOutbox, keepable, postOutbox, prizeBand, prizeGold, readOutbox, removeOutbox, standingInvitation, tickConvocationClock, type OutboxStore } from "./convocation-link.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = loadCatalog(join(ROOT, "data/world"));
const knobs = defaultKnobs();
const mem = (): OutboxStore & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null }; };
const world = (seed = 5901) => newWorld({ seed, catalog, starter: "green", difficulty: "standard" });
const at = (w: ReturnType<typeof world>, steps: number) => { w.player.stepsTaken = steps; return tickConvocationClock(w, knobs); };

/** S59 (ADR-172) — the bridge between the journey and the Convocation: the clock, the window, the outbox, the fence, the prize table. */
describe("S59 — the Convocation's link to the journey (ADR-172)", () => {
  it("the clock: the Convocation sits every convocationInterval steps (1000); an invitation stands until the next sitting — a window, not a stock", () => {
    expect([knobs.convocationInterval, knobs.convocationShape]).toEqual([1000, { 1: "short", 2: "full" }]);
    const w = world();
    expect(at(w, 999)).toEqual({ sat: null, missed: false });
    expect(standingInvitation(w)).toBeNull();
    const first = at(w, 1003);
    expect(first.sat).toMatchObject({ id: "5901-p1-s1", source: "clock", shape: "short", postedAt: 1003, until: 2000 });
    expect(first.missed).toBe(false);
    expect(at(w, 1500)).toEqual({ sat: null, missed: false }); // idempotent between sittings
    expect(standingInvitation(w)!.id).toBe("5901-p1-s1");
    const second = at(w, 2000); // the first was never spent: gone, and said so
    expect([second.sat!.id, second.missed, second.sat!.until]).toEqual(["5901-p1-s2", true, 3000]);
    expect(w.invitations!.map((i) => i.id)).toEqual(["5901-p1-s2"]); // they do not accumulate
    w.invitations![0]!.spent = true;
    expect(standingInvitation(w)).toBeNull();
    const third = at(w, 3100);
    expect([third.sat!.id, third.missed]).toEqual(["5901-p1-s3", false]); // a spent letter is not a missed one
    expect(w.invitations!.map((i) => i.id)).toEqual(["5901-p1-s2", "5901-p1-s3"]); // the spent stay: an outbox entry names its invitation
    // a journey that slept through two sittings is told once and holds one letter
    const far = at(w, 6400);
    expect([far.sat!.id, far.missed, standingInvitation(w)!.until]).toEqual(["5901-p1-s6", true, 7000]);
    // phase two admits the four days
    const w2 = world(77); w2.phase = 2;
    expect(at(w2, 1000).sat).toMatchObject({ id: "77-p2-s1", shape: "full" });
    // the fields ride the save (additive; a save from before has neither)
    const back = deserializeWorld(serializeWorld(w, { compact: true }));
    expect([back.invitations, back.convocation]).toEqual([w.invitations, w.convocation]);
    expect(standingInvitation(world())).toBeNull();
  });

  it("the outbox: a post is one key of its own; an entry is applied once, to the journey whose invitation it names; cards never from the power slot", () => {
    const s = mem(), w = world(); at(w, 1000);
    const inv = standingInvitation(w)!.id;
    expect(postOutbox(s, { id: `${inv}:spent`, kind: "spent", invitationId: inv })).toBe(true);
    postOutbox(s, { id: `${inv}:prize`, kind: "prize", invitationId: inv, gold: 150 });
    postOutbox(s, { id: `${inv}:kept:1`, kind: "kept", invitationId: inv, cards: ["serra_angel", "black_lotus", "no_such_card"] });
    postOutbox(s, { id: `${inv}:prize`, kind: "prize", invitationId: inv, gold: 999 }); // the same id again: nothing changes
    postOutbox(s, { id: "42-p2-s1:prize", kind: "prize", invitationId: "42-p2-s1", gold: 300 }); // another journey's
    s.setItem("shandalar-world-save", "{}"); s.setItem(OUTBOX_PREFIX + "broken", "{not json");
    expect(readOutbox(s).map((e) => e.id)).toEqual(["42-p2-s1:prize", `${inv}:kept:1`, `${inv}:prize`, `${inv}:spent`]);
    const gold = w.player.gold, angels = w.player.collection.serra_angel ?? 0;
    const isCard = (id: string) => id !== "no_such_card";
    const r = applyOutbox(w, readOutbox(s), isCard);
    expect(r.applied.map((e) => e.id)).toEqual([`${inv}:kept:1`, `${inv}:prize`, `${inv}:spent`]);
    expect([w.player.gold - gold, (w.player.collection.serra_angel ?? 0) - angels, w.player.collection.black_lotus ?? 0]).toEqual([150, 1, 0]);
    expect(w.provenance[w.provenance.length - 1]).toEqual({ cardId: "serra_angel", source: "convocation", step: 1000 });
    expect(standingInvitation(w)).toBeNull(); // spent
    // again before the delete (the save succeeded, the page closed): nothing is applied twice; the ids come back as stale
    const again = applyOutbox(w, readOutbox(s), isCard);
    expect([again.applied.length, again.stale.sort()]).toEqual([0, [`${inv}:kept:1`, `${inv}:prize`, `${inv}:spent`]]);
    expect(w.player.gold - gold).toBe(150);
    removeOutbox(s, again.stale);
    expect(readOutbox(s).map((e) => e.id)).toEqual(["42-p2-s1:prize"]); // the other journey's waits for its own
    // …and its own takes it, by seed and phase, even with its invitation list gone
    const other = world(42); other.phase = 2;
    expect(applyOutbox(other, readOutbox(s), isCard).applied.map((e) => e.id)).toEqual(["42-p2-s1:prize"]);
  });

  it("the fence (a): the packs' power slot is the fourteen, and none of them is keepable", () => {
    const power = (JSON.parse(readFileSync(join(ROOT, "data/convocation/sets.json"), "utf8")) as { power: string[] }).power;
    expect([...POWER_SLOT].sort()).toEqual([...power].sort());
    expect(power).toHaveLength(14);
    for (const id of power) expect(keepable(id, power), id).toBe(false);
    expect(keepable("black_lotus", [])).toBe(false); // the world's own list, whatever the packs say
    expect(keepable("serra_angel", power)).toBe(true);
  });

  it("the prize table (provisional): gold by band — 300 / 150 / 75 / 25; Hard ×1.5; a single event half", () => {
    expect([prizeBand(1, 128, true), prizeBand(5, 128, true), prizeBand(8, 128, true), prizeBand(9, 128, true), prizeBand(32, 128, true), prizeBand(33, 128, true), prizeBand(128, 128, true)]).toEqual(["champion", "eight", "eight", "quarter", "quarter", "rest", "rest"]);
    expect([prizeBand(2, 8, false), prizeBand(3, 8, false)]).toEqual(["quarter", "rest"]); // no Umbel: no eight
    const g = (band: Parameters<typeof prizeGold>[0], hard = false, single = false) => prizeGold(band, { hard, single }, knobs);
    expect([g("champion"), g("eight"), g("quarter"), g("rest")]).toEqual([300, 150, 75, 25]);
    expect([g("champion", true), g("eight", false, true), g("rest", true, true)]).toEqual([450, 75, 19]);
  });
});
