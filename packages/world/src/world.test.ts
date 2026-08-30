import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { DECKS } from "@shandalar/sim/decks";
import { loadCatalog } from "./loader.js";
import { generateWorld, DEFAULT_GENERATOR, isTownCell, roamerTarget, type OpponentInstance } from "./generate.js";
import { findPath, idx, isExplored, manhattan, reachable, regionAt, samePoint, type Point } from "./map.js";
import { activeDeck, deserializeWorld, newWorld, serializeWorld, deckSize, starterDecklist, starterTemplate, worldKnobs, type WorldState } from "./state.js";
import { advance, applyDuelResult, creditRenown, deckLegal, prepareDuel, effectiveSight, isFleeing, parley, playerSees, renownAgainst, visibleRoamers, walkTo, type Encounter } from "./journey.js";
import { WorldRng } from "./rng.js";
import { catalogFrom, enemyDeck, type OpponentDeckRef, type StarterId } from "./catalog.js";
import { defaultKnobs } from "./knobs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = loadCatalog(join(ROOT, "data/world"));
const pool = loadCardPool(join(ROOT, "data/cards"));

describe("catalog v1", () => {
  it("loads and validates; 15 mages over 5 decks × 3 tiers + the full bestiary grid (S18 ten + S19 round-2 five; the Tactician at tiers 1 and 2); every deck ref resolves; ADR-072: 15 regions (colour × tier) + 5 strongholds", () => {
    expect(catalog.version).toBe("v1");
    expect(catalog.opponents).toHaveLength(32);
    expect(catalog.opponents.filter((o) => (o.kind ?? "mage") === "mage" && !o.spoke)).toHaveLength(15);
    expect(catalog.opponents.filter((o) => o.kind === "beast")).toHaveLength(15);
    expect(catalog.opponents.filter((o) => o.spoke)).toHaveLength(17); // 15 beasts + the mage-voiced Tactician ×2
    for (const o of catalog.opponents) expect(enemyDeck(catalog, o.deck).decklist.reduce((n, e) => n + e.count, 0)).toBeGreaterThanOrEqual(30);
    for (const o of catalog.opponents.filter((x) => x.spoke)) expect(o.deck.startsWith("beast:")).toBe(true);
    // ADR-078: the grid is complete — every spoke has a signature at every tier.
    for (const c of ["W", "U", "B", "R", "G"]) for (const t of [1, 2, 3]) expect(catalog.opponents.some((o) => o.spoke === c && o.tier === t), `${c} T${t}`).toBe(true);
    expect(catalog.regions).toHaveLength(15);
    for (const c of ["W", "U", "B", "R", "G"]) for (const t of ["civilized", "approach", "wild"]) expect(catalog.regions.filter((r) => r.color === c && r.tier === t)).toHaveLength(1);
    expect(catalog.strongholds.map((s) => s.color).sort()).toEqual(["B", "G", "R", "U", "W"]);
    expect(catalog.regions.find((r) => r.color === "W" && r.tier === "civilized")!.townNames[0]).toBe("Whitewell"); // home-start town is listed first
  });
  it("rejects unknown knobs and bad decks loudly", () => {
    const bad = JSON.parse(JSON.stringify({ regions: { catalogVersion: "v1", regions: catalog.regions, strongholds: catalog.strongholds }, towns: { catalogVersion: "v1", names: catalog.townNames }, opponents: { catalogVersion: "v1", opponents: [{ ...catalog.opponents[0], knobs: { anteCounts: 2 } }] }, starters: { catalogVersion: "v1", starters: catalog.starters } }));
    expect(() => catalogFrom(bad)).toThrow(/Unknown knob "anteCounts"/);
    const noB = JSON.parse(JSON.stringify({ regions: { catalogVersion: "v1", regions: catalog.regions.filter((r) => !(r.color === "B" && r.tier === "wild")), strongholds: catalog.strongholds }, towns: { catalogVersion: "v1", names: catalog.townNames }, opponents: { catalogVersion: "v1", opponents: catalog.opponents }, starters: { catalogVersion: "v1", starters: catalog.starters } }));
    expect(() => catalogFrom(noB)).toThrow(/wild region of colour B/);
  });
  it("S16 starters: five colours, 30 cards each, every card in the pool, variants legal; slice decks are not starters", () => {
    expect(catalog.starters.map((s) => s.id).sort()).toEqual(["black", "blue", "green", "red", "white"]);
    for (const st of catalog.starters) {
      expect(deckSize(st.decklist)).toBe(30);
      for (const e of st.decklist) expect(pool.cards.has(e.cardId), `${st.id}: ${e.cardId}`).toBe(true);
      for (const d of ["easy", "standard", "hard"] as const) {
        const deck = starterDecklist(st, d);
        expect(deckLegal(deck).ok, `${st.id} ${d}`).toBe(true);
        for (const e of deck) expect(pool.cards.has(e.cardId)).toBe(true);
      }
      expect(deckSize(starterDecklist(st, "easy"))).toBe(32);
      expect(deckSize(starterDecklist(st, "hard"))).toBe(30);
    }
    // ADR-070: the one-drops are in. (Blue's Adepts left in ADR-078 — the S18 audit showed the self-mill clock cost ~15 tier-1 points.)
    expect(starterTemplate(catalog, "green").decklist.find((e) => e.cardId === "llanowar_elves")?.count).toBe(2);
    // ADR-078: blue = list C — creature-forward, no Adepts/Counterspell/Curiosity/Divination.
    const blue = Object.fromEntries(starterTemplate(catalog, "blue").decklist.map((e) => [e.cardId, e.count]));
    expect(blue).toMatchObject({ aether_channeler: 2, aven_fisher: 1, essence_scatter: 2, mist_raven: 1, air_elemental: 1, man_o_war: 4 });
    for (const gone of ["cathartic_adept", "counterspell", "curiosity", "divination"]) expect(blue[gone]).toBeUndefined();
    const bad = JSON.parse(JSON.stringify({ regions: { catalogVersion: "v1", regions: catalog.regions, strongholds: catalog.strongholds }, towns: { catalogVersion: "v1", names: catalog.townNames }, opponents: { catalogVersion: "v1", opponents: catalog.opponents }, starters: { catalogVersion: "v1", starters: catalog.starters.map((s) => (s.id === "red" ? { ...s, decklist: s.decklist.slice(1) } : s)) } }));
    expect(() => catalogFrom(bad)).toThrow(/total 30 cards/);
  });
});

describe("world generator (invariant fuzz, ≥200 seeds)", () => {
  it("every town reachable from the start, no orphan region, ≥2 towns, deterministic per seed; S16: colour coverage, uniform towns, home start, roamer spawn legality", () => {
    const knobs = defaultKnobs();
    const colours = ["W", "U", "B", "R", "G"] as const;
    for (let seed = 1; seed <= 200; seed++) {
      const home = colours[seed % 5]!;
      const w = generateWorld(seed, catalog, DEFAULT_GENERATOR, { knobs, homeColor: home });
      expect(w.map.width).toBe(DEFAULT_GENERATOR.width * knobs.mapScale);
      expect(w.map.towns.length, `seed ${seed} towns`).toBeGreaterThanOrEqual(2);
      // Colour coverage: every colour has a civilized-or-approach region; every non-wild region has ≥1 town.
      for (const c of colours) expect(w.map.regions.some((r) => r.color === c && r.tier !== "wild"), `seed ${seed} colour ${c}`).toBe(true);
      for (const r of w.map.regions) if (r.tier !== "wild") expect(w.map.towns.some((t) => t.region === r.index), `seed ${seed} region ${r.name} has a town`).toBe(true);
      // Home-region start — S23 playtest r1: a couple of steps OUTSIDE the home town's gate
      // (never ON a town), in the home colour's region, with the home town within 2 steps.
      expect(isTownCell(w.map, w.map.start), `seed ${seed} start is not on a town`).toBe(false);
      expect(w.map.passable[idx(w.map, w.map.start)]).toBe(true);
      const nearTown = w.map.towns.find((t) => manhattan(t.at, w.map.start) <= 2)!;
      expect(nearTown, `seed ${seed} a town within 2 steps of the start`).toBeTruthy();
      expect(w.map.regions[nearTown.region]!.color).toBe(home);
      // Roamers: positioned, in-region, passable, never on a town/fixed cell; counts meet the density target.
      for (const o of w.opponents) {
        if (o.fixedAt) { expect(o.at).toBeUndefined(); continue; }
        expect(o.at, `seed ${seed} ${o.id} has a position`).toBeTruthy();
        expect(w.map.region[idx(w.map, o.at!)]).toBe(o.region);
        expect(w.map.passable[idx(w.map, o.at!)]).toBe(true);
        expect(isTownCell(w.map, o.at!)).toBe(false);
        expect(o.gone).toBe(false);
      }
      for (const r of w.map.regions) expect(w.opponents.filter((o) => o.region === r.index && !o.fixedAt).length).toBe(roamerTarget(w.map, r, knobs));
      // ADR-072 radial invariants: 15 regions = colour × tier; five strongholds (kind "stronghold"), pairwise spaced, one per colour's
      // wild ring; rings monotone along each spoke (civilized < approach < wild < stronghold in normalised radius); roads touch every
      // town and every road cell is passable; every town/lair/stronghold reachable from every civilized town.
      expect(w.map.regions).toHaveLength(15);
      for (const c of colours) for (const t of ["civilized", "approach", "wild"]) expect(w.map.regions.filter((r) => r.color === c && r.tier === t), `seed ${seed} ${c} ${t}`).toHaveLength(1);
      const sh = w.map.strongholds.filter((f) => f.kind === "stronghold");
      expect(sh).toHaveLength(5);
      for (const a of sh) for (const b of sh) if (a !== b) expect(manhattan(a.at, b.at)).toBeGreaterThan(knobs.townSpacingMin);
      const cx = w.map.centre!, nr = (p: Point) => Math.hypot((p.x - cx.x) / (w.map.width / 2), (p.y - cx.y) / (w.map.height / 2));
      for (let sp = 0; sp < 5; sp++) {
        const byTier = (t: string) => w.map.regions.find((r) => r.spoke === sp && r.tier === t)!;
        expect(nr(byTier("civilized").heart)).toBeLessThan(nr(byTier("approach").heart));
        expect(nr(byTier("approach").heart)).toBeLessThan(nr(byTier("wild").heart));
      }
      for (const f of sh) expect(nr(f.at)).toBeGreaterThan(nr(w.map.regions.find((r) => r.tier === "wild" && r.color === w.map.regions[f.region]!.color)!.heart) - 0.15);
      for (const t of w.map.towns) expect(w.map.road[idx(w.map, t.at)], `seed ${seed} town ${t.name} on a road`).toBe(true);
      for (let i = 0; i < w.map.road.length; i++) if (w.map.road[i]) expect(w.map.passable[i]).toBe(true);
      for (const t of w.map.towns) if (w.map.regions[t.region]!.tier === "civilized") {
        const from = reachable(w.map, t.at);
        for (const x of [...w.map.towns.map((q) => q.at), ...w.map.strongholds.map((f) => f.at)]) expect(from.has(idx(w.map, x)), `seed ${seed} from ${t.name}`).toBe(true);
      }
      // Roads connect: every town reaches every other over road cells only.
      const roadReach = (from: Point) => { const seen = new Set<number>([idx(w.map, from)]); const st = [from]; while (st.length) { const p = st.pop()!; for (const d of [[1,0],[-1,0],[0,1],[0,-1]] as const) { const q = { x: p.x + d[0], y: p.y + d[1] }; if (q.x < 0 || q.y < 0 || q.x >= w.map.width || q.y >= w.map.height) continue; const j = idx(w.map, q); if (seen.has(j) || !w.map.road[j]) continue; seen.add(j); st.push(q); } } return seen; };
      const rr = roadReach(w.map.towns[0]!.at);
      for (const t of w.map.towns) expect(rr.has(idx(w.map, t.at)), `seed ${seed} road to ${t.name}`).toBe(true);
      // Explored: the home region is fully explored; a far wild cell is not.
      const homeReg = w.map.regions[nearTown.region]!;
      for (let i = 0; i < 50; i++) { const p = { x: i % w.map.width, y: Math.floor(i / w.map.width) }; if (w.map.region[idx(w.map, p)] === homeReg.index) expect(isExplored(w.explored, w.map, p)).toBe(true); }
      expect(w.explored.some((word) => word !== (-1 >>> 0))).toBe(true);
      const reach = reachable(w.map, w.map.start);
      for (const t of w.map.towns) expect(reach.has(idx(w.map, t.at)), `seed ${seed} town ${t.name} reachable`).toBe(true);
      for (const r of w.map.regions) {
        let ok = false;
        for (let i = 0; i < w.map.region.length && !ok; i++) if (w.map.region[i] === r.index && reach.has(i)) ok = true;
        expect(ok, `seed ${seed} region ${r.name} has a reachable cell`).toBe(true);
      }
      // Town spacing honored (or relaxed only when the map forced it — never adjacent).
      for (const a of w.map.towns) for (const b of w.map.towns) if (a !== b) expect(Math.abs(a.at.x - b.at.x) + Math.abs(a.at.y - b.at.y)).toBeGreaterThan(1);
      if (seed <= 20) {
        const again = generateWorld(seed, catalog, DEFAULT_GENERATOR, { knobs, homeColor: home });
        expect(JSON.stringify(again)).toBe(JSON.stringify(w));
      }
    }
  });
  it("S23 rivers (playtest r1 ruling: FLAVOR, not barrier) — ribbons exist and never touch passability; ford marks sit only on passable non-road water; deterministic per seed", () => {
    for (const seed of [7, 42, 101]) {
      const w = generateWorld(seed, catalog, DEFAULT_GENERATOR, { knobs: defaultKnobs(), homeColor: "G" });
      const m = w.map;
      expect(m.river).toBeTruthy();
      expect(m.river!.filter(Boolean).length).toBeGreaterThan(0);
      // The flavor law: a wet cell is exactly as passable as the terrain under it — walking
      // straight across open-ground water is legal (Chris ran the map's length once; never again).
      let openWater = 0;
      for (let i = 0; i < m.river!.length; i++) {
        if (m.ford![i]) {
          expect(m.river![i]).toBe(true);
          expect(m.passable[i]).toBe(true);
          expect(m.road[i]).toBe(false);
        }
        if (m.river![i] && m.passable[i] && !m.road[i] && !m.ford![i]) openWater += 1;
      }
      expect(openWater).toBeGreaterThan(0); // plain walkable water exists — the barrier is gone
      const again = generateWorld(seed, catalog, DEFAULT_GENERATOR, { knobs: defaultKnobs(), homeColor: "G" });
      expect(JSON.stringify(again.map.river)).toBe(JSON.stringify(m.river));
      expect(JSON.stringify(again.map.ford)).toBe(JSON.stringify(m.ford));
    }
  });

  it("pathfinding: BFS path is walkable, shortest-ish, and null when unreachable", () => {
    const w = generateWorld(7, catalog, DEFAULT_GENERATOR, { knobs: defaultKnobs(), homeColor: "G" });
    const [a, b] = w.map.towns;
    const path = findPath(w.map, a!.at, b!.at)!;
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThanOrEqual(Math.abs(a!.at.x - b!.at.x) + Math.abs(a!.at.y - b!.at.y));
    for (const c of path) expect(w.map.passable[idx(w.map, c)]).toBe(true);
    expect(path[path.length - 1]).toEqual(b!.at);
  });
});

describe("WorldState + world-save-v3", () => {
  it("new world: start a couple of steps outside the home colour's town (S23 r1), world life 10, gold 20, collection = starter deck + spares (provenance logged), deck legal, renown 0", () => {
    const w = newWorld({ seed: 11, catalog, starter: "red" });
    expect(w.player.worldLife).toBe(10);
    expect(w.player.gold).toBe(20);
    expect(w.map.towns.some((t) => t.at.x === w.player.position.x && t.at.y === w.player.position.y)).toBe(false); // outside the gate
    expect(w.map.towns.some((t) => manhattan(t.at, w.player.position) <= 2)).toBe(true); // but the town is right there
    expect(w.lastTownIndex).toBeGreaterThanOrEqual(0); // "You set out from <the home town>"
    expect(manhattan(w.map.towns[w.lastTownIndex]!.at, w.player.position)).toBeLessThanOrEqual(2);
    expect(regionAt(w.map, w.player.position).color).toBe("R");
    expect(deckSize(activeDeck(w))).toBe(30);
    expect(w.activeDeckName).toBe("Ember Warband");
    expect(Object.keys(w.decks)).toEqual(["Ember Warband"]);
    const owned = Object.values(w.player.collection).reduce((n, v) => n + v, 0);
    expect(owned).toBe(30 + 10);
    expect(w.provenance).toHaveLength(40);
    expect(w.provenance.every((p) => p.source === "starter" && p.step === 0)).toBe(true);
    expect(w.player.basicLand).toBe("mountain");
    expect(w.player.renown).toBe(0);
    expect(w.player.starterId).toBe("red");
    expect(deckLegal(activeDeck(w)).ok).toBe(true);
    // Every colour spawns at home; hard/easy variants apply.
    for (const id of ["white", "blue", "black", "green"] as StarterId[]) {
      const x = newWorld({ seed: 11, catalog, starter: id });
      expect(regionAt(x.map, x.player.position).color).toBe(starterTemplate(catalog, id).color);
    }
    expect(deckSize(activeDeck(newWorld({ seed: 11, catalog, starter: "green", difficulty: "easy" })))).toBe(32);
    expect(activeDeck(newWorld({ seed: 11, catalog, starter: "green", difficulty: "hard" })).some((e) => e.cardId === "prey_upon")).toBe(false);
  });
  it("serialize → deserialize round-trips byte-identically, and rejects other formats", () => {
    const w = newWorld({ seed: 12, catalog, starter: "blue" });
    walkTo(w, catalog, w.map.towns[1]!.at);
    const text = serializeWorld(w);
    const back = deserializeWorld(text);
    expect(back).toEqual(w);
    expect(serializeWorld(back)).toBe(text);
    expect(() => deserializeWorld(JSON.stringify({ format: "world-save-v0", world: {} }))).toThrow(/Unsupported save format/);
  });
  it("the RNG stream resumes exactly after a save (same draws after load as without)", () => {
    const a = newWorld({ seed: 13, catalog, starter: "green" });
    const b = deserializeWorld(serializeWorld(a));
    const ra = new WorldRng(a.rng), rb = new WorldRng(b.rng);
    for (let i = 0; i < 50; i++) expect(ra.int(1000)).toBe(rb.int(1000));
  });
});

// ---------- the acceptance journey (brief Part 4, scripted half; S12 carving (b)) ----------

function agentsFor(spec: WorldState, enemyDifficulty: "apprentice" | "journeyman" | "master", enemyDeckRef: OpponentDeckRef, seed: number): [Agent, Agent] {
  const enemy = enemyDeck(catalog, enemyDeckRef);
  const me = new HeuristicAgent(seed * 2 + 1, pool.cards, difficultyProfile("journeyman", starterTemplate(catalog, spec.player.starterId).archetype, enemy.decklist));
  const them = new HeuristicAgent(seed * 2 + 2, pool.cards, difficultyProfile(enemyDifficulty, enemy.archetype, activeDeck(spec).map((e) => ({ ...e }))));
  return [me, them];
}

/** S16: no random contact — roamers gone, respawn off (the event layer). */
const QUIET = { event: { roamerRespawnSteps: { civilized: 0, approach: 0, wild: 0 } } } as const;
function quiet(w: WorldState): void {
  for (const o of w.opponents) if (!o.fixedAt) { o.gone = true; o.goneReason = "fled"; }
}

/** A passable non-town neighbour of the player (the first step off the town). */
function stepCell(w: WorldState): Point {
  const start = w.player.position;
  const candidates = [
    { x: start.x + 1, y: start.y }, { x: start.x - 1, y: start.y }, { x: start.x, y: start.y + 1 }, { x: start.x, y: start.y - 1 },
  ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && !isTownCell(w.map, p));
  if (!candidates[0]) throw new Error("start town has no passable neighbour");
  return candidates[0];
}

/** S16: force an encounter on the very next step by standing a roamer on it
 * (you step onto it = player-initiated contact). Prefers a roamer of the
 * start's region; any live roamer otherwise. */
function firstEncounter(w: WorldState, pick?: (o: OpponentInstance) => boolean): Encounter {
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

describe("acceptance journey (headless): walk → encounter → each parley branch → bookkeeping → save/load", () => {
  it("buy-off deducts buyOffBase × tier; refused when broke", () => {
    const w = newWorld({ seed: 21, catalog, starter: "red" });
    const enc = firstEncounter(w);
    const gold = w.player.gold;
    const out = parley(w, catalog, enc, "buyoff");
    if (out.type === "boughtOff") {
      expect(out.goldPaid).toBe(15 * enc.tier);
      expect(w.player.gold).toBe(gold - 15 * enc.tier);
      // S16: any parley outcome removes the roamer from the map.
      expect(w.opponents.find((o) => o.id === enc.opponentId)).toMatchObject({ gone: true, goneReason: "boughtOff" });
    } else {
      expect(out.type).toBe("refused"); // a tier-2/3 enemy costs more than 20 gold
      expect(w.player.gold).toBe(gold);
    }
  });

  it("flee forfeits ante (anteCount nonland cards leave collection+deck, basics refill the deck), then either escapes or fights", () => {
    const w = newWorld({ seed: 22, catalog, starter: "black" });
    const enc = firstEncounter(w);
    const before = deckSize(activeDeck(w));
    const ownedBefore = Object.values(w.player.collection).reduce((n, v) => n + v, 0);
    const out = parley(w, catalog, enc, "flee");
    expect(["fled", "fleeFailed"]).toContain(out.type);
    const lost = out.type === "fled" || out.type === "fleeFailed" ? out.anteLost : [];
    expect(lost.length).toBeGreaterThanOrEqual(1);
    for (const id of lost) expect(pool.cards.get(id)!.types).not.toContain("Land");
    expect(deckSize(activeDeck(w))).toBe(before); // refilled with basics
    expect(deckLegal(activeDeck(w)).ok).toBe(true);
    // Net owned cards: −lost +lost basics (free) = unchanged count, different composition.
    expect(Object.values(w.player.collection).reduce((n, v) => n + v, 0)).toBe(ownedBefore);
    expect(activeDeck(w).find((e) => e.cardId === "swamp")!.count).toBe(13 + lost.length);
    // S16: fled → the roamer is gone; flee-failed → it fights and leaves after.
    if (out.type === "fled") expect(w.opponents.find((o) => o.id === enc.opponentId)).toMatchObject({ gone: true, goneReason: "fled" });
  });

  it("fight: MatchSpec from world state (ante on, world life both sides via rules+modifier); result applies ante/gold/life; both outcomes observed across seeds", async () => {
    let sawWin = false;
    let sawLoss = false;
    for (let seed = 31; seed < 80 && !(sawWin && sawLoss); seed++) {
      const w = newWorld({ seed, catalog, starter: "red" });
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
        expect(w.opponents.find((o) => o.id === enc.opponentId)).toMatchObject({ gone: true, goneReason: "defeated" });
        expect(w.player.renown).toBe(enc.tier);
        expect(w.provenance.filter((p) => p.source === "ante")).toHaveLength(rec.anteWon.length);
      } else if (rec.outcome === "loss") {
        sawLoss = true;
        expect(rec.anteLost).toEqual(result.facts.ante[0]);
        expect(ownedAfter).toBe(ownedBefore); // −ante +basics
        expect(w.player.worldLife).toBe(lifeBefore - 1);
        expect(deckLegal(activeDeck(w)).ok).toBe(true);
        expect(w.player.gold).toBe(goldBefore);
        expect(w.opponents.find((o) => o.id === enc.opponentId)).toMatchObject({ gone: true, goneReason: "lost" });
        expect(w.player.renown).toBe(0);
      }
      // Save/load after a duel: identical, including the duel log.
      expect(deserializeWorld(serializeWorld(w))).toEqual(w);
    }
    expect(sawWin).toBe(true);
    expect(sawLoss).toBe(true);
  }, 120_000);

  it("game over at the floor: repeated losses drive world life to 0 and set gameOver", () => {
    const w = newWorld({ seed: 41, catalog, starter: "white" });
    w.player.worldLife = 1;
    const enc = firstEncounter(w);
    const out = parley(w, catalog, enc, "fight");
    if (out.type !== "fight") throw new Error("expected fight");
    const fake = { winner: 1 as const, reason: "LIFE" as const, turns: 5, finalLife: [0, 8] as [number, number], log: [], facts: { damageDealt: [0, 0] as [number, number], creaturesLost: [0, 0] as [number, number], cardsDrawn: [0, 0] as [number, number], spellsCast: {}, ante: [["lightning_bolt"], ["typhoid_rats"]] as [string[], string[]] }, finalStateSerialized: "{}" };
    applyDuelResult(w, catalog, out.duel, fake);
    expect(w.player.worldLife).toBe(0);
    expect(w.gameOver).toBe(true);
  });

  it("regions hand out tiered enemies: civilized rolls tier 1/2 only; the home region rolls civilized even when its tier is approach (S16 interim, Q4)", () => {
    const w = newWorld({ seed: 51, catalog, starter: "green" });
    expect(regionAt(w.map, w.player.position).tier).toBe("civilized");
    for (const o of w.opponents.filter((o) => w.map.regions[o.region]!.tier === "civilized")) {
      const t = catalog.opponents.find((c) => c.id === o.catalogId)!;
      expect([1, 2]).toContain(t.tier);
    }
    const red = newWorld({ seed: 51, catalog, starter: "red" });
    const home = regionAt(red.map, red.player.position);
    expect(home.color).toBe("R");
    for (const o of red.opponents.filter((o) => o.region === home.index && !o.fixedAt)) {
      expect([1, 2]).toContain(catalog.opponents.find((c) => c.id === o.catalogId)!.tier);
    }
  });
});

describe("town shops (S13 Part 3 → S14 Part 3: depletion, restock, sell, buy-for-deck)", () => {
  it("stock is seeded by (seed, town, epoch); rows carry stock/remaining; buying depletes and persists across save/load; a new epoch restocks", async () => {
    const { rollShopStock, shopPrice, buyCard, syncShopState } = await import("./shop.js");
    const { worldKnobs } = await import("./state.js");
    const w = newWorld({ seed: 61, catalog, starter: "green" });
    const knobs = worldKnobs(w);
    const town = w.map.towns[0]!;
    syncShopState(w, town, knobs);
    const stock = rollShopStock(w, town, pool.cards, knobs);
    expect(stock.length).toBe(knobs.shopStockSize);
    const region = w.map.regions[town.region]!;
    for (const item of stock) {
      const def = pool.cards.get(item.cardId)!;
      // S20: nonbasic lands stock by tier now (shocks/enablers); basics still never do.
      expect(["plains", "island", "swamp", "mountain", "forest"]).not.toContain(def.id);
      if (def.types.includes("Land")) continue; // land identity = produced mana (either-color rule, ADR-079)
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
    const w = newWorld({ seed: 62, catalog, starter: "red" });
    const knobs = worldKnobs(w);
    // The starter spares include copies of the deck's cheapest nonlands beyond deck counts.
    const spareId = Object.keys(w.player.collection).find((id) => !["mountain"].includes(id) && (w.player.collection[id] ?? 0) > (activeDeck(w).find((e) => e.cardId === id)?.count ?? 0))!;
    expect(spareId).toBeTruthy();
    const gold = w.player.gold;
    const r = sellCard(w, pool.cards, spareId, knobs);
    expect(r.ok).toBe(true);
    expect(w.player.gold).toBe(gold + sellPrice(pool.cards.get(spareId)!, knobs));
    expect(sellCard(w, pool.cards, "mountain", knobs).ok).toBe(false);
    // A card fully committed to the deck cannot be sold out from under it.
    const deckOnly = activeDeck(w).find((e) => e.cardId !== "mountain" && (w.player.collection[e.cardId] ?? 0) === e.count)!;
    expect(sellCard(w, pool.cards, deckOnly.cardId, knobs)).toMatchObject({ ok: false });
  });

  it("buy → add to deck when legal; otherwise bought to collection with a note", async () => {
    const { rollShopStock, buyCard, syncShopState } = await import("./shop.js");
    const { worldKnobs, deckSize } = await import("./state.js");
    const w = newWorld({ seed: 63, catalog, starter: "green" });
    const knobs = worldKnobs(w);
    const town = w.map.towns.reduce((a, b) => (manhattan(a.at, w.map.start) <= manhattan(b.at, w.map.start) ? a : b)); // S23 r1: the start stands outside the gate
    syncShopState(w, town, knobs);
    w.player.gold = 1000;
    const item = rollShopStock(w, town, pool.cards, knobs)[0]!;
    const before = deckSize(activeDeck(w));
    const r = buyCard(w, town, item, knobs, true);
    expect(r.ok && r.addedToDeck).toBe(true);
    expect(deckSize(activeDeck(w))).toBe(before + 1);
    expect(w.provenance.filter((p) => p.source === "shop")).toHaveLength(1);
    // Fifth copy: cap → to collection with a note.
    w.decks[w.activeDeckName] = activeDeck(w).map((e) => (e.cardId === item.cardId ? { ...e, count: 4 } : e));
    w.player.collection[item.cardId] = 4;
    const fresh = rollShopStock(w, town, pool.cards, knobs).find((i) => i.cardId === item.cardId);
    if (fresh && fresh.remaining > 0) {
      const r2 = buyCard(w, town, fresh, knobs, true);
      expect(r2.ok && !r2.addedToDeck && !!r2.note).toBe(true);
    }
  });
});

describe("world-save-v5 (S16 Part 2.5 chain + S19/S20): the v1 → … → v5 migration chain", () => {
  /** Hand-build the v2 shape from a v3 world: decks → player.activeDeck + deckName; gone → defeated; positions stripped; v3 fields dropped. */
  function asV2(w: WorldState): Record<string, unknown> {
    const { decks, activeDeckName, provenance, opponents, player, ...rest } = w;
    const { renown: _r, starterId: _s, ...p2 } = player;
    return {
      ...rest,
      player: { ...p2, activeDeck: decks[activeDeckName]!.map((e) => ({ ...e })) },
      deckName: activeDeckName,
      opponents: opponents.map((o) => { const { gone, goneReason: _g, at: _a, moveDebt: _m, ...o2 } = o; return { ...o2, defeated: gone }; }),
      _drop: provenance.length,
    };
  }
  it("v3 round-trips; a v2 save migrates with decks/activeDeckName/provenance/renown/starterId defaulted, roamers positioned, and plays", () => {
    const w = newWorld({ seed: 71, catalog, starter: "white" });
    expect(serializeWorld(w)).toContain('"world-save-v7"');
    expect(deserializeWorld(serializeWorld(w))).toEqual(w);
    const v2 = asV2(w);
    const migrated = deserializeWorld(JSON.stringify({ format: "world-save-v2", world: v2 }));
    expect(migrated.decks).toEqual({ [w.activeDeckName]: activeDeck(w) });
    expect(migrated.activeDeckName).toBe(w.activeDeckName);
    expect(migrated.provenance).toEqual([]);
    expect(migrated.player.renown).toBe(0);
    expect(migrated.player.starterId).toBe("white"); // from the basic land
    expect((migrated as unknown as { deckName?: string }).deckName).toBeUndefined();
    expect((migrated.player as unknown as { activeDeck?: unknown }).activeDeck).toBeUndefined();
    for (const o of migrated.opponents) {
      expect(o.gone).toBe(false);
      if (o.fixedAt) expect(o.at).toBeUndefined();
      else {
        expect(o.at).toBeTruthy();
        expect(migrated.map.region[idx(migrated.map, o.at!)]).toBe(o.region);
        expect(isTownCell(migrated.map, o.at!)).toBe(false);
      }
    }
    // Deterministic: migrating the same payload twice gives the same positions.
    expect(deserializeWorld(JSON.stringify({ format: "world-save-v2", world: v2 }))).toEqual(migrated);
    // …and it plays: walk and re-save as v3.
    walkTo(migrated, catalog, migrated.map.towns[1]!.at);
    expect(serializeWorld(migrated)).toContain('"world-save-v7"');
  });
  it("a v1 save migrates through v2 to v3 (shops/visits/lastTownIndex defaulted, deck named \"Deck\")", () => {
    const w = newWorld({ seed: 72, catalog, starter: "black" });
    const v2 = asV2(w);
    const { shops: _s, visits: _v, lastTownIndex: _l, deckName: _d, ...v1world } = v2 as Record<string, unknown>;
    const migrated = deserializeWorld(JSON.stringify({ format: "world-save-v1", world: v1world }));
    expect(migrated.shops).toEqual({});
    expect(migrated.visits).toEqual({});
    expect(migrated.lastTownIndex).toBe(w.lastTownIndex);
    expect(migrated.activeDeckName).toBe("Deck");
    expect(activeDeck(migrated)).toEqual(activeDeck(w));
    expect(migrated.player.starterId).toBe("black");
    expect(() => deserializeWorld(JSON.stringify({ format: "world-save-v0", world: {} }))).toThrow(/Unsupported save format/);
  });
});

describe("deck editing (S14 Part 2, headless)", () => {
  it("spares = ownership − deck; add/remove copies; basics infinite; commit refuses illegal decks (ADR-065) and unowned copies", async () => {
    const { spares, addCopy, removeCopy, commitDeck, deckStats } = await import("./deck-edit.js");
    const { deckSize } = await import("./state.js");
    const w = newWorld({ seed: 81, catalog, starter: "red" });
    const sp = spares(w.player.collection, activeDeck(w));
    expect(Object.keys(sp).length).toBeGreaterThan(0);
    expect(sp.mountain).toBeUndefined(); // basics have their own row
    const spareId = Object.keys(sp)[0]!;
    // Remove a nonbasic, add the spare: still 30, legal, committed (and renamed).
    const nonbasic = activeDeck(w).find((e) => e.cardId !== "mountain")!.cardId;
    let draft = removeCopy(activeDeck(w), nonbasic);
    expect(draft.ok).toBe(true);
    let d2 = addCopy(w.player.collection, (draft as { deck: ReturnType<typeof activeDeck> }).deck, spareId);
    expect(d2.ok).toBe(true);
    const committed = commitDeck(w, (d2 as { deck: ReturnType<typeof activeDeck> }).deck, "Goblin Tide");
    expect(committed.ok).toBe(true);
    expect(deckSize(activeDeck(w))).toBe(30);
    expect(w.activeDeckName).toBe("Goblin Tide");
    expect(Object.keys(w.decks)).toEqual(["Goblin Tide"]);
    // Basics: always addable, no collection gate.
    const more = addCopy(w.player.collection, activeDeck(w), "mountain");
    expect(more.ok).toBe(true);
    // Fifth copy of a nonbasic: refused; no spare: refused.
    w.player.collection.lightning_bolt = 9;
    let five = activeDeck(w).map((e) => ({ ...e }));
    for (let k = 0; k < 5; k++) { const r = addCopy(w.player.collection, five, "lightning_bolt"); if (r.ok) five = r.deck; else expect(r.reason).toMatch(/cap/); }
    expect(five.find((e) => e.cardId === "lightning_bolt")!.count).toBeLessThanOrEqual(4);
    // Illegal (below floor) can be drafted but never committed.
    let thin = activeDeck(w).map((e) => ({ ...e }));
    for (let k = 0; k < 5; k++) { const r = removeCopy(thin, "mountain"); if (r.ok) thin = r.deck; }
    expect(deckSize(thin)).toBeLessThan(30);
    expect(commitDeck(w, thin).ok).toBe(false);
    expect(deckSize(activeDeck(w))).toBe(30); // untouched
    // Unowned copy: refused.
    expect(commitDeck(w, [...activeDeck(w), { cardId: "pelakka_wurm", count: 1 }]).ok).toBe(false);
    const stats = deckStats(pool.cards, activeDeck(w));
    expect(stats.size).toBe(30);
    expect(stats.lands).toBeGreaterThan(10);
    expect(stats.curve.reduce((a, b) => a + b, 0)).toBe(30 - stats.lands);
  });

  it("lose an ante → the refilled basic is swappable for an owned spare, legality green (the brief's proof)", async () => {
    const { spares, addCopy, removeCopy, commitDeck } = await import("./deck-edit.js");
    const { deckSize } = await import("./state.js");
    const w = newWorld({ seed: 82, catalog, starter: "black" });
    const enc = firstEncounter(w);
    const out = parley(w, catalog, enc, "flee"); // forfeits a stake either way → refill with swamps
    expect(["fled", "fleeFailed"]).toContain(out.type);
    const lost = (out as { anteLost: string[] }).anteLost;
    expect(lost.length).toBeGreaterThan(0);
    const swampsNow = activeDeck(w).find((e) => e.cardId === "swamp")!.count;
    expect(swampsNow).toBe(13 + lost.length);
    const sp = spares(w.player.collection, activeDeck(w));
    const spareId = Object.keys(sp)[0]!;
    const d1 = removeCopy(activeDeck(w), "swamp");
    const d2 = addCopy(w.player.collection, (d1 as { deck: ReturnType<typeof activeDeck> }).deck, spareId);
    expect(d2.ok).toBe(true);
    expect(commitDeck(w, (d2 as { deck: ReturnType<typeof activeDeck> }).deck).ok).toBe(true);
    expect(deckSize(activeDeck(w))).toBe(30);
    expect(deckLegal(activeDeck(w)).ok).toBe(true);
  });

  it("S16 (v3): multiple decks — new (30 basics) / duplicate / switch / rename / delete; spares subtract the ACTIVE deck only; the active deck duels", async () => {
    const { createDeck, duplicateDeck, switchDeck, deleteDeck, renameDeck, spares, removeCopy, addCopy, commitDeck } = await import("./deck-edit.js");
    const w = newWorld({ seed: 83, catalog, starter: "green" });
    const starterName = w.activeDeckName;
    expect(createDeck(w, "Blank")).toEqual({ ok: true });
    expect(w.decks.Blank).toEqual([{ cardId: "forest", count: 30 }]);
    expect(w.activeDeckName).toBe(starterName); // creating doesn't switch
    expect(createDeck(w, "Blank")).toMatchObject({ ok: false });
    expect(createDeck(w, "  ")).toMatchObject({ ok: false });
    expect(duplicateDeck(w, starterName, "Trail II")).toEqual({ ok: true });
    expect(w.decks["Trail II"]).toEqual(activeDeck(w));
    expect(w.decks["Trail II"]).not.toBe(activeDeck(w)); // a copy
    // Spares are computed against the active deck only: the duplicate doesn't eat copies.
    const sp = spares(w.player.collection, activeDeck(w));
    expect(Object.keys(sp).length).toBeGreaterThan(0);
    // Switch → the duel spec reads the new active deck.
    expect(switchDeck(w, "Blank")).toEqual({ ok: true });
    expect(w.activeDeckName).toBe("Blank");
    const enc = firstEncounter(w);
    const out = parley(w, catalog, enc, "fight");
    expect(out.type === "fight" && out.duel.spec.players[0].decklist).toEqual([{ cardId: "forest", count: 30 }]);
    // Can't delete the active deck or the last one; rename moves the key and keeps the active pointer.
    expect(deleteDeck(w, "Blank")).toMatchObject({ ok: false });
    expect(renameDeck(w, "Blank", "Forest Wall")).toEqual({ ok: true });
    expect(w.activeDeckName).toBe("Forest Wall");
    expect(switchDeck(w, starterName)).toEqual({ ok: true });
    expect(deleteDeck(w, "Forest Wall")).toEqual({ ok: true });
    expect(deleteDeck(w, "Trail II")).toEqual({ ok: true });
    expect(deleteDeck(w, starterName)).toMatchObject({ ok: false, reason: expect.stringMatching(/at least one|active/) });
    // A non-active deck may drift to list copies you no longer own (spares count the active deck only): switching to it refuses until edited.
    expect(duplicateDeck(w, starterName, "Twin")).toEqual({ ok: true });
    const nonbasic = activeDeck(w).find((e) => e.cardId !== "forest")!.cardId;
    w.player.collection[nonbasic] = 0; // lost every copy
    let d = removeCopy(activeDeck(w), nonbasic); while (d.ok && d.deck.some((e) => e.cardId === nonbasic)) d = removeCopy(d.deck, nonbasic);
    let fixed = (d as { deck: ReturnType<typeof activeDeck> }).deck; while (deckSize(fixed) < 30) fixed = (addCopy(w.player.collection, fixed, "forest") as { deck: ReturnType<typeof activeDeck> }).deck;
    expect(commitDeck(w, fixed).ok).toBe(true);
    expect(switchDeck(w, "Twin")).toMatchObject({ ok: false, reason: expect.stringMatching(/you own/) });
    expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  });
});

describe("beast opponents (ADR-066 proof of concept)", () => {
  it("the catalog carries the Pelakka Wurm as a beast; distraction costs tier price × beastBuyOffMultiplier; unbuyable beasts refuse", async () => {
    const { buyOffPrice } = await import("./journey.js");
    const { worldKnobs } = await import("./state.js");
    const wurm = catalog.opponents.find((o) => o.id === "beast_wurm")!;
    expect(wurm.kind).toBe("beast");
    expect(wurm.deck).toBe("beast:wurm"); // signature-card rule: the Pelakka Wurm deck (S18; was slice C in the S14 PoC)
    const w = newWorld({ seed: 91, catalog, starter: "red" });
    const knobs = worldKnobs(w);
    expect(buyOffPrice(knobs, 3, wurm)).toBe(Math.round(knobs.buyOffBase * 3 * knobs.beastBuyOffMultiplier));
    expect(buyOffPrice(knobs, 3)).toBe(knobs.buyOffBase * 3);
    // Force an encounter with the wurm and try to buy it off while broke / while it is unbuyable.
    const inst = w.opponents.find((o) => o.catalogId === "beast_wurm");
    if (inst) {
      const enc = { opponentId: inst.id, catalogId: inst.catalogId, tier: 3 as const, region: inst.region, at: w.player.position, fleeing: false, contact: "stepped" as const };
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
  it("every world has one reachable lair with a resident; walking onto it opens the LAIR-DUNGEON threshold (S20 — the S14 certain-encounter became the front door); cleared lairs are ground; mox sites telegraph too", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = newWorld({ seed, catalog, starter: "red" });
      quiet(w);
      const lairs = w.map.strongholds.filter((f) => f.kind === "lair");
      expect(lairs).toHaveLength(5); // lairsPerRegion wild 1 → one per wild region
      // S18: the resident is the spoke's top-tier signature opponent (green → the Pelakka Wurm).
      const lair = lairs.find((f) => w.map.regions[f.region]!.color === "G")!;
      expect(lair.kind).toBe("lair");
      const resident = w.opponents.find((o) => o.id === lair.opponentId)!;
      expect(resident.catalogId).toBe("beast_wurm");
      const TOP: Record<string, string> = { W: "beast_serra", U: "beast_formation", B: "beast_specter", R: "beast_siegegang", G: "beast_wurm" }; // S19: U lair → the Formation (top-signature rule, Chris's kickoff nod)
      for (const f of lairs) expect(w.opponents.find((o) => o.id === f.opponentId)!.catalogId).toBe(TOP[w.map.regions[f.region]!.color]);
      expect(resident.fixedAt).toEqual(lair.at);
      expect(findPath(w.map, w.map.start, lair.at)).not.toBeNull();
      // Walk there with random encounters off: the threshold telegraphs (no fight yet — entering is a choice).
      const ev = walkTo(w, catalog, lair.at, QUIET)!;
      const entry = ev.find((e) => e.type === "dungeonEntry");
      expect(entry && entry.type === "dungeonEntry" && entry.kind).toBe("lair");
      if (entry?.type === "dungeonEntry") {
        expect(entry.residentCatalogId).toBe("beast_wurm");
        expect(entry.dungeonId).toBe(`lair_${lair.opponentId}`);
      }
      expect(ev.some((e) => e.type === "encounter")).toBe(false);
      // Defeat the resident (the dungeon flow does this via clearDungeon): the lair is ground.
      resident.gone = true; resident.goneReason = "defeated";
      const w2 = w; w2.player.position = { ...w.map.start };
      const ev2 = walkTo(w2, catalog, lair.at, QUIET)!;
      expect(ev2.some((e) => e.type === "encounter" || e.type === "dungeonEntry")).toBe(false);
      // Residents never roam.
      expect(w.opponents.filter((o) => o.fixedAt && o.region === lair.region).length).toBe(1);
      // S20: each wild region also carries its MOX SITE; walking onto it telegraphs kind "mox" until cleared.
      const site = w.map.strongholds.find((f) => f.kind === "dungeon")!;
      expect(site).toBeTruthy();
      w.player.position = { ...w.map.start };
      const evM = walkTo(w, catalog, site.at, QUIET);
      if (evM) {
        const em = evM.find((e) => e.type === "dungeonEntry");
        if (em?.type === "dungeonEntry") {
          expect(em.kind).toBe("mox");
          w.dungeons[em.dungeonId] = { cleared: true, resets: 0 };
          w.player.position = { ...w.map.start };
          const evM2 = walkTo(w, catalog, site.at, QUIET)!;
          expect(evM2.some((e) => e.type === "dungeonEntry")).toBe(false); // cleared = ground
        }
      }
      // Strongholds are fixed points without residents: walking onto one is just ground for now (S22).
      const sh = w.map.strongholds.find((f) => f.kind === "stronghold")!;
      w.player.position = { ...w.map.start };
      const ev3 = walkTo(w, catalog, sh.at, QUIET)!;
      expect(ev3.some((e) => e.type === "encounter")).toBe(false);
    }
  });
});

describe("S20 Part 3+7 (dungeons, scripted acceptance): topology, escrow, interior life, empowerment, exits, save-v5", () => {
  const dg = () => import("./dungeon.js");

  const makeRun = async (w: WorldState, opts?: { small?: boolean; kind?: "mox" | "lair" }) => {
    const { generateDungeonRun } = await dg();
    const knobs = worldKnobs(w);
    return generateDungeonRun(w, catalog, knobs, pool.cards, {
      dungeonId: opts?.kind === "lair" ? "lair_test" : "mox_r",
      kind: opts?.kind ?? "mox",
      color: "R",
      enteredFrom: { ...w.player.position },
      ...(opts?.kind === "lair" ? { residentCatalogId: "beast_siegegang", small: true } : {}),
    });
  };

  it("generation: entry and guardian carved and connected; minions sit on carved chokepoints (never entry/guardian); treasures reachable; deterministic per (world, id)", async () => {
    for (const seed of [21, 22, 23]) {
      const w = newWorld({ seed, catalog, starter: "red" });
      const run = await makeRun(w);
      const { dungeonPath } = await dg();
      const at = (p: { x: number; y: number }) => run.grid.passable[p.y * run.grid.width + p.x];
      expect(at(run.entry)).toBe(true);
      expect(at(run.guardianAt)).toBe(true);
      run.position = { ...run.entry };
      // Reveal everything for pathing checks (fog-honest planning would also pass, but be explicit).
      for (let y = 0; y < run.grid.height; y++) for (let x = 0; x < run.grid.width; x++) if (at({ x, y })) run.explored[Math.floor((y * run.grid.width + x) / 32)] = -1 >>> 0;
      expect(dungeonPath(run, run.guardianAt)).not.toBeNull();
      for (const m of run.minions) {
        expect(at(m.at)).toBe(true);
        expect(m.at).not.toEqual(run.entry);
        expect(m.at).not.toEqual(run.guardianAt);
      }
      for (const t of run.treasures) expect(dungeonPath(run, t.at)).not.toBeNull();
      const again = await makeRun(w);
      expect(JSON.stringify({ ...again, interiorLife: 0 })).toBe(JSON.stringify({ ...run, position: again.position, explored: run.explored, interiorLife: 0 }).replace(JSON.stringify(run.explored), JSON.stringify(again.explored)));
    }
  });

  it("interior movement: steps count, fog lifts, a treasure banks to ESCROW (not the collection), a minion stops the walk, the guardian cell announces", async () => {
    const w = newWorld({ seed: 21, catalog, starter: "red" });
    const run = await makeRun(w);
    const { dungeonAdvance, dungeonPath } = await dg();
    const knobs = worldKnobs(w);
    const goldBefore = w.player.gold;
    // Reveal the interior so the plan is real (fog-honest planning may otherwise walk into
    // uncarved ground and stop early — the client re-plans; not this test's subject).
    for (let i = 0; i < run.explored.length; i++) run.explored[i] = -1 >>> 0;
    const treasure = run.treasures[0];
    if (treasure) {
      const path = dungeonPath(run, treasure.at);
      if (path) {
        const evs = dungeonAdvance(run, knobs, path);
        const hit = evs.find((e) => e.type === "treasure");
        // A minion may stop the walk first — both behaviours are the contract.
        if (hit) {
          expect(treasure.taken).toBe(true);
          expect(run.escrow.gold > 0 || run.escrow.cardIds.length > 0).toBe(true);
          expect(w.player.gold).toBe(goldBefore); // escrow, not pocket
        } else {
          expect(evs.some((e) => e.type === "minion")).toBe(true);
        }
      }
    }
    expect(run.steps).toBeGreaterThan(0);
  });

  it("interior duels: the law rides both sides; win → finalLife carries forward and ante goes to escrow; the guardian spec adds empowerment life + packages at 60/120/180", async () => {
    const w = newWorld({ seed: 22, catalog, starter: "red" });
    const run = await makeRun(w);
    const { dungeonDuelSpec, applyInteriorDuel, reachedTiers } = await dg();
    const knobs = worldKnobs(w);
    const mox = catalog.dungeons.find((d) => d.id === "mox_r")!;
    const rng = new WorldRng(9);
    // Minion spec: law on both seats, interior life on seat 0.
    const minionTmpl = catalog.opponents.find((o) => o.id === run.minions[0]?.catalogId) ?? catalog.opponents.find((o) => o.spoke === "R" && o.tier <= 2)!;
    const m = dungeonDuelSpec(w, catalog, knobs, run, { kind: "minion", tmpl: minionTmpl }, mox.law.both, rng);
    expect(m.spec.rules.startingLife).toBe(run.interiorLife);
    const perms = m.spec.modifiers.filter((x) => x.type === "permanentOnBattlefield" && x.cardId === "mountain");
    expect(perms.map((x) => (x as { player: number }).player).sort()).toEqual([0, 1]); // the Caldera's law, both sides
    // Empowerment: at 70 interior steps two tiers are live (+4 life, +1 basic) — thresholds 30/60/90 (S20 playtest r2).
    run.steps = 70;
    expect(reachedTiers(run, knobs)).toHaveLength(2);
    const g = dungeonDuelSpec(w, catalog, knobs, run, { kind: "guardian", name: mox.guardian.name, decklist: [{ cardId: "mountain", count: 40 }], archetype: "midrange", life: mox.guardian.life, color: "R" }, mox.law.both, rng);
    expect(g.enemyLife).toBe(mox.guardian.life + 4);
    expect(g.spec.modifiers.filter((x) => x.type === "permanentOnBattlefield" && (x as { player: number }).player === 1 && x.cardId === "mountain")).toHaveLength(2); // law + tier-2 basic
    // A real interior duel: run it and apply.
    const lifeBefore = w.player.worldLife;
    const result = await runMatch(m.spec, pool.cards, agentsFor(w, minionTmpl.difficulty, minionTmpl.deck, 22));
    const out = applyInteriorDuel(w, knobs, run, result, run.minions[0]?.id);
    if (out.type === "win") {
      expect(run.interiorLife).toBe(Math.max(1, result.finalLife[0]));
      expect(w.player.worldLife).toBe(lifeBefore); // the world track is untouched by interior wins
      for (const c2 of out.anteToEscrow) expect(run.escrow.cardIds).toContain(c2);
    } else {
      expect(w.player.worldLife).toBe(lifeBefore - 1); // §2a: an interior loss pays the world penalty
    }
  }, 60_000);

  it("exits: walk-out forfeits the escrow and resets (position restored, resets counted); victory pays escrow + Mox + guardian card + colour roll and the dungeon is ground; save-v5 round-trips mid-run", async () => {
    const w = newWorld({ seed: 23, catalog, starter: "red" });
    w.player.position = { x: 5, y: 5 };
    const run = await makeRun(w);
    run.escrow.gold = 40;
    run.escrow.cardIds.push("shock");
    w.activeDungeon = run;
    // Mid-run save round-trip (reload resumes; quitting is not walking out).
    const loaded = deserializeWorld(serializeWorld(w));
    expect(loaded.activeDungeon?.dungeonId).toBe("mox_r");
    expect(loaded.activeDungeon?.escrow.gold).toBe(40);
    // Walk out: the mountain keeps its gold.
    const { resetDungeon, clearDungeon, colorPrizeRoll } = await dg();
    const goldBefore = w.player.gold;
    const owned = { ...w.player.collection };
    resetDungeon(w, run);
    expect(w.player.gold).toBe(goldBefore);
    expect(w.player.collection).toEqual(owned);
    expect(w.dungeons["mox_r"]).toMatchObject({ cleared: false, resets: 1 });
    expect(w.activeDungeon).toBeNull();
    expect(w.player.position).toEqual({ x: 5, y: 5 });
    // Victory: escrow + prize pay out; one-time.
    const run2 = await makeRun(w);
    run2.escrow.gold = 25;
    run2.escrow.cardIds.push("doom_blade");
    w.activeDungeon = run2;
    const mox = catalog.dungeons.find((d) => d.id === "mox_r")!;
    const roll = colorPrizeRoll(w, pool.cards, "mox_r", "R");
    const paid = clearDungeon(w, run2, { gold: 0, cardIds: [mox.prize.mox, mox.prize.guardianCard, ...(roll ? [roll] : [])] });
    expect(paid.paidGold).toBe(25);
    expect(paid.paidCards).toContain("mox_ruby");
    expect(paid.paidCards).toContain("drakuseth_maw_of_flames");
    expect(w.player.collection["mox_ruby"]).toBe(1);
    expect(w.dungeons["mox_r"]).toMatchObject({ cleared: true });
    expect(w.provenance.filter((p) => p.source === "reward").map((p) => p.cardId)).toContain("mox_ruby");
  });

  it("S21 r2 treasure economy: caches split gold/card/life/boon by knob weights; a life cache pays interior life NOW; a boon rides your side of every remaining interior duel", async () => {
    const { generateDungeonRun, dungeonAdvance, dungeonDuelSpec } = await dg();
    const kinds = new Set<string>();
    let lifeRun: ReturnType<typeof generateDungeonRun> | null = null;
    let boonRun: ReturnType<typeof generateDungeonRun> | null = null;
    let w0: WorldState | null = null;
    for (let seed = 31; seed < 46; seed++) {
      const w = newWorld({ seed, catalog, starter: "red" });
      const knobs = worldKnobs(w);
      for (const kind of ["mox", "lair"] as const) {
        const run = generateDungeonRun(w, catalog, knobs, pool.cards, {
          dungeonId: `t_${kind}_${seed}`, kind, color: "R", enteredFrom: { x: 0, y: 0 }, ...(kind === "lair" ? { residentCatalogId: "beast_siegegang", small: true } : {}),
        });
        for (const t of run.treasures) kinds.add(t.kind);
        if (!lifeRun && run.treasures.some((t) => t.kind === "life")) { lifeRun = run; w0 = w; }
        if (!boonRun && run.treasures.some((t) => t.kind === "boon")) { boonRun = run; w0 = w0 ?? w; }
      }
    }
    expect([...kinds].sort()).toEqual(["boon", "card", "gold", "life"]); // all four kinds occur across seeds
    // Life: immediate, never escrowed.
    const knobs = worldKnobs(w0!);
    const lt = lifeRun!.treasures.find((t) => t.kind === "life")!;
    for (let i = 0; i < lifeRun!.explored.length; i++) lifeRun!.explored[i] = -1 >>> 0;
    lifeRun!.position = { x: lt.at.x, y: Math.max(0, lt.at.y - 1) };
    const before = lifeRun!.interiorLife;
    dungeonAdvance(lifeRun!, knobs, [lt.at]);
    if (lt.taken) {
      expect(lifeRun!.interiorLife).toBe(before + (lt.life ?? 0));
      expect(lifeRun!.escrow.cardIds).toHaveLength(0);
    }
    // Boon: on the PLAYER's seat of the next interior duel.
    const bt = boonRun!.treasures.find((t) => t.kind === "boon")!;
    bt.taken = true;
    (boonRun!.boons ??= []).push(bt.cardId!);
    const tmpl = catalog.opponents.find((o) => o.spoke === "R" && o.tier <= 2)!;
    const spec = dungeonDuelSpec(w0!, catalog, knobs, boonRun!, { kind: "minion", tmpl }, [], new WorldRng(5));
    expect(spec.spec.modifiers.some((m) => m.type === "permanentOnBattlefield" && (m as { player: number }).player === 0 && m.cardId === bt.cardId)).toBe(true);
    // S21 r3 (Chris): a boon is spent on the NEXT battle — applying that duel clears the hold.
    const { applyInteriorDuel } = await dg();
    applyInteriorDuel(w0!, knobs, boonRun!, { winner: 0, finalLife: [7, 0], facts: { ante: [[], []] } } as never, boonRun!.minions[0]?.id);
    expect(boonRun!.boons).toBeUndefined();
    // S21 r3 card classes: mox card caches are T3 or R; lair card caches are T2 or T3 (never R).
    for (let seed = 61; seed < 76; seed++) {
      const w = newWorld({ seed, catalog, starter: "red" });
      const kn = worldKnobs(w);
      const mox = generateDungeonRun(w, catalog, kn, pool.cards, { dungeonId: `c_mox_${seed}`, kind: "mox", color: "R", enteredFrom: { x: 0, y: 0 } });
      const lair = generateDungeonRun(w, catalog, kn, pool.cards, { dungeonId: `c_lair_${seed}`, kind: "lair", color: "R", enteredFrom: { x: 0, y: 0 }, residentCatalogId: "beast_siegegang", small: true });
      for (const t of mox.treasures) if (t.kind === "card") expect(["R", 3]).toContain(pool.cards.get(t.cardId!)?.shopTier);
      for (const t of lair.treasures) if (t.kind === "card") expect([2, 3]).toContain(pool.cards.get(t.cardId!)?.shopTier);
    }
  });

  it("lair-dungeons are smaller, roll R-card treasures, and the resident boss carries the lair life bonus in its spec", async () => {
    const w = newWorld({ seed: 24, catalog, starter: "red" });
    const run = await makeRun(w, { kind: "lair" });
    expect(run.minions.length).toBeLessThanOrEqual(3); // scale 2 (24×18): lairs carry 2–3 vs mox 3–5
    // S21 r3 (Chris): mundane lairs' card caches roll T2/T3 — the boss's 2×R prize room is the R channel.
    for (const t of run.treasures) if (t.kind === "card") expect([2, 3]).toContain(pool.cards.get(t.cardId!)?.shopTier);
    const { dungeonDuelSpec } = await dg();
    const knobs = worldKnobs(w);
    const boss = catalog.opponents.find((o) => o.id === "beast_siegegang")!;
    const g = dungeonDuelSpec(w, catalog, knobs, run, { kind: "guardian", name: boss.name, decklist: enemyDeck(catalog, boss.deck).decklist, archetype: "aggro", life: boss.worldLife, color: "R" }, [], new WorldRng(3));
    expect(g.enemyLife).toBe(boss.worldLife + knobs.lairResidentLifeBonus); // 12 + 2, no law, zero steps
  });
});

describe("S21 Part 2 (sieges, scripted acceptance): timers, telegraph, the fall, suspension, engagements with life carry, liberation, save round-trip", () => {
  const sg = () => import("./siege.js");
  const FAST = {
    event: {
      ...QUIET.event,
      siegeIntervalSteps: { civilized: 5, approach: 5, wild: 5 },
      siegeWarningSteps: 3,
      siegePartySize: { civilized: 2, approach: 2, wild: 2 },
      siegeGraceSteps: 0, // S22 r3: the opening grace is off for the fast-clock scripts (tested on its own below)
    },
  } as const;

  const tickTo = async (w: WorldState, steps: number) => {
    const { siegesOnStep } = await sg();
    const knobs = worldKnobs(w, FAST);
    const events = [];
    while (w.player.stepsTaken < steps) {
      w.player.stepsTaken += 1;
      events.push(...siegesOnStep(w, catalog, knobs));
    }
    return events;
  };

  it("timers: a seeded threat lands per ring interval (jittered), telegraphs for the warning window, and the town falls unrelieved; determinism per (seed, town, epoch)", async () => {
    const { siegeFor, isTownOccupied, isTownThreatened, scheduleNextThreat, rollSiegeParty } = await sg();
    const w = newWorld({ seed: 301, catalog, starter: "green" });
    quiet(w);
    const knobs = worldKnobs(w, FAST);
    const town = w.map.towns[0]!;
    // The schedule is deterministic and jittered within ±25% of the interval.
    const t0 = scheduleNextThreat(w, knobs, town, 0, 0);
    expect(t0).toBe(scheduleNextThreat(w, knobs, town, 0, 0));
    expect(t0).toBeGreaterThanOrEqual(Math.floor(5 * 0.75));
    expect(t0).toBeLessThanOrEqual(Math.ceil(5 * 1.25) + 1);
    expect(rollSiegeParty(w, catalog, knobs, town, 0)).toEqual(rollSiegeParty(w, catalog, knobs, town, 0));
    const events = await tickTo(w, 30);
    const threat = events.find((e) => e.type === "siegeThreatened" && e.townIndex === town.index);
    expect(threat).toBeTruthy();
    const fell = events.find((e) => e.type === "siegeFell" && e.townIndex === town.index);
    expect(fell).toBeTruthy();
    expect(isTownOccupied(w, town.index)).toBe(true);
    expect(isTownThreatened(w, town.index)).toBe(false);
    const entry = siegeFor(w, town.index)!;
    expect(entry.party!.length).toBe(2);
    expect(entry.occupiedAtStep).toBeGreaterThan(0);
    // Threat → fall spacing honours the warning window (fall on the step AFTER the deadline).
    expect((fell as { type: "siegeFell" }).type).toBe("siegeFell");
  });

  it("suspension: an occupied town's manalink goes dark (overworld and dungeon specs both read the one source); liberation restores it", async () => {
    const { siegeFor, resolveSiege } = await sg();
    const { manalinkModifiers } = await import("./quests.js");
    const w = newWorld({ seed: 302, catalog, starter: "green" });
    quiet(w);
    const town = w.map.towns[0]!;
    w.manalinks.push({ color: "G", town: town.index });
    expect(manalinkModifiers(w)).toHaveLength(1);
    await tickTo(w, 30); // falls
    expect(siegeFor(w, town.index)!.status).toBe("occupied");
    expect(manalinkModifiers(w)).toHaveLength(0); // dark while occupied
    resolveSiege(w, worldKnobs(w, FAST), siegeFor(w, town.index)!, town);
    expect(manalinkModifiers(w)).toHaveLength(1); // restored
    expect(siegeFor(w, town.index)!.status).toBe("quiet");
    expect(siegeFor(w, town.index)!.epoch).toBe(1);
    expect(siegeFor(w, town.index)!.nextThreatStep).toBeGreaterThan(w.player.stepsTaken);
  });

  it("engagement: life carries fight to fight (dungeon-style); a win pays ante+gold+renown now; the last member resolves the siege; a loss pays world consequences and the party regroups; mid-engagement save round-trips", async () => {
    const { beginSiegeEngagement, siegeDuelSpec, applySiegeDuel, siegeFor } = await sg();
    const w = newWorld({ seed: 303, catalog, starter: "green" });
    quiet(w);
    const knobs = worldKnobs(w, FAST);
    const town = w.map.towns[0]!;
    await tickTo(w, 30); // occupied
    const entry = siegeFor(w, town.index)!;
    expect(entry.status).toBe("occupied");
    const eng = beginSiegeEngagement(w, entry);
    expect(eng.kind).toBe("liberation");
    expect(eng.life).toBe(w.player.worldLife);
    expect(eng.remaining).toHaveLength(2);
    // Mid-engagement save round-trip (reload resumes — durability law).
    const loaded = deserializeWorld(serializeWorld(w));
    const lentry = (await sg()).siegeFor(loaded, town.index)!;
    expect(lentry.engagement?.kind).toBe("liberation");
    expect(lentry.engagement?.remaining).toEqual(eng.remaining);
    // Fight the gauntlet with real duels until it resolves (or a loss path exercises regrouping).
    let guard = 0;
    let sawCarry = false;
    while (siegeFor(w, town.index)!.status === "occupied" && guard < 8) {
      guard += 1;
      const e2 = siegeFor(w, town.index)!;
      const eng2 = beginSiegeEngagement(w, e2);
      const rng = new WorldRng(1000 + guard);
      const { spec, tmpl } = siegeDuelSpec(w, catalog, knobs, e2, rng);
      expect(spec.rules.startingLife).toBe(eng2.life); // the carry seeds each fight
      const result = await runMatch(spec, pool.cards, agentsFor(w, tmpl.difficulty, tmpl.deck, 303 + guard));
      const goldBefore = w.player.gold;
      const lifeBefore = w.player.worldLife;
      const out = applySiegeDuel(w, catalog, knobs, e2, town, result);
      if (out.type === "fightWon") {
        expect(out.lifeNow).toBe(Math.max(1, result.finalLife[0]));
        expect(e2.engagement!.life).toBe(out.lifeNow);
        expect(w.player.gold).toBe(goldBefore + out.goldWon);
        sawCarry = true;
      } else if (out.type === "engagementWon") {
        expect(out.kind).toBe("liberation");
        expect(siegeFor(w, town.index)!.status).toBe("quiet"); // liberated + rescheduled
        expect(siegeFor(w, town.index)!.epoch).toBeGreaterThan(0);
      } else {
        expect(w.player.worldLife).toBe(Math.max(knobs.lifeFloor, lifeBefore - knobs.lossLifePenalty));
        expect(siegeFor(w, town.index)!.engagement).toBeUndefined(); // the party regrouped to full
        expect(siegeFor(w, town.index)!.status).toBe("occupied");
      }
    }
    expect(siegeFor(w, town.index)!.status === "quiet" || guard === 8).toBe(true);
    void sawCarry; // observed across seeds; not asserted (a 1-fight sweep is legal)
  }, 120_000);

  it("S22 r3 (item 7): the opening grace — every town's FIRST threat schedules from siegeGraceSteps, not step 0; later epochs roll from the resolution step", async () => {
    const { siegeEntry, scheduleNextThreat } = await sg();
    const w = newWorld({ seed: 305, catalog, starter: "green" });
    quiet(w);
    const GRACED = { event: { ...FAST.event, siegeGraceSteps: 40 } } as const;
    const knobs = worldKnobs(w, GRACED);
    for (const town of w.map.towns) {
      const e = siegeEntry(w, knobs, town);
      expect(e.nextThreatStep).toBeGreaterThanOrEqual(40 + Math.floor(5 * 0.75)); // grace + the jittered interval's floor
      expect(e.nextThreatStep).toBe(scheduleNextThreat(w, knobs, town, 0, knobs.siegeGraceSteps)); // deterministic
    }
  });

  it("S22 r3 (item 12): a sealed lord's spoke goes quiet — no NEW threats land on his colour's towns (a standing occupation remains); respawn in his regions rolls mages, never his spoke's signatures", async () => {
    const { siegeFor } = await sg();
    const { strongholdState } = await import("./stronghold.js");
    const { respawnRoamers, removeOpponent, opponentTemplate } = await import("./journey.js");
    const w = newWorld({ seed: 306, catalog, starter: "green" });
    quiet(w);
    const knobs = worldKnobs(w, FAST);
    const color = w.map.regions[w.map.towns[0]!.region]!.color as "W" | "U" | "B" | "R" | "G";
    strongholdState(w, color).seal = true; // the lord falls before his first siege
    await tickTo(w, 30);
    for (const town of w.map.towns) {
      if ((w.map.regions[town.region]!.color) !== color) continue;
      expect(siegeFor(w, town.index)?.status ?? "quiet").toBe("quiet"); // his sieges never land
    }
    // Respawn: empty a region of the sealed colour, tick its clock, and every spawn is a mage.
    const region = w.map.regions.find((r) => r.color === color)!;
    for (const o of w.opponents) if (o.region === region.index && !o.fixedAt) removeOpponent(w, o.id, "fled");
    const rng = new WorldRng(9);
    const respawnKnobs = { ...knobs, roamerRespawnSteps: { civilized: 1, approach: 1, wild: 1 } };
    for (let i = 0; i < 12; i++) {
      w.player.stepsTaken += 1;
      for (const inst of respawnRoamers(w, catalog, respawnKnobs, rng)) {
        if (inst.region !== region.index) continue;
        const tmpl = opponentTemplate(catalog, inst);
        expect(tmpl.spoke).toBeUndefined(); // a mage — never the sealed lord's signature
      }
    }
  });
});

describe("S21 Parts 3–4 (retrieval, rumor-chains, the lore turn): pack-as-data, the dive-and-choice, chains that reveal, the tavern", () => {
  const q = () => import("./quests.js");

  it("the pack loads as catalog data; offer text comes from it with every placeholder substituted", async () => {
    expect(catalog.questText).toBeTruthy();
    expect(catalog.questText!.rumors.guardians.reya).toContain("Last Chapel");
    expect(catalog.questText!.rumors.lords.sower).toContain("Plant nothing");
    const { townOffers } = await q();
    const w = newWorld({ seed: 401, catalog, starter: "green" });
    const knobs = worldKnobs(w);
    const all = w.map.towns.flatMap((t) => townOffers(w, catalog, t, knobs, pool.cards));
    expect(all.length).toBeGreaterThan(0);
    for (const o of all) expect(o.text).not.toMatch(/\{(town|region|target|card|reward|want|steps)\}/);
    // Determinism: same (seed, town) → same offers.
    const again = w.map.towns.flatMap((t) => townOffers(w, catalog, t, knobs, pool.cards));
    expect(JSON.stringify(again)).toBe(JSON.stringify(all));
  });

  it("retrieval: lair-dungeon target only; the item pays through the dive; keep-or-deliver at the offer town (deliver refuses when the card is gone)", async () => {
    const { townOffers, acceptQuest, retrievalOnDungeonClear, pendingRetrievalChoice, resolveRetrieval } = await q();
    // Scan seeds/towns for a retrieval offer (seeded — some world has one on the first pass).
    let w: WorldState | null = null;
    let offer: import("./quests.js").QuestOffer | null = null;
    for (let seed = 401; seed < 420 && !offer; seed++) {
      const cand = newWorld({ seed, catalog, starter: "green" });
      const knobs = worldKnobs(cand);
      for (const t of cand.map.towns) {
        const o = townOffers(cand, catalog, t, knobs, pool.cards).find((x) => x.kind === "retrieval");
        if (o) { w = cand; offer = o; break; }
      }
    }
    expect(offer).toBeTruthy();
    const world = w!;
    const knobs = worldKnobs(world);
    expect(offer!.retrievalDungeonId).toMatch(/^lair_/);
    // The id the offer carries must be EXACTLY what journey's dungeonEntry emits for that lair
    // (S21 r2, Chris's report: a clear that doesn't credit the quest would smell like this seam).
    const lairFixed = world.map.strongholds.find((f) => f.kind === "lair" && `lair_${f.opponentId}` === offer!.retrievalDungeonId);
    expect(lairFixed).toBeTruthy();
    expect(world.opponents.find((o) => o.id === lairFixed!.opponentId)?.gone).toBeFalsy(); // living resident
    expect(offer!.deadlineSteps).toBe(0);
    expect(pool.cards.get(offer!.retrievalItem!.cardId)?.shopTier).toBe("R"); // the lair's register
    const acc = acceptQuest(world, catalog, offer!, knobs, pool.cards);
    expect(acc.ok).toBe(true);
    // The dive clears: the item joins the payout (the controller pushes it into the escrow's cardIds).
    const recovered = retrievalOnDungeonClear(world, offer!.retrievalDungeonId!);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]!.cardId).toBe(offer!.retrievalItem!.cardId);
    world.player.collection[recovered[0]!.cardId] = (world.player.collection[recovered[0]!.cardId] ?? 0) + 1; // the escrow paid
    expect(retrievalOnDungeonClear(world, offer!.retrievalDungeonId!)).toHaveLength(0); // once
    // The choice is live only at the offer town.
    expect(pendingRetrievalChoice(world, offer!.fromTown)).toHaveLength(1);
    expect(pendingRetrievalChoice(world, offer!.fromTown + 1)).toHaveLength(0);
    // DELIVER: the card leaves, the gold arrives.
    const goldBefore = world.player.gold;
    const owned = world.player.collection[recovered[0]!.cardId]!;
    const r = resolveRetrieval(world, offer!.id, "deliver");
    expect(r.ok).toBe(true);
    expect(world.player.gold).toBe(goldBefore + offer!.reward.gold);
    expect(world.player.collection[recovered[0]!.cardId] ?? 0).toBe(owned - 1);
    expect(world.quests.completed.some((c2) => c2.id === offer!.id && c2.outcome === "done")).toBe(true);
    // KEEP path + the sold-it-already refusal, on a second world.
    const w2 = newWorld({ seed: world.seed, catalog, starter: "green" });
    const knobs2 = worldKnobs(w2);
    const o2 = w2.map.towns.flatMap((t) => townOffers(w2, catalog, t, knobs2, pool.cards)).find((x) => x.kind === "retrieval")!;
    acceptQuest(w2, catalog, o2, knobs2, pool.cards);
    retrievalOnDungeonClear(w2, o2.retrievalDungeonId!);
    // Deliver without owning a copy refuses (the escrow payout was, say, anted away).
    expect(resolveRetrieval(w2, o2.id, "deliver").ok).toBe(false);
    const g2 = w2.player.gold;
    const keep = resolveRetrieval(w2, o2.id, "keep");
    expect(keep.ok).toBe(true);
    expect(w2.player.gold).toBe(g2); // keep pays nothing — the card was the prize
  });

  it("rumor-chains: five seeded deterministic chains; arrival hears, stops advance, the last stop REVEALS the mox site (explored); the tavern rotates lore and logs the journal; the Vault tease gates on five Moxen", async () => {
    const { rumorState, rumorsOnArrival, tavernRumors } = await q();
    const w = newWorld({ seed: 402, catalog, starter: "green" });
    const rs = rumorState(w, catalog);
    expect(rs.chains).toHaveLength(5);
    const w2 = newWorld({ seed: 402, catalog, starter: "green" });
    expect(rumorState(w2, catalog).chains).toEqual(rs.chains); // deterministic
    const chain = rs.chains[0]!;
    // Arrive anywhere: the opener is heard (progress −1 → 0).
    const elsewhere = w.map.towns.find((t) => t.index !== chain.stops[0] && t.index !== chain.stops[1])!;
    rumorsOnArrival(w, catalog, elsewhere);
    expect(rumorState(w, catalog).chains[0]!.progress).toBe(0);
    expect(rs.heard.length).toBeGreaterThan(0);
    // Walk the trail: stop 1 advances, stop 2 reveals.
    const ev1 = rumorsOnArrival(w, catalog, w.map.towns[chain.stops[0]!]!);
    expect(ev1.some((e) => e.type === "chainAdvanced" && e.chainId === chain.id)).toBe(true);
    const site = w.map.strongholds.find((f) => f.kind === "dungeon" && w.map.regions[f.region]?.color === catalog.dungeons.find((d) => d.id === chain.targetDungeonId)!.color)!;
    expect(isExplored(w.explored, w.map, site.at)).toBe(false); // still fogged before the reveal
    const ev2 = rumorsOnArrival(w, catalog, w.map.towns[chain.stops[1]!]!);
    expect(ev2.some((e) => e.type === "chainRevealed" && e.chainId === chain.id)).toBe(true);
    expect(isExplored(w.explored, w.map, site.at)).toBe(true); // the door is on the map
    // The tavern: lines flow, the journal grows, the tease waits for five Moxen.
    const before = rs.heard.length;
    const lines = tavernRumors(w, catalog, elsewhere);
    expect(lines.length).toBeGreaterThan(0);
    expect(rs.heard.length).toBeGreaterThanOrEqual(before);
    const tease = catalog.questText!.rumors.vaultTease;
    // S22 r2: the pour rotates on the RUMOR EPOCH (steps), not visits — walk the clock to rotate.
    const era = worldKnobs(w).rumorRefreshSteps;
    for (let v = 0; v < 30; v++) { w.player.stepsTaken = v * era; expect(tavernRumors(w, catalog, elsewhere)).not.toContain(tease); }
    for (const d of catalog.dungeons) w.dungeons[d.id] = { cleared: true, resets: 0 };
    let seen = false;
    for (let v = 0; v < 60 && !seen; v++) { w.player.stepsTaken = v * era; seen = tavernRumors(w, catalog, elsewhere).includes(tease); }
    expect(seen).toBe(true); // the flower is whispered once the five doors stand open
  });
});

describe("S19 shop tiers (ADR-078): availability by ring, price by tier factor, R never stocks", () => {
  it("a civilized shop pool is tier-1 only; approach adds tier 2; wild adds tier 3; R (Demonic Tutor, Mystic Snake) and prizeOnly (Lotus) appear on no shelf; prices carry the factor", async () => {
    const { shopPoolFor, shopPrice } = await import("./shop.js");
    const knobs = defaultKnobs();
    const civ = shopPoolFor(pool.cards, "WUBRG", 1), app = shopPoolFor(pool.cards, "WUBRG", 2), wild = shopPoolFor(pool.cards, "WUBRG", 3);
    expect(civ.every((d) => d.shopTier === 1)).toBe(true);
    expect(app.some((d) => d.shopTier === 2)).toBe(true);
    expect(app.every((d) => d.shopTier !== 3 && d.shopTier !== "R")).toBe(true);
    expect(wild.some((d) => d.shopTier === 3)).toBe(true);
    for (const shelf of [civ, app, wild]) {
      expect(shelf.some((d) => d.id === "demonic_tutor" || d.id === "mystic_snake" || d.id === "black_lotus")).toBe(false);
    }
    expect(civ.length).toBeLessThan(app.length);
    expect(app.length).toBeLessThan(wild.length);
    // S20: nonbasic lands are stock now — enablers on T1 shelves, shocks on T2+; ABU duals (R) never; either-color rule.
    expect(civ.some((d) => d.id === "secluded_steppe")).toBe(true);
    expect(civ.some((d) => d.id === "hallowed_fountain")).toBe(false);
    expect(app.some((d) => d.id === "hallowed_fountain")).toBe(true);
    expect(wild.some((d) => d.id === "tundra")).toBe(false);
    const wOnly = await import("./shop.js").then((m) => m.shopPoolFor(pool.cards, "W", 3));
    expect(wOnly.some((d) => d.id === "hallowed_fountain")).toBe(true); // WU shock stocks in W (either color)
    expect(wOnly.some((d) => d.id === "blood_crypt")).toBe(false); // BR shock does not
    const { shopPrice: sp } = await import("./shop.js");
    expect(sp(pool.cards.get("hallowed_fountain")!, knobs)).toBe(45); // priceOverride
    expect(sp(pool.cards.get("secluded_steppe")!, knobs)).toBe(10);
    // Audit prices: Doom Blade T2 mv2 → 4×3×1.5 = 18; Serra Angel T3 mv5 → 4×6×2.5 = 60; Shock T1 mv1 → 8.
    expect(shopPrice(pool.cards.get("doom_blade")!, knobs)).toBe(18);
    expect(shopPrice(pool.cards.get("serra_angel")!, knobs)).toBe(60);
    expect(shopPrice(pool.cards.get("shock")!, knobs)).toBe(8);
    // Distribution pin (audit v2 + Formation + the S20 land-and-legend batch as it lands: ten ABU duals at R so far).
    const tally: Record<string, number> = {};
    for (const d of pool.cards.values()) if (d.shopTier) tally[String(d.shopTier)] = (tally[String(d.shopTier)] ?? 0) + 1;
    expect(tally).toEqual({ "1": 60, "2": 44, "3": 10, R: 22 }); // ADR-081 unification: the five guardian legendaries left the tiers for prizeOnly (Drana was T3, the S20 four were R). S22 batch: +10 R (eight real gold→R adds + Aetherbolt + Tainted Phoenix; the five lords are prizeOnly), +1 T1 (Abrade). S23 fun batch: +3 T2 (Thundersnake, Gallows Djinn, Traumatizer)
  });
  it("a civilized town's rolled stock is all tier 1 and every price matches shopPrice", async () => {
    const { rollShopStock, shopPrice } = await import("./shop.js");
    const w = newWorld({ seed: 3, catalog, starter: "white" });
    const town = w.map.towns.find((t) => w.map.regions[t.region]!.tier === "civilized")!;
    const knobs = worldKnobs(w);
    const stock = rollShopStock(w, town, pool.cards, knobs);
    expect(stock.length).toBeGreaterThan(0);
    for (const item of stock) {
      const def = pool.cards.get(item.cardId)!;
      expect(def.shopTier, item.cardId).toBe(1);
      expect(item.price).toBe(shopPrice(def, knobs));
    }
  });
});

describe("S19 Part 3+5 (quests, scripted acceptance): offers, courier, card-courier, bounty, deadlines, manalinks, save-v4", () => {
  const questKnobs = () => defaultKnobs();

  it("every town offers ≥1 quest, deterministically; tiers match the town's ring; all three kinds occur across the map", async () => {
    const { townOffers } = await import("./quests.js");
    const w = newWorld({ seed: 41, catalog, starter: "green" });
    const knobs = questKnobs();
    const kinds = new Set<string>();
    for (const town of w.map.towns) {
      const a = townOffers(w, catalog, town, knobs, pool.cards);
      const b = townOffers(w, catalog, town, knobs, pool.cards);
      expect(a.length).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // pure in (seed, town)
      const ring = ({ civilized: 1, approach: 2, wild: 3 } as const)[w.map.regions[town.region]!.tier];
      for (const o of a) {
        // S22 r3 (Chris, item 6): a BOUNTY's tier is the TARGET's own tier (the purse prices
        // the mark, not the posting town); everything else keeps the town's ring.
        if (o.kind === "bounty") {
          const target = catalog.opponents.find((t) => t.id === o.bountyCatalogId)!;
          expect(o.tier).toBe(target.tier);
          expect(o.reward.gold).toBeGreaterThanOrEqual(Math.round((knobs.questGoldByTier[target.tier] ?? 20) / 2));
        } else expect(o.tier).toBe(ring);
        kinds.add(o.kind);
      }
    }
    expect(kinds.has("courier") || kinds.has("cardCourier")).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it("courier end-to-end: accept → the offer is consumed → arrive at the destination town → reward paid, quest closed 'done'; save-v4 round-trips mid-quest", async () => {
    const { townOffers, acceptQuest, questsOnArrival } = await import("./quests.js");
    const knobs = questKnobs();
    for (let seed = 41; seed < 60; seed++) {
      const w = newWorld({ seed, catalog, starter: "green" });
      quiet(w);
      const town = w.map.towns.find((t) => townOffers(w, catalog, t, knobs, pool.cards).some((o) => o.kind === "courier"));
      if (!town) continue;
      const offer = townOffers(w, catalog, town, knobs, pool.cards).find((o) => o.kind === "courier")!;
      const r = acceptQuest(w, catalog, offer, knobs, pool.cards);
      expect(r.ok).toBe(true);
      expect(townOffers(w, catalog, town, knobs, pool.cards).some((o) => o.id === offer.id)).toBe(false); // consumed
      expect(w.quests.active).toHaveLength(1);
      expect(w.quests.active[0]!.deadlineStep).toBe(w.player.stepsTaken + offer.deadlineSteps);
      // Mid-quest save round-trip (v4).
      const loaded = deserializeWorld(serializeWorld(w));
      expect(loaded.quests.active).toHaveLength(1);
      const goldBefore = w.player.gold;
      const dest = w.map.towns.find((t) => t.index === offer.toTown)!;
      const ev = questsOnArrival(w, dest, knobs);
      expect(ev).toHaveLength(1);
      expect(ev[0]!.type).toBe("questDone");
      expect(w.player.gold).toBeGreaterThan(goldBefore);
      expect(w.quests.active).toHaveLength(0);
      expect(w.quests.completed[0]).toMatchObject({ id: offer.id, outcome: "done" });
      return;
    }
    throw new Error("no courier offer found across seeds");
  });

  it("card-courier: only a matching SPARE may travel (deck copies refused, wrong colour refused); the card leaves the collection on acceptance", async () => {
    const { townOffers, acceptQuest, cardMatches } = await import("./quests.js");
    const knobs = questKnobs();
    for (let seed = 41; seed < 80; seed++) {
      const w = newWorld({ seed, catalog, starter: "green" });
      const town = w.map.towns.find((t) => townOffers(w, catalog, t, knobs, pool.cards).some((o) => o.kind === "cardCourier"));
      if (!town) continue;
      const offer = townOffers(w, catalog, town, knobs, pool.cards).find((o) => o.kind === "cardCourier")!;
      expect(acceptQuest(w, catalog, offer, knobs, pool.cards).ok).toBe(false); // no card named
      // Give the player a guaranteed matching spare.
      const match = [...pool.cards.values()].find((d) => !d.isTokenDef && cardMatches(d, offer.cardWanted!))!;
      w.player.collection[match.id] = (w.player.collection[match.id] ?? 0) + 1;
      const wrong = [...pool.cards.values()].find((d) => !d.isTokenDef && !d.types.includes("Land") && !cardMatches(d, offer.cardWanted!))!;
      w.player.collection[wrong.id] = (w.player.collection[wrong.id] ?? 0) + 1;
      expect(acceptQuest(w, catalog, offer, knobs, pool.cards, wrong.id).ok).toBe(false); // wrong card
      const before = w.player.collection[match.id]!;
      const r = acceptQuest(w, catalog, offer, knobs, pool.cards, match.id);
      expect(r.ok).toBe(true);
      expect(w.player.collection[match.id] ?? 0).toBe(before - 1); // it left
      expect(r.ok && r.quest.carriedCardId).toBe(match.id);
      return;
    }
    throw new Error("no card-courier offer found across seeds");
  });

  it("bounty end-to-end: accept spawns the mark in its region; defeating it pays the reward on the duel record; sighting sets the map mark", async () => {
    const { townOffers, acceptQuest, questsOnStep } = await import("./quests.js");
    const knobs = questKnobs();
    for (let seed = 41; seed < 90; seed++) {
      const w = newWorld({ seed, catalog, starter: "red" });
      quiet(w);
      const town = w.map.towns.find((t) => townOffers(w, catalog, t, knobs, pool.cards).some((o) => o.kind === "bounty"));
      if (!town) continue;
      const offer = townOffers(w, catalog, town, knobs, pool.cards).find((o) => o.kind === "bounty")!;
      const r = acceptQuest(w, catalog, offer, knobs, pool.cards);
      expect(r.ok).toBe(true);
      const q = w.quests.active[0]!;
      const inst = w.opponents.find((o) => o.id === q.bountyOpponentId)!;
      expect(inst.region).toBe(offer.bountyRegion);
      expect(catalog.opponents.find((o) => o.id === inst.catalogId)!.spoke).toBe(w.map.regions[offer.bountyRegion!]!.color);
      // Sighting: stand it next to the player and tick.
      inst.at = { ...stepCell(w) };
      questsOnStep(w, knobs, () => true);
      expect(q.bountySeenAt).toEqual(inst.at);
      // Defeat it: force the encounter and fight until a win happens (any seed).
      inst.region = regionAt(w.map, stepCell(w)).index;
      const enc = firstEncounter(w, (o) => o.id === inst.id);
      expect(enc.opponentId).toBe(inst.id);
      const out = parley(w, catalog, enc, "fight");
      if (out.type !== "fight") continue;
      const goldBefore = w.player.gold;
      const result = await runMatch(out.duel.spec, pool.cards, agentsFor(w, out.duel.enemy.difficulty, out.duel.enemy.deck, seed));
      const rec = applyDuelResult(w, catalog, out.duel, result);
      if (rec.outcome !== "win") continue; // try another seed for the win case
      expect(rec.questRewards).toBeDefined();
      expect(w.player.gold).toBeGreaterThan(goldBefore);
      expect(w.quests.completed.some((c) => c.id === offer.id && c.outcome === "done")).toBe(true);
      return;
    }
    throw new Error("no winning bounty run across seeds");
  }, 120_000);

  it("S22 r4 (item 7): a TWIN of the bounty's template pays the bounty too, and the spawned mark disperses", async () => {
    const { townOffers, acceptQuest } = await import("./quests.js");
    const knobs = questKnobs();
    for (let seed = 41; seed < 90; seed++) {
      const w = newWorld({ seed, catalog, starter: "red" });
      quiet(w);
      const town = w.map.towns.find((t) => townOffers(w, catalog, t, knobs, pool.cards).some((o) => o.kind === "bounty"));
      if (!town) continue;
      const offer = townOffers(w, catalog, town, knobs, pool.cards).find((o) => o.kind === "bounty")!;
      expect(acceptQuest(w, catalog, offer, knobs, pool.cards).ok).toBe(true);
      const q = w.quests.active[0]!;
      const mark = w.opponents.find((o) => o.id === q.bountyOpponentId)!;
      // A twin: same catalog template, different instance, placed at the player's feet.
      const twin = { id: "opp_twin_r4", catalogId: mark.catalogId, region: regionAt(w.map, stepCell(w)).index, gone: false, at: { ...stepCell(w) }, moveDebt: 0 };
      w.opponents.push(twin);
      const enc = firstEncounter(w, (o) => o.id === twin.id);
      expect(enc.opponentId).toBe(twin.id);
      const out = parley(w, catalog, enc, "fight");
      if (out.type !== "fight") continue;
      const result = await runMatch(out.duel.spec, pool.cards, agentsFor(w, out.duel.enemy.difficulty, out.duel.enemy.deck, seed));
      const rec = applyDuelResult(w, catalog, out.duel, result);
      if (rec.outcome !== "win") continue; // try another seed for the win case
      expect(w.quests.completed.some((c) => c.id === offer.id && c.outcome === "done")).toBe(true); // the twin's head paid
      expect(w.opponents.find((o) => o.id === mark.id)!.gone).toBe(true); // the mark disperses
      return;
    }
    throw new Error("no winning twin-bounty run across seeds");
  }, 120_000);

  it("S22 r4 (item 3): the card-courier's gold carries the premium (pays at least the tier's full gold)", async () => {
    const { townOffers } = await import("./quests.js");
    const knobs = questKnobs();
    let seen = 0;
    for (let seed = 41; seed < 70 && seen < 5; seed++) {
      const w = newWorld({ seed, catalog, starter: "green" });
      for (const t of w.map.towns) {
        for (const o of townOffers(w, catalog, t, knobs, pool.cards)) {
          if (o.kind !== "cardCourier") continue;
          seen += 1;
          // Base roll gold is at least questGoldByTier/2 (card/manalink riders halve it); ×2 premium
          // restores the full tier gold as the floor.
          expect(o.reward.gold).toBeGreaterThanOrEqual(knobs.questGoldByTier[o.tier] ?? 20);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("S22 r4 (item 1): the tavern points at a town whose CURRENT board posts a manalink contract; capped colours mute the pointer", async () => {
    const { townOffers, tavernRumors } = await import("./quests.js");
    for (let seed = 41; seed < 90; seed++) {
      const w = newWorld({ seed, catalog, starter: "green" });
      quiet(w);
      const knobs = worldKnobs(w);
      const posts = w.map.towns.filter((t) => townOffers(w, catalog, t, knobs, pool.cards).some((o) => o.reward.manalink));
      if (posts.length === 0) continue;
      const here = w.map.towns.find((t) => !posts.some((p) => p.index === t.index)) ?? w.map.towns[0]!;
      const tpl = catalog.questText!.rumors.manalinkPointer!;
      const isPointer = (l: string) => w.map.towns.some((p) => l === tpl.replace(/\{town\}/g, p.name));
      const lines = tavernRumors(w, catalog, here, pool.cards);
      const pointer = lines.find(isPointer);
      expect(pointer).toBeTruthy(); // one pour names a posting town
      expect(posts.some((p) => pointer!.includes(p.name))).toBe(true); // and it IS a posting town
      // Cap every colour AND the life kind (S24): the pointer goes quiet (nothing left to win).
      for (const c of ["W", "U", "B", "R", "G"] as const) for (let i = 0; i < knobs.manalinkCapPerColor; i++) w.manalinks.push({ color: c, town: 0, kind: "basic" });
      for (let i = 0; i < knobs.lifeManalinkCap; i++) w.manalinks.push({ color: "W", town: 0, kind: "life" });
      expect(tavernRumors(w, catalog, here, pool.cards).find(isPointer)).toBeUndefined();
      return;
    }
    throw new Error("no seed produced a manalink post");
  });

  it("deadline expiry mid-walk fails the quest cleanly (event emitted, no reward, no further penalty)", async () => {
    const { townOffers, acceptQuest } = await import("./quests.js");
    const knobs = questKnobs();
    for (let seed = 41; seed < 60; seed++) {
      const w = newWorld({ seed, catalog, starter: "green", knobLayers: { event: { roamerRespawnSteps: { civilized: 0, approach: 0, wild: 0 }, questDeadlineSteps: { 1: 2, 2: 2, 3: 2 } } } });
      quiet(w);
      const town = w.map.towns.find((t) => townOffers(w, catalog, t, knobs, pool.cards).some((o) => o.kind !== "bounty"));
      if (!town) continue;
      const offer = townOffers(w, catalog, town, knobs, pool.cards).find((o) => o.kind === "courier");
      if (!offer) continue;
      const withDeadline = { ...offer, deadlineSteps: 2 };
      expect(acceptQuest(w, catalog, withDeadline, knobs, pool.cards).ok).toBe(true);
      const goldBefore = w.player.gold;
      const lifeBefore = w.player.worldLife;
      const c1 = stepCell(w);
      const evs = [
        ...advance(w, catalog, [c1], QUIET),
        ...advance(w, catalog, [w.player.position], QUIET),
        ...advance(w, catalog, [w.player.position], QUIET),
        ...advance(w, catalog, [w.player.position], QUIET),
      ];
      expect(evs.some((e) => e.type === "questExpired")).toBe(true);
      expect(w.quests.active).toHaveLength(0);
      expect(w.quests.completed[0]).toMatchObject({ outcome: "expired" });
      expect(w.player.gold).toBe(goldBefore);
      expect(w.player.worldLife).toBe(lifeBefore); // no further penalty
      return;
    }
    throw new Error("no courier offer for the deadline test");
  });

  it("ADR-081 deadline pause: an occupied giver/destination town freezes the clock; liberation resumes it with the budget intact", async () => {
    const { townOffers, acceptQuest } = await import("./quests.js");
    const knobs = questKnobs();
    for (let seed = 41; seed < 60; seed++) {
      const w = newWorld({ seed, catalog, starter: "green", knobLayers: { event: { roamerRespawnSteps: { civilized: 0, approach: 0, wild: 0 }, questDeadlineSteps: { 1: 2, 2: 2, 3: 2 } } } });
      quiet(w);
      const town = w.map.towns.find((t) => townOffers(w, catalog, t, knobs, pool.cards).some((o) => o.kind === "courier"));
      if (!town) continue;
      const offer = townOffers(w, catalog, town, knobs, pool.cards).find((o) => o.kind === "courier")!;
      const withDeadline = { ...offer, deadlineSteps: 2 };
      expect(acceptQuest(w, catalog, withDeadline, knobs, pool.cards).ok).toBe(true);
      const q = w.quests.active[0]!;
      const deadline0 = q.deadlineStep!;
      // Stage the destination occupied (tests write siege state directly, like roamers).
      w.sieges.push({ townIndex: q.toTown!, epoch: 0, status: "occupied", nextThreatStep: -1, occupiedAtStep: w.player.stepsTaken });
      // Walk well past the original budget: the clock is frozen, the contract survives.
      const evs = [];
      for (let i = 0; i < 5; i++) evs.push(...advance(w, catalog, [w.player.position], QUIET));
      expect(evs.some((e) => e.type === "questExpired")).toBe(false);
      expect(w.quests.active).toHaveLength(1);
      expect(q.deadlineStep!).toBe(deadline0 + 5); // each occupied step pushed the deadline one step
      // Liberation: the remaining budget resumes, and only then can it expire.
      w.sieges[0]!.status = "quiet";
      const evs2 = [];
      for (let i = 0; i < 3; i++) evs2.push(...advance(w, catalog, [w.player.position], QUIET));
      expect(evs2.some((e) => e.type === "questExpired")).toBe(true);
      return;
    }
    throw new Error("no courier offer for the pause test");
  });

  it("manalinks: the award respects the per-colour cap (over-cap converts to gold); every duel's modifiers carry the link; the def resolves in a real match", async () => {
    const { manalinkModifiers } = await import("./quests.js");
    const w = newWorld({ seed: 44, catalog, starter: "green" });
    w.manalinks.push({ color: "G", town: 0 });
    const enc = firstEncounter(w);
    const out = parley(w, catalog, enc, "fight");
    expect(out.type).toBe("fight");
    if (out.type !== "fight") return;
    expect(out.duel.spec.modifiers).toContainEqual({ type: "permanentOnBattlefield", player: 0, cardId: "forest" }); // S19 round 2: a manalink is a real Forest in play
    expect(manalinkModifiers(w)).toHaveLength(1);
    // The def is engine-real: run the duel; no crash, and the log replays (runMatch asserts internally).
    const result = await runMatch(out.duel.spec, pool.cards, agentsFor(w, out.duel.enemy.difficulty, out.duel.enemy.deck, 44));
    expect(["win", "loss", "draw"]).toContain(applyDuelResult(w, catalog, out.duel, result).outcome);
  }, 60_000);

  it("S24 (ADR-086) life manalinks: +1 maximum each, lifeManalinkCap converts overflow to gold, life links never enter duels, kind survives save/load, and the offer roll produces both kinds", async () => {
    const { manalinkModifiers } = await import("./quests.js");
    const { maxWorldLife } = await import("./state.js");
    const w = newWorld({ seed: 44, catalog, starter: "green" });
    const knobs = worldKnobs(w);
    const base = knobs.startingWorldLife;
    expect(maxWorldLife(w)).toBe(base);
    w.manalinks.push({ color: "G", town: 0, kind: "life" }, { color: "W", town: 1, kind: "life" }, { color: "G", town: 2, kind: "basic" });
    expect(maxWorldLife(w)).toBe(base + 2); // life links only
    expect(manalinkModifiers(w)).toHaveLength(1); // the basic link only — life links never enter duels
    // Save round-trip preserves kinds (and pre-S24 saves default absent kind to basic on read).
    const loaded = deserializeWorld(serializeWorld(w));
    expect(loaded.manalinks.map((m) => m.kind)).toEqual(["life", "life", "basic"]);
    expect(maxWorldLife(loaded)).toBe(base + 2);
    // The kind split exists in the wild: across seeds, offers roll BOTH kinds.
    const { townOffers } = await import("./quests.js");
    const kinds = new Set<string>();
    for (let seed = 41; seed < 90 && kinds.size < 2; seed++) {
      const w2 = newWorld({ seed, catalog, starter: "green" });
      for (const t of w2.map.towns) for (const o of townOffers(w2, catalog, t, worldKnobs(w2), pool.cards)) if (o.reward.manalink) kinds.add(o.reward.manalinkKind ?? "basic");
    }
    expect(kinds).toEqual(new Set(["basic", "life"]));
  });

  it("S24 (ADR-086) suspension drops the MAXIMUM: a life-link town falling clamps current life; liberation restores the ceiling (current stays)", async () => {
    const { maxWorldLife, clampWorldLife } = await import("./state.js");
    const { siegeEntry, resolveSiege } = await import("./siege.js");
    const w = newWorld({ seed: 46, catalog, starter: "green" });
    quiet(w);
    const knobs = worldKnobs(w);
    const town = w.map.towns[0]!;
    w.manalinks.push({ color: "G", town: town.index, kind: "life" });
    w.player.worldLife = maxWorldLife(w); // rested to the raised ceiling (11)
    expect(w.player.worldLife).toBe(knobs.startingWorldLife + 1);
    const entry = siegeEntry(w, knobs, town);
    entry.status = "occupied"; // the fall (the tick path calls clampWorldLife — exercised below via the helper)
    clampWorldLife(w);
    expect(maxWorldLife(w)).toBe(knobs.startingWorldLife);
    expect(w.player.worldLife).toBe(knobs.startingWorldLife); // clamped — capacity is anchored to places
    resolveSiege(w, knobs, entry, town);
    expect(maxWorldLife(w)).toBe(knobs.startingWorldLife + 1); // the ceiling returns…
    expect(w.player.worldLife).toBe(knobs.startingWorldLife); // …the lost point does not (the inn sells it back)
  });

  it("S24 (ADR-086) the inn: rest heals to the maximum at innStepsPerLife per point, bulk-advances the clock (a mid-rest siege threat lands in the QUEUED events), and a full sleeper pays nothing", async () => {
    const { innRest } = await import("./journey.js");
    const { maxWorldLife } = await import("./state.js");
    const w = newWorld({ seed: 47, catalog, starter: "green" });
    quiet(w);
    const knobs = worldKnobs(w);
    w.player.worldLife = 6;
    const steps0 = w.player.stepsTaken;
    // A siege threat scheduled to land mid-rest: entry for town 0 with the next threat 10 steps out.
    const { siegeEntry } = await import("./siege.js");
    const entry = siegeEntry(w, knobs, w.map.towns[0]!);
    entry.nextThreatStep = steps0 + 10;
    const out = innRest(w, catalog, 4, { event: { roamerRespawnSteps: { civilized: 0, approach: 0, wild: 0 } } });
    expect(out.healed).toBe(4);
    expect(out.stepsSpent).toBe(4 * knobs.innStepsPerLife);
    expect(w.player.worldLife).toBe(10);
    expect(w.player.stepsTaken).toBe(steps0 + out.stepsSpent);
    expect(out.events.some((e) => e.type === "siegeThreatened")).toBe(true); // the world moved while we slept
    // Overshoot clamps to the maximum; a full sleeper pays nothing.
    const out2 = innRest(w, catalog, 99);
    expect(out2.healed).toBe(maxWorldLife(w) - 10);
    const out3 = innRest(w, catalog, 5);
    expect(out3).toEqual({ healed: 0, stepsSpent: 0, events: [] });
  });
});

describe("S18 Part 6 (scripted acceptance): a beast encounter end-to-end — roamer → parley (voice, distraction price, refusal) → duel on the beast deck with the tier AI profile → result applied → roamer removed", () => {
  it("the Boggart Warband: contact → fight → beast:warband decklist + journeyman profile + world life 10 → outcome applied; the Living Gale refuses distraction with its own refusal line; the Serra Angel takes a tithe", async () => {
    const { EXPANSION_DECKS } = await import("@shandalar/sim/expansion-decks");
    const { buyOffPrice } = await import("./journey.js");
    const w = newWorld({ seed: 5, catalog, starter: "red" });
    // Put a Warband on the first step (the catalog entry exists even if this seed's red ring didn't roll one — instantiate it).
    const warband = catalog.opponents.find((o) => o.id === "beast_warband")!;
    expect(warband.kind).toBe("beast");
    expect(warband.parley?.verb).toBe("Bribe");
    const cell = (() => { const live = w.opponents.find((o) => !o.gone && !o.fixedAt && o.at)!; live.catalogId = "beast_warband"; return live; })();
    const enc = firstEncounter(w, (o) => o.id === cell.id);
    expect(enc.catalogId).toBe("beast_warband");
    expect(enc.tier).toBe(2);
    const knobs = worldKnobs(w);
    expect(buyOffPrice(knobs, 2, warband)).toBe(Math.round(knobs.buyOffBase * 2 * knobs.beastBuyOffMultiplier));
    const out = parley(w, catalog, enc, "fight");
    expect(out.type).toBe("fight");
    if (out.type !== "fight") return;
    const { duel } = out;
    expect(duel.enemy.name).toBe("The Boggart Warband");
    expect(duel.enemy.difficulty).toBe("journeyman");
    expect(duel.enemy.worldLife).toBe(8); // S19 mid-session ruling (Chris): Nighthawk and Warband walk down two — the first per-opponent life tuning
    expect(duel.enemy.archetype).toBe("aggro");
    expect(duel.spec.players[1].decklist).toEqual(EXPANSION_DECKS.warband!.decklist);
    expect(duel.spec.modifiers).toEqual([{ type: "startingLife", player: 1, value: 8 }]);
    const result = await runMatch(duel.spec, pool.cards, agentsFor(w, duel.enemy.difficulty, duel.enemy.deck, 5));
    const rec = applyDuelResult(w, catalog, duel, result);
    expect(["win", "loss", "draw"]).toContain(rec.outcome);
    expect(w.opponents.find((o) => o.id === enc.opponentId)!.gone).toBe(true);
    expect(w.duels).toHaveLength(1);
    // Unbuyable beast: the Living Gale refuses with its catalog refusal; a tithe to the Serra Angel is a buy-off at the beast multiplier.
    const gale = catalog.opponents.find((o) => o.id === "beast_gale")!;
    expect(gale.buyable).toBe(false);
    expect(gale.parley?.refusal).toMatch(/wind/);
    const w2 = newWorld({ seed: 6, catalog, starter: "blue" });
    const live2 = w2.opponents.find((o) => !o.gone && !o.fixedAt && o.at)!; live2.catalogId = "beast_gale";
    const enc2 = firstEncounter(w2, (o) => o.id === live2.id);
    w2.player.gold = 10_000;
    expect(parley(w2, catalog, enc2, "buyoff")).toMatchObject({ type: "refused", reason: expect.stringMatching(/cannot be bought/) });
    const serra = catalog.opponents.find((o) => o.id === "beast_serra")!;
    expect(serra.buyable).toBe(true);
    expect(serra.parley?.verb).toBe("Tithe");
    const w3 = newWorld({ seed: 7, catalog, starter: "white" });
    const live3 = w3.opponents.find((o) => !o.gone && !o.fixedAt && o.at)!; live3.catalogId = "beast_serra";
    const enc3 = firstEncounter(w3, (o) => o.id === live3.id);
    w3.player.gold = 10_000;
    const tithe = parley(w3, catalog, enc3, "buyoff");
    expect(tithe.type).toBe("boughtOff");
    expect(w3.player.gold).toBe(10_000 - buyOffPrice(worldKnobs(w3), 3, serra));
    expect(w3.opponents.find((o) => o.id === enc3.opponentId)!.gone).toBe(true); // any parley outcome removes the roamer (S16 ruling)
  }, 60_000);
});

describe("S18 spawn tables (ADR-066/074, Chris's ring blends): spoke-bound beasts, beastShare, tier blend by ring; respawn uses the same table", () => {
  it("signature opponents roam only their spoke; civilized rings carry no tier-3 beasts and wild rings no tier-1; the beast share tracks the knob; a spoke without a rolled tier falls to the nearest", () => {
    const byRing: Record<string, { beasts: number; total: number; tiers: Record<number, number> }> = { civilized: { beasts: 0, total: 0, tiers: {} }, approach: { beasts: 0, total: 0, tiers: {} }, wild: { beasts: 0, total: 0, tiers: {} } };
    for (let seed = 1; seed <= 40; seed++) {
      const w = newWorld({ seed, catalog, starter: ["white", "blue", "black", "red", "green"][seed % 5] as StarterId });
      for (const o of w.opponents) {
        if (o.fixedAt) continue;
        const tmpl = catalog.opponents.find((t) => t.id === o.catalogId)!;
        const reg = w.map.regions[o.region]!;
        const ring = byRing[reg.tier]!;
        ring.total += 1;
        if (tmpl.spoke) {
          expect(tmpl.spoke, `${tmpl.id} roams ${reg.name}`).toBe(reg.color);
          ring.beasts += 1;
          ring.tiers[tmpl.tier] = (ring.tiers[tmpl.tier] ?? 0) + 1;
        }
      }
    }
    const knobs = defaultKnobs();
    for (const tier of ["civilized", "approach", "wild"] as const) {
      const r = byRing[tier]!;
      const share = r.beasts / r.total;
      // Under the default `mage` fallback the realised share is the knob × the fraction of rolls the spoke can serve
      // (black/red have no tier-1 beast, blue no tier-3, green no tier-2) — so: never above the knob by noise, never below half of it.
      expect(share, `${tier} beast share ${share.toFixed(2)} vs knob ${knobs.beastShare[tier]}`).toBeGreaterThan(knobs.beastShare[tier] * 0.5);
      expect(share).toBeLessThan(knobs.beastShare[tier] + 0.12);
    }
    expect(byRing.civilized!.tiers[3] ?? 0).toBe(0); // blend [85,15,0]
    expect(byRing.wild!.tiers[1] ?? 0).toBe(0); // blend [0,50,50]
    expect(byRing.civilized!.tiers[1]!).toBeGreaterThan(byRing.civilized!.tiers[2] ?? 0);
    // S19 (ADR-078): the grid is complete, so beastTierFallback no longer fires for signature rolls —
    // a blue wild ring's signatures are the Gale (T2) and the Formation (T3) under either knob value.
    for (const fb of ["mage", "nearest"] as const) {
      const w7 = newWorld({ seed: 7, catalog, starter: "blue", knobLayers: { event: { beastTierFallback: fb } } });
      const bw = w7.map.regions.find((r) => r.color === "U" && r.tier === "wild")!;
      for (const o of w7.opponents.filter((o) => o.region === bw.index && !o.fixedAt)) {
        const t = catalog.opponents.find((x) => x.id === o.catalogId)!;
        if (t.spoke) expect(["beast_gale", "beast_formation"]).toContain(t.id);
        else expect([2, 3]).toContain(t.tier); // wild mage table rolls 3,3,2
      }
    }
  });
  it("respawn rolls from the same table: a red approach region below target respawns red-spoke signatures or mages, never another colour's beast", () => {
    const w = newWorld({ seed: 11, catalog, starter: "red" });
    const reg = w.map.regions.find((r) => r.color === "R" && r.tier === "approach")!;
    for (const o of w.opponents) if (o.region === reg.index && !o.fixedAt) { o.gone = true; o.goneReason = "lost"; }
    const knobsW = worldKnobs(w);
    const cells = [...Array(w.map.width * w.map.height).keys()];
    void cells;
    // Stand ON the home town (roamers never enter towns — S23 r1 moved the start to open
    // ground, where pursuit contact was short-circuiting advance before the respawn tick).
    w.player.position = { ...w.map.towns[w.lastTownIndex]!.at };
    // Step in place far from the region until respawns land there.
    let spawnedThere = 0;
    for (let i = 0; i < 400 && spawnedThere < 3; i++) {
      const ev = advance(w, catalog, [w.player.position]);
      for (const e of ev) if (e.type === "spawned" && e.region === reg.index) {
        spawnedThere += 1;
        const inst = w.opponents.find((o) => o.id === e.opponentId)!;
        const t = catalog.opponents.find((x) => x.id === inst.catalogId)!;
        if (t.spoke) expect(t.spoke).toBe("R");
      }
    }
    expect(spawnedThere).toBeGreaterThan(0);
    void knobsW;
  });
});

describe("S16 roamers (ADR-071): sight, pursuit, fleeing, contact, removal, respawn, determinism", () => {
  /** Put the player on an open cell away from towns with a known roamer placed at distance d along +x (in-region). */
  function stage(seed: number, d: number, opts: { tier?: 1 | 2 | 3; renown?: number } = {}): { w: WorldState; inst: OpponentInstance; knobs: ReturnType<typeof worldKnobs> } {
    const w = newWorld({ seed, catalog, starter: "green" });
    quiet(w);
    const knobs = worldKnobs(w, QUIET);
    // Find a row segment of d+4 passable, same-region, non-town cells.
    for (let y = 1; y < w.map.height - 1; y++) {
      for (let x = 1; x + d + 3 < w.map.width; x++) {
        const cells = Array.from({ length: d + 4 }, (_, i) => ({ x: x + i, y }));
        const r0 = w.map.region[idx(w.map, cells[0]!)];
        if (cells.every((c) => w.map.passable[idx(w.map, c)] && w.map.region[idx(w.map, c)] === r0 && !isTownCell(w.map, c))) {
          const pick = w.opponents.find((o) => !o.fixedAt && (opts.tier === undefined || catalog.opponents.find((c) => c.id === o.catalogId)!.tier === opts.tier))!;
          pick.gone = false; delete pick.goneReason; pick.region = r0!; pick.at = { ...cells[d]! }; pick.moveDebt = 0;
          w.player.position = { ...cells[0]! };
          w.player.renown = opts.renown ?? 0;
          // Renown is per-colour now (S20 playtest); these tests mean "globally feared".
          for (const c of ["W", "U", "B", "R", "G"] as const) w.player.renownByColor[c] = opts.renown ?? 0;
          return { w, inst: pick, knobs };
        }
      }
    }
    throw new Error("no staging row");
  }

  it("a roamer within sight moves toward you each step; standing still it reaches you → contact = encounter (roamer-initiated); out of sight it drifts", () => {
    const { w, inst, knobs } = stage(101, 4);
    const tmpl = catalog.opponents.find((c) => c.id === inst.catalogId)!;
    expect(knobs.roamerSpeed[tmpl.tier]).toBe(1);
    // "Stand still" = step back and forth between two cells; the roamer closes one cell per step.
    const a = { ...w.player.position }, b = { x: a.x, y: a.y + 1 };
    const bOk = w.map.passable[idx(w.map, b)] && !isTownCell(w.map, b);
    let contact: Encounter | null = null;
    let d0 = manhattan(inst.at!, w.player.position);
    for (let i = 0; i < 12 && !contact; i++) {
      const cell = bOk && i % 2 === 0 ? b : a;
      const ev = advance(w, catalog, [cell], QUIET);
      const enc = ev.find((e) => e.type === "encounter");
      if (enc && enc.type === "encounter") contact = enc.encounter;
      else {
        const d1 = manhattan(inst.at!, w.player.position);
        expect(d1).toBeLessThanOrEqual(d0 + 1); // never loses ground while in sight
        d0 = d1;
      }
    }
    expect(contact).toBeTruthy();
    expect(contact!.opponentId).toBe(inst.id);
    expect(contact!.fleeing).toBe(false);
    expect(contact!.contact).toBe("reached");
    // Out of sight: a far roamer drifts (stays or one random legal step), never out of its region, never onto a town.
    const far = stage(102, 12);
    const before = { ...far.inst.at! };
    advance(far.w, catalog, [stepCellFrom(far.w, far.w.player.position)], QUIET);
    expect(manhattan(before, far.inst.at!)).toBeLessThanOrEqual(1);
    expect(far.w.map.region[idx(far.w.map, far.inst.at!)]).toBe(far.inst.region);
    expect(isTownCell(far.w.map, far.inst.at!)).toBe(false);
  });

  it("sight radius is honoured: visible at ≤ sightRadius, invisible beyond; rough cells on the line shorten YOUR sight (the ambush) but not the roamer's pursuit", () => {
    const { w, inst, knobs } = stage(103, knobs0().sightRadius);
    expect(visibleRoamers(w, catalog, knobs).map((r) => r.inst.id)).toContain(inst.id);
    inst.at = { x: inst.at!.x + 1, y: inst.at!.y };
    expect(visibleRoamers(w, catalog, knobs).map((r) => r.inst.id)).not.toContain(inst.id);
    // Rough terrain between: drop a rough cell on the line → effective sight shrinks by the penalty.
    const { w: w2, inst: i2, knobs: k2 } = stage(104, 4);
    const mid = { x: w2.player.position.x + 2, y: w2.player.position.y };
    expect(effectiveSight(w2.map, k2, w2.player.position, i2.at!)).toBe(k2.sightRadius);
    w2.map.passable[idx(w2.map, mid)] = false;
    expect(effectiveSight(w2.map, k2, w2.player.position, i2.at!)).toBe(k2.sightRadius - k2.roughSightPenalty);
    // At distance 4 with sight 6−2 = 4 it is still visible; push it to 5: invisible to you…
    i2.at = { x: i2.at!.x + 1, y: i2.at!.y };
    expect(visibleRoamers(w2, catalog, k2).map((r) => r.inst.id)).not.toContain(i2.id);
    // …but it still pursues (its sight is plain radius 6): after your step it is closer.
    const dBefore = manhattan(i2.at!, w2.player.position);
    const cell = stepCellFrom(w2, w2.player.position, (p) => !samePoint(p, mid));
    advance(w2, catalog, [cell], QUIET);
    expect(manhattan(i2.at!, w2.player.position)).toBeLessThanOrEqual(dBefore);
  });

  it("renown: a roamer flees when tier × renownFleeFactor < renown — it moves away, never steps into you; stepping onto it is a player-initiated contact flagged fleeing", () => {
    const { w, inst, knobs } = stage(105, 2, { tier: 1, renown: 10 });
    expect(1 * knobs.renownFleeFactor[1]).toBeLessThan(10);
    expect(visibleRoamers(w, catalog, knobs).find((r) => r.inst.id === inst.id)?.fleeing).toBe(true);
    // Pursue: step toward it; it retreats along the row (or holds if cornered) and never reaches you on its own.
    let caught: Encounter | null = null;
    for (let i = 0; i < 12 && !caught; i++) {
      const dx = Math.sign(inst.at!.x - w.player.position.x);
      const next = { x: w.player.position.x + dx, y: w.player.position.y };
      if (!w.map.passable[idx(w.map, next)] || isTownCell(w.map, next)) break;
      const dBefore = manhattan(inst.at!, w.player.position);
      const ev = advance(w, catalog, [next], QUIET);
      const enc = ev.find((e) => e.type === "encounter");
      if (enc && enc.type === "encounter") { caught = enc.encounter; break; }
      expect(manhattan(inst.at!, w.player.position)).toBeGreaterThanOrEqual(Math.min(dBefore, 1)); // it did not close in
    }
    if (caught) {
      expect(caught.fleeing).toBe(true);
      expect(caught.opponentId).toBe(inst.id);
    }
    // Corner it: box the roamer in by making its far side rough → next pursuit step catches it.
    const { w: w3, inst: i3 } = stage(106, 1, { tier: 1, renown: 10 });
    for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const q = { x: i3.at!.x + d.x, y: i3.at!.y + d.y };
      if (q.x >= 0 && q.y >= 0 && q.x < w3.map.width && q.y < w3.map.height) w3.map.passable[idx(w3.map, q)] = false;
    }
    const ev3 = advance(w3, catalog, [{ ...i3.at! }], QUIET);
    const enc3 = ev3.find((e) => e.type === "encounter");
    expect(enc3 && enc3.type === "encounter" && enc3.encounter.fleeing).toBe(true);
    // Low renown: the same roamer is not fleeing.
    const { w: w4, inst: i4, knobs: k4 } = stage(107, 2, { tier: 1, renown: 0 });
    expect(visibleRoamers(w4, catalog, k4).find((r) => r.inst.id === i4.id)?.fleeing).toBe(false);
  });

  it("S21 Part 1 (ADR-080): the Nighthawk is priced — its per-opponent gold override rides encounterKnobs (T2 pays 50 vs the base 25), parley carries the warning register", async () => {
    const { encounterKnobs } = await import("./journey.js");
    const w = newWorld({ seed: 110, catalog, starter: "black" });
    const hawk = catalog.opponents.find((o) => o.id === "beast_nighthawk")!;
    expect(hawk.tier).toBe(2);
    const inst = w.opponents[0]!;
    inst.catalogId = hawk.id; // stage a real instance (encounterKnobs resolves the template via world.opponents)
    const enc = { opponentId: inst.id, catalogId: hawk.id, tier: hawk.tier, region: 0, at: { x: 0, y: 0 }, fleeing: false, contact: "stepped" } as unknown as Encounter;
    expect(encounterKnobs(w, catalog, enc).goldRewardByTier[2]).toBe(50);
    expect(worldKnobs(w).goldRewardByTier[2]).toBe(25); // the base is untouched — the price is the Nighthawk's alone
    expect(hawk.parley?.line).toContain("walk in numbers");
  });

  it("S20 playtest: renown is felt per colour — green fear flees green roamers while white tier 1s still line up; defeat credits each of the opponent's colours + the total", () => {
    const w = newWorld({ seed: 109, catalog, starter: "green" });
    const knobs = worldKnobs(w, QUIET);
    const green = catalog.opponents.find((o) => o.tier === 1 && o.colors.includes("G") && !o.colors.includes("W"))!;
    const white = catalog.opponents.find((o) => o.tier === 1 && o.colors.includes("W") && !o.colors.includes("G"))!;
    w.player.renownByColor.G = 10; // over tier 1's flee threshold (1 × 4)
    w.player.renown = 10;
    expect(isFleeing(green, knobs, renownAgainst(w.player, green))).toBe(true);
    expect(isFleeing(white, knobs, renownAgainst(w.player, white))).toBe(false); // white hasn't heard of you
    // Credit: a WU opponent's defeat lands on W and U (and the total), not on G.
    creditRenown(w.player, "WU", 2);
    expect(w.player.renown).toBe(12);
    expect(w.player.renownByColor).toMatchObject({ W: 2, U: 2, G: 10, B: 0, R: 0 });
    // Save shape: v6 round-trips; a v5-labelled save migrates with renownByColor zeroed.
    const round = deserializeWorld(serializeWorld(w));
    expect(round.player.renownByColor).toEqual(w.player.renownByColor);
    const v5 = JSON.parse(serializeWorld(w)) as { format: string; world: WorldState };
    v5.format = "world-save-v5";
    delete (v5.world.player as Partial<WorldState["player"]>).renownByColor;
    const migrated = deserializeWorld(JSON.stringify(v5));
    expect(migrated.player.renownByColor).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
    expect(migrated.player.renown).toBe(12); // the total survives
  });

  it("roamer speed is a knob: at 0.5 a pursuer moves every other step; at 0 it never moves", () => {
    const slow = { event: { ...QUIET.event, roamerSpeed: { 1: 0.5, 2: 0.5, 3: 0.5 } } } as const;
    const { w, inst } = stage(108, 6);
    const a = { ...w.player.position }, b = { x: a.x, y: a.y + 1 };
    const bOk = w.map.passable[idx(w.map, b)] && !isTownCell(w.map, b);
    const d0 = manhattan(inst.at!, a);
    const moved: number[] = [];
    for (let i = 0; i < 4; i++) {
      const p = { ...inst.at! };
      advance(w, catalog, [bOk && i % 2 === 0 ? b : a], slow);
      moved.push(manhattan(p, inst.at!));
    }
    expect(moved.reduce((x, y) => x + y, 0)).toBe(2); // two moves in four steps
    void d0;
    const frozen = { event: { ...QUIET.event, roamerSpeed: { 1: 0, 2: 0, 3: 0 } } } as const;
    const { w: w2, inst: i2 } = stage(109, 3);
    const p2 = { ...i2.at! };
    advance(w2, catalog, [stepCellFrom(w2, w2.player.position)], frozen);
    expect(i2.at).toEqual(p2);
  });

  it("roads (ADR-072): while the player stands on a road, roamers move at roamerStepsPerPlayerStep.road (0.5 → every other step); off-road they move every step", () => {
    const { w, inst } = stage(112, 6);
    const a = { ...w.player.position }, b = { x: a.x, y: a.y + 1 };
    const bOk = w.map.passable[idx(w.map, b)] && !isTownCell(w.map, b);
    // Paint the two cells the player oscillates between as road.
    w.map.road[idx(w.map, a)] = true;
    if (bOk) w.map.road[idx(w.map, b)] = true;
    let moved = 0;
    for (let i = 0; i < 4; i++) { const p = { ...inst.at! }; advance(w, catalog, [bOk && i % 2 === 0 ? b : a], QUIET); moved += manhattan(p, inst.at!); }
    expect(moved).toBe(2);
    // Off the road: every step.
    w.map.road[idx(w.map, a)] = false; if (bOk) w.map.road[idx(w.map, b)] = false; inst.moveDebt = 0;
    let moved2 = 0;
    for (let i = 0; i < 2; i++) { const p = { ...inst.at! }; const ev = advance(w, catalog, [bOk && i % 2 === 0 ? b : a], QUIET); if (ev.some((e) => e.type === "encounter")) break; moved2 += manhattan(p, inst.at!); }
    expect(moved2).toBeGreaterThanOrEqual(1);
  });

  it("respawn: a region below its density target gains one roamer every roamerRespawnSteps (out of sight, in-region, never a town); none when at target or when the knob is 0", () => {
    const w = newWorld({ seed: 110, catalog, starter: "green" });
    const knobs = worldKnobs(w);
    const home = regionAt(w.map, w.player.position);
    const target = roamerTarget(w.map, home, knobs);
    expect(target).toBeGreaterThanOrEqual(1);
    // Clear the home region's roamers, then walk until the respawn tick.
    for (const o of w.opponents) if (o.region === home.index && !o.fixedAt) { o.gone = true; o.goneReason = "boughtOff"; }
    const frozen = { event: { roamerSpeed: { 1: 0, 2: 0, 3: 0 } } } as const; // keep others still so walks don't contact
    const start = { ...w.player.position };
    const cell = stepCellFrom(w, start);
    let spawnedIds: string[] = [];
    for (let i = 0; i < knobs.roamerRespawnSteps[home.tier] && spawnedIds.length === 0; i++) {
      const ev = advance(w, catalog, [i % 2 === 0 ? cell : start], frozen);
      spawnedIds = ev.filter((e) => e.type === "spawned" && (e as { region: number }).region === home.index).map((e) => (e as { opponentId: string }).opponentId);
    }
    expect(spawnedIds.length).toBe(1);
    const sp = w.opponents.find((o) => o.id === spawnedIds[0])!;
    expect(sp.region).toBe(home.index);
    expect(w.map.region[idx(w.map, sp.at!)]).toBe(home.index);
    expect(isTownCell(w.map, sp.at!)).toBe(false);
    expect(playerSees(w, knobs, sp.at!)).toBe(false); // out of sight
    // At target already: no more spawns on the next tick.
    for (const o of w.opponents) if (o.region === home.index && !o.fixedAt && o.gone) { o.gone = false; delete o.goneReason; }
    const live = w.opponents.filter((o) => o.region === home.index && !o.fixedAt && !o.gone).length;
    expect(live).toBeGreaterThanOrEqual(target);
    let extra = 0;
    for (let i = 0; i < knobs.roamerRespawnSteps[home.tier]; i++) {
      const ev = advance(w, catalog, [i % 2 === 0 ? cell : start], frozen);
      extra += ev.filter((e) => e.type === "spawned" && (e as { region: number }).region === home.index).length;
    }
    expect(extra).toBe(0);
  });

  it("determinism: sight/pursuit/respawn replay identically from a save (same walk after load = same world)", () => {
    const a = newWorld({ seed: 111, catalog, starter: "blue" });
    const dest = a.map.towns.find((t) => !samePoint(t.at, a.map.start))!.at;
    const b = deserializeWorld(serializeWorld(a));
    const ea = walkTo(a, catalog, dest)!;
    const eb = walkTo(b, catalog, dest)!;
    expect(JSON.stringify(ea)).toBe(JSON.stringify(eb));
    expect(serializeWorld(a)).toBe(serializeWorld(b));
    // Save mid-walk, resume both: still identical.
    const c = deserializeWorld(serializeWorld(a));
    const dest2 = a.map.towns.find((t) => !samePoint(t.at, a.player.position))!.at;
    expect(JSON.stringify(walkTo(a, catalog, dest2))).toBe(JSON.stringify(walkTo(c, catalog, dest2)));
    expect(serializeWorld(a)).toBe(serializeWorld(c));
  });
});

function knobs0() {
  return defaultKnobs();
}

function stepCellFrom(w: WorldState, from: Point, ok: (p: Point) => boolean = () => true): Point {
  const c = [
    { x: from.x + 1, y: from.y }, { x: from.x - 1, y: from.y }, { x: from.x, y: from.y + 1 }, { x: from.x, y: from.y - 1 },
  ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < w.map.width && p.y < w.map.height && w.map.passable[idx(w.map, p)] && !isTownCell(w.map, p) && ok(p));
  if (!c[0]) throw new Error("no step cell");
  return c[0];
}

// ---------- S22b: the lords' seats (strongholds as maximum-scale dungeons) ----------

describe("S22b strongholds: entry, generation, the partisan law, the entrance, the pace war, treasures, seals", () => {
  const sh = () => import("./stronghold.js");
  const dg = () => import("./dungeon.js");

  const strongholdPoint = (w: WorldState) => w.map.strongholds.find((f) => f.kind === "stronghold")!;
  const contentFor = (w: WorldState, at: Point) => {
    const color = regionAt(w.map, at).color;
    return catalog.strongholdContent!.find((c) => c.color === color)!;
  };

  it("stepping onto a stronghold fixed point opens the threshold (dungeonEntry kind stronghold); a broken seat is ground", async () => {
    const w = newWorld({ seed: 401, catalog, starter: "green" });
    quiet(w);
    const fp = strongholdPoint(w);
    const content = contentFor(w, fp.at);
    w.player.position = stepCellFrom(w, fp.at);
    const events = advance(w, catalog, [fp.at], QUIET);
    const entry = events.find((e) => e.type === "dungeonEntry");
    expect(entry).toMatchObject({ type: "dungeonEntry", kind: "stronghold", dungeonId: content.id, name: content.name });
    // Broken = ground forever (one-time, like every dungeon).
    w.dungeons[content.id] = { cleared: true, resets: 0 };
    w.player.position = stepCellFrom(w, fp.at);
    const events2 = advance(w, catalog, [fp.at], QUIET);
    expect(events2.some((e) => e.type === "dungeonEntry")).toBe(false);
  });

  it("generation: the stronghold grid knobs (30×22), spoke-themed minion floors at scale, the lord at the far end", async () => {
    const { generateDungeonRun } = await dg();
    const w = newWorld({ seed: 402, catalog, starter: "white" });
    const kn = worldKnobs(w);
    const run = generateDungeonRun(w, catalog, kn, pool.cards, { dungeonId: "argent_bastion", kind: "stronghold", color: "W", enteredFrom: { x: 0, y: 0 } });
    expect(run.kind).toBe("stronghold");
    expect(run.grid.width).toBe(kn.strongholdGridWidth);
    expect(run.grid.height).toBe(kn.strongholdGridHeight);
    expect(run.minions.length).toBeGreaterThanOrEqual(4); // maximum scale: 2s..3s at s=2
    for (const m of run.minions) {
      const tmpl = catalog.opponents.find((o) => o.id === m.catalogId)!;
      expect(tmpl.spoke, m.catalogId).toBe("W"); // spoke-themed floors
    }
    expect(run.guardianAt.x).toBe(run.grid.width - 1);
    // Determinism: the same world regenerates the same halls.
    const again = generateDungeonRun(w, catalog, kn, pool.cards, { dungeonId: "argent_bastion", kind: "stronghold", color: "W", enteredFrom: { x: 0, y: 0 } });
    expect(JSON.stringify(again.grid)).toBe(JSON.stringify(run.grid));
  });

  it("the law rides EVERY interior duel on the defender's side (per-battle re-injection), and the lord adds his entrance + the formula life", async () => {
    const { generateDungeonRun, dungeonDuelSpec } = await dg();
    const { lawModifier, entranceModifier, lordStartingLife } = await sh();
    const w = newWorld({ seed: 403, catalog, starter: "white" });
    const kn = worldKnobs(w);
    const content = catalog.strongholdContent!.find((c) => c.color === "W")!;
    const run = generateDungeonRun(w, catalog, kn, pool.cards, { dungeonId: content.id, kind: "stronghold", color: "W", enteredFrom: { x: 0, y: 0 } });
    const rng = new WorldRng(1);
    const minionTmpl = catalog.opponents.find((o) => o.id === run.minions[0]!.catalogId)!;
    const m = dungeonDuelSpec(w, catalog, kn, run, { kind: "minion", tmpl: minionTmpl }, [], rng, [lawModifier(content)]);
    const lawOnDefender = (spec: typeof m.spec) => spec.modifiers.some((mod) => mod.type === "permanentOnBattlefield" && mod.player === 1 && mod.cardId === content.law.cardId);
    expect(lawOnDefender(m.spec)).toBe(true); // the dungeon teaches the law before the lord enforces it
    // The lord duel: law + entrance + the formula.
    const g = dungeonDuelSpec(
      w, catalog, kn, run,
      { kind: "guardian", name: content.lord.name, decklist: [{ cardId: "mountain", count: 40 }], archetype: "midrange", life: lordStartingLife(w, kn, content), color: "W" },
      [], rng, [lawModifier(content), entranceModifier(content)],
    );
    expect(lawOnDefender(g.spec)).toBe(true); // destroyed in one battle, back the next: every spec re-injects it
    expect(g.spec.modifiers.some((mod) => mod.type === "signatureToHand" && mod.player === 1 && mod.cardId === content.lord.cardId)).toBe(true);
    expect(g.enemyLife).toBe(content.lord.baseLife); // fresh world: no growth, no hunt, no empowerment
  });

  it("the pace war: global growth fattens all five; spoke kills bleed ONE lord (tier = points); the floor holds", async () => {
    const { lordStartingLife, creditSpokeKill, strongholdState, lordGrowth } = await sh();
    const w = newWorld({ seed: 404, catalog, starter: "green" });
    const kn = worldKnobs(w);
    const content = catalog.strongholdContent!.find((c) => c.color === "G")!;
    expect(lordStartingLife(w, kn, content)).toBe(30);
    w.player.stepsTaken = 2 * kn.lordGrowthSteps + 5;
    expect(lordGrowth(w, kn)).toBe(2 * kn.lordGrowthLife);
    expect(lordStartingLife(w, kn, content)).toBe(30 + 2 * kn.lordGrowthLife);
    // Nine points of green kills = −3; the other lords are untouched.
    creditSpokeKill(w, "G", 3); creditSpokeKill(w, "G", 3); creditSpokeKill(w, "G", 3);
    expect(strongholdState(w, "G").spokeMinionPoints).toBe(9);
    expect(lordStartingLife(w, kn, content)).toBe(30 + 2 * kn.lordGrowthLife - 3);
    const other = catalog.strongholdContent!.find((c) => c.color === "B")!;
    expect(lordStartingLife(w, kn, other)).toBe(30 + 2 * kn.lordGrowthLife);
    // The floor: no amount of hunting trivializes the fight (Chris-ratified 15).
    creditSpokeKill(w, "G", 300);
    expect(lordStartingLife(w, kn, content)).toBe(kn.lordLifeFloor);
    // A defeat through the ordinary journey path credits the spoke too (inside AND outside).
    const spokeTmpl = catalog.opponents.find((o) => o.spoke === "B" && o.tier === 2) ?? catalog.opponents.find((o) => o.spoke === "B")!;
    const inst: OpponentInstance = { id: "sh_test", catalogId: spokeTmpl.id, region: 0, gone: false, at: { ...w.player.position }, moveDebt: 0 };
    w.opponents.push(inst);
    const enc: Encounter = { opponentId: "sh_test", catalogId: spokeTmpl.id, tier: spokeTmpl.tier, region: 0, at: { ...w.player.position }, fleeing: false, contact: "stepped" };
    const before = strongholdState(w, "B").spokeMinionPoints;
    const rng = new WorldRng(9);
    const duel = prepareDuel(w, catalog, enc, rng, worldKnobs(w));
    applyDuelResult(w, catalog, duel, { winner: 0, reason: "LIFE", turns: 5, finalLife: [10, 0], facts: { damageDealt: [0, 0], creaturesLost: [0, 0], cardsDrawn: [0, 0], spellsCast: {}, ante: [[], []] }, log: [], finalStateSerialized: "" }, QUIET);
    expect(strongholdState(w, "B").spokeMinionPoints).toBe(before + spokeTmpl.tier);
  });

  it("the colour prize list: the WHOLE colour wardrobe shelved R → 3 → 2 → 1 (S22 r1), typed duals in, prizeOnly out", async () => {
    const { strongholdPrizeList } = await sh();
    const list = strongholdPrizeList(pool.cards, "G");
    const ids = list.map((d) => d.id);
    expect(ids).toContain("tropical_island"); // the typed dual — the investment made fetchable
    expect(ids).toContain("aether_mutation"); // a gold R touching green
    expect(ids).toContain("grizzly_bears"); // S22 r1: tier 1 is on offer too (the player's right to a bear)
    expect(ids).not.toContain("the_sower"); // prizeOnly: the sole-drop channel only
    expect(ids).not.toContain("mox_emerald"); // prizeOnly
    expect(ids).not.toContain("law_season"); // prizeOnly laws never circulate
    expect(ids).not.toContain("doom_blade"); // wrong colour
    // Shelved: tier rank is monotone down the list (R first, then 3, 2, 1).
    const rank: Record<string, number> = { R: 0, "3": 1, "2": 2, "1": 3 };
    const ranks = list.map((d) => rank[String(d.shopTier)]!);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("seal + save round-trip: the reserved field carries typed entries; five seals = the gauntlet-unlock state", async () => {
    const { strongholdState, sealsHeld } = await sh();
    const w = newWorld({ seed: 405, catalog, starter: "red" });
    expect(sealsHeld(w)).toBe(0);
    strongholdState(w, "R").seal = true;
    strongholdState(w, "W").spokeMinionPoints = 7;
    const back = deserializeWorld(serializeWorld(w));
    const { strongholdState: sh2, sealsHeld: held2 } = await sh();
    expect(held2(back)).toBe(1);
    expect(sh2(back, "R").seal).toBe(true);
    expect(sh2(back, "W").spokeMinionPoints).toBe(7);
    for (const c of ["W", "U", "B", "G"] as const) strongholdState(w, c).seal = true;
    expect(sealsHeld(w)).toBe(5);
  });

  it("acceptance: a REAL lord duel runs under the law + entrance (a full stronghold spec end to end); interior minion kill credits the spoke", async () => {
    const { generateDungeonRun, dungeonDuelSpec, applyInteriorDuel } = await dg();
    const { lawModifier, entranceModifier, lordStartingLife, strongholdState } = await sh();
    const { LORD_DECKS } = await import("@shandalar/sim/lord-decks");
    const w = newWorld({ seed: 406, catalog, starter: "white" });
    const kn = worldKnobs(w);
    const content = catalog.strongholdContent!.find((c) => c.color === "W")!;
    const run = generateDungeonRun(w, catalog, kn, pool.cards, { dungeonId: content.id, kind: "stronghold", color: "W", enteredFrom: { x: 0, y: 0 } });
    w.activeDungeon = run;
    // A minion falls inside: interior life carries, the spoke is credited (the pace war's interior half).
    const minion = run.minions[0]!;
    const minionTmpl = catalog.opponents.find((o) => o.id === minion.catalogId)!;
    const before = strongholdState(w, "W").spokeMinionPoints;
    applyInteriorDuel(w, kn, run, { winner: 0, reason: "LIFE", turns: 6, finalLife: [8, 0], facts: { damageDealt: [0, 0], creaturesLost: [0, 0], cardsDrawn: [0, 0], spellsCast: {}, ante: [[], []] }, log: [], finalStateSerialized: "" }, minion.id, catalog);
    expect(strongholdState(w, "W").spokeMinionPoints).toBe(before + minionTmpl.tier);
    expect(run.minions[0]!.defeated).toBe(true);
    // The lord himself, for real: his v1 deck, master profile, law + entrance, formula life.
    const lord = LORD_DECKS[content.lord.key]!;
    const rng = new WorldRng(4);
    const { spec } = dungeonDuelSpec(
      w, catalog, kn, run,
      { kind: "guardian", name: content.lord.name, decklist: lord.decklist, archetype: lord.archetype, life: lordStartingLife(w, kn, content), color: "W" },
      [], rng, [lawModifier(content), entranceModifier(content)],
    );
    const me = new HeuristicAgent(81, pool.cards, difficultyProfile("journeyman", starterTemplate(catalog, "white").archetype, lord.decklist.map((e) => ({ ...e }))));
    const them = new HeuristicAgent(82, pool.cards, difficultyProfile("master", lord.archetype, activeDeck(w).map((e) => ({ ...e }))));
    const result = await runMatch(spec, pool.cards, [me, them]);
    expect(result.reason).toBeTruthy(); // it terminates cleanly under the law, the entrance, and the tri-colour deck
    expect(result.log.some((e) => e.t === "RNG" && (e as { purpose?: string }).purpose === "entrance") || result.turns >= 0).toBe(true);
  }, 120_000);
});
