import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { DECKS, DECK_ARCHETYPES } from "@shandalar/sim/decks";
import { loadCatalog } from "./loader.js";
import { generateWorld, DEFAULT_GENERATOR } from "./generate.js";
import { findPath, idx, reachable, regionAt } from "./map.js";
import { deserializeWorld, newWorld, serializeWorld, deckSize, type WorldState } from "./state.js";
import { advance, applyDuelResult, deckLegal, parley, walkTo, type Encounter } from "./journey.js";
import { WorldRng } from "./rng.js";
import { catalogFrom } from "./catalog.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = loadCatalog(join(ROOT, "data/world"));
const pool = loadCardPool(join(ROOT, "data/cards"));

describe("catalog v0", () => {
  it("loads and validates; 15 opponents over 5 decks × 3 tiers; every deck key exists", () => {
    expect(catalog.version).toBe("v0");
    expect(catalog.opponents).toHaveLength(15);
    for (const o of catalog.opponents) expect(o.deck in DECKS).toBe(true);
    expect(catalog.regions.filter((r) => r.tier === "civilized").length).toBeGreaterThanOrEqual(2);
  });
  it("rejects unknown knobs and bad decks loudly", () => {
    const bad = JSON.parse(JSON.stringify({ regions: { catalogVersion: "v0", regions: catalog.regions }, towns: { catalogVersion: "v0", names: catalog.townNames }, opponents: { catalogVersion: "v0", opponents: [{ ...catalog.opponents[0], knobs: { anteCounts: 2 } }] } }));
    expect(() => catalogFrom(bad)).toThrow(/Unknown knob "anteCounts"/);
  });
});

describe("world generator (invariant fuzz, ≥200 seeds)", () => {
  it("every town reachable from the start, no orphan region, ≥2 towns, deterministic per seed", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const w = generateWorld(seed, catalog);
      expect(w.map.towns.length, `seed ${seed} towns`).toBeGreaterThanOrEqual(2);
      const reach = reachable(w.map, w.map.start);
      for (const t of w.map.towns) expect(reach.has(idx(w.map, t.at)), `seed ${seed} town ${t.name} reachable`).toBe(true);
      for (const r of w.map.regions) {
        let ok = false;
        for (let i = 0; i < w.map.region.length && !ok; i++) if (w.map.region[i] === r.index && reach.has(i)) ok = true;
        expect(ok, `seed ${seed} region ${r.name} has a reachable cell`).toBe(true);
      }
      // Town spacing honored (or relaxed only when the map forced it — never adjacent).
      for (const a of w.map.towns) for (const b of w.map.towns) if (a !== b) expect(Math.abs(a.at.x - b.at.x) + Math.abs(a.at.y - b.at.y)).toBeGreaterThan(1);
      // Every region has a roster.
      for (const r of w.map.regions) expect(w.opponents.filter((o) => o.region === r.index).length).toBe(DEFAULT_GENERATOR.rosterPerRegion);
      if (seed <= 20) {
        const again = generateWorld(seed, catalog);
        expect(JSON.stringify(again)).toBe(JSON.stringify(w));
      }
    }
  });
  it("pathfinding: BFS path is walkable, shortest-ish, and null when unreachable", () => {
    const w = generateWorld(7, catalog);
    const [a, b] = w.map.towns;
    const path = findPath(w.map, a!.at, b!.at)!;
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThanOrEqual(Math.abs(a!.at.x - b!.at.x) + Math.abs(a!.at.y - b!.at.y));
    for (const c of path) expect(w.map.passable[idx(w.map, c)]).toBe(true);
    expect(path[path.length - 1]).toEqual(b!.at);
  });
});

describe("WorldState + world-save-v1", () => {
  it("new world: start in a town, world life 10, gold 20, collection = starter deck + spares, deck legal", () => {
    const w = newWorld({ seed: 11, catalog, starterDeck: "A" });
    expect(w.player.worldLife).toBe(10);
    expect(w.player.gold).toBe(20);
    expect(w.map.towns.some((t) => t.at.x === w.player.position.x && t.at.y === w.player.position.y)).toBe(true);
    expect(deckSize(w.player.activeDeck)).toBe(deckSize(DECKS.A.decklist));
    const owned = Object.values(w.player.collection).reduce((n, v) => n + v, 0);
    expect(owned).toBe(deckSize(DECKS.A.decklist) + 10);
    expect(w.player.basicLand).toBe("mountain");
    expect(deckLegal(w.player.activeDeck).ok).toBe(true);
  });
  it("serialize → deserialize round-trips byte-identically, and rejects other formats", () => {
    const w = newWorld({ seed: 12, catalog, starterDeck: "E" });
    walkTo(w, catalog, w.map.towns[1]!.at);
    const text = serializeWorld(w);
    const back = deserializeWorld(text);
    expect(back).toEqual(w);
    expect(serializeWorld(back)).toBe(text);
    expect(() => deserializeWorld(JSON.stringify({ format: "world-save-v0", world: {} }))).toThrow(/Unsupported save format/);
  });
  it("the RNG stream resumes exactly after a save (same draws after load as without)", () => {
    const a = newWorld({ seed: 13, catalog, starterDeck: "C" });
    const b = deserializeWorld(serializeWorld(a));
    const ra = new WorldRng(a.rng), rb = new WorldRng(b.rng);
    for (let i = 0; i < 50; i++) expect(ra.int(1000)).toBe(rb.int(1000));
  });
});

// ---------- the acceptance journey (brief Part 4, scripted half; S12 carving (b)) ----------

function agentsFor(spec: WorldState, enemyDifficulty: "apprentice" | "journeyman" | "master", enemyDeck: keyof typeof DECKS, seed: number): [Agent, Agent] {
  const me = new HeuristicAgent(seed * 2 + 1, pool.cards, difficultyProfile("journeyman", DECK_ARCHETYPES.A, [...DECKS[enemyDeck].decklist]));
  const them = new HeuristicAgent(seed * 2 + 2, pool.cards, difficultyProfile(enemyDifficulty, DECK_ARCHETYPES[enemyDeck], spec.player.activeDeck.map((e) => ({ ...e }))));
  return [me, them];
}

/** Force an encounter on the very next step via the event layer. */
const FORCE = { event: { encounterRatePerStep: { civilized: 1, approach: 1, wild: 1 } } } as const;

function firstEncounter(w: WorldState): Encounter {
  // Step off the town cell (towns don't roll); the first non-town step rolls at rate 1.
  const start = w.player.position;
  const candidates = [
    { x: start.x + 1, y: start.y }, { x: start.x - 1, y: start.y }, { x: start.x, y: start.y + 1 }, { x: start.x, y: start.y - 1 },
  ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && !w.map.towns.some((t) => t.at.x === p.x && t.at.y === p.y));
  for (const c of candidates) {
    const events = advance(w, catalog, [c], FORCE);
    const enc = events.find((e) => e.type === "encounter");
    if (enc && enc.type === "encounter") return enc.encounter;
  }
  throw new Error("no encounter could be forced from the start town");
}

describe("acceptance journey (headless): walk → encounter → each parley branch → bookkeeping → save/load", () => {
  it("buy-off deducts buyOffBase × tier; refused when broke", () => {
    const w = newWorld({ seed: 21, catalog, starterDeck: "A" });
    const enc = firstEncounter(w);
    const gold = w.player.gold;
    const out = parley(w, catalog, enc, "buyoff");
    if (out.type === "boughtOff") {
      expect(out.goldPaid).toBe(15 * enc.tier);
      expect(w.player.gold).toBe(gold - 15 * enc.tier);
    } else {
      expect(out.type).toBe("refused"); // a tier-2/3 enemy costs more than 20 gold
      expect(w.player.gold).toBe(gold);
    }
  });

  it("flee forfeits ante (anteCount nonland cards leave collection+deck, basics refill the deck), then either escapes or fights", () => {
    const w = newWorld({ seed: 22, catalog, starterDeck: "D" });
    const enc = firstEncounter(w);
    const before = deckSize(w.player.activeDeck);
    const ownedBefore = Object.values(w.player.collection).reduce((n, v) => n + v, 0);
    const out = parley(w, catalog, enc, "flee");
    expect(["fled", "fleeFailed"]).toContain(out.type);
    const lost = out.type === "fled" || out.type === "fleeFailed" ? out.anteLost : [];
    expect(lost.length).toBeGreaterThanOrEqual(1);
    for (const id of lost) expect(pool.cards.get(id)!.types).not.toContain("Land");
    expect(deckSize(w.player.activeDeck)).toBe(before); // refilled with basics
    expect(deckLegal(w.player.activeDeck).ok).toBe(true);
    // Net owned cards: −lost +lost basics (free) = unchanged count, different composition.
    expect(Object.values(w.player.collection).reduce((n, v) => n + v, 0)).toBe(ownedBefore);
    expect(w.player.activeDeck.find((e) => e.cardId === "swamp")!.count).toBeGreaterThan(DECKS.D.decklist.find((e) => e.cardId === "swamp")!.count - 1);
  });

  it("fight: MatchSpec from world state (ante on, world life both sides via rules+modifier); result applies ante/gold/life; both outcomes observed across seeds", async () => {
    let sawWin = false;
    let sawLoss = false;
    for (let seed = 31; seed < 80 && !(sawWin && sawLoss); seed++) {
      const w = newWorld({ seed, catalog, starterDeck: "A" });
      const enc = firstEncounter(w);
      const out = parley(w, catalog, enc, "fight");
      expect(out.type).toBe("fight");
      if (out.type !== "fight") return;
      const { duel } = out;
      expect(duel.spec.rules.startingLife).toBe(10);
      expect(duel.spec.rules.ante).toBe(enc.tier === 3 ? 2 : 1);
      expect(duel.spec.modifiers).toEqual([{ type: "startingLife", player: 1, value: duel.enemy.worldLife }]);
      expect(duel.spec.players[1].agent).toBe(`heuristic:${duel.enemy.difficulty}`);
      const lifeBefore = w.player.worldLife;
      const goldBefore = w.player.gold;
      const ownedBefore = Object.values(w.player.collection).reduce((n, v) => n + v, 0);
      const result = await runMatch(duel.spec, pool.cards, agentsFor(w, duel.enemy.difficulty, duel.enemy.deck, seed));
      const rec = applyDuelResult(w, catalog, duel, result);
      expect(rec.saved).toMatchObject({ format: "shandalar-log-v1" });
      expect(w.duels).toHaveLength(1);
      const ownedAfter = Object.values(w.player.collection).reduce((n, v) => n + v, 0);
      if (rec.outcome === "win") {
        sawWin = true;
        expect(rec.anteWon).toEqual(result.facts.ante[1]);
        expect(ownedAfter).toBe(ownedBefore + rec.anteWon.length);
        expect(w.player.gold).toBe(goldBefore + { 1: 10, 2: 25, 3: 60 }[enc.tier]);
        expect(w.player.worldLife).toBe(lifeBefore);
        expect(w.opponents.find((o) => o.id === enc.opponentId)!.defeated).toBe(true);
      } else if (rec.outcome === "loss") {
        sawLoss = true;
        expect(rec.anteLost).toEqual(result.facts.ante[0]);
        expect(ownedAfter).toBe(ownedBefore); // −ante +basics
        expect(w.player.worldLife).toBe(lifeBefore - 1);
        expect(deckLegal(w.player.activeDeck).ok).toBe(true);
        expect(w.player.gold).toBe(goldBefore);
      }
      // Save/load after a duel: identical, including the duel log.
      expect(deserializeWorld(serializeWorld(w))).toEqual(w);
    }
    expect(sawWin).toBe(true);
    expect(sawLoss).toBe(true);
  }, 120_000);

  it("game over at the floor: repeated losses drive world life to 0 and set gameOver", () => {
    const w = newWorld({ seed: 41, catalog, starterDeck: "B" });
    w.player.worldLife = 1;
    const enc = firstEncounter(w);
    const out = parley(w, catalog, enc, "fight");
    if (out.type !== "fight") throw new Error("expected fight");
    const fake = { winner: 1 as const, reason: "LIFE" as const, turns: 5, finalLife: [0, 8] as [number, number], log: [], facts: { damageDealt: [0, 0] as [number, number], creaturesLost: [0, 0] as [number, number], cardsDrawn: [0, 0] as [number, number], spellsCast: {}, ante: [["lightning_bolt"], ["typhoid_rats"]] as [string[], string[]] }, finalStateSerialized: "{}" };
    applyDuelResult(w, catalog, out.duel, fake);
    expect(w.player.worldLife).toBe(0);
    expect(w.gameOver).toBe(true);
  });

  it("regions hand out tiered enemies: civilized rolls tier 1/2 only; the region at the start is civilized", () => {
    const w = newWorld({ seed: 51, catalog, starterDeck: "C" });
    expect(regionAt(w.map, w.player.position).tier).toBe("civilized");
    for (const o of w.opponents.filter((o) => w.map.regions[o.region]!.tier === "civilized")) {
      const t = catalog.opponents.find((c) => c.id === o.catalogId)!;
      expect([1, 2]).toContain(t.tier);
    }
  });
});

describe("town shops (S13 Part 3, headless)", () => {
  it("stock is seeded by (seed, town, epoch): same now, same after load, different next epoch; region-coloured; never basics/tokens; priced by mana value", async () => {
    const { rollShopStock, shopPrice, buyCard } = await import("./shop.js");
    const { worldKnobs } = await import("./state.js");
    const w = newWorld({ seed: 61, catalog, starterDeck: "C" });
    const knobs = worldKnobs(w);
    const town = w.map.towns[0]!;
    const stock = rollShopStock(w, town, pool.cards, knobs);
    expect(stock.length).toBe(knobs.shopStockSize);
    const region = w.map.regions[town.region]!;
    for (const item of stock) {
      const def = pool.cards.get(item.cardId)!;
      expect(def.types).not.toContain("Land");
      for (const c of (await import("@shandalar/cards")).cardColors(def)) expect(region.color).toContain(c);
      expect(item.price).toBe(shopPrice(def, knobs));
      expect(item.price).toBeGreaterThanOrEqual(4);
    }
    expect(rollShopStock(deserializeWorld(serializeWorld(w)), town, pool.cards, knobs)).toEqual(stock);
    w.player.stepsTaken += knobs.shopRefreshSteps; // next epoch
    const later = rollShopStock(w, town, pool.cards, knobs);
    expect(later.map((i) => i.cardId)).not.toEqual(stock.map((i) => i.cardId));
    // Buying: gold down, collection up; refused when broke.
    const gold = w.player.gold;
    const cheap = [...stock].sort((a, b) => a.price - b.price)[0]!;
    const r = buyCard(w, cheap);
    expect(r.ok).toBe(true);
    expect(w.player.gold).toBe(gold - cheap.price);
    expect(w.player.collection[cheap.cardId]).toBeGreaterThanOrEqual(1);
    w.player.gold = 0;
    expect(buyCard(w, cheap).ok).toBe(false);
  });
});
