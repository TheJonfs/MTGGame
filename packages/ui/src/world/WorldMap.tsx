import { useState } from "react";
import { idx, type Point, type Town, type WorldMap as WorldMapModel } from "@shandalar/world";

/**
 * Ink-and-wash cartography (S13 Part 1, art-direction §0): flat wash per
 * region tier tinted by the region's colour, ink borders between regions,
 * hatched rough terrain, town glyphs with hover labels, the player as a
 * portrait chip, and a dotted ink path preview. Pure SVG, cells clickable.
 */

const CELL = 18;

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

export function WorldMapView({
  map,
  player,
  portrait,
  preview,
  previewTarget,
  encounterAt,
  encounterPortrait,
  clearedFixed,
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
  onClickCell: (p: Point) => void;
}) {
  const [hoverTown, setHoverTown] = useState<Town | null>(null);
  const [hoverLair, setHoverLair] = useState<{ name: string; at: Point } | null>(null);
  const W = map.width * CELL;
  const H = map.height * CELL;
  const centre = (p: Point) => ({ cx: p.x * CELL + CELL / 2, cy: p.y * CELL + CELL / 2 });

  // Region borders: an ink segment wherever a cell's right/bottom neighbour is in another region.
  const borders: string[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const r = map.region[y * map.width + x];
      if (x + 1 < map.width && map.region[y * map.width + x + 1] !== r) borders.push(`M${(x + 1) * CELL} ${y * CELL} v${CELL}`);
      if (y + 1 < map.height && map.region[(y + 1) * map.width + x] !== r) borders.push(`M${x * CELL} ${(y + 1) * CELL} h${CELL}`);
    }
  }

  return (
    <svg className="world-map" viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="rough" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(43,37,32,0.55)" strokeWidth="1.2" />
        </pattern>
        <filter id="paper" x="0" y="0">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" in2="n" mode="multiply" />
        </filter>
        <clipPath id="chip"><circle r={CELL * 0.75} /></clipPath>
      </defs>
      {/* washes */}
      {map.region.map((r, i) => {
        const x = i % map.width, y = Math.floor(i / map.width);
        const reg = map.regions[r]!;
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
      {map.passable.map((p, i) =>
        p ? null : (
          <rect key={`r${i}`} x={(i % map.width) * CELL} y={Math.floor(i / map.width) * CELL} width={CELL} height={CELL} fill="url(#rough)" pointerEvents="none" />
        ),
      )}
      {/* region borders */}
      <path d={borders.join(" ")} stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" pointerEvents="none" opacity="0.85" />
      {/* region names at hearts */}
      {map.regions.map((reg) => {
        // Clamp labels inside the map (hearts can sit near an edge).
        const half = reg.name.length * 3.4;
        const x = Math.max(half + 4, Math.min(W - half - 4, centre(reg.heart).cx));
        const y = Math.max(14, Math.min(H - 6, centre(reg.heart).cy - CELL));
        return (
          <text key={reg.index} x={x} y={y} className="region-label" textAnchor="middle" pointerEvents="none">
            {reg.name}
          </text>
        );
      })}
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
      {map.towns.map((t) => {
        const { cx, cy } = centre(t.at);
        return (
          <g key={t.index} transform={`translate(${cx} ${cy + 1})`} onMouseEnter={() => setHoverTown(t)} onMouseLeave={() => setHoverTown(null)} onClick={() => onClickCell(t.at)} style={{ cursor: "pointer" }}>
            <circle r={CELL * 0.62} fill="var(--parchment)" stroke="var(--ink)" strokeWidth="1.4" />
            <path d={TOWN_GLYPH} fill="var(--ink)" stroke="var(--ink)" strokeWidth="0.8" strokeLinejoin="round" />
          </g>
        );
      })}
      {/* lairs (fixed points) */}
      {map.strongholds.map((f, i) => {
        const { cx, cy } = centre(f.at);
        const cleared = clearedFixed?.has(i) ?? false;
        return (
          <g key={`f${i}`} transform={`translate(${cx} ${cy + 1})`} onMouseEnter={() => setHoverLair({ name: f.name ?? f.kind, at: f.at })} onMouseLeave={() => setHoverLair(null)} onClick={() => onClickCell(f.at)} style={{ cursor: "pointer" }} opacity={cleared ? 0.45 : 1}>
            <circle r={CELL * 0.66} fill="var(--parchment)" stroke={cleared ? "var(--ink-soft)" : "var(--danger)"} strokeWidth="1.6" />
            <path d={LAIR_GLYPH} fill="var(--ink)" stroke="var(--ink)" strokeWidth="0.8" strokeLinejoin="round" />
          </g>
        );
      })}
      {hoverLair && (
        <g transform={`translate(${centre(hoverLair.at).cx} ${centre(hoverLair.at).cy - CELL})`} pointerEvents="none">
          <rect x={-hoverLair.name.length * 3.6 - 6} y={-11} width={hoverLair.name.length * 7.2 + 12} height={16} rx="3" fill="var(--parchment)" stroke="var(--ink)" strokeWidth="1" />
          <text y={1} textAnchor="middle" className="town-label">{hoverLair.name}</text>
        </g>
      )}
      {hoverTown && (
        <g transform={`translate(${centre(hoverTown.at).cx} ${centre(hoverTown.at).cy - CELL})`} pointerEvents="none">
          <rect x={-hoverTown.name.length * 3.6 - 6} y={-11} width={hoverTown.name.length * 7.2 + 12} height={16} rx="3" fill="var(--parchment)" stroke="var(--ink)" strokeWidth="1" />
          <text y={1} textAnchor="middle" className="town-label">{hoverTown.name}</text>
        </g>
      )}
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
  );
}
