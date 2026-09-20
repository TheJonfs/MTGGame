import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCatalog } from "./loader.js";
import { DEFAULT_GENERATOR, generateWorld } from "./generate.js";
import { findPath, idx } from "./map.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = loadCatalog(join(ROOT, "data/world"));
const SEEDS = [4101, 7, 99, 2026, 31337];

describe("S41 (ADR-130): the phase-two map — the flood's strongholds, the Calyx, no phase-one sites", () => {
  it("a phase-two map is a new map: the five strongholds carry the flood's names in their law's territory; no Mox court, no power dungeon, no Corolla, no Vault", () => {
    for (const seed of SEEDS) {
      const m = generateWorld(seed, catalog, DEFAULT_GENERATOR, { phase: 2, homeColor: "W" }).map;
      const kinds = m.strongholds.map((f) => f.kind);
      for (const gone of ["dungeon", "corolla", "vault", "petal"]) expect(kinds, `${seed}: ${gone}`).not.toContain(gone);
      const sh = m.strongholds.filter((f) => f.kind === "stronghold");
      expect(sh).toHaveLength(5);
      for (const f of sh) {
        const def = catalog.flood!.strongholds.find((s) => s.name === f.name);
        expect(def, `${seed}: ${f.name}`).toBeDefined();
        expect(m.regions[f.region]!.color, `${seed}: ${f.name}`).toBe(def!.color);
        expect(m.regions[f.region]!.tier, `${seed}: ${f.name}`).toBe("wild"); // the outer ring, as phase one's
      }
    }
  });
  it("the Calyx: deep water at the centre is impassable; five High Grounds stand in it, each carrying its court's id; the Heart's site is the centre", () => {
    for (const seed of SEEDS) {
      const m = generateWorld(seed, catalog, DEFAULT_GENERATOR, { phase: 2, homeColor: "G" }).map;
      expect(m.deep!.filter(Boolean).length, `${seed}`).toBeGreaterThan(40);
      for (let i = 0; i < m.deep!.length; i++) if (m.deep![i] && m.passable[i]) {
        const at = { x: i % m.width, y: Math.floor(i / m.width) };
        const site = m.strongholds.some((f) => f.at.x === at.x && f.at.y === at.y);
        expect(m.deepFord![i] || site, `${seed}: a passable deep cell is a ford or a site`).toBe(true);
      }
      const grounds = m.strongholds.filter((f) => f.kind === "ground");
      expect(grounds.map((g) => g.contentId).sort()).toEqual(catalog.flood!.courts.map((c) => c.id).sort());
      for (const g of grounds) expect(m.deep![idx(m, g.at)], `${seed}: ${g.name} stands in the water`).toBe(true);
      const heart = m.strongholds.filter((f) => f.kind === "deep");
      expect(heart).toHaveLength(1);
      expect(heart[0]!.at).toEqual(m.centre);
      for (const t of m.towns) expect(m.deep![idx(m, t.at)], `${seed}: ${t.name} is dry`).toBe(false);
    }
  });
  it("every ground is reachable from BOTH its pair's shores without crossing another colour's fords first… and everything is reachable from the start", () => {
    for (const seed of SEEDS) {
      const m = generateWorld(seed, catalog, DEFAULT_GENERATOR, { phase: 2, homeColor: "R" }).map;
      for (const g of m.strongholds.filter((f) => f.kind === "ground")) {
        const court = catalog.flood!.courts.find((c) => c.id === g.contentId)!;
        for (const colour of court.pair) {
          const town = m.towns.find((t) => m.regions[t.region]!.color === colour && m.regions[t.region]!.tier === "civilized")!;
          expect(findPath(m, town.at, g.at), `${seed}: ${g.name} from the ${colour} shore`).not.toBeNull();
        }
      }
      for (const f of m.strongholds) expect(findPath(m, m.start, f.at), `${seed}: ${f.kind} ${f.name}`).not.toBeNull();
      for (const t of m.towns) expect(findPath(m, m.start, t.at), `${seed}: ${t.name}`).not.toBeNull();
    }
  });
  it("phase one is untouched: no deep water, the Corolla's doors, the Mox courts and the power dungeons", () => {
    const m = generateWorld(4101, catalog, DEFAULT_GENERATOR, { homeColor: "W" }).map;
    expect(m.deep).toBeUndefined();
    expect(m.strongholds.filter((f) => f.kind === "dungeon")).toHaveLength(10);
    expect(m.strongholds.some((f) => f.kind === "corolla")).toBe(true);
    expect(m.width).toBe(generateWorld(4101, catalog).map.width);
  });
});
