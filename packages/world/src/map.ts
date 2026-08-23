import type { RegionTier } from "./knobs.js";

/**
 * The map model (brief Part 2): a passability grid, click-to-walk, one
 * traversed cell = one step (the clock, manifest §5). Square cells; the
 * granularity is a generator knob.
 */
export interface Point {
  x: number;
  y: number;
}

export interface RegionInstance {
  index: number;
  templateId: string;
  name: string;
  tier: RegionTier;
  color: string;
  /** Voronoi seed cell (the region's "heart"). */
  heart: Point;
  /** S16 (ADR-072): which spoke (0–4, by colour order) this region belongs to. */
  spoke?: number;
}

export interface Town {
  index: number;
  name: string;
  region: number;
  at: Point;
}

/** Fixed points the generator places with spacing constraints; strongholds
 * are the M6b+ kind — present in the shape, unused in the slice. */
export type FixedPointKind = "town" | "stronghold" | "lair";

/** A fixed point with a resident (S14 round 1 prototype: a lair hosting one
 * opponent; strongholds/dungeons will reuse the shape). Walking onto it is a
 * guaranteed encounter with the resident until they are defeated. */
export interface FixedPoint {
  kind: FixedPointKind;
  at: Point;
  region: number;
  name?: string;
  opponentId?: string;
}

export interface WorldMap {
  width: number;
  height: number;
  /** Row-major: region index per cell. */
  region: number[];
  /** Row-major: passable flag per cell. */
  passable: boolean[];
  /** S16 (ADR-072): row-major road flag per cell — shortest passable paths between neighbour towns. */
  road: boolean[];
  regions: RegionInstance[];
  towns: Town[];
  /** Fixed points: lairs (with residents) and the five colour strongholds (ADR-072; unused until S19+). */
  strongholds: FixedPoint[];
  start: Point;
  /** S16 (ADR-072): the map's centre and each region's spoke/ring (radial worlds); absent on pre-radial maps. */
  centre?: Point;
}

export const idx = (m: { width: number }, p: Point) => p.y * m.width + p.x;
export const inBounds = (m: { width: number; height: number }, p: Point) => p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;
export const manhattan = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function neighbors(m: WorldMap, p: Point): Point[] {
  const out: Point[] = [];
  for (const d of DIRS) {
    const q = { x: p.x + d.x, y: p.y + d.y };
    if (inBounds(m, q)) out.push(q);
  }
  return out;
}

/** BFS shortest path over passable cells (4-neighbour). Returns the cells
 * AFTER `from` up to and including `to`, or null when unreachable.
 * Deterministic: neighbour order is fixed. */
export function findPath(m: WorldMap, from: Point, to: Point, passable: (p: Point) => boolean = (p) => m.passable[idx(m, p)]!): Point[] | null {
  if (samePoint(from, to)) return [];
  const prev = new Int32Array(m.width * m.height).fill(-1);
  const seen = new Uint8Array(m.width * m.height);
  const queue: Point[] = [from];
  seen[idx(m, from)] = 1;
  let head = 0;
  while (head < queue.length) {
    const p = queue[head++]!;
    for (const q of neighbors(m, p)) {
      const qi = idx(m, q);
      if (seen[qi] || !passable(q)) continue;
      seen[qi] = 1;
      prev[qi] = idx(m, p);
      if (samePoint(q, to)) {
        const path: Point[] = [];
        let cur = qi;
        while (cur !== idx(m, from)) {
          path.push({ x: cur % m.width, y: Math.floor(cur / m.width) });
          cur = prev[cur]!;
        }
        return path.reverse();
      }
      queue.push(q);
    }
  }
  return null;
}

/** All cells reachable from `from` over passable cells. */
export function reachable(m: WorldMap, from: Point): Set<number> {
  const out = new Set<number>();
  const stack = [from];
  out.add(idx(m, from));
  while (stack.length) {
    const p = stack.pop()!;
    for (const q of neighbors(m, p)) {
      const qi = idx(m, q);
      if (out.has(qi) || !m.passable[qi]) continue;
      out.add(qi);
      stack.push(q);
    }
  }
  return out;
}

// ---------- S16 (ADR-072): `explored` — packed bits over cells (fog of war reserved; not rendered yet) ----------

export function exploredAll(m: { width: number; height: number }): number[] {
  const n = Math.ceil((m.width * m.height) / 32);
  return new Array<number>(n).fill(-1 >>> 0);
}
export function exploredNone(m: { width: number; height: number }): number[] {
  return new Array<number>(Math.ceil((m.width * m.height) / 32)).fill(0);
}
export function isExplored(explored: number[], m: { width: number }, p: Point): boolean {
  const i = idx(m, p);
  return ((explored[i >> 5] ?? 0) >>> (i & 31)) & 1 ? true : false;
}
export function markExplored(explored: number[], m: { width: number }, p: Point): void {
  const i = idx(m, p);
  explored[i >> 5] = ((explored[i >> 5] ?? 0) | (1 << (i & 31))) >>> 0;
}

export function regionAt(m: WorldMap, p: Point): RegionInstance {
  return m.regions[m.region[idx(m, p)]!]!;
}

export function townAt(m: WorldMap, p: Point): Town | null {
  return m.towns.find((t) => samePoint(t.at, p)) ?? null;
}

export function fixedPointAt(m: WorldMap, p: Point): FixedPoint | null {
  return m.strongholds.find((f) => samePoint(f.at, p)) ?? null;
}
