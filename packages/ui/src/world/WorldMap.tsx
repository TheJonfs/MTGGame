import { useState } from "react";
import { idx, type Point, type Town, type WorldMap as WorldMapModel } from "@shandalar/world";

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

const TOWN_GLYPH = "M -5 3 L -5 -2 L 0 -6 L 5 -2 L 5 3 Z M -2 3 L -2 0 L 2 0 L 2 3"; // house with a door
const LAIR_GLYPH = "M -6 4 L -4 -3 L -1 -6 L 2 -5 L 5 -1 L 6 4 Z M -2 4 L -2 1 L 2 1 L 2 4"; // crag with a mouth

export interface RoamerChip {
  id: string;
  at: Point;
  portrait: string;
  name: string;
  tier: 1 | 2 | 3;
  fleeing: boolean;
}

/** The viewport origin (in cells) for a player position: centred, clamped. */
export function viewportOrigin(map: { width: number; height: number }, player: Point): Point {
  const vw = Math.min(VIEW_W, map.width), vh = Math.min(VIEW_H, map.height);
  const x = Math.max(0, Math.min(map.width - vw, player.x - Math.floor(vw / 2)));
  const y = Math.max(0, Math.min(map.height - vh, player.y - Math.floor(vh / 2)));
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
  onClickCell: (p: Point) => void;
}) {
  const [hoverTown, setHoverTown] = useState<Town | null>(null);
  const [hoverLair, setHoverLair] = useState<{ name: string; at: Point } | null>(null);
  const [hoverRoamer, setHoverRoamer] = useState<RoamerChip | null>(null);
  const vw = Math.min(VIEW_W, map.width), vh = Math.min(VIEW_H, map.height);
  const origin = viewportOrigin(map, player);
  const W = map.width * CELL;
  const H = map.height * CELL;
  const centre = (p: Point) => ({ cx: p.x * CELL + CELL / 2, cy: p.y * CELL + CELL / 2 });
  const inView = (p: Point) => p.x >= origin.x - 1 && p.y >= origin.y - 1 && p.x <= origin.x + vw && p.y <= origin.y + vh;

  // Only the window's cells render (the map is 4× the S13 grid at mapScale 2).
  const cells: Point[] = [];
  for (let y = Math.max(0, origin.y - 1); y < Math.min(map.height, origin.y + vh + 1); y++) {
    for (let x = Math.max(0, origin.x - 1); x < Math.min(map.width, origin.x + vw + 1); x++) cells.push({ x, y });
  }
  // Region borders: an ink segment wherever a cell's right/bottom neighbour is in another region.
  const borders: string[] = [];
  for (const { x, y } of cells) {
    const r = map.region[y * map.width + x];
    if (x + 1 < map.width && map.region[y * map.width + x + 1] !== r) borders.push(`M${(x + 1) * CELL} ${y * CELL} v${CELL}`);
    if (y + 1 < map.height && map.region[(y + 1) * map.width + x] !== r) borders.push(`M${x * CELL} ${(y + 1) * CELL} h${CELL}`);
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
        const here = x < map.width && map.region[y * map.width + x] === reg.index;
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
          <clipPath id="chip"><circle r={CELL * 0.75} /></clipPath>
          <clipPath id="chip-sm"><circle r={CELL * 0.6} /></clipPath>
        </defs>
        {/* washes */}
        {cells.map(({ x, y }) => {
          const i = y * map.width + x;
          const reg = map.regions[map.region[i]!]!;
          return (
            <rect
              key={i}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={washFor(reg.tier, reg.color)}
              onClick={() => onClickCell({ x, y })}
              style={{ cursor: map.passable[i] ? "pointer" : "not-allowed" }}
            />
          );
        })}
        {/* rough terrain hatching */}
        {cells.map(({ x, y }) => {
          const i = y * map.width + x;
          return map.passable[i] ? null : <rect key={`r${i}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill="url(#rough)" pointerEvents="none" />;
        })}
        {/* region borders */}
        <path d={borders.join(" ")} stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" pointerEvents="none" opacity="0.85" />
        {/* region names at hearts (only when the heart is in view) */}
        {map.regions.filter((reg) => inView(reg.heart)).map((reg) => {
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
            stroke="var(--ink)"
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
        {map.towns.filter((t) => inView(t.at)).map((t) => {
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
          if (!inView(f.at)) return null;
          const { cx, cy } = centre(f.at);
          const cleared = clearedFixed?.has(i) ?? false;
          return (
            <g key={`f${i}`} transform={`translate(${cx} ${cy + 1})`} onMouseEnter={() => setHoverLair({ name: f.name ?? f.kind, at: f.at })} onMouseLeave={() => setHoverLair(null)} onClick={() => onClickCell(f.at)} style={{ cursor: "pointer" }} opacity={cleared ? 0.45 : 1}>
              <circle r={CELL * 0.66} fill="var(--parchment)" stroke={cleared ? "var(--ink-soft)" : "var(--danger)"} strokeWidth="1.6" />
              <path d={LAIR_GLYPH} fill="var(--ink)" stroke="var(--ink)" strokeWidth="0.8" strokeLinejoin="round" transform="scale(1.3)" />
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
              <text y={CELL * 0.95} textAnchor="middle" className="town-label" style={{ fontSize: 9 }}>{r.fleeing ? "flees" : ["", "I", "II", "III"][r.tier]}</text>
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
        if (x >= 0 && y >= 0 && x < map.width && y < map.height && map.passable[idx(map, { x, y })]) onClickCell({ x, y });
      }}>
        {miniRegions.map(({ reg, runs }) => runs.map((r, i) => <rect key={`${reg.index}-${i}`} x={r.x * MINI} y={r.y * MINI} width={r.w * MINI} height={MINI} fill={washFor(reg.tier, reg.color)} />))}
        {map.towns.map((t) => <rect key={t.index} x={t.at.x * MINI - MINI * 0.5} y={t.at.y * MINI - MINI * 0.5} width={MINI * 2} height={MINI * 2} fill="var(--ink)" />)}
        {map.strongholds.map((f, i) => <rect key={`f${i}`} x={f.at.x * MINI - MINI * 0.5} y={f.at.y * MINI - MINI * 0.5} width={MINI * 2} height={MINI * 2} fill="var(--danger)" />)}
        {roamers.map((r) => <circle key={r.id} cx={(r.at.x + 0.5) * MINI} cy={(r.at.y + 0.5) * MINI} r={MINI} fill={r.fleeing ? "var(--ink-soft)" : "var(--danger)"} />)}
        <rect x={origin.x * MINI} y={origin.y * MINI} width={vw * MINI} height={vh * MINI} fill="none" stroke="var(--brass)" strokeWidth="1.2" />
        <circle cx={(player.x + 0.5) * MINI} cy={(player.y + 0.5) * MINI} r={MINI * 1.4} fill="var(--brass)" stroke="var(--ink)" strokeWidth="0.6" />
      </svg>
    </div>
  );
}
