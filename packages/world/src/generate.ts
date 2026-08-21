import type { Catalog, RegionTemplate } from "./catalog.js";
import { findPath, idx, inBounds, manhattan, reachable, type FixedPoint, type Point, type RegionInstance, type Town, type WorldMap } from "./map.js";
import { WorldRng } from "./rng.js";

/**
 * Seeded world generator (manifest §6; brief Part 2). Authored catalog in,
 * `(catalogVersion, seed)` → the same world every time. Shape: Voronoi
 * regions (L1 distance → connected), 2–3 civilized hearts + sparse approach
 * and wild hearts, rough terrain sprinkled then carved so every town is
 * reachable from the start, towns placed as fixed points with spacing, and a
 * fixed-point API that strongholds (M6b+) will use — present, unused.
 */

export interface GeneratorOptions {
  width: number;
  height: number;
  /** Fraction of cells that start impassable (rough terrain); carving restores connectivity. */
  roughness: number;
  civilizedRegions: number; // 2–3
  approachRegions: number;
  wildRegions: number;
  towns: number; // ≥2
  townSpacing: number; // min Manhattan distance between towns
  /** Opponent roster size per region. */
  rosterPerRegion: number;
}

export const DEFAULT_GENERATOR: GeneratorOptions = {
  width: 40,
  height: 28,
  roughness: 0.1,
  civilizedRegions: 3,
  approachRegions: 2,
  wildRegions: 1,
  towns: 4,
  townSpacing: 7,
  rosterPerRegion: 4,
};

export interface OpponentInstance {
  id: string;
  catalogId: string;
  region: number;
  defeated: boolean;
  /** Resident of a fixed point (lair): never in the roaming roster; met only there. */
  fixedAt?: Point;
}

export interface GeneratedWorld {
  map: WorldMap;
  opponents: OpponentInstance[];
}

/** Encounter tables by region tier: which enemy tiers show up, weighted. */
export const TIER_TABLES: Record<string, (1 | 2 | 3)[]> = {
  civilized: [1, 1, 1, 2],
  approach: [2, 2, 3, 1],
  wild: [3, 3, 2],
};

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

export function generateWorld(seed: number, catalog: Catalog, opts: GeneratorOptions = DEFAULT_GENERATOR): GeneratedWorld {
  const rng = new WorldRng(seed ^ 0x9e3779b9);
  const { width, height } = opts;
  const cells = width * height;

  // 1. Region hearts: pick templates per tier (reuse if the catalog has fewer
  //    than requested), then spread hearts with spacing.
  const byTier = (t: RegionTemplate["tier"]) => catalog.regions.filter((r) => r.tier === t);
  const pickTemplates = (t: RegionTemplate["tier"], n: number): RegionTemplate[] => {
    const pool = byTier(t);
    if (pool.length === 0) return [];
    const shuffled = rng.shuffle(pool);
    return Array.from({ length: n }, (_, i) => shuffled[i % shuffled.length]!);
  };
  const templates = [
    ...pickTemplates("civilized", opts.civilizedRegions),
    ...pickTemplates("approach", opts.approachRegions),
    ...pickTemplates("wild", opts.wildRegions),
  ];
  const allCells: Point[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) allCells.push({ x, y });
  const spacing = Math.floor(Math.min(width, height) / 3);
  let hearts = placeFixedPoints(rng, allCells, templates.length, spacing);
  // Spacing too strict for the template count? Relax deterministically.
  let relax = spacing;
  while (hearts.length < templates.length && relax > 1) {
    relax -= 1;
    hearts = placeFixedPoints(rng, allCells, templates.length, relax);
  }
  const regions: RegionInstance[] = templates.map((t, i) => ({
    index: i,
    templateId: t.id,
    name: t.name,
    tier: t.tier,
    color: t.color,
    heart: hearts[i]!,
  }));

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

  // 3. Rough terrain, then towns on passable civilized cells, then carving.
  const passable = new Array<boolean>(cells).fill(true);
  for (let i = 0; i < cells; i++) if (rng.chance(opts.roughness)) passable[i] = false;
  const map: WorldMap = { width, height, region, passable, regions, towns: [], strongholds: [], start: { x: 0, y: 0 } };
  const civilizedCells = allCells.filter((p) => regions[region[idx(map, p)]!]!.tier === "civilized" && passable[idx(map, p)]);
  const anyCivilized = civilizedCells.length > 0 ? civilizedCells : allCells;
  const townPts = placeFixedPoints(rng, anyCivilized, opts.towns, opts.townSpacing);
  // Guarantee ≥2 towns even on cramped maps: relax spacing.
  let ts = opts.townSpacing;
  while (townPts.length < Math.min(2, opts.towns) && ts > 1) {
    ts -= 1;
    townPts.splice(0, townPts.length, ...placeFixedPoints(rng, anyCivilized, opts.towns, ts));
  }
  const usedNames = new Set<string>();
  const nameFor = (r: RegionInstance): string => {
    const tmpl = catalog.regions.find((t) => t.id === r.templateId);
    const pref = (tmpl?.townNames ?? []).filter((n) => !usedNames.has(n));
    const pool = pref.length ? pref : catalog.townNames.filter((n) => !usedNames.has(n));
    const name = pool.length ? rng.pick(pool) : `Town ${usedNames.size + 1}`;
    usedNames.add(name);
    return name;
  };
  const towns: Town[] = townPts.map((at, i) => {
    passable[idx(map, at)] = true;
    const r = regions[region[idx(map, at)]!]!;
    return { index: i, name: nameFor(r), region: r.index, at };
  });
  map.towns = towns;
  map.start = towns[0]!.at;

  // Carve: every town reachable from the start, every region has a reachable
  // passable cell. Carving = clear the impassables along an ignore-terrain BFS path.
  const carveTo = (target: Point) => {
    if (findPath(map, map.start, target)) return;
    const p = findPath(map, map.start, target, (q) => inBounds(map, q));
    if (!p) return;
    for (const c of p) passable[idx(map, c)] = true;
  };
  for (const t of towns) carveTo(t.at);
  for (const r of regions) {
    const reach = reachable(map, map.start);
    const hasReachable = allCells.some((p) => region[idx(map, p)] === r.index && reach.has(idx(map, p)));
    if (!hasReachable) {
      passable[idx(map, r.heart)] = true;
      carveTo(r.heart);
    }
  }
  // 4. Opponent rosters per region from the catalog by tier table.
  const opponents: OpponentInstance[] = [];
  let n = 0;
  // S14 round 1 prototype: ONE lair — a fixed point in the wildest region with
  // a resident (the catalog's first beast, else its highest-tier opponent),
  // spaced from towns, carved reachable. Strongholds/dungeons reuse this shape.
  const lairHost = catalog.opponents.find((o) => o.kind === "beast") ?? [...catalog.opponents].sort((a, b) => b.tier - a.tier)[0];
  const wildest = [...regions].sort((a, b) => ["civilized", "approach", "wild"].indexOf(b.tier) - ["civilized", "approach", "wild"].indexOf(a.tier))[0];
  const fixed: FixedPoint[] = [];
  if (lairHost && wildest) {
    const candidates = allCells.filter((p) => region[idx(map, p)] === wildest.index && passable[idx(map, p)] && !towns.some((t) => t.at.x === p.x && t.at.y === p.y));
    const [at] = placeFixedPoints(rng, candidates, 1, opts.townSpacing, townPts);
    if (at) {
      passable[idx(map, at)] = true;
      carveTo(at);
      const inst: OpponentInstance = { id: `opp_lair_${n++}`, catalogId: lairHost.id, region: wildest.index, defeated: false, fixedAt: at };
      opponents.push(inst);
      fixed.push({ kind: "lair", at, region: wildest.index, name: `Lair of ${lairHost.name}`, opponentId: inst.id });
    }
  }
  map.strongholds = fixed;
  for (const r of regions) {
    const table = TIER_TABLES[r.tier] ?? [1];
    for (let i = 0; i < opts.rosterPerRegion; i++) {
      const tier = rng.pick(table);
      const pool = catalog.opponents.filter((o) => o.tier === tier);
      const fallback = pool.length ? pool : catalog.opponents;
      const tmpl = rng.pick(fallback);
      opponents.push({ id: `opp_${n++}`, catalogId: tmpl.id, region: r.index, defeated: false });
    }
  }

  return { map, opponents };
}
