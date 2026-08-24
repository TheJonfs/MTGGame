import { useState } from "react";
import { idx, isExplored, type Point, type Town, type WorldMap as WorldMapModel } from "@shandalar/world";

/**
 * Ink-and-wash cartography (S13 Part 1, art-direction §0): flat wash per
 * region tier tinted by the region's colour, ink borders between regions,
 * hatched rough terrain, town glyphs with hover labels, the player as a
 * portrait chip, and a dotted ink path preview. Pure SVG, cells clickable.
 *
 * S16 (ADR-071): the SVG is now a WINDOW — a viewport of VIEW_W × VIEW_H
 * cells centred on the player (clamped to the map) — with a minimap of the
 * whole world (click to preview a path there), visible roamers as portrait
 * chips (fleeing ones marked), and a faint sight diamond (Manhattan radius)
 * so the felt-wrong list can argue about sight with a picture.
 *
 * S18 (ADR-072 planner addition 1 + ADR-073): FOG. Unexplored cells are blank
 * parchment — no wash, no hatching, no borders, no names; towns/lairs/castles
 * spawn into view on first sight (they are drawn only when explored); roads
 * render through explored cells plus a one-cell faded stub into fog
 * ("invitation, not information"). The home region starts explored (data).
 */

const CELL = 24;
export const VIEW_W = 29;
export const VIEW_H = 19;

const TIER_WASH: Record<string, Record<string, string>> = {
  civilized: { W: "#efe6c8", U: "#d3dfe6", B: "#d9d0d8", R: "#e8d3c2", G: "#d6e0c2", C: "#e2d9c4" },
  approach: { W: "#e2d39a", U: "#a9bfd1", B: "#b6a3b8", R: "#d9a78f", G: "#adc18f", C: "#cfc2a3" },
  wild: { W: "#bcae8a", U: "#8c9aa3", B: "#8e8190", R: "#a98472", G: "#86956f", C: "#9f9478" },
};

function washFor(tier: string, color: string): string {
  return TIER_WASH[tier]?.[color] ?? TIER_WASH[tier]?.C ?? "#e2d9c4";
}

/** S20 playtest r3 (Chris, concept-map-overworld v2): rough terrain is no longer a uniform
 * diagonal hatch — each colour's region draws its OWN hand-hatched pictorial symbols, the
 * campaign-map register. Glyphs are ink paths centred on the cell (~±9px at CELL 24); the
 * pick and a small jitter are hashed from the cell coords, so the map is stable per seed. */
const TERRAIN_GLYPHS: Record<string, string[]> = {
  // W: wheat fields, hedgerows, standing stones
  W: [
    "M -6 8 L -6 -2 M -6 -2 L -8 -5 M -6 -2 L -4 -5 M -6 1 L -8 -2 M -6 1 L -4 -2 M 1 8 L 1 -4 M 1 -4 L -1 -7 M 1 -4 L 3 -7 M 1 -1 L -1 -4 M 1 -1 L 3 -4 M 7 8 L 7 -1 M 7 -1 L 5 -4 M 7 -1 L 9 -4",
    "M -3 8 L -4 -2 L -1 -7 L 3 -6 L 4 8 Z M 7 8 L 6 3 L 8 2 L 9 8 Z",
    "M -9 6 Q -7 2 -5 5 Q -3 1 -1 4 Q 1 0 3 4 Q 5 1 7 5 Q 8 3 9 6 M -9 8 L 9 8",
  ],
  // U: reef waves, reeds, islets
  U: [
    "M -8 -2 Q -5 -6 -2 -2 Q 1 2 4 -2 Q 6 -5 8 -2 M -8 4 Q -5 0 -2 4 Q 1 8 4 4 Q 6 1 8 4",
    "M -4 8 C -4 2 -5 -2 -6 -6 M 0 8 C 0 1 0 -3 1 -7 M 4 8 C 4 2 5 -1 6 -5 M -6 -6 L -7 -8 M 1 -7 L 1 -9 M 6 -5 L 7 -7",
    "M -5 3 Q 0 0 5 3 L 4 6 Q 0 8 -4 6 Z M -8 -3 Q -6 -5 -4 -3 M 3 -5 Q 5 -7 7 -5",
  ],
  // B: dead trees, barrow mounds, snags
  B: [
    "M 0 8 L 0 -2 M 0 -2 L -5 -7 M -5 -7 L -7 -6 M 0 -2 L 4 -8 M 4 -8 L 6 -7 M 0 2 L -4 -1 M 0 0 L 3 -3 M -3 8 L 3 8",
    "M -8 6 Q 0 -6 8 6 Z M -2 6 L -2 1 Q 0 -1 2 1 L 2 6",
    "M -5 8 L -5 0 L -7 -3 M -5 0 L -3 -2 M 3 8 L 3 2 L 1 -1 M 3 2 L 6 -2 M -8 8 L 8 8",
  ],
  // R: cinder cones, lava cracks, crags
  R: [
    "M -8 7 L -2 -5 L 0 -3 L 2 -6 L 8 7 Z M 0 -5 Q -1 -8 1 -9 Q 3 -10 2 -12",
    "M -8 2 L -4 0 L -2 3 L 2 1 L 4 4 L 8 2 M -3 7 L 0 6 L 2 8 M -5 -3 L -2 -4 L 0 -2",
    "M -8 7 L -4 -2 L -1 3 L 3 -6 L 8 7 Z",
  ],
  // G: conifers, broadleaf canopies, root tangles
  G: [
    "M 0 -8 L -5 0 L 5 0 Z M 0 -3 L -6 5 L 6 5 Z M 0 5 L 0 8",
    "M 0 8 L 0 2 M -7 0 Q -7 -5 -3 -5 Q -2 -8 2 -7 Q 6 -7 6 -2 Q 8 1 4 2 Q 0 4 -4 2 Q -8 3 -7 0 Z",
    "M -7 7 Q -4 3 0 6 Q 4 2 7 6 M -5 2 Q 0 -2 5 2 M 0 6 L 0 -1 M 0 -1 L -3 -5 M 0 -1 L 3 -4",
  ],
  // fallback (uncoloured ground): a plain crag
  C: ["M -8 7 L -3 -3 L 0 1 L 4 -5 L 8 7 Z"],
};

const TOWN_GLYPH = "M -5 3 L -5 -2 L 0 -6 L 5 -2 L 5 3 Z M -2 3 L -2 0 L 2 0 L 2 3"; // house with a door
const LAIR_GLYPH = "M -6 4 L -4 -3 L -1 -6 L 2 -5 L 5 -1 L 6 4 Z M -2 4 L -2 1 L 2 1 L 2 4"; // crag with a mouth
const CASTLE_GLYPH = "M -6 4 L -6 -3 L -4 -3 L -4 -1 L -2 -1 L -2 -3 L 0 -3 L 0 -1 L 2 -1 L 2 -3 L 4 -3 L 4 -1 L 6 -1 L 6 4 Z M -1.5 4 L -1.5 1 L 1.5 1 L 1.5 4"; // battlements with a gate
const DOOR_GLYPH = "M -5 5 L -5 -1 A 5 6 0 0 1 5 -1 L 5 5 Z M -3 5 L -3 -0.5 A 3 3.6 0 0 1 3 -0.5 L 3 5"; // arched stone door (guardian chamber)

/** S20 playtest r2 (Chris: "the dungeon interior looks great; let's implement it") — the
 * dark-stone register from the concept plate: pale carved floors against near-black hatched
 * rock, torchlight pools at junctions, fog as darkness. Overworld palette untouched. */
const INTERIOR = {
  floor: "#d9d2c0",
  rock: "#2c2926",
  dark: "#181614", // unexplored — the halls fade into darkness
  edge: "#cfc5ab", // carved wall edge highlight
  text: "#d9d2c0",
};

export interface RoamerChip {
  id: string;
  at: Point;
  portrait: string;
  name: string;
  tier: 1 | 2 | 3;
  fleeing: boolean;
}

/** The viewport origin (in cells) for a player position: centred, clamped. S18: plus a pan offset (look mode). */
export function viewportOrigin(map: { width: number; height: number }, player: Point, pan: Point = { x: 0, y: 0 }): Point {
  const vw = Math.min(VIEW_W, map.width), vh = Math.min(VIEW_H, map.height);
  const x = Math.max(0, Math.min(map.width - vw, player.x + pan.x - Math.floor(vw / 2)));
  const y = Math.max(0, Math.min(map.height - vh, player.y + pan.y - Math.floor(vh / 2)));
  return { x, y };
}

export function WorldMapView({
  map,
  player,
  portrait,
  preview,
  previewTarget,
  encounterAt,
  encounterPortrait,
  clearedFixed,
  roamers = [],
  sightRadius,
  explored,
  pan = { x: 0, y: 0 },
  onPan,
  marks = [],
  edgeLabel = "the edge of the map",
  interior = false,
  onClickCell,
}: {
  map: WorldMapModel;
  player: Point;
  portrait: string;
  preview: Point[] | null;
  previewTarget: Point | null;
  encounterAt?: Point | null;
  encounterPortrait?: string | null;
  /** Indices into map.strongholds whose resident is defeated (greyed). */
  clearedFixed?: Set<number>;
  /** S16: roamers the player can see right now. */
  roamers?: RoamerChip[];
  /** S16: the player's sight radius (cells, Manhattan) — drawn as a faint diamond. */
  sightRadius?: number;
  /** S18: packed explored bits (world.explored). Absent = everything explored (replays, older saves). */
  explored?: number[] | null;
  /** S18 (OQ-7): look-mode pan offset in cells (viewport centre = player + pan); onPan receives a new offset. */
  pan?: Point;
  onPan?: (p: Point) => void;
  /** S19: bounty marks — the target's LAST SEEN cell (fog-honest; the mark trails sightings).
   * S20 playtest: `kind` picks the glyph — bounty flag (default) or treasure chest (dungeon caches). */
  marks?: { at: Point; label: string; kind?: "flag" | "chest" }[];
  /** S20: override the map-edge label ("" hides it — dungeon interiors where every edge is close). */
  edgeLabel?: string;
  /** S20 playtest r2: dark-stone dungeon-interior register (concept-map-dungeon). */
  interior?: boolean;
  onClickCell: (p: Point) => void;
}) {
  const [hoverTown, setHoverTown] = useState<Town | null>(null);
  const [hoverLair, setHoverLair] = useState<{ name: string; at: Point } | null>(null);
  const [hoverRoamer, setHoverRoamer] = useState<RoamerChip | null>(null);
  const vw = Math.min(VIEW_W, map.width), vh = Math.min(VIEW_H, map.height);
  const origin = viewportOrigin(map, player, pan);
  const panned = pan.x !== 0 || pan.y !== 0;
  // S18 (OQ-7): the edges of the map — a heavy double ink rule wherever the viewport meets the world's edge.
  const edges: { d: string; label: string; lx: number; ly: number; rot: number }[] = [];
  const X0 = origin.x * CELL, Y0 = origin.y * CELL, X1 = (origin.x + vw) * CELL, Y1 = (origin.y + vh) * CELL;
  if (origin.x === 0) edges.push({ d: `M${X0 + 2} ${Y0} V${Y1}`, label: edgeLabel, lx: X0 + 14, ly: (Y0 + Y1) / 2, rot: -90 });
  if (origin.y === 0) edges.push({ d: `M${X0} ${Y0 + 2} H${X1}`, label: edgeLabel, lx: (X0 + X1) / 2, ly: Y0 + 16, rot: 0 });
  if (origin.x + vw >= map.width) edges.push({ d: `M${X1 - 2} ${Y0} V${Y1}`, label: edgeLabel, lx: X1 - 14, ly: (Y0 + Y1) / 2, rot: 90 });
  if (origin.y + vh >= map.height) edges.push({ d: `M${X0} ${Y1 - 2} H${X1}`, label: edgeLabel, lx: (X0 + X1) / 2, ly: Y1 - 8, rot: 0 });
  const W = map.width * CELL;
  const H = map.height * CELL;
  const centre = (p: Point) => ({ cx: p.x * CELL + CELL / 2, cy: p.y * CELL + CELL / 2 });
  const inView = (p: Point) => p.x >= origin.x - 1 && p.y >= origin.y - 1 && p.x <= origin.x + vw && p.y <= origin.y + vh;
  const seen = (p: Point) => !explored || isExplored(explored, map, p);
  const seenXY = (x: number, y: number) => seen({ x, y });

  // Only the window's cells render (the map is 4× the S13 grid at mapScale 2).
  const cells: Point[] = [];
  for (let y = Math.max(0, origin.y - 1); y < Math.min(map.height, origin.y + vh + 1); y++) {
    for (let x = Math.max(0, origin.x - 1); x < Math.min(map.width, origin.x + vw + 1); x++) cells.push({ x, y });
  }
  // Region borders: an ink segment wherever a cell's right/bottom neighbour is in another region.
  const borders: string[] = [];
  for (const { x, y } of cells) {
    const r = map.region[y * map.width + x];
    if (!seenXY(x, y)) continue;
    if (x + 1 < map.width && seenXY(x + 1, y) && map.region[y * map.width + x + 1] !== r) borders.push(`M${(x + 1) * CELL} ${y * CELL} v${CELL}`);
    if (y + 1 < map.height && seenXY(x, y + 1) && map.region[(y + 1) * map.width + x] !== r) borders.push(`M${x * CELL} ${(y + 1) * CELL} h${CELL}`);
  }
  // Overworld: the torn fog edge (concept v2) — a soft boundary wherever seen ground meets fog.
  const fogEdges: string[] = [];
  if (!interior && explored) {
    for (const { x, y } of cells) {
      if (!seenXY(x, y)) continue;
      if (x + 1 < map.width && !seenXY(x + 1, y)) fogEdges.push(`M${(x + 1) * CELL} ${y * CELL} v${CELL}`);
      if (x - 1 >= 0 && !seenXY(x - 1, y)) fogEdges.push(`M${x * CELL} ${y * CELL} v${CELL}`);
      if (y + 1 < map.height && !seenXY(x, y + 1)) fogEdges.push(`M${x * CELL} ${(y + 1) * CELL} h${CELL}`);
      if (y - 1 >= 0 && !seenXY(x, y - 1)) fogEdges.push(`M${x * CELL} ${y * CELL} h${CELL}`);
    }
  }
  // Interior: carved wall edges (a pale chisel line wherever seen floor meets rock or the map's
  // edge) and torchlight junctions (seen floor cells with 3+ floor neighbours).
  const wallEdges: string[] = [];
  const torches: Point[] = [];
  if (interior) {
    const floorAt = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && !!map.passable[y * map.width + x];
    for (const { x, y } of cells) {
      if (!floorAt(x, y) || !seenXY(x, y)) continue;
      if (!floorAt(x - 1, y)) wallEdges.push(`M${x * CELL} ${y * CELL} v${CELL}`);
      if (!floorAt(x + 1, y)) wallEdges.push(`M${(x + 1) * CELL} ${y * CELL} v${CELL}`);
      if (!floorAt(x, y - 1)) wallEdges.push(`M${x * CELL} ${y * CELL} h${CELL}`);
      if (!floorAt(x, y + 1)) wallEdges.push(`M${x * CELL} ${(y + 1) * CELL} h${CELL}`);
      const n = [floorAt(x - 1, y), floorAt(x + 1, y), floorAt(x, y - 1), floorAt(x, y + 1)].filter(Boolean).length;
      if (n >= 3) torches.push({ x, y });
    }
  }
  const label = (text: string, at: Point, dy = -CELL) => (
    <g transform={`translate(${centre(at).cx} ${centre(at).cy + dy})`} pointerEvents="none">
      <rect x={-text.length * 3.6 - 6} y={-11} width={text.length * 7.2 + 12} height={16} rx="3" fill="var(--parchment)" stroke="var(--ink)" strokeWidth="1" />
      <text y={1} textAnchor="middle" className="town-label">{text}</text>
    </g>
  );
  const sightDiamond = sightRadius
    ? `M ${centre(player).cx} ${centre(player).cy - (sightRadius + 0.5) * CELL} L ${centre(player).cx + (sightRadius + 0.5) * CELL} ${centre(player).cy} L ${centre(player).cx} ${centre(player).cy + (sightRadius + 0.5) * CELL} L ${centre(player).cx - (sightRadius + 0.5) * CELL} ${centre(player).cy} Z`
    : null;

  // Minimap: the whole map at MINI px per cell, capped to ~180px wide.
  const MINI = Math.max(1.5, Math.min(3, 180 / map.width));
  const miniRegions = map.regions.map((reg) => {
    // One rect per run of same-region cells per row keeps the minimap cheap.
    const runs: { x: number; y: number; w: number }[] = [];
    for (let y = 0; y < map.height; y++) {
      let start = -1;
      for (let x = 0; x <= map.width; x++) {
        const here = x < map.width && map.region[y * map.width + x] === reg.index && seenXY(x, y);
        if (here && start === -1) start = x;
        if (!here && start !== -1) { runs.push({ x: start, y, w: x - start }); start = -1; }
      }
    }
    return { reg, runs };
  });

  return (
    <div className="world-map-stage">
      <svg className="world-map" viewBox={`${origin.x * CELL} ${origin.y * CELL} ${vw * CELL} ${vh * CELL}`} width="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="rough" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(43,37,32,0.55)" strokeWidth="1.2" />
          </pattern>
          <pattern id="rough-faint" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(43,37,32,0.16)" strokeWidth="1.1" />
          </pattern>
          <pattern id="chisel" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
            <line x1="0" y1="1" x2="4.5" y2="1" stroke="rgba(226,214,186,0.13)" strokeWidth="1.1" />
            <line x1="2.5" y1="4.5" x2="7" y2="4.5" stroke="rgba(226,214,186,0.08)" strokeWidth="1" />
          </pattern>
          <pattern id="flagstone" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <rect width={CELL} height={CELL} fill="none" stroke="rgba(43,37,32,0.18)" strokeWidth="1" />
            <line x1={CELL * 0.5} y1={0} x2={CELL * 0.5} y2={CELL * 0.14} stroke="rgba(43,37,32,0.14)" strokeWidth="1" />
          </pattern>
          <radialGradient id="torch">
            <stop offset="0%" stopColor="rgba(232,178,90,0.5)" />
            <stop offset="45%" stopColor="rgba(232,178,90,0.22)" />
            <stop offset="100%" stopColor="rgba(232,178,90,0)" />
          </radialGradient>
          <clipPath id="chip"><circle r={CELL * 0.75} /></clipPath>
          <clipPath id="chip-sm"><circle r={CELL * 0.6} /></clipPath>
        </defs>
        {/* interior: a dark backdrop under the cells — subpixel seams between cell rects
            otherwise bleed the parchment page through as a pale grid on the near-black rock */}
        {interior && <rect x={0} y={0} width={W} height={H} fill={INTERIOR.dark} />}
        {/* washes (interior: pale carved floor / near-black rock / darkness for fog) */}
        {cells.map(({ x, y }) => {
          const i = y * map.width + x;
          const reg = map.regions[map.region[i]!]!;
          const fill = interior
            ? (!seenXY(x, y) ? INTERIOR.dark : map.passable[i] ? INTERIOR.floor : INTERIOR.rock)
            : (seenXY(x, y) ? washFor(reg.tier, reg.color) : "var(--fog)");
          return (
            <rect
              key={i}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={fill}
              onClick={() => onClickCell({ x, y })}
              style={{ cursor: !seenXY(x, y) || map.passable[i] ? "pointer" : "not-allowed" }}
            />
          );
        })}
        {/* rough terrain (interior: chisel-marks on rock, flagstones on floor; overworld: each
            colour's pictorial glyphs over a faint hatch — concept-map-overworld v2) */}
        {cells.map(({ x, y }) => {
          const i = y * map.width + x;
          if (interior) {
            if (!seenXY(x, y)) return null;
            return <rect key={`r${i}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill={map.passable[i] ? "url(#flagstone)" : "url(#chisel)"} pointerEvents="none" />;
          }
          if (map.passable[i] || !seenXY(x, y)) return null;
          const reg = map.regions[map.region[i]!]!;
          const set = TERRAIN_GLYPHS[reg.color] ?? TERRAIN_GLYPHS.C!;
          const h = (x * 31 + y * 17 + (map.region[i] ?? 0) * 7) >>> 0;
          const glyph = set[h % set.length]!;
          const jx = ((h >> 3) % 5) - 2, jy = ((h >> 5) % 5) - 2;
          const { cx, cy } = centre({ x, y });
          return (
            <g key={`r${i}`} pointerEvents="none">
              <rect x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill="url(#rough-faint)" />
              <path d={glyph} transform={`translate(${cx + jx * 0.8} ${cy + jy * 0.8}) scale(0.92)`} fill="none" stroke="rgba(43,37,32,0.8)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {/* interior: torchlight pools at junctions, then the carved wall edge */}
        {interior && torches.map((t, i) => (
          <circle key={`t${i}`} cx={centre(t).cx} cy={centre(t).cy} r={CELL * 1.9} fill="url(#torch)" pointerEvents="none" />
        ))}
        {interior && <path d={wallEdges.join(" ")} stroke={INTERIOR.edge} strokeWidth="1.6" fill="none" strokeLinecap="square" pointerEvents="none" opacity="0.85" />}
        {/* the torn fog edge: fog bleeds a few px over the seen side, with a faint broken ink rule */}
        {!interior && fogEdges.length > 0 && (
          <g pointerEvents="none">
            <path d={fogEdges.join(" ")} stroke="var(--fog)" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9" />
            <path d={fogEdges.join(" ")} stroke="var(--ink)" strokeWidth="0.9" fill="none" strokeLinecap="round" strokeDasharray="3 4 1 3" opacity="0.28" />
          </g>
        )}
        {/* S16 (ADR-072): roads — a dotted ink line through the centre of road cells */}
        {map.road && (() => {
          // A road segment joins two adjacent road cells. Both explored → drawn; exactly one
          // explored → a faded half-stub from the explored cell toward the fog (ADR-073); neither → nothing.
          const full: string[] = [], stub: string[] = [];
          for (const { x, y } of cells) {
            if (!map.road[y * map.width + x]) continue;
            const c = centre({ x, y });
            for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || !map.road[ny * map.width + nx]) continue;
              const a = seenXY(x, y), b = seenXY(nx, ny);
              if (a && b) { if (dx > 0 || dy > 0) full.push(`M${c.cx} ${c.cy} L${c.cx + dx * CELL} ${c.cy + dy * CELL}`); }
              else if (a && !b) stub.push(`M${c.cx} ${c.cy} L${c.cx + dx * CELL * 0.8} ${c.cy + dy * CELL * 0.8}`);
            }
          }
          return (
            <>
              <path d={full.join(" ")} stroke="var(--ink)" strokeWidth="2.2" strokeDasharray="1 4" strokeLinecap="round" fill="none" opacity="0.7" pointerEvents="none" />
              <path d={stub.join(" ")} stroke="var(--ink)" strokeWidth="2.2" strokeDasharray="1 4" strokeLinecap="round" fill="none" opacity="0.28" pointerEvents="none" className="road-stub" />
            </>
          );
        })()}
        {/* region borders (meaningless inside — one region) */}
        {!interior && <path d={borders.join(" ")} stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" pointerEvents="none" opacity="0.85" />}
        {/* region names at hearts (only when the heart is in view) */}
        {map.regions.filter((reg) => inView(reg.heart) && seen(reg.heart)).map((reg) => {
          const half = reg.name.length * 3.4;
          const x = Math.max(half + 4, Math.min(W - half - 4, centre(reg.heart).cx));
          const y = Math.max(14, Math.min(H - 6, centre(reg.heart).cy - CELL));
          return (
            <text key={reg.index} x={x} y={y} className="region-label" textAnchor="middle" pointerEvents="none">
              {reg.name}
            </text>
          );
        })}
        {/* sight diamond */}
        {sightDiamond && <path d={sightDiamond} fill="none" stroke="var(--brass)" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.55" pointerEvents="none" />}
        {/* path preview */}
        {preview && preview.length > 0 && (
          <polyline
            points={[player, ...preview].map((p) => `${centre(p).cx},${centre(p).cy}`).join(" ")}
            fill="none"
            stroke={interior ? "var(--brass)" : "var(--ink)"}
            strokeWidth="2"
            strokeDasharray="2 5"
            strokeLinecap="round"
            pointerEvents="none"
          />
        )}
        {previewTarget && (
          <circle cx={centre(previewTarget).cx} cy={centre(previewTarget).cy} r={CELL * 0.45} fill="none" stroke="var(--brass)" strokeWidth="2.2" pointerEvents="none" />
        )}
        {/* towns */}
        {map.towns.filter((t) => inView(t.at) && seen(t.at)).map((t) => {
          const { cx, cy } = centre(t.at);
          return (
            <g key={t.index} transform={`translate(${cx} ${cy + 1})`} onMouseEnter={() => setHoverTown(t)} onMouseLeave={() => setHoverTown(null)} onClick={() => onClickCell(t.at)} style={{ cursor: "pointer" }}>
              <circle r={CELL * 0.62} fill="var(--parchment)" stroke="var(--ink)" strokeWidth="1.4" />
              <path d={TOWN_GLYPH} fill="var(--ink)" stroke="var(--ink)" strokeWidth="0.8" strokeLinejoin="round" transform="scale(1.3)" />
            </g>
          );
        })}
        {/* lairs (fixed points) */}
        {map.strongholds.map((f, i) => {
          if (!inView(f.at) || !seen(f.at)) return null;
          const { cx, cy } = centre(f.at);
          const cleared = clearedFixed?.has(i) ?? false;
          const castle = f.kind === "stronghold";
          if (interior) {
            // The guardian chamber: an arched stone door flanked by brazier flames.
            return (
              <g key={`f${i}`} transform={`translate(${cx} ${cy + 1})`} onMouseEnter={() => setHoverLair({ name: f.name ?? f.kind, at: f.at })} onMouseLeave={() => setHoverLair(null)} onClick={() => onClickCell(f.at)} style={{ cursor: "pointer" }}>
                <circle r={CELL * 0.78} fill={INTERIOR.rock} stroke="var(--danger)" strokeWidth="2" />
                <path d={DOOR_GLYPH} fill={INTERIOR.floor} stroke={INTERIOR.edge} strokeWidth="0.9" strokeLinejoin="round" transform="scale(1.25)" fillRule="evenodd" />
                <circle cx={-CELL * 0.52} cy={-2} r={2.4} fill="rgba(232,178,90,0.95)" />
                <circle cx={CELL * 0.52} cy={-2} r={2.4} fill="rgba(232,178,90,0.95)" />
              </g>
            );
          }
          return (
            <g key={`f${i}`} transform={`translate(${cx} ${cy + 1})`} onMouseEnter={() => setHoverLair({ name: f.name ?? f.kind, at: f.at })} onMouseLeave={() => setHoverLair(null)} onClick={() => onClickCell(f.at)} style={{ cursor: "pointer" }} opacity={cleared ? 0.45 : 1}>
              <circle r={CELL * (castle ? 0.8 : 0.66)} fill="var(--parchment)" stroke={castle ? "var(--ink)" : cleared ? "var(--ink-soft)" : "var(--danger)"} strokeWidth={castle ? 2.2 : 1.6} />
              <path d={castle ? CASTLE_GLYPH : LAIR_GLYPH} fill="var(--ink)" stroke="var(--ink)" strokeWidth="0.8" strokeLinejoin="round" transform={castle ? "scale(1.5)" : "scale(1.3)"} />
            </g>
          );
        })}
        {/* S16 roamers in sight */}
        {roamers.filter((r) => inView(r.at)).map((r) => {
          const { cx, cy } = centre(r.at);
          return (
            <g key={r.id} transform={`translate(${cx} ${cy})`} onMouseEnter={() => setHoverRoamer(r)} onMouseLeave={() => setHoverRoamer(null)} onClick={() => onClickCell(r.at)} style={{ cursor: "pointer" }} className={r.fleeing ? "roamer fleeing" : "roamer"}>
              <circle r={CELL * 0.66} fill="var(--parchment)" stroke={r.fleeing ? "var(--ink-soft)" : "var(--danger)"} strokeWidth="2" strokeDasharray={r.fleeing ? "3 2" : undefined} />
              <image href={r.portrait} x={-CELL * 0.6} y={-CELL * 0.6} width={CELL * 1.2} height={CELL * 1.2} clipPath="url(#chip-sm)" opacity={r.fleeing ? 0.8 : 1} />
              <text y={CELL * 0.95} textAnchor="middle" className="town-label" style={{ fontSize: 9, ...(interior ? { fill: INTERIOR.text } : {}) }}>{r.fleeing ? "flees" : ["", "I", "II", "III"][r.tier]}</text>
            </g>
          );
        })}
        {hoverLair && label(hoverLair.name, hoverLair.at)}
        {hoverTown && label(hoverTown.name, hoverTown.at)}
        {hoverRoamer && label(`${hoverRoamer.name} · tier ${hoverRoamer.tier}${hoverRoamer.fleeing ? " · fleeing" : ""}`, hoverRoamer.at, -CELL * 1.1)}
        {/* encounter marker */}
        {encounterAt && encounterPortrait && (
          <g transform={`translate(${centre(encounterAt).cx + CELL * 0.9} ${centre(encounterAt).cy - CELL * 0.6})`} pointerEvents="none">
            <circle r={CELL * 0.8} fill="var(--parchment)" stroke="var(--danger)" strokeWidth="2.2" />
            <image href={encounterPortrait} x={-CELL * 0.75} y={-CELL * 0.75} width={CELL * 1.5} height={CELL * 1.5} clipPath="url(#chip)" />
          </g>
        )}
        {/* S19: bounty marks — a brass ⚑ at the last-seen cell; S20 playtest: chest glyph for dungeon caches */}
        {marks.filter((m) => inView(m.at)).map((m, i) => (
          <g key={`mk${i}`} transform={`translate(${centre(m.at).cx} ${centre(m.at).cy})`} pointerEvents="none" opacity="0.9">
            {m.kind === "chest" ? (
              <g>
                <path d="M -7 -1 A 7 6 0 0 1 7 -1 L 7 -1 L -7 -1 Z" fill="var(--brass)" stroke="var(--ink)" strokeWidth="1.1" />
                <rect x={-7} y={-1} width={14} height={8} rx={1} fill="var(--brass)" stroke="var(--ink)" strokeWidth="1.1" />
                <line x1={-7} y1={-1} x2={7} y2={-1} stroke="var(--ink)" strokeWidth="1.1" />
                <line x1={-3.5} y1={-5.6} x2={-3.5} y2={7} stroke="var(--ink)" strokeWidth="0.8" opacity="0.65" />
                <line x1={3.5} y1={-5.6} x2={3.5} y2={7} stroke="var(--ink)" strokeWidth="0.8" opacity="0.65" />
                <rect x={-1.6} y={-2.6} width={3.2} height={4.2} rx={0.8} fill="var(--parchment)" stroke="var(--ink)" strokeWidth="1" />
              </g>
            ) : (
              <path d="M 0 8 L 0 -9 L 8 -6 L 0 -3" fill="var(--brass)" stroke="var(--ink)" strokeWidth="1" />
            )}
            <text y={16} textAnchor="middle" className="town-label" style={{ fontSize: 8.5, ...(interior ? { fill: INTERIOR.text } : {}) }}>{m.label}</text>
          </g>
        ))}
        {/* interior: the descending stair at the entrance */}
        {interior && seen(map.start) && (
          <g transform={`translate(${centre(map.start).cx} ${centre(map.start).cy})`} pointerEvents="none" opacity="0.9">
            <path d="M -8 6 L -8 2 L -4 2 L -4 -2 L 0 -2 L 0 -6 L 4 -6 L 4 -8 L 8 -8" fill="none" stroke={INTERIOR.text} strokeWidth="1.6" strokeLinecap="square" />
          </g>
        )}
        {/* S18 (OQ-7): map edges */}
        {edges.map((e, i) => (
          <g key={`edge${i}`} pointerEvents="none">
            <path d={e.d} stroke="var(--ink)" strokeWidth="5" opacity="0.9" />
            <path d={e.d} stroke="var(--parchment)" strokeWidth="1.2" strokeDasharray="6 6" />
            {e.label && <text x={e.lx} y={e.ly} transform={`rotate(${e.rot} ${e.lx} ${e.ly})`} textAnchor="middle" className="region-label" opacity="0.7">{e.label}</text>}
          </g>
        ))}
        {/* player chip */}
        <g transform={`translate(${centre(player).cx} ${centre(player).cy})`} pointerEvents="none">
          <circle r={CELL * 0.8} fill="var(--parchment)" stroke="var(--brass)" strokeWidth="2.4" />
          <image href={portrait} x={-CELL * 0.75} y={-CELL * 0.75} width={CELL * 1.5} height={CELL * 1.5} clipPath="url(#chip)" />
        </g>
      </svg>
      {/* minimap */}
      <svg className="world-minimap" viewBox={`0 0 ${map.width * MINI} ${map.height * MINI}`} width={map.width * MINI} height={map.height * MINI} onClick={(e) => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * map.width);
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * map.height);
        if (x >= 0 && y >= 0 && x < map.width && y < map.height) {
          onPan?.({ x: x - player.x, y: y - player.y });
          if (!seenXY(x, y) || map.passable[idx(map, { x, y })]) onClickCell({ x, y });
        }
      }}>
        {interior && <rect x={0} y={0} width={map.width * MINI} height={map.height * MINI} fill={INTERIOR.dark} />}
        {interior
          ? cells.length > 0 && Array.from({ length: map.height }, (_, y) => Array.from({ length: map.width }, (_, x) => (seenXY(x, y) ? <rect key={`m${y * map.width + x}`} x={x * MINI} y={y * MINI} width={MINI} height={MINI} fill={map.passable[y * map.width + x] ? INTERIOR.floor : INTERIOR.rock} /> : null)))
          : miniRegions.map(({ reg, runs }) => runs.map((r, i) => <rect key={`${reg.index}-${i}`} x={r.x * MINI} y={r.y * MINI} width={r.w * MINI} height={MINI} fill={washFor(reg.tier, reg.color)} />))}
        {map.road && map.road.map((r, i) => (r && seenXY(i % map.width, Math.floor(i / map.width)) ? <rect key={`rd${i}`} x={(i % map.width) * MINI} y={Math.floor(i / map.width) * MINI} width={MINI} height={MINI} fill="rgba(43,37,32,0.45)" /> : null))}
        {map.towns.filter((t) => seen(t.at)).map((t) => <rect key={t.index} x={t.at.x * MINI - MINI * 0.5} y={t.at.y * MINI - MINI * 0.5} width={MINI * 2} height={MINI * 2} fill="var(--ink)" />)}
        {map.strongholds.map((f, i) => !seen(f.at) ? null : <rect key={`f${i}`} x={f.at.x * MINI - MINI * (f.kind === "stronghold" ? 1 : 0.5)} y={f.at.y * MINI - MINI * (f.kind === "stronghold" ? 1 : 0.5)} width={MINI * (f.kind === "stronghold" ? 3 : 2)} height={MINI * (f.kind === "stronghold" ? 3 : 2)} fill={f.kind === "stronghold" ? "var(--ink)" : "var(--danger)"} stroke={f.kind === "stronghold" ? "var(--brass)" : undefined} strokeWidth={0.8} />)}
        {roamers.map((r) => <circle key={r.id} cx={(r.at.x + 0.5) * MINI} cy={(r.at.y + 0.5) * MINI} r={MINI} fill={r.fleeing ? "var(--ink-soft)" : "var(--danger)"} />)}
        <rect x={origin.x * MINI} y={origin.y * MINI} width={vw * MINI} height={vh * MINI} fill="none" stroke="var(--brass)" strokeWidth="1.2" />
        <circle cx={(player.x + 0.5) * MINI} cy={(player.y + 0.5) * MINI} r={MINI * 1.4} fill="var(--brass)" stroke="var(--ink)" strokeWidth="0.6" />
      </svg>
      {/* compass rose (concept v2) — the campaign-map signature, top-right of the stage */}
      {!interior && (
        <svg className="map-compass" viewBox="-21 -21 42 42" width="54" height="54" pointerEvents="none">
          <circle r="16" fill="var(--parchment)" opacity="0.88" stroke="var(--ink)" strokeWidth="1.1" />
          <circle r="12.5" fill="none" stroke="var(--ink)" strokeWidth="0.6" opacity="0.6" />
          <path d="M 0 -14 L 2.6 0 L 0 14 L -2.6 0 Z" fill="var(--brass)" stroke="var(--ink)" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M -14 0 L 0 2.6 L 14 0 L 0 -2.6 Z" fill="var(--parchment)" stroke="var(--ink)" strokeWidth="0.8" strokeLinejoin="round" />
          <circle r="1.6" fill="var(--ink)" />
          <text y="-16.5" textAnchor="middle" style={{ fontFamily: "var(--serif)", fontSize: 7, fontWeight: 700, fill: "var(--ink)" }}>N</text>
        </svg>
      )}
      {panned && onPan && (
        <button className="recentre" title="re-centre on you (Home)" onClick={() => onPan({ x: 0, y: 0 })}>⌖ back to you</button>
      )}
      <div className="map-hint">arrow keys look around · Home re-centres</div>
    </div>
  );
}
