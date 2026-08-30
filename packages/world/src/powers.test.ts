import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "./loader.js";
import { activeDeck, deserializeWorld, newWorld, serializeWorld, type WorldState } from "./state.js";
import { burnFuel, fuelCandidates, fuelColorsOf, fuelDepth, powerAdvanced, powerRates, powerUnlocked, suggestFuel, unlockPower } from "./powers.js";
import type { StrongholdState } from "./stronghold.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = loadCatalog(join(ROOT, "data/world"));
const pool = loadCardPool(join(ROOT, "data/cards")).cards;

const mkWorld = (): WorldState => newWorld({ seed: 7, catalog, starter: "green" });

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
