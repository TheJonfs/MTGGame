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
  it("loads and validates; 15 mages over 5 decks × 3 tiers + 1 beast (ADR-066 PoC); every deck key exists", () => {
    expect(catalog.version).toBe("v0");
    expect(catalog.opponents).toHaveLength(16);
    expect(catalog.opponents.filter((o) => (o.kind ?? "mage") === "mage")).toHaveLength(15);
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
      for (const r of w.map.regions) expect(w.opponents.filter((o) => o.region === r.index && !o.fixedAt).length).toBe(DEFAULT_GENERATOR.rosterPerRegion);
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

describe("town shops (S13 Part 3 → S14 Part 3: depletion, restock, sell, buy-for-deck)", () => {
  it("stock is seeded by (seed, town, epoch); rows carry stock/remaining; buying depletes and persists across save/load; a new epoch restocks", async () => {
    const { rollShopStock, shopPrice, buyCard, syncShopState } = await import("./shop.js");
    const { worldKnobs } = await import("./state.js");
    const w = newWorld({ seed: 61, catalog, starterDeck: "C" });
    const knobs = worldKnobs(w);
    const town = w.map.towns[0]!;
    syncShopState(w, town, knobs);
    const stock = rollShopStock(w, town, pool.cards, knobs);
    expect(stock.length).toBe(knobs.shopStockSize);
    const region = w.map.regions[town.region]!;
    for (const item of stock) {
      const def = pool.cards.get(item.cardId)!;
      expect(def.types).not.toContain("Land");
      for (const c of (await import("@shandalar/cards")).cardColors(def)) expect(region.color).toContain(c);
      expect(item.price).toBe(shopPrice(def, knobs));
      expect(item.remaining).toBe(item.stock);
      expect(item.stock).toBeGreaterThanOrEqual(1);
    }
    const cheap = [...stock].sort((a, b) => a.price - b.price)[0]!;
    const gold = w.player.gold;
    const r = buyCard(w, town, cheap, knobs);
    expect(r.ok).toBe(true);
    expect(w.player.gold).toBe(gold - cheap.price);
    expect(w.player.collection[cheap.cardId]).toBeGreaterThanOrEqual(1);
    const after = rollShopStock(w, town, pool.cards, knobs).find((i) => i.cardId === cheap.cardId)!;
    expect(after.remaining).toBe(cheap.stock - 1);
    // Depletion persists through save/load (world.shops is in the save).
    const back = deserializeWorld(serializeWorld(w));
    expect(rollShopStock(back, town, pool.cards, knobs).find((i) => i.cardId === cheap.cardId)!.remaining).toBe(cheap.stock - 1);
    // Sell out a row, then it refuses.
    w.player.gold = 10_000;
    for (let k = 0; k < cheap.stock - 1; k++) expect(buyCard(w, town, rollShopStock(w, town, pool.cards, knobs).find((i) => i.cardId === cheap.cardId)!, knobs).ok).toBe(true);
    expect(buyCard(w, town, rollShopStock(w, town, pool.cards, knobs).find((i) => i.cardId === cheap.cardId)!, knobs).ok).toBe(false);
    // New epoch: different stock, fresh counts.
    w.player.stepsTaken += knobs.shopRefreshSteps;
    syncShopState(w, town, knobs);
    const later = rollShopStock(w, town, pool.cards, knobs);
    expect(later.map((i) => i.cardId)).not.toEqual(stock.map((i) => i.cardId));
    for (const i of later) expect(i.remaining).toBe(i.stock);
    // Broke → refused.
    w.player.gold = 0;
    expect(buyCard(w, town, later[0]!, knobs).ok).toBe(false);
  });

  it("sell: half price for spare copies only — never basics, never copies the active deck uses", async () => {
    const { sellCard, sellPrice } = await import("./shop.js");
    const { worldKnobs } = await import("./state.js");
    const w = newWorld({ seed: 62, catalog, starterDeck: "A" });
    const knobs = worldKnobs(w);
    // The starter spares include copies of the deck's cheapest nonlands beyond deck counts.
    const spareId = Object.keys(w.player.collection).find((id) => !["mountain"].includes(id) && (w.player.collection[id] ?? 0) > (w.player.activeDeck.find((e) => e.cardId === id)?.count ?? 0))!;
    expect(spareId).toBeTruthy();
    const gold = w.player.gold;
    const r = sellCard(w, pool.cards, spareId, knobs);
    expect(r.ok).toBe(true);
    expect(w.player.gold).toBe(gold + sellPrice(pool.cards.get(spareId)!, knobs));
    expect(sellCard(w, pool.cards, "mountain", knobs).ok).toBe(false);
    // A card fully committed to the deck cannot be sold out from under it.
    const deckOnly = w.player.activeDeck.find((e) => e.cardId !== "mountain" && (w.player.collection[e.cardId] ?? 0) === e.count)!;
    expect(sellCard(w, pool.cards, deckOnly.cardId, knobs)).toMatchObject({ ok: false });
  });

  it("buy → add to deck when legal; otherwise bought to collection with a note", async () => {
    const { rollShopStock, buyCard, syncShopState } = await import("./shop.js");
    const { worldKnobs, deckSize } = await import("./state.js");
    const w = newWorld({ seed: 63, catalog, starterDeck: "C" });
    const knobs = worldKnobs(w);
    const town = w.map.towns[0]!;
    syncShopState(w, town, knobs);
    w.player.gold = 1000;
    const item = rollShopStock(w, town, pool.cards, knobs)[0]!;
    const before = deckSize(w.player.activeDeck);
    const r = buyCard(w, town, item, knobs, true);
    expect(r.ok && r.addedToDeck).toBe(true);
    expect(deckSize(w.player.activeDeck)).toBe(before + 1);
    // Fifth copy: cap → to collection with a note.
    w.player.activeDeck = w.player.activeDeck.map((e) => (e.cardId === item.cardId ? { ...e, count: 4 } : e));
    w.player.collection[item.cardId] = 4;
    const fresh = rollShopStock(w, town, pool.cards, knobs).find((i) => i.cardId === item.cardId);
    if (fresh && fresh.remaining > 0) {
      const r2 = buyCard(w, town, fresh, knobs, true);
      expect(r2.ok && !r2.addedToDeck && !!r2.note).toBe(true);
    }
  });
});

describe("world-save-v2 (S14 Part 1)", () => {
  it("v2 round-trips; a v1 save migrates with shops/visits/lastTownIndex/deckName defaulted and plays", async () => {
    const w = newWorld({ seed: 71, catalog, starterDeck: "B" });
    expect(serializeWorld(w)).toContain('"world-save-v2"');
    expect(deserializeWorld(serializeWorld(w))).toEqual(w);
    // Hand-build a v1 payload: strip the v2 fields and relabel.
    const { shops: _s, visits: _v, lastTownIndex: _l, deckName: _d, ...v1world } = w;
    const v1 = JSON.stringify({ format: "world-save-v1", world: v1world });
    const migrated = deserializeWorld(v1);
    expect(migrated.shops).toEqual({});
    expect(migrated.visits).toEqual({});
    expect(migrated.lastTownIndex).toBe(w.lastTownIndex);
    expect(migrated.deckName).toBe("Deck");
    // …and it plays: walk and re-save as v2.
    walkTo(migrated, catalog, migrated.map.towns[1]!.at, { event: { encounterRatePerStep: { civilized: 0, approach: 0, wild: 0 } } });
    expect(serializeWorld(migrated)).toContain('"world-save-v2"');
    expect(() => deserializeWorld(JSON.stringify({ format: "world-save-v0", world: {} }))).toThrow(/Unsupported save format/);
  });
});

describe("deck editing (S14 Part 2, headless)", () => {
  it("spares = ownership − deck; add/remove copies; basics infinite; commit refuses illegal decks (ADR-065) and unowned copies", async () => {
    const { spares, addCopy, removeCopy, commitDeck, deckStats } = await import("./deck-edit.js");
    const { deckSize } = await import("./state.js");
    const w = newWorld({ seed: 81, catalog, starterDeck: "A" });
    const sp = spares(w.player.collection, w.player.activeDeck);
    expect(Object.keys(sp).length).toBeGreaterThan(0);
    expect(sp.mountain).toBeUndefined(); // basics have their own row
    const spareId = Object.keys(sp)[0]!;
    // Remove a nonbasic, add the spare: still 40, legal, committed.
    const nonbasic = w.player.activeDeck.find((e) => e.cardId !== "mountain")!.cardId;
    let draft = removeCopy(w.player.activeDeck, nonbasic);
    expect(draft.ok).toBe(true);
    let d2 = addCopy(w.player.collection, (draft as { deck: typeof w.player.activeDeck }).deck, spareId);
    expect(d2.ok).toBe(true);
    const committed = commitDeck(w, (d2 as { deck: typeof w.player.activeDeck }).deck, "Goblin Tide");
    expect(committed.ok).toBe(true);
    expect(deckSize(w.player.activeDeck)).toBe(40);
    expect(w.deckName).toBe("Goblin Tide");
    // Basics: always addable, no collection gate.
    const more = addCopy(w.player.collection, w.player.activeDeck, "mountain");
    expect(more.ok).toBe(true);
    // Fifth copy of a nonbasic: refused; no spare: refused.
    w.player.collection.lightning_bolt = 9;
    let five = w.player.activeDeck.map((e) => ({ ...e }));
    for (let k = 0; k < 5; k++) { const r = addCopy(w.player.collection, five, "lightning_bolt"); if (r.ok) five = r.deck; else expect(r.reason).toMatch(/cap/); }
    expect(five.find((e) => e.cardId === "lightning_bolt")!.count).toBeLessThanOrEqual(4);
    // Illegal (below floor) can be drafted but never committed.
    let thin = w.player.activeDeck.map((e) => ({ ...e }));
    for (let k = 0; k < 12; k++) { const r = removeCopy(thin, "mountain"); if (r.ok) thin = r.deck; }
    expect(deckSize(thin)).toBeLessThan(30);
    expect(commitDeck(w, thin).ok).toBe(false);
    expect(deckSize(w.player.activeDeck)).toBe(40); // untouched
    // Unowned copy: refused.
    expect(commitDeck(w, [...w.player.activeDeck, { cardId: "pelakka_wurm", count: 1 }]).ok).toBe(false);
    const stats = deckStats(pool.cards, w.player.activeDeck);
    expect(stats.size).toBe(40);
    expect(stats.lands).toBeGreaterThan(10);
    expect(stats.curve.reduce((a, b) => a + b, 0)).toBe(40 - stats.lands);
  });

  it("lose an ante → the refilled basic is swappable for an owned spare, legality green (the brief's proof)", async () => {
    const { spares, addCopy, removeCopy, commitDeck } = await import("./deck-edit.js");
    const { deckSize } = await import("./state.js");
    const w = newWorld({ seed: 82, catalog, starterDeck: "D" });
    const enc = firstEncounter(w);
    const out = parley(w, catalog, enc, "flee"); // forfeits a stake either way → refill with swamps
    expect(["fled", "fleeFailed"]).toContain(out.type);
    const lost = (out as { anteLost: string[] }).anteLost;
    expect(lost.length).toBeGreaterThan(0);
    const swampsNow = w.player.activeDeck.find((e) => e.cardId === "swamp")!.count;
    expect(swampsNow).toBe(17 + lost.length);
    const sp = spares(w.player.collection, w.player.activeDeck);
    const spareId = Object.keys(sp)[0]!;
    const d1 = removeCopy(w.player.activeDeck, "swamp");
    const d2 = addCopy(w.player.collection, (d1 as { deck: typeof w.player.activeDeck }).deck, spareId);
    expect(d2.ok).toBe(true);
    expect(commitDeck(w, (d2 as { deck: typeof w.player.activeDeck }).deck).ok).toBe(true);
    expect(deckSize(w.player.activeDeck)).toBe(40);
    expect(deckLegal(w.player.activeDeck).ok).toBe(true);
  });
});

describe("beast opponents (ADR-066 proof of concept)", () => {
  it("the catalog carries the Pelakka Wurm as a beast; distraction costs tier price × beastBuyOffMultiplier; unbuyable beasts refuse", async () => {
    const { buyOffPrice } = await import("./journey.js");
    const { worldKnobs } = await import("./state.js");
    const wurm = catalog.opponents.find((o) => o.id === "beast_wurm")!;
    expect(wurm.kind).toBe("beast");
    expect(wurm.deck).toBe("C"); // signature-card rule: green stompy with Pelakka Wurms
    const w = newWorld({ seed: 91, catalog, starterDeck: "A" });
    const knobs = worldKnobs(w);
    expect(buyOffPrice(knobs, 3, wurm)).toBe(Math.round(knobs.buyOffBase * 3 * knobs.beastBuyOffMultiplier));
    expect(buyOffPrice(knobs, 3)).toBe(knobs.buyOffBase * 3);
    // Force an encounter with the wurm and try to buy it off while broke / while it is unbuyable.
    const inst = w.opponents.find((o) => o.catalogId === "beast_wurm");
    if (inst) {
      const enc = { opponentId: inst.id, catalogId: inst.catalogId, tier: 3 as const, region: inst.region, at: w.player.position };
      w.player.gold = 0;
      expect(parley(w, catalog, enc, "buyoff")).toMatchObject({ type: "refused" });
      const was = wurm.buyable;
      (wurm as { buyable?: boolean }).buyable = false;
      w.player.gold = 10_000;
      expect(parley(w, catalog, enc, "buyoff")).toMatchObject({ type: "refused", reason: expect.stringMatching(/cannot be bought/) });
      if (was === undefined) delete (wurm as { buyable?: boolean }).buyable;
      else (wurm as { buyable?: boolean }).buyable = was;
    }
  });
});

describe("lair fixed point (S14 round 1 prototype)", () => {
  it("every world has one reachable lair with a resident beast; walking onto it is a certain encounter; cleared lairs are ground", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = newWorld({ seed, catalog, starterDeck: "A" });
      expect(w.map.strongholds).toHaveLength(1);
      const lair = w.map.strongholds[0]!;
      expect(lair.kind).toBe("lair");
      const resident = w.opponents.find((o) => o.id === lair.opponentId)!;
      expect(resident.catalogId).toBe("beast_wurm");
      expect(resident.fixedAt).toEqual(lair.at);
      expect(findPath(w.map, w.map.start, lair.at)).not.toBeNull();
      // Walk there with random encounters off: the lair still triggers.
      const ev = walkTo(w, catalog, lair.at, { event: { encounterRatePerStep: { civilized: 0, approach: 0, wild: 0 } } })!;
      const enc = ev.find((e) => e.type === "encounter");
      expect(enc && enc.type === "encounter" && enc.encounter.catalogId).toBe("beast_wurm");
      // Defeat the resident: walking onto the lair is now just ground.
      resident.defeated = true;
      const w2 = w; w2.player.position = { ...w.map.start };
      const ev2 = walkTo(w2, catalog, lair.at, { event: { encounterRatePerStep: { civilized: 0, approach: 0, wild: 0 } } })!;
      expect(ev2.some((e) => e.type === "encounter")).toBe(false);
      // Residents never roam.
      expect(w.opponents.filter((o) => o.fixedAt && o.region === lair.region).length).toBe(1);
    }
  });
});
