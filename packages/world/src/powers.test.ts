import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "./loader.js";
import { activeDeck, deserializeWorld, newWorld, serializeWorld, type WorldState } from "./state.js";
import { activateStride, applyBalm, applyCrossing, barrageFight, burnFuel, fuelCandidates, fuelColorsOf, fuelDepth, powerAdvanced, powerRates, powerRefusal, powerUnlocked, quietusStrike, suggestFuel, unlockPower } from "./powers.js";
import { advance, type Encounter } from "./journey.js";
import { idx, regionAt } from "./map.js";
import { isTownCell, type OpponentInstance } from "./generate.js";
import type { StrongholdState } from "./stronghold.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = loadCatalog(join(ROOT, "data/world"));
const pool = loadCardPool(join(ROOT, "data/cards")).cards;

const mkWorld = (): WorldState => newWorld({ seed: 7, catalog, starter: "green" });

/** A passable non-town neighbour of the start (the world.test.ts stepCell pattern). */
function stepCell(w: WorldState): { x: number; y: number } {
  const start = w.player.position;
  const candidates = [
    { x: start.x + 1, y: start.y }, { x: start.x - 1, y: start.y }, { x: start.x, y: start.y + 1 }, { x: start.x, y: start.y - 1 },
  ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && !isTownCell(w.map, p));
  if (!candidates[0]) throw new Error("start has no passable neighbour");
  return candidates[0];
}

function quiet(w: WorldState): void {
  for (const o of w.opponents) if (!o.fixedAt) { o.gone = true; o.goneReason = "fled"; }
}
const QUIET = { event: { roamerRespawnSteps: { civilized: 0, approach: 0, wild: 0 } } } as const;

/** Stand a roamer on the next cell and step onto it (the world.test.ts firstEncounter pattern). */
function forceEncounter(w: WorldState, pick?: (o: OpponentInstance) => boolean): Encounter {
  const cell = stepCell(w);
  const region = regionAt(w.map, cell).index;
  const live = w.opponents.filter((o) => !o.gone && !o.fixedAt && o.at && (!pick || pick(o)));
  const inst = live.find((o) => o.region === region) ?? live[0];
  if (!inst) throw new Error("no live roamer to force");
  inst.at = { ...cell };
  inst.region = region;
  const events = advance(w, catalog, [cell]);
  const enc = events.find((e) => e.type === "encounter");
  if (enc && enc.type === "encounter") return enc.encounter;
  throw new Error("no encounter happened on the forced cell");
}

describe("S25 Part 2 — the fuel system (five-powers-design §1)", () => {
  it("colour matching: mono its colour, gold EITHER colour, lands what they tap for, colourless nothing", () => {
    expect(fuelColorsOf(pool.get("grizzly_bears")!)).toEqual(["G"]);
    expect(fuelColorsOf(pool.get("aetherbolt")!).sort()).toEqual(["R", "U"]); // gold fuels either
    expect(fuelColorsOf(pool.get("tropical_island")!).sort()).toEqual(["G", "U"]); // a land is what it taps for
    // The taps-for rule is LANDS-only (the S20 shop-stocking precedent verbatim): a Mox is a {0}
    // ARTIFACT, colour identity none — so the Moxen are unburnable. Flagged in the handoff:
    // arguably correct (the crown jewels are not kindling), but the planner should ratify.
    expect(fuelColorsOf(pool.get("mox_emerald")!)).toEqual([]);
  });

  it("the picker's list: spares only (never the active deck), sorted shopTier-then-price, sole-mechanism flagged and LAST", () => {
    const w = mkWorld();
    // A curated spare shelf: a T1 common, a T2, an R dual, and the court's own Keeper (prizeOnly).
    w.player.collection["grizzly_bears"] = (w.player.collection["grizzly_bears"] ?? 0) + 2;
    w.player.collection["rumbling_baloth"] = (w.player.collection["rumbling_baloth"] ?? 0) + 1;
    w.player.collection["tropical_island"] = 1;
    w.player.collection["the_emerald_keeper"] = 1;
    const cands = fuelCandidates(w, pool, "G");
    const ids = cands.map((c) => c.cardId);
    // Active-deck copies never fuel: the starter's own deck cards appear only to their SPARE depth.
    const deckUse = Object.fromEntries(activeDeck(w).map((e) => [e.cardId, e.count]));
    for (const c of cands) expect(c.available).toBe((w.player.collection[c.cardId] ?? 0) - (deckUse[c.cardId] ?? 0));
    expect(ids).toContain("tropical_island"); // the dual fuels G
    // Sole-mechanism sorts last (tierless = Infinity) and is flagged for the double-confirm.
    expect(ids[ids.length - 1]).toBe("the_emerald_keeper");
    expect(cands[cands.length - 1]!.soleMechanism).toBe(true);
    // Tier ascending holds across the rest.
    const tiers = cands.map((c) => c.tier);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });

  it("auto-suggest takes cheapest-first, never proposes a sole-mechanism burn, and reports null past the burnable depth", () => {
    const w = mkWorld();
    w.player.collection["the_emerald_keeper"] = 1;
    const cands = fuelCandidates(w, pool, "G");
    const burnable = fuelDepth(cands) - 1; // everything but the Keeper
    const picks = suggestFuel(cands, Math.min(3, burnable));
    expect(picks).not.toBeNull();
    expect(picks!).not.toContain("the_emerald_keeper");
    // The suggestion is the cheapest prefix: its cards come from the front of the sorted list.
    expect(picks![0]).toBe(cands.find((c) => !c.soleMechanism)!.cardId);
    expect(suggestFuel(cands, burnable + 1)).toBeNull(); // only the Keeper could cover it — never auto
  });

  it("burnFuel decrements the collection and refuses wrong-colour and non-spare picks", () => {
    const w = mkWorld();
    w.player.collection["grizzly_bears"] = (w.player.collection["grizzly_bears"] ?? 0) + 2;
    const before = w.player.collection["grizzly_bears"]!;
    burnFuel(w, pool, "G", ["grizzly_bears", "grizzly_bears"]);
    expect(w.player.collection["grizzly_bears"] ?? 0).toBe(before - 2);
    expect(() => burnFuel(w, pool, "G", ["doom_blade"])).toThrow(/cannot fuel/);
    expect(() => burnFuel(w, pool, "G", Array(99).fill("grizzly_bears"))).toThrow(/not spare/);
  });
});

describe("S25 Part 2 — power state, forms, and the v7 save", () => {
  it("unlock flags are knowledge (idempotent), and the form is COMPUTED from the seal — a fallen lord upgrades retroactively by construction", () => {
    const w = mkWorld();
    expect(powerUnlocked(w, "G")).toBe(false);
    unlockPower(w, "G");
    unlockPower(w, "G");
    expect(w.powers.unlocked).toEqual(["G"]);
    expect(powerAdvanced(w, "G")).toBe(false);
    expect(powerRates(w, "G").stride!.durationSteps).toBe(40);
    (w.strongholds as StrongholdState[]).push({ color: "G", seal: true, spokeMinionPoints: 0 });
    expect(powerAdvanced(w, "G")).toBe(true);
    expect(powerRates(w, "G").stride!.durationSteps).toBe(80); // duration raise (G/R form)
    (w.strongholds as StrongholdState[]).push({ color: "U", seal: true, spokeMinionPoints: 0 });
    expect(powerRates(w, "U").crossing!.cost).toBe(3); // cost reduction (W/U/B form)
    expect(powerRates(w, "B").quietus!.costs).toEqual({ 1: 3, 2: 6, 3: 10 }); // B unsealed: initial
  });

  it("v7 round-trips; a v6 save migrates with empty powers and the reserved gauntlet object", () => {
    const w = mkWorld();
    unlockPower(w, "U");
    w.powers.strideStepsLeft = 17;
    const back = deserializeWorld(serializeWorld(w));
    expect(back.powers).toEqual({ unlocked: ["U"], strideStepsLeft: 17 });
    expect(back.gauntlet).toEqual({});
    // A v6-shaped save (no powers, no gauntlet) reads clean.
    const v6 = JSON.parse(serializeWorld(mkWorld())) as { format: string; world: Record<string, unknown> };
    v6.format = "world-save-v6";
    delete v6.world.powers;
    delete v6.world.gauntlet;
    const migrated = deserializeWorld(JSON.stringify(v6));
    expect(migrated.powers).toEqual({ unlocked: [], strideStepsLeft: 0 });
    expect(migrated.gauntlet).toEqual({});
  });
});

describe("S25 Part 3 — the powers, wired (transactions on the world)", () => {
  it("the Stride doubles the pace: four cells cost two steps, the countdown ticks on paid halves only, and re-activation while running is refused", () => {
    const w = mkWorld();
    quiet(w);
    unlockPower(w, "G");
    w.player.collection["rumbling_baloth"] = 10;
    const cost = powerRates(w, "G").stride!.cost;
    const fuel = suggestFuel(fuelCandidates(w, pool, "G"), cost)!;
    const r = activateStride(w, pool, fuel);
    expect(r.ok).toBe(true);
    expect(w.powers.strideStepsLeft).toBe(40);
    const again = activateStride(w, pool, suggestFuel(fuelCandidates(w, pool, "G"), cost) ?? []);
    expect(again.ok).toBe(false); // one at a time — stacking is a rate question, escalated
    const a = stepCell(w);
    const start = { ...w.player.position };
    const before = w.player.stepsTaken;
    advance(w, catalog, [a, start, a, start], QUIET);
    expect(w.player.stepsTaken).toBe(before + 2); // 4 cells, 2 steps
    expect(w.powers.strideStepsLeft).toBe(38);
  });

  it("the Crossing lands at a threatened gate with the clock UNTOUCHED (zero ticks — the brief's fixture)", () => {
    const w = mkWorld();
    unlockPower(w, "U");
    w.player.collection["counterspell"] = 6;
    const town = w.map.towns[3]!;
    (w.sieges as { townIndex: number; epoch: number; status: string; nextThreatStep: number; deadlineStep?: number }[]).push({ townIndex: town.index, epoch: 0, status: "threatened", nextThreatStep: -1, deadlineStep: 99999 });
    const stepsBefore = w.player.stepsTaken;
    const rngBefore = JSON.stringify(w.rng);
    const cost = powerRates(w, "U").crossing!.cost;
    const r = applyCrossing(w, pool, town.index, suggestFuel(fuelCandidates(w, pool, "U"), cost)!);
    expect(r.ok).toBe(true);
    expect(w.player.position).toEqual(town.at); // the gate
    expect(w.player.stepsTaken).toBe(stepsBefore); // zero clock cost
    expect(JSON.stringify(w.rng)).toBe(rngBefore); // nothing rolled — nothing else moved
    // A quiet town is not a destination.
    const r2 = applyCrossing(w, pool, (town.index + 1) % w.map.towns.length, ["counterspell"]);
    expect(r2.ok).toBe(false);
  });

  it("the Balm heals per point, caps at the maximum, and prices at costPerLife", () => {
    const w = mkWorld();
    unlockPower(w, "W");
    w.player.collection["pacifism"] = 20;
    w.player.worldLife = 6; // max 10
    const per = powerRates(w, "W").balm!.costPerLife;
    const heal3 = applyBalm(w, pool, 3, suggestFuel(fuelCandidates(w, pool, "W"), 3 * per)!);
    expect(heal3.ok).toBe(true);
    expect(w.player.worldLife).toBe(9);
    const over = applyBalm(w, pool, 2, Array(2 * per).fill("pacifism"));
    expect(over.ok).toBe(false); // only 1 below maximum
    const top = applyBalm(w, pool, 1, Array(per).fill("pacifism"));
    expect(top.ok).toBe(true);
    expect(w.player.worldLife).toBe(10);
    expect(applyBalm(w, pool, 1, Array(per).fill("pacifism")).ok).toBe(false); // at the maximum
  });

  it("the Quietus: the roamer dies without a duel — ante roll only, NO gold, fear-only renown (the total untouched)", () => {
    const w = mkWorld();
    unlockPower(w, "B");
    w.player.collection["doom_blade"] = 12;
    const enc = forceEncounter(w);
    const tmpl = catalog.opponents.find((o) => o.id === enc.catalogId)!;
    const cost = powerRates(w, "B").quietus!.costs[enc.tier];
    const goldBefore = w.player.gold;
    const renownBefore = w.player.renown;
    const collectionBefore = Object.values(w.player.collection).reduce((a, b) => a + b, 0);
    const r = quietusStrike(w, catalog, pool, enc, suggestFuel(fuelCandidates(w, pool, "B"), cost)!);
    expect(r.ok).toBe(true);
    const inst = w.opponents.find((o) => o.id === enc.opponentId)!;
    expect(inst.gone).toBe(true);
    expect(inst.goneReason).toBe("defeated");
    expect(w.player.gold).toBe(goldBefore); // no gold — the fight's purse needed the fight
    expect(w.player.renown).toBe(renownBefore); // whispers, not respect
    for (const c of ["W", "U", "B", "R", "G"] as const) {
      expect(w.player.renownByColor[c]).toBe(tmpl.colors.includes(c) ? enc.tier : 0); // fear spreads
    }
    if (!r.ok) throw new Error("unreachable");
    const total = Object.values(w.player.collection).reduce((a, b) => a + b, 0);
    expect(total).toBe(collectionBefore - cost + r.anteWon.length); // fuel out, their stake in
  });

  it("the Barrage carves the enemy's opening life on the MatchSpec, floored at 1", () => {
    const w = mkWorld();
    unlockPower(w, "R");
    w.player.collection["lightning_bolt"] = 30;
    const enc = forceEncounter(w);
    const tmpl = catalog.opponents.find((o) => o.id === enc.catalogId)!;
    const dmg = Math.min(5, powerRates(w, "R").barrage!.cap);
    const r = barrageFight(w, catalog, pool, enc, dmg, suggestFuel(fuelCandidates(w, pool, "R"), dmg)!);
    expect(r.ok).toBe(true);
    if (!r.ok || r.outcome.type !== "fight") throw new Error("expected a fight");
    const lifeMod = r.outcome.duel.spec.modifiers.find((m) => m.type === "startingLife" && m.player === 1) as { value: number };
    expect(lifeMod.value).toBe(Math.max(1, tmpl.worldLife - dmg));
    // The floor: overkill leaves them standing at 1.
    const w2 = mkWorld();
    unlockPower(w2, "R");
    w2.player.collection["lightning_bolt"] = 30;
    const enc2 = forceEncounter(w2);
    const tmpl2 = catalog.opponents.find((o) => o.id === enc2.catalogId)!;
    const big = Math.min(powerRates(w2, "R").barrage!.cap, tmpl2.worldLife + 3);
    const r2 = barrageFight(w2, catalog, pool, enc2, big, suggestFuel(fuelCandidates(w2, pool, "R"), big)!);
    if (!r2.ok || r2.outcome.type !== "fight") throw new Error("expected a fight");
    const mod2 = r2.outcome.duel.spec.modifiers.find((m) => m.type === "startingLife" && m.player === 1) as { value: number };
    expect(mod2.value).toBe(Math.max(1, tmpl2.worldLife - big));
  });

  it("an unlearned power refuses with its reason", () => {
    const w = mkWorld();
    expect(powerRefusal(w, pool, "G", 4)).toMatch(/not yet learned/);
    expect(activateStride(w, pool, []).ok).toBe(false);
  });
});
