import type { Catalog, Color, RegionTemplate } from "./catalog.js";
import { defaultKnobs, type KnobValues } from "./knobs.js";
import { findPath, idx, inBounds, manhattan, reachable, type FixedPoint, type Point, type RegionInstance, type Town, type WorldMap } from "./map.js";
import { WorldRng } from "./rng.js";

/**
 * Seeded world generator (manifest §6; brief Part 2). Authored catalog in,
 * `(catalogVersion, seed)` → the same world every time. Shape: Voronoi
 * regions (L1 distance → connected), rough terrain sprinkled then carved so
 * every town is reachable from the start, towns placed as fixed points with
 * spacing, and a fixed-point API that strongholds (M6b+) will use.
 *
 * S16 (ADR-071): the grid scales by the `mapScale` knob; towns are per
 * region by density (every non-wild region ≥1 — "uniform towns"); the start
 * is the home colour's town; opponents are ROAMERS with positions spawned
 * in-region by density (encounter rolls are gone); the home region's roster
 * uses the civilized tier table (S16 interim ruling, Q4 — until the radial
 * generator gives every colour a civilized region).
 */

export interface GeneratorOptions {
  /** Base grid; multiplied by the mapScale knob. */
  width: number;
  height: number;
  /** Fraction of cells that start impassable (rough terrain); carving restores connectivity. */
  roughness: number;
  civilizedRegions: number; // 2–3
  approachRegions: number;
  wildRegions: number;
  /** Legacy (pre-S16) total-town count; used only when knobs are absent. */
  towns: number;
  townSpacing: number;
  /** Legacy roster size per region; used only when knobs are absent (world-save-v1/v2 shape). */
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

export interface GenerateExtra {
  /** Resolved knobs (mapScale, town/roamer densities…). Defaults when absent. */
  knobs?: KnobValues;
  /** The starter's colour: the start town is in this colour's region (S16 home-region start). */
  homeColor?: Color;
}

/** Passable, non-town, non-fixed cells of a region (spawn / town candidates). */
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

/** Pick a catalog template for a region by its tier table. */
export function rollTemplate(rng: WorldRng, catalog: Catalog, tier: RegionInstance["tier"]): Catalog["opponents"][number] {
  const table = TIER_TABLES[tier] ?? [1];
  const t = rng.pick(table);
  const pool = catalog.opponents.filter((o) => o.tier === t && o.kind !== "beast");
  const fallback = pool.length ? pool : catalog.opponents.filter((o) => o.kind !== "beast");
  return rng.pick(fallback.length ? fallback : catalog.opponents);
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

export function generateWorld(seed: number, catalog: Catalog, opts: GeneratorOptions = DEFAULT_GENERATOR, extra: GenerateExtra = {}): GeneratedWorld {
  const rng = new WorldRng(seed ^ 0x9e3779b9);
  const knobs = extra.knobs ?? defaultKnobs();
  const scale = Math.max(1, knobs.mapScale);
  const width = Math.round(opts.width * scale);
  const height = Math.round(opts.height * scale);
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
  // S16 colour-coverage invariant: every colour W/U/B/R/G must have a
  // civilized-or-approach region. If the roll missed one, swap a duplicate
  // template (or the last of its tier) for the missing colour's template.
  for (const color of ["W", "U", "B", "R", "G"] as const) {
    if (templates.some((t) => t.color === color && t.tier !== "wild")) continue;
    const cand = catalog.regions.find((t) => t.color === color && t.tier !== "wild");
    if (!cand) continue; // catalog can't provide it — the fuzz invariant reports it
    const seen = new Set<string>();
    let swapAt = -1;
    templates.forEach((t, i) => {
      if (t.tier === "wild") return;
      if (seen.has(t.id) && swapAt === -1) swapAt = i;
      seen.add(t.id);
    });
    if (swapAt === -1) swapAt = templates.findIndex((t) => t.tier === cand.tier);
    if (swapAt !== -1) templates[swapAt] = cand;
  }
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

  // 3. Rough terrain, then towns per region (S16: density by tier, ≥1 in every
  //    non-wild region), then carving.
  const passable = new Array<boolean>(cells).fill(true);
  for (let i = 0; i < cells; i++) if (rng.chance(opts.roughness)) passable[i] = false;
  const map: WorldMap = { width, height, region, passable, regions, towns: [], strongholds: [], start: { x: 0, y: 0 } };
  const townSpacing = extra.knobs ? knobs.townSpacingMin : opts.townSpacing;
  const townPts: { at: Point; region: RegionInstance }[] = [];
  for (const r of regions) {
    if (r.tier === "wild" && knobs.townsPer100Cells.wild <= 0) continue;
    const cand = regionCells(map, r.index);
    const area = cand.length;
    const want = r.tier === "wild" ? Math.round((knobs.townsPer100Cells.wild * area) / 100) : Math.max(1, Math.round((knobs.townsPer100Cells[r.tier] * area) / 100));
    if (want <= 0) continue;
    let ts = townSpacing;
    let pts = placeFixedPoints(rng, cand, want, ts, townPts.map((t) => t.at));
    while (pts.length < Math.min(1, want) && ts > 1) {
      ts -= 1;
      pts = placeFixedPoints(rng, cand, want, ts, townPts.map((t) => t.at));
    }
    for (const at of pts) townPts.push({ at, region: r });
  }
  if (townPts.length < 2) {
    // Degenerate tiny maps (tests with custom generators): fall back to the legacy count on civilized cells.
    const civilizedCells = allCells.filter((p) => regions[region[idx(map, p)]!]!.tier === "civilized" && passable[idx(map, p)]);
    const anyCivilized = civilizedCells.length > 0 ? civilizedCells : allCells;
    let ts = opts.townSpacing;
    let pts = placeFixedPoints(rng, anyCivilized, Math.max(2, opts.towns), ts);
    while (pts.length < 2 && ts > 1) {
      ts -= 1;
      pts = placeFixedPoints(rng, anyCivilized, Math.max(2, opts.towns), ts);
    }
    townPts.splice(0, townPts.length, ...pts.map((at) => ({ at, region: regions[region[idx(map, at)]!]! })));
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
  const towns: Town[] = townPts.map((t, i) => {
    passable[idx(map, t.at)] = true;
    return { index: i, name: nameFor(t.region), region: t.region.index, at: t.at };
  });
  map.towns = towns;
  // S16 home-region start: the first town of the home colour's region (civilized preferred), else town 0.
  const homeTowns = towns.filter((t) => regions[t.region]!.color === extra.homeColor);
  const homeTown = homeTowns.find((t) => regions[t.region]!.tier === "civilized") ?? homeTowns[0] ?? towns[0]!;
  map.start = homeTown.at;
  const homeRegion = homeTown.region;

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
  // 4. Opponents. S14 round 1 prototype: ONE lair — a fixed point in the
  // wildest region with a resident (the catalog's first beast, else its
  // highest-tier opponent), spaced from towns, carved reachable.
  const opponents: OpponentInstance[] = [];
  let n = 0;
  const lairHost = catalog.opponents.find((o) => o.kind === "beast") ?? [...catalog.opponents].sort((a, b) => b.tier - a.tier)[0];
  const wildest = [...regions].sort((a, b) => ["civilized", "approach", "wild"].indexOf(b.tier) - ["civilized", "approach", "wild"].indexOf(a.tier))[0];
  const fixed: FixedPoint[] = [];
  if (lairHost && wildest) {
    const candidates = regionCells(map, wildest.index).filter((p) => !towns.some((t) => t.at.x === p.x && t.at.y === p.y));
    const [at] = placeFixedPoints(rng, candidates, 1, townSpacing, towns.map((t) => t.at));
    if (at) {
      passable[idx(map, at)] = true;
      carveTo(at);
      const inst: OpponentInstance = { id: `opp_lair_${n++}`, catalogId: lairHost.id, region: wildest.index, gone: false, fixedAt: at, moveDebt: 0 };
      opponents.push(inst);
      fixed.push({ kind: "lair", at, region: wildest.index, name: `Lair of ${lairHost.name}`, opponentId: inst.id });
    }
  }
  map.strongholds = fixed;
  // S16 roamers: per-region count by density (knobs) — or the legacy roster
  // size when no knobs were given — each with a seeded in-region position.
  // The home region rolls from the civilized table (interim, Q4).
  for (const r of regions) {
    const count = extra.knobs ? roamerTarget(map, r, knobs) : opts.rosterPerRegion;
    const tableTier = r.index === homeRegion ? "civilized" : r.tier;
    for (let i = 0; i < count; i++) {
      const tmpl = rollTemplate(rng, catalog, tableTier);
      opponents.push({ id: `opp_${n++}`, catalogId: tmpl.id, region: r.index, gone: false, moveDebt: 0 });
    }
  }
  spawnRoamers(map, opponents, rng);

  return { map, opponents };
}
