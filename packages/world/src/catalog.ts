import { DECKS, type DeckKey } from "@shandalar/sim/decks";
import { assertKnobSource, type KnobSource, type RegionTier, type EnemyTier } from "./knobs.js";

/**
 * Authored catalog v0 (overworld manifest §2 "authored inventory, procedural
 * placement"; brief Part 2). Lives in `data/world/*.json`; validated here in a
 * browser-safe way (the fs loader is the `./loader` subpath, like cards).
 * A world is `(catalogVersion, seed)`: any catalog change that would alter
 * generation bumps the version.
 */
export const CATALOG_VERSION = "v0";

export type Color = "W" | "U" | "B" | "R" | "G" | "C";

export interface RegionTemplate {
  id: string;
  name: string;
  tier: RegionTier;
  /** Wash colour on the map + shop stock colour (S13). "C" = wild/colourless. */
  color: Color;
  /** Preferred town names for this region (falls back to the shared pool). */
  townNames: string[];
}

export type Difficulty = "apprentice" | "journeyman" | "master";

export interface OpponentTemplate {
  id: string;
  name: string;
  /** Slice opponents play the existing slice decks. */
  deck: DeckKey;
  tier: EnemyTier;
  difficulty: Difficulty;
  /** Portrait subject slug (docs/art/subjects/<slug>.md → /portraits/<slug>.png). */
  portrait: string;
  /** Enemy world life = their duel starting life (manifest §2a: per-opponent data). */
  worldLife: number;
  /** Colour identity string for UI washes, e.g. "R", "WU". */
  colors: string;
  /** Knob overrides at the `opponent` layer (e.g. a tier-3 carries anteCount 2). */
  knobs?: KnobSource;
}

export interface Catalog {
  version: string;
  regions: RegionTemplate[];
  townNames: string[];
  opponents: OpponentTemplate[];
}

/** Assemble + validate a catalog from already-parsed JSON objects (browser-safe). */
export function catalogFrom(parts: { regions: unknown; towns: unknown; opponents: unknown }): Catalog {
  const r = parts.regions as { catalogVersion: string; regions: RegionTemplate[] };
  const t = parts.towns as { catalogVersion: string; names: string[] };
  const o = parts.opponents as { catalogVersion: string; opponents: OpponentTemplate[] };
  const errors: string[] = [];
  for (const [what, v] of [["regions", r.catalogVersion], ["towns", t.catalogVersion], ["opponents", o.catalogVersion]] as const) {
    if (v !== CATALOG_VERSION) errors.push(`${what}: catalogVersion ${v} != ${CATALOG_VERSION}`);
  }
  const tiers = new Set<string>(["civilized", "approach", "wild"]);
  for (const reg of r.regions) {
    if (!reg.id || !reg.name) errors.push(`region missing id/name: ${JSON.stringify(reg)}`);
    if (!tiers.has(reg.tier)) errors.push(`region ${reg.id}: bad tier ${reg.tier}`);
    if (!Array.isArray(reg.townNames)) errors.push(`region ${reg.id}: townNames must be an array`);
  }
  if (!r.regions.some((x) => x.tier === "civilized")) errors.push("catalog needs at least one civilized region");
  const ids = new Set<string>();
  for (const op of o.opponents) {
    if (ids.has(op.id)) errors.push(`duplicate opponent id ${op.id}`);
    ids.add(op.id);
    if (!(op.deck in DECKS)) errors.push(`opponent ${op.id}: unknown deck ${op.deck}`);
    if (![1, 2, 3].includes(op.tier)) errors.push(`opponent ${op.id}: bad tier ${op.tier}`);
    if (!["apprentice", "journeyman", "master"].includes(op.difficulty)) errors.push(`opponent ${op.id}: bad difficulty ${op.difficulty}`);
    if (!Number.isInteger(op.worldLife) || op.worldLife < 1) errors.push(`opponent ${op.id}: bad worldLife`);
    if (op.knobs) {
      try {
        assertKnobSource(op.knobs as Record<string, unknown>, `opponent ${op.id}`);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
  }
  if (errors.length) throw new Error(`Catalog validation failed:\n${errors.join("\n")}`);
  return { version: CATALOG_VERSION, regions: r.regions, townNames: t.names, opponents: o.opponents };
}
