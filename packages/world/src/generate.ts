import type { Catalog, Color, RegionTemplate } from "./catalog.js";
import { defaultKnobs, type KnobValues, type RegionTier } from "./knobs.js";
import { exploredNone, findPath, idx, inBounds, manhattan, markExplored, reachable, samePoint, type FixedPoint, type Point, type RegionInstance, type Town, type WorldMap } from "./map.js";
import { WorldRng } from "./rng.js";

/**
 * Seeded world generator (manifest §6). Authored catalog in, `(catalogVersion,
 * seed)` → the same world every time.
 *
 * S16 (ADR-072) — **the radial world**: five colour spokes (seed-rotated,
 * colour order shuffled, each angle jittered) × three rings (civilized /
 * approach / wild at `ringRadii`, jittered) from an elliptically-normalised
 * centre give 15 region hearts (colour × tier) to the existing L1-Voronoi,
 * so borders wobble organically while the radial structure holds. Each
 * colour's **stronghold** is a fixed point at `strongholdRadius` on its spoke
 * (present, unused until S19+). Towns per region by ring-tiered density
 * (every non-wild region ≥1; civilized names are hub-outward — the first is
 * the colour's home-start town). **Roads** are shortest passable paths over a
 * minimum spanning tree of the towns plus the civilized hub cycle. Lairs per
 * region by knob (the S14 pattern; beasts round-robin). Roamers are spawned
 * in-region by density (ADR-071).
 */

export interface GeneratorOptions {
  /** Base grid; multiplied by the mapScale knob. */
  width: number;
  height: number;
  /** Fraction of cells that start impassable (rough terrain); carving restores connectivity. */
  roughness: number;
}

export const DEFAULT_GENERATOR: GeneratorOptions = { width: 40, height: 28, roughness: 0.1 };

export type GoneReason = "defeated" | "boughtOff" | "fled" | "draw" | "lost";

export interface OpponentInstance {
  id: string;
  catalogId: string;
  region: number;
  /** S16: off the map for good — any parley outcome removes a roamer (Chris's ruling; lair residents only when defeated). */
  gone: boolean;
  goneReason?: GoneReason;
  /** Resident of a fixed point (lair): never roams; met only there. */
  fixedAt?: Point;
  /** S16 roamer position (absent for lair residents). */
  at?: Point;
  /** S16: fractional movement accumulator (roamerSpeed < 1 moves every other step, etc.). */
  moveDebt: number;
}

export interface GeneratedWorld {
  map: WorldMap;
  opponents: OpponentInstance[];
  /** S16 (ADR-072): packed explored bits — the home region + the start's sight (fog reserved, not rendered). */
  explored: number[];
}

/** Encounter tables by region tier: which enemy tiers show up, weighted. */
export const TIER_TABLES: Record<string, (1 | 2 | 3)[]> = {
  civilized: [1, 1, 1, 2],
  approach: [2, 2, 3, 1],
  wild: [3, 3, 2],
};

export const SPOKE_COLORS: Exclude<Color, "C">[] = ["W", "U", "B", "R", "G"];
const TIERS: RegionTier[] = ["civilized", "approach", "wild"];

/** Fixed-point placement with spacing (towns now; strongholds later). */
export function placeFixedPoints(
  rng: WorldRng,
  candidates: Point[],
  count: number,
  minSpacing: number,
  existing: Point[] = [],
): Point[] {
  const placed: Point[] = [];
  const pool = rng.shuffle(candidates);
  for (const c of pool) {
    if (placed.length >= count) break;
    if ([...existing, ...placed].every((p) => manhattan(p, c) >= minSpacing)) placed.push(c);
  }
  return placed;
}

export interface GenerateExtra {
  /** Resolved knobs (mapScale, rings, densities…). Defaults when absent. */
  knobs?: KnobValues;
  /** The starter's colour: the start town is this colour's first civilized town (ADR-072 home start). */
  homeColor?: Color;
}

/** Passable (by default) cells of a region. */
export function regionCells(map: WorldMap, region: number, passableOnly = true): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      if (map.region[i] !== region) continue;
      if (passableOnly && !map.passable[i]) continue;
      out.push({ x, y });
    }
  }
  return out;
}

export function isTownCell(map: WorldMap, p: Point): boolean {
  return map.towns.some((t) => t.at.x === p.x && t.at.y === p.y) || map.strongholds.some((f) => f.at.x === p.x && f.at.y === p.y);
}

/** Target roamer count for a region (density × area, min 1). */
export function roamerTarget(map: WorldMap, region: RegionInstance, knobs: KnobValues): number {
  const area = regionCells(map, region.index).length;
  return Math.max(1, Math.round((knobs.roamerDensityPer100Cells[region.tier] * area) / 100));
}

/** Mage roll: a region's tier table (TIER_TABLES) over the mage roster (any colour roams anywhere). */
export function rollMage(rng: WorldRng, catalog: Catalog, tier: RegionInstance["tier"], forceTier?: 1 | 2 | 3): Catalog["opponents"][number] {
  const table = TIER_TABLES[tier] ?? [1];
  const t = forceTier ?? rng.pick(table);
  // Spoke-bound signature opponents (beasts, the Tactician) never roll here — they come from rollBeast.
  const pool = catalog.opponents.filter((o) => o.tier === t && o.kind !== "beast" && !o.spoke);
  const fallback = pool.length ? pool : catalog.opponents.filter((o) => o.kind !== "beast" && !o.spoke);
  return rng.pick(fallback.length ? fallback : catalog.opponents);
}

/** S18 signature roll: the region's spoke-bound opponents (beasts + mage-voiced signatures like the
 * Tactician — anything with `spoke`) by the ring's tier blend (knob). Returns null when the spoke has
 * none (the caller spawns a mage). A rolled tier the spoke lacks falls to the nearest tier. */
export function rollBeast(rng: WorldRng, catalog: Catalog, region: { tier: RegionInstance["tier"]; color: string }, knobs: KnobValues): Catalog["opponents"][number] | null {
  const spokeBeasts = catalog.opponents.filter((o) => o.spoke === region.color);
  if (spokeBeasts.length === 0) return null;
  const weights = knobs.beastTierBlend[region.tier] ?? [1, 1, 1];
  const total = weights[0] + weights[1] + weights[2];
  let roll = rng.float() * total;
  let want: 1 | 2 | 3 = 1;
  for (const t of [1, 2, 3] as const) { roll -= weights[t - 1]!; if (roll < 0) { want = t; break; } want = t; }
  const exact = spokeBeasts.filter((o) => o.tier === want);
  if (exact.length) return rng.pick(exact);
  // The spoke lacks the rolled tier: by knob, spawn a mage of that tier instead (default — ring difficulty holds)
  // or the spoke's nearest-tier beast.
  if (knobs.beastTierFallback === "mage") return rollMage(rng, catalog, region.tier, want);
  // Nearest tier; ties break DOWNWARD in civilized rings (a green civilized ring that rolls tier 2 gets a
  // Bear, not the Wurm) and UPWARD elsewhere (a green wild ring that rolls tier 2 gets the Wurm).
  const up = region.tier !== "civilized";
  const dist = (o: { tier: number }) => Math.abs(o.tier - want) - ((up ? o.tier > want : o.tier < want) ? 0.5 : 0);
  const nearest = spokeBeasts.reduce((best, o) => (dist(o) < dist(best) ? o : best), spokeBeasts[0]!);
  return rng.pick(spokeBeasts.filter((o) => o.tier === nearest.tier));
}

/** S18 spawn table: beast (spoke-bound, tier blend by ring) with probability beastShare[tier], else a mage.
 * One template per roamer (generation and respawn share this). */
export function rollTemplate(rng: WorldRng, catalog: Catalog, region: { tier: RegionInstance["tier"]; color: string }, knobs: KnobValues): Catalog["opponents"][number] {
  const share = knobs.beastShare[region.tier] ?? 0;
  if (share > 0 && rng.chance(share)) {
    const beast = rollBeast(rng, catalog, region, knobs);
    if (beast) return beast;
  }
  return rollMage(rng, catalog, region.tier);
}

/** Give every position-less roamer a seeded in-region cell (new worlds and
 * the v2→v3 migration). Never a town/fixed cell; reachable cells preferred. */
export function spawnRoamers(map: WorldMap, opponents: OpponentInstance[], rng: WorldRng): void {
  const reach = reachable(map, map.start);
  for (const o of opponents) {
    if (o.fixedAt || o.gone || o.at) continue;
    const cells = regionCells(map, o.region).filter((p) => !isTownCell(map, p));
    const good = cells.filter((p) => reach.has(idx(map, p)));
    const pool = good.length ? good : cells;
    if (pool.length === 0) {
      o.at = { ...map.regions[o.region]!.heart };
      continue;
    }
    o.at = { ...rng.pick(pool) };
  }
}

/** BFS distance field over passable cells (−1 = unreachable). */
function distanceField(map: WorldMap, from: Point): Int32Array {
  const d = new Int32Array(map.width * map.height).fill(-1);
  const q: number[] = [idx(map, from)];
  d[idx(map, from)] = 0;
  let head = 0;
  while (head < q.length) {
    const i = q[head++]!;
    const x = i % map.width, y = Math.floor(i / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const j = ny * map.width + nx;
      if (d[j] !== -1 || !map.passable[j]) continue;
      d[j] = d[i]! + 1;
      q.push(j);
    }
  }
  return d;
}

/** Roads (ADR-072): shortest passable paths along a minimum spanning tree of
 * all towns (by path length) plus the civilized hub cycle (home town → next
 * spoke's home town). Flags cells on `map.road`. */
export function buildRoads(map: WorldMap, homeTowns: Town[]): void {
  const towns = map.towns;
  if (towns.length < 2) return;
  const fields = towns.map((t) => distanceField(map, t.at));
  const dist = (a: number, b: number) => fields[a]![idx(map, towns[b]!.at)] ?? -1;
  // Prim's MST.
  const inTree = new Set<number>([0]);
  const edges: [number, number][] = [];
  while (inTree.size < towns.length) {
    let best: [number, number, number] | null = null;
    for (const a of inTree) {
      for (let b = 0; b < towns.length; b++) {
        if (inTree.has(b)) continue;
        const d = dist(a, b);
        if (d < 0) continue;
        if (!best || d < best[2]) best = [a, b, d];
      }
    }
    if (!best) break; // disconnected towns (carving should prevent this)
    inTree.add(best[1]);
    edges.push([best[0], best[1]]);
  }
  // Hub cycle: civilized home towns in spoke order.
  for (let i = 0; i < homeTowns.length; i++) {
    const a = towns.indexOf(homeTowns[i]!), b = towns.indexOf(homeTowns[(i + 1) % homeTowns.length]!);
    if (a >= 0 && b >= 0 && a !== b) edges.push([a, b]);
  }
  for (const [a, b] of edges) {
    const path = findPath(map, towns[a]!.at, towns[b]!.at);
    if (!path) continue;
    map.road[idx(map, towns[a]!.at)] = true;
    for (const c of path) map.road[idx(map, c)] = true;
  }
}

export function generateWorld(seed: number, catalog: Catalog, opts: GeneratorOptions = DEFAULT_GENERATOR, extra: GenerateExtra = {}): GeneratedWorld {
  const rng = new WorldRng(seed ^ 0x9e3779b9);
  const knobs = extra.knobs ?? defaultKnobs();
  const scale = Math.max(1, knobs.mapScale);
  const width = Math.round(opts.width * scale);
  const height = Math.round(opts.height * scale);
  const cells = width * height;
  const centre: Point = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const jitter = (amp: number) => (rng.float() * 2 - 1) * amp;
  const clampPt = (p: Point): Point => ({ x: Math.max(1, Math.min(width - 2, Math.round(p.x))), y: Math.max(1, Math.min(height - 2, Math.round(p.y))) });
  const polar = (thetaDeg: number, r: number): Point => {
    const th = (thetaDeg * Math.PI) / 180;
    return clampPt({ x: centre.x + Math.cos(th) * r * (width / 2 - 1), y: centre.y + Math.sin(th) * r * (height / 2 - 1) });
  };

  // 1. Spokes (colour order shuffled, pentagram rotated, each angle jittered) × rings → 15 hearts + 5 stronghold points.
  // S20 (ADR-079, lore canon): the ring order is WBRUG — adjacency is invariant; seed-jittered
  // ROTATION and REFLECTION keep worldgen variety without breaking which colours neighbour which.
  const base: Exclude<Color, "C">[] = ["W", "B", "R", "U", "G"];
  const rot = rng.int(5);
  const flip = rng.float() < 0.5;
  const rotated = [...base.slice(rot), ...base.slice(0, rot)];
  const colours = flip ? [rotated[0]!, ...rotated.slice(1).reverse()] : rotated;
  const theta0 = rng.float() * 360;
  const spokeAngle: number[] = colours.map((_, i) => theta0 + i * 72 + jitter(knobs.spokeJitterDeg));
  const pickTemplate = (color: Color, tier: RegionTier): RegionTemplate => {
    const pool = catalog.regions.filter((r) => r.color === color && r.tier === tier);
    if (pool.length === 0) throw new Error(`catalog has no ${tier} region of colour ${color} (ADR-072)`);
    return rng.pick(pool);
  };
  const regions: RegionInstance[] = [];
  const strongholdPts: { at: Point; color: Exclude<Color, "C">; spoke: number }[] = [];
  colours.forEach((color, i) => {
    TIERS.forEach((tier) => {
      const tmpl = pickTemplate(color, tier);
      const r = Math.max(0.02, knobs.ringRadii[tier] + jitter(knobs.ringJitter));
      regions.push({ index: regions.length, templateId: tmpl.id, name: tmpl.name, tier, color, heart: polar(spokeAngle[i]! + jitter(4), r), spoke: i });
    });
    strongholdPts.push({ at: polar(spokeAngle[i]!, knobs.strongholdRadius), color, spoke: i });
  });

  // 2. Voronoi (L1, jittered by a small per-heart weight so borders wobble).
  const weights = regions.map(() => rng.int(3));
  const region = new Array<number>(cells);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let best = 0;
      let bestD = Infinity;
      for (const r of regions) {
        const d = manhattan({ x, y }, r.heart) + weights[r.index]!;
        if (d < bestD) {
          bestD = d;
          best = r.index;
        }
      }
      region[y * width + x] = best;
    }
  }

  // 3. Rough terrain, then towns per region (density by tier; ≥1 in every non-wild region).
  const passable = new Array<boolean>(cells).fill(true);
  for (let i = 0; i < cells; i++) if (rng.chance(opts.roughness)) passable[i] = false;
  const map: WorldMap = { width, height, region, passable, road: new Array<boolean>(cells).fill(false), regions, towns: [], strongholds: [], start: { ...centre }, centre };
  const townSpacing = knobs.townSpacingMin;
  const townPts: { at: Point; region: RegionInstance }[] = [];
  for (const r of regions) {
    const cand = regionCells(map, r.index).filter((p) => manhattan(p, centre) > 1);
    const area = cand.length;
    const want = r.tier === "wild" ? Math.round((knobs.townsPer100Cells.wild * area) / 100) : Math.max(1, Math.round((knobs.townsPer100Cells[r.tier] * area) / 100));
    if (want <= 0) continue;
    let ts = townSpacing;
    let pts = placeFixedPoints(rng, cand, want, ts, townPts.map((t) => t.at));
    while (pts.length < Math.min(1, want) && ts > 1) {
      ts -= 1;
      pts = placeFixedPoints(rng, cand, want, ts, townPts.map((t) => t.at));
    }
    // Hub-outward: name towns nearest the centre first (the first civilized name is the home-start town).
    pts.sort((a, b) => manhattan(a, centre) - manhattan(b, centre));
    for (const at of pts) townPts.push({ at, region: r });
  }
  const usedNames = new Set<string>();
  const nextName = (r: RegionInstance): string => {
    const tmpl = catalog.regions.find((t) => t.id === r.templateId);
    const pref = (tmpl?.townNames ?? []).filter((n) => !usedNames.has(n));
    const name = pref[0] ?? catalog.townNames.filter((n) => !usedNames.has(n))[0] ?? `Town ${usedNames.size + 1}`;
    usedNames.add(name);
    return name;
  };
  const towns: Town[] = townPts.map((t, i) => {
    passable[idx(map, t.at)] = true;
    return { index: i, name: nextName(t.region), region: t.region.index, at: t.at };
  });
  map.towns = towns;
  // Home towns: each colour's first (nearest-the-centre) civilized town; start = the home colour's.
  const homeTowns: Town[] = colours.map((c) => towns.find((t) => regions[t.region]!.color === c && regions[t.region]!.tier === "civilized")!).filter(Boolean);
  const homeTown = homeTowns.find((t) => regions[t.region]!.color === extra.homeColor) ?? homeTowns[0] ?? towns[0]!;
  map.start = { ...homeTown.at };

  // 4. Strongholds (ADR-072): the nearest passable non-town cell to each spoke point; carved reachable.
  const fixed: FixedPoint[] = [];
  for (const sp of strongholdPts) {
    const tmpl = catalog.strongholds.find((s) => s.color === sp.color);
    let at = sp.at;
    if (isTownCell(map, at) || !passable[idx(map, at)]) {
      let best: Point | null = null;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const p = { x, y };
        if (!passable[idx(map, p)] || isTownCell(map, p) || towns.some((t) => manhattan(t.at, p) < 2)) continue;
        if (!best || manhattan(p, sp.at) < manhattan(best, sp.at)) best = p;
      }
      at = best ?? sp.at;
      passable[idx(map, at)] = true;
    }
    fixed.push({ kind: "stronghold", at, region: region[idx(map, at)]!, name: tmpl?.name ?? `Stronghold of ${sp.color}` });
  }
  map.strongholds = fixed;

  // Carve: every town/stronghold reachable from the start, every region has a reachable cell.
  const carveTo = (target: Point) => {
    if (findPath(map, map.start, target)) return;
    const p = findPath(map, map.start, target, (q) => inBounds(map, q));
    if (!p) return;
    for (const c of p) passable[idx(map, c)] = true;
  };
  for (const t of towns) carveTo(t.at);
  for (const f of fixed) carveTo(f.at);
  for (const r of regions) {
    const reach = reachable(map, map.start);
    let hasReachable = false;
    for (let i = 0; i < cells && !hasReachable; i++) if (region[i] === r.index && reach.has(i)) hasReachable = true;
    if (!hasReachable) {
      passable[idx(map, r.heart)] = true;
      carveTo(r.heart);
    }
  }

  // 5. Lairs per region by knob (S14 pattern). S18: the resident is the region's spoke's top-tier beast
  // (the Serra Angel in the white wild ring, the Pelakka Wurm in the green …); a spoke without beasts
  // round-robins the whole bestiary (pre-S18 behaviour), and no beasts at all falls back to the top mage.
  const opponents: OpponentInstance[] = [];
  let n = 0;
  const beasts = catalog.opponents.filter((o) => o.kind === "beast");
  const lairHosts = beasts.length ? beasts : [[...catalog.opponents].sort((a, b) => b.tier - a.tier)[0]!];
  let lairN = 0;
  for (const r of regions) {
    const want = knobs.lairsPerRegion[r.tier];
    if (want <= 0) continue;
    const candidates = regionCells(map, r.index).filter((p) => !isTownCell(map, p));
    const pts = placeFixedPoints(rng, candidates, want, townSpacing, [...towns.map((t) => t.at), ...map.strongholds.map((f) => f.at)]);
    const spokeBeasts = beasts.filter((o) => o.spoke === r.color);
    const topTier = Math.max(0, ...spokeBeasts.map((o) => o.tier));
    const spokeHosts = spokeBeasts.filter((o) => o.tier === topTier);
    for (const at of pts) {
      const host = spokeHosts.length ? rng.pick(spokeHosts) : lairHosts[lairN++ % lairHosts.length]!;
      passable[idx(map, at)] = true;
      carveTo(at);
      const inst: OpponentInstance = { id: `opp_lair_${n++}`, catalogId: host.id, region: r.index, gone: false, fixedAt: at, moveDebt: 0 };
      opponents.push(inst);
      map.strongholds.push({ kind: "lair", at, region: r.index, name: `Lair of ${host.name}`, opponentId: inst.id });
    }
  }

  // 5b. S20 (ADR-079): one MOX DUNGEON site per wild region — a sealed fixed point until entered;
  // the dungeon interior generates on entry (dungeon.ts). Named from the catalog's dungeons file.
  for (const r of regions) {
    if (r.tier !== "wild") continue;
    const dungeon = catalog.dungeons.find((d) => d.color === r.color);
    if (!dungeon) continue;
    const candidates = regionCells(map, r.index).filter((p) => !isTownCell(map, p));
    const pts = placeFixedPoints(rng, candidates, 1, townSpacing, [...towns.map((t) => t.at), ...map.strongholds.map((f) => f.at)]);
    for (const at of pts) {
      passable[idx(map, at)] = true;
      carveTo(at);
      map.strongholds.push({ kind: "dungeon", at, region: r.index, name: dungeon.name });
    }
  }

  // 6. Roads (after carving: the paths exist).
  buildRoads(map, homeTowns);

  // 7. Roamers: per-region count by density, each with a seeded in-region position.
  for (const r of regions) {
    const count = roamerTarget(map, r, knobs);
    for (let i = 0; i < count; i++) {
      const tmpl = rollTemplate(rng, catalog, r, knobs);
      opponents.push({ id: `opp_${n++}`, catalogId: tmpl.id, region: r.index, gone: false, moveDebt: 0 });
    }
  }
  spawnRoamers(map, opponents, rng);

  // 8. Explored (ADR-072 reserved): the home region + the start's sight radius.
  const explored = exploredNone(map);
  const homeRegion = homeTown.region;
  for (let i = 0; i < cells; i++) if (region[i] === homeRegion) markExplored(explored, map, { x: i % width, y: Math.floor(i / width) });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (manhattan({ x, y }, map.start) <= knobs.sightRadius) markExplored(explored, map, { x, y });
  void samePoint;

  return { map, opponents, explored };
}
