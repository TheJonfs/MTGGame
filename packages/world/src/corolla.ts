/**
 * S26 (ADR-091; the-bloom-gauntlet-v1.md §3–§4, v1.2): THE COROLLA and THE VAULT — the gauntlet,
 * all but its heart.
 *
 * The Corolla is a small radial WORLD (not a dungeon): five petals around a central town — the
 * logo rendered as geography. Entered from the outer map's centre on five seals. World-kind rules
 * (Chris-ruled at the S26 kickoff): pay-as-you-go (no escrow), cleared petals persist, walk out
 * and return, no roamers, no fog (the flower is known entire), the OUTER CLOCK FROZEN inside
 * (no steps tick; the inn rests for free — time does not pass in the flower), ante ON at the
 * petals, a loss leaves you standing where you fell. Each petal's tip is a fixed-point boss fight
 * (the ADR-067 lair pattern): the still-pair signature's deck under the chamber's RETURNED law —
 * the lord's partisan law re-injected on the boss's side, exactly as at his seat. The petal wears
 * the LAW's colour; its boss wields the two colours of the neighbouring petals (the Cinquefoil
 * configuration: WBRUG ring order, each still pair = the lord's two ring-neighbours).
 *
 * The Vault (outer centre, the second door) opens on the five Moxen: the MIRROR — your own deck
 * plus the Black Lotus played against you by the master profile; ante off both ways; no guardian
 * card; the Lotus is the prize; cleared = plain ground.
 *
 * Save shape: additive optional fields inside the reserved `gauntlet` object (no format bump —
 * Chris's ruling): `petals` (fallen flags), `vault` ("cleared"), `corolla` (inside: position +
 * steps walked), plus the reserved `opened`/`attempts` now written.
 */
import type { CardDef } from "@shandalar/cards";
import type { MatchResult, MatchSpec, Modifier } from "@shandalar/engine";
import { activeDeck, maxWorldLife, moxenHeld, MOX_IDS, type WorldState } from "./state.js";
import { addToCollection, deckLegal, forfeitCards, recordDuel } from "./journey.js";
import { lawModifier, sealsHeld } from "./stronghold.js";
import { empowermentModifiers, type EmpowermentTier } from "./dungeon.js";
import { manalinkModifiers } from "./quests.js";
import { shopPrice, type ShopItem } from "./shop.js";
import { findPath, idx, manhattan, samePoint, type FixedPoint, type Point, type Town, type WorldMap } from "./map.js";
import type { KnobValues } from "./knobs.js";
import type { Catalog } from "./catalog.js";
import type { WorldRng } from "./rng.js";

export type PetalColor = "W" | "U" | "B" | "R" | "G";
/** The ring order (lore canon, generate.ts §1): petal 0 at the top, then clockwise. */
export const PETAL_ORDER: readonly PetalColor[] = ["W", "B", "R", "U", "G"];

/** Content (data/world/dungeons.json `corolla`): the flower's names, the five petal bosses. */
export interface CorollaPetalDef {
  /** The LAW's colour (the lord whose law returns here). */
  color: PetalColor;
  boss: { key: string; name: string; portrait: string };
  /** The still-pair signature (sole-mechanism drop) and the pair's two duals (one copy each). */
  signature: string;
  duals: [string, string];
}
export interface CorollaDef {
  name: string;
  town: { name: string };
  vault: { name: string };
  petals: CorollaPetalDef[];
  /** Petal-boss starting life (Chris: 30 to start; petal-sim and play tune it) — the knob overrides when set. */
  bossLife?: number;
  /** S27 (ADR-093): the Heart — the Manafleur behind the town's door (absent = no fight, S26's state). */
  heart?: HeartDef;
}
export interface HeartDef {
  name: string;
  boss: { name: string; portrait: string; cardId: string };
}

export function validateCorollaDef(def: CorollaDef | undefined): string[] {
  if (!def) return [];
  const errors: string[] = [];
  if (!def.name || !def.town?.name || !def.vault?.name) errors.push("corolla: name/town.name/vault.name required");
  if (!Array.isArray(def.petals) || def.petals.length !== 5 || new Set(def.petals.map((p) => p.color)).size !== 5) errors.push("corolla: petals must be five entries covering the five colours");
  for (const p of def.petals ?? []) {
    if (!p.boss?.key || !p.boss?.name || !p.boss?.portrait) errors.push(`corolla petal ${p.color}: boss key/name/portrait required`);
    if (!p.signature || !Array.isArray(p.duals) || p.duals.length !== 2) errors.push(`corolla petal ${p.color}: signature + two duals required`);
  }
  if (def.heart && (!def.heart.name || !def.heart.boss?.name || !def.heart.boss?.portrait || !def.heart.boss?.cardId)) errors.push("corolla.heart: name + boss name/portrait/cardId required");
  return errors;
}

// ---------- geometry ----------

export const COROLLA_HEART = 5; // region index of the central disc (the town's clearing)
export const COROLLA_VOID = 6; // region index of the unpainted paper beyond the petals

export interface CorollaGeometry {
  size: number;
  passable: boolean[];
  /** Row-major region per cell: 0..4 = petal (PETAL_ORDER index), 5 = heart, 6 = void. */
  region: number[];
  petals: { color: PetalColor; tip: Point; heart: Point }[];
  town: Point;
  /** Where you stand on entry — just off the town's centre (Chris, kickoff #15). */
  entry: Point;
}

/** The logo as geography: five elliptical lobes on the ring's spokes around a central disc.
 * Pure and deterministic from `size` alone — the flower is the same in every world (it is the
 * plane's own shape); only its STATE lives in the save. */
export function generateCorolla(size = 41): CorollaGeometry {
  const s = Math.max(21, size | 1); // odd, so the centre is a cell
  const c = (s - 1) / 2;
  const R = c;
  // S27 (ADR-092: "narrow the lobes until paper shows between them — the logo has gaps"): the
  // lobes are slimmer and sit further out; a two-cell STEM along each spoke joins lobe to heart
  // (the logo's petals meet at the centre), so every tip stays reachable.
  const heartR = R * 0.16;
  const lobeD = R * 0.6, lobeA = R * 0.38, lobeB = R * 0.17;
  const stemHalf = 1.0;
  const passable = new Array<boolean>(s * s).fill(false);
  const region = new Array<number>(s * s).fill(COROLLA_VOID);
  const spokes = PETAL_ORDER.map((color, i) => {
    const th = ((-90 + i * 72) * Math.PI) / 180;
    return { color, ux: Math.cos(th), uy: Math.sin(th) };
  });
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - c, dy = y - c;
      const i = y * s + x;
      if (Math.hypot(dx, dy) <= heartR) {
        passable[i] = true;
        region[i] = COROLLA_HEART;
        continue;
      }
      // Nearest spoke by angle; inside its lobe = passable petal cell.
      let best = -1, bestDot = -Infinity;
      spokes.forEach((sp, k) => {
        const dot = dx * sp.ux + dy * sp.uy;
        if (dot > bestDot) { bestDot = dot; best = k; }
      });
      const sp = spokes[best]!;
      const along = dx * sp.ux + dy * sp.uy - lobeD;
      const across = -dx * sp.uy + dy * sp.ux;
      const inLobe = (along * along) / (lobeA * lobeA) + (across * across) / (lobeB * lobeB) <= 1;
      const dist = dx * sp.ux + dy * sp.uy;
      const inStem = Math.abs(across) <= stemHalf && dist > 0 && dist < lobeD;
      if (inLobe || inStem) {
        passable[i] = true;
        region[i] = best;
      }
    }
  }
  const petals = spokes.map((sp, k) => {
    // The tip: the lobe's passable cell farthest along the spoke (ties → nearest the axis).
    let tip: Point = { x: c, y: c }, tipScore = -Infinity;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (region[y * s + x] !== k) continue;
      const dx = x - c, dy = y - c;
      const score = (dx * sp.ux + dy * sp.uy) * 100 - Math.abs(-dx * sp.uy + dy * sp.ux);
      if (score > tipScore) { tipScore = score; tip = { x, y }; }
    }
    const heart = { x: Math.round(c + sp.ux * lobeD), y: Math.round(c + sp.uy * lobeD) };
    return { color: sp.color, tip, heart };
  });
  const town = { x: c, y: c };
  const entry = { x: c, y: c + 2 };
  passable[idx({ width: s }, entry)] = true;
  return { size: s, passable, region, petals, town, entry };
}

/** The flower as a WorldMap for the shared map stack (renderer register "corolla"). Petals are
 * regions in the LAW's colour named for the law; the heart and the void carry no name. */
export function corollaAsWorldMap(geom: CorollaGeometry, def: CorollaDef, lawNames: Partial<Record<PetalColor, string>>, fallen: ReadonlySet<PetalColor>): WorldMap {
  const s = geom.size;
  const regions = [
    ...geom.petals.map((p, i) => ({ index: i, templateId: `petal_${p.color}`, name: lawNames[p.color] ?? `the ${p.color} petal`, tier: "wild" as const, color: p.color, heart: p.heart })),
    { index: COROLLA_HEART, templateId: "corolla_heart", name: "", tier: "civilized" as const, color: "C", heart: { x: -99, y: -99 } },
    { index: COROLLA_VOID, templateId: "corolla_void", name: "", tier: "void" as never, color: "C", heart: { x: -99, y: -99 } },
  ];
  const strongholds: FixedPoint[] = geom.petals.map((p, i) => {
    const pd = def.petals.find((d) => d.color === p.color);
    return { kind: "petal", at: p.tip, region: i, name: pd ? `${pd.boss.name} — ${lawNames[p.color] ?? p.color}` : p.color, ...(fallen.has(p.color) ? { opponentId: "fallen" } : {}) };
  });
  return {
    width: s,
    height: s,
    region: [...geom.region],
    passable: [...geom.passable],
    road: new Array<boolean>(s * s).fill(false),
    regions,
    towns: [{ index: COROLLA_TOWN_INDEX, name: def.town.name, region: COROLLA_HEART, at: geom.town }],
    strongholds,
    start: { ...geom.entry },
    centre: { ...geom.town },
  };
}

// ---------- state ----------

export interface CorollaInside {
  position: Point;
  /** Steps walked in the flower (the empowerment knob's input — shipped OFF; the clock stops here). */
  steps: number;
}

/** The gauntlet save slot, typed (state.ts declares it loosely; this is the S26 occupancy). */
export interface GauntletState {
  opened?: boolean;
  attempts?: number;
  /** S27: the per-run chronicle — one entry per Manafleur victory (copied into the profile). */
  chronicle?: ChronicleEntry[];
  /** S27: the run is finishable — the Manafleur fell at least once (postponement; the world stays playable). */
  completed?: true;
  petals?: Partial<Record<PetalColor, true>>;
  vault?: "cleared";
  corolla?: CorollaInside | null;
}

export function gauntletState(world: WorldState): GauntletState {
  return world.gauntlet as GauntletState;
}
export function petalsFallen(world: WorldState): PetalColor[] {
  const p = gauntletState(world).petals ?? {};
  return PETAL_ORDER.filter((c) => p[c] === true);
}
export function insideCorolla(world: WorldState): CorollaInside | null {
  return gauntletState(world).corolla ?? null;
}

/** The outer door: five seals part the petals. */
export function corollaDoor(world: WorldState): { seals: number; open: boolean; opened: boolean } {
  const seals = sealsHeld(world);
  return { seals, open: seals >= 5, opened: gauntletState(world).opened === true };
}
/** The second door: the five Moxen, then the Mirror; cleared = plain ground. */
export function vaultDoor(world: WorldState): { moxen: number; open: boolean; cleared: boolean } {
  const moxen = moxenHeld(world);
  return { moxen, open: moxen >= MOX_IDS.length, cleared: gauntletState(world).vault === "cleared" };
}
/** The Heart's door in the town: readable, locked until five petals fall — no fight behind it this session. */
export function heartDoor(world: WorldState): { fallen: number; total: number; open: boolean } {
  const fallen = petalsFallen(world).length;
  return { fallen, total: 5, open: fallen >= 5 };
}

/** Step through the parting petals: attempts count, the door is marked opened, you stand at the entry. */
export function enterCorolla(world: WorldState, geom: CorollaGeometry): void {
  const g = gauntletState(world);
  g.opened = true;
  g.attempts = (g.attempts ?? 0) + 1;
  g.corolla = { position: { ...geom.entry }, steps: 0 };
}
/** Walk back out to the outer world: the flower keeps its wounds (fallen petals persist); your
 * outer position never moved (you stood at the door the whole time). */
export function leaveCorolla(world: WorldState): void {
  gauntletState(world).corolla = null;
}

// ---------- movement (no clock) ----------

export type CorollaEvent =
  | { type: "moved"; to: Point }
  /** You stand at a petal's tip with its boss unfallen — the fight telegraphs. */
  | { type: "petal"; color: PetalColor }
  /** You reached the town at the heart. */
  | { type: "heart" };

export function corollaPath(map: WorldMap, from: Point, to: Point): Point[] | null {
  return findPath(map, from, to);
}

/** Walk the flower. NO clocks: steps inside count only for the (shipped-off) empowerment knob;
 * the outer world's sieges, quests, roamers, and lord growth stand still. Stops at an unfallen
 * petal tip or the town, like the overworld stops at thresholds and gates. */
export function corollaAdvance(world: WorldState, geom: CorollaGeometry, path: Point[]): CorollaEvent[] {
  const inside = insideCorolla(world);
  if (!inside) throw new Error("corollaAdvance: not inside the Corolla");
  const fallen = new Set(petalsFallen(world));
  const events: CorollaEvent[] = [];
  for (const cell of path) {
    if (!geom.passable[idx({ width: geom.size }, cell)]) throw new Error(`corollaAdvance: cell ${cell.x},${cell.y} is beyond the petals`);
    inside.position = { ...cell };
    inside.steps += 1;
    events.push({ type: "moved", to: { ...cell } });
    const petal = geom.petals.find((p) => samePoint(p.tip, cell));
    if (petal && !fallen.has(petal.color)) {
      events.push({ type: "petal", color: petal.color });
      break;
    }
    if (samePoint(cell, geom.town)) {
      events.push({ type: "heart" });
      break;
    }
  }
  return events;
}

// ---------- the petal fights ----------

export interface PetalEnemy {
  name: string;
  decklist: { cardId: string; count: number }[];
  archetype: "aggro" | "midrange" | "control";
}

/** The petal's law: the lord's partisan law by the petal's colour, re-injected on the boss's side
 * (the dungeon-law hook on a fixed point — exactly the seat's rule, returned). */
export function petalLawModifier(catalog: Catalog, color: PetalColor): Modifier | null {
  const content = (catalog.strongholdContent ?? []).find((c) => c.color === color);
  return content ? lawModifier(content) : null;
}
export function petalLawName(catalog: Catalog, color: PetalColor): string | undefined {
  return (catalog.strongholdContent ?? []).find((c) => c.color === color)?.law.name;
}

export function petalBossLife(knobs: KnobValues, def: CorollaDef): number {
  return knobs.petalBossLife > 0 ? knobs.petalBossLife : (def.bossLife ?? 30);
}

/** The empowerment knob, shipped OFF (default []): tiers reached by steps walked in the flower. */
export function corollaTiersReached(world: WorldState, knobs: KnobValues): EmpowermentTier[] {
  const steps = insideCorolla(world)?.steps ?? 0;
  return knobs.corollaEmpowermentTiers.filter((t) => steps >= t.steps);
}

export function petalDuelSpec(
  world: WorldState,
  catalog: Catalog,
  knobs: KnobValues,
  def: CorollaDef,
  petal: CorollaPetalDef,
  enemy: PetalEnemy,
  rng: WorldRng,
): { spec: MatchSpec; enemyName: string; enemyLife: number; lawName?: string } {
  const legal = deckLegal(activeDeck(world));
  if (!legal.ok) throw new Error(`cannot fight the petal: ${legal.reason}`);
  const law = petalLawModifier(catalog, petal.color);
  const emp = empowermentModifiers(corollaTiersReached(world, knobs), petal.color);
  const enemyLife = Math.max(1, petalBossLife(knobs, def) + emp.lifeBonus);
  const spec: MatchSpec = {
    seed: rng.int(1_000_000_000),
    players: [
      { name: world.player.name, decklist: activeDeck(world).map((e) => ({ ...e })), agent: "human" },
      { name: enemy.name, decklist: enemy.decklist.map((e) => ({ ...e })), agent: "heuristic:master" },
    ],
    // World-kind: the fight starts at your WORLD life (no interior track) and antes as the world does.
    rules: { startingLife: world.player.worldLife, handSize: 7, mulligan: "london", maxTurns: 100, ante: knobs.anteCount, startingPlayer: rng.chance(0.5) ? 0 : 1 },
    modifiers: [
      { type: "startingLife", player: 1, value: enemyLife },
      ...(law ? [law] : []),
      ...emp.modifiers,
      ...manalinkModifiers(world),
    ],
  };
  const lawName = petalLawName(catalog, petal.color);
  return { spec, enemyName: enemy.name, enemyLife, ...(lawName ? { lawName } : {}) };
}

export type PetalOutcome =
  | { type: "win"; paidGold: number; paidCards: string[]; anteWon: string[]; anteWithheld: string[]; ministerWithheld: boolean }
  | { type: "loss"; anteLost: string[] };

/** Pay-as-you-go: a WIN pays the signature (sole-mechanism), one copy of each of the pair's duals,
 * the gold purse, and the ante — minus any prizeOnly card the boss's deck staked (the sole-mechanism
 * law: there is exactly one, and it drops by defeat, not by ante). A LOSS costs the world's usual
 * price (stake + a world life) and leaves you standing where you fell. */
export function applyPetalDuel(
  world: WorldState,
  knobs: KnobValues,
  pool: Map<string, CardDef>,
  petal: CorollaPetalDef,
  result: MatchResult,
  record?: { seed: number; spec: MatchSpec; enemyName: string },
): PetalOutcome {
  if (record) {
    recordDuel(world, record.seed, record.spec, result, {
      opponentId: `petal_${petal.color}`,
      catalogId: `petal_${petal.color}`,
      enemyName: record.enemyName,
      outcome: result.winner === 0 ? "win" : result.winner === 1 ? "loss" : "draw",
      anteWon: result.winner === 0 ? [...result.facts.ante[1]] : [],
      anteLost: result.winner === 1 ? [...result.facts.ante[0]] : [],
    });
  }
  if (result.winner === 0) {
    const g = gauntletState(world);
    (g.petals ??= {})[petal.color] = true;
    const staked = [...result.facts.ante[1]];
    const anteWon = staked.filter((id) => !pool.get(id)?.prizeOnly);
    const anteWithheld = staked.filter((id) => pool.get(id)?.prizeOnly);
    // S27 (ADR-093, the never-duplicate rule): a minister already held (carried in from the
    // chronicle) is withheld — the petal yields coin instead, and the two currents it kept.
    const ministerWithheld = (world.player.collection[petal.signature] ?? 0) > 0;
    const paidCards = ministerWithheld ? [...petal.duals] : [petal.signature, ...petal.duals];
    addToCollection(world, paidCards, "reward");
    if (anteWon.length) addToCollection(world, anteWon, "ante");
    const paidGold = knobs.petalGoldPrize * (ministerWithheld ? 2 : 1);
    world.player.gold += paidGold;
    return { type: "win", paidGold, paidCards, anteWon, anteWithheld, ministerWithheld };
  }
  // Draws count as losses at a fixed point (the lair pattern's rule, the dungeon's too).
  const anteLost = [...result.facts.ante[0]];
  forfeitCards(world, anteLost);
  world.player.worldLife = Math.max(knobs.lifeFloor, world.player.worldLife - knobs.lossLifePenalty);
  if (world.player.worldLife <= 0) world.gameOver = true;
  return { type: "loss", anteLost };
}

// ---------- the Vault: the Mirror ----------

/** The reflection's posture, read off the deck (Chris: derive, midrange fallback): a creature-heavy
 * curve plays aggro; a spell-heavy, creature-light list plays control; everything else midrange. */
export function deriveArchetype(decklist: { cardId: string; count: number }[], pool: Map<string, CardDef>): "aggro" | "midrange" | "control" {
  let creatures = 0, spells = 0, cheapCreatures = 0, nonland = 0;
  for (const e of decklist) {
    const d = pool.get(e.cardId);
    if (!d || d.types.includes("Land")) continue;
    nonland += e.count;
    if (d.types.includes("Creature")) {
      creatures += e.count;
      const mv = (d.manaCost.match(/\{[^}]+\}/g) ?? []).reduce((n, sym) => n + (/^\{\d+\}$/.test(sym) ? Number(sym.slice(1, -1)) : 1), 0);
      if (mv <= 2) cheapCreatures += e.count;
    } else if (d.types.includes("Instant") || d.types.includes("Sorcery")) spells += e.count;
  }
  if (nonland === 0) return "midrange";
  if (creatures / nonland >= 0.6 && cheapCreatures >= 6) return "aggro";
  if (spells / nonland >= 0.45 && creatures / nonland <= 0.4) return "control";
  return "midrange";
}

export function mirrorDuelSpec(world: WorldState, knobs: KnobValues, pool: Map<string, CardDef>, rng: WorldRng): { spec: MatchSpec; archetype: "aggro" | "midrange" | "control"; enemyLife: number } {
  const legal = deckLegal(activeDeck(world));
  if (!legal.ok) throw new Error(`cannot enter the Vault: ${legal.reason}`);
  const mine = activeDeck(world).map((e) => ({ ...e }));
  // The reflection: the deck byte-for-byte, plus the prize — the Lotus fights for the other side.
  const reflection = [...mine.map((e) => ({ ...e })), { cardId: "black_lotus", count: 1 }];
  const enemyLife = maxWorldLife(world); // Chris: the mirror fights at your FULL life (13/16 → 16)
  const spec: MatchSpec = {
    seed: rng.int(1_000_000_000),
    players: [
      { name: world.player.name, decklist: mine, agent: "human" },
      { name: "Your reflection", decklist: reflection, agent: "heuristic:master" },
    ],
    // Ante OFF both ways: a reflection has nothing to lose, and mirror-ante would mint duplicates.
    rules: { startingLife: world.player.worldLife, handSize: 7, mulligan: "london", maxTurns: 100, ante: 0, startingPlayer: rng.chance(0.5) ? 0 : 1 },
    modifiers: [
      { type: "startingLife", player: 1, value: enemyLife },
      // The reflection brought your manalinks too (they are yours; it is you).
      ...manalinkModifiers(world),
      ...manalinkModifiers(world).map((m) => ({ ...m, player: 1 as const })),
    ],
  };
  void knobs;
  return { spec, archetype: deriveArchetype(mine, pool), enemyLife };
}

export type MirrorOutcome = { type: "win"; paidCards: string[] } | { type: "loss" };

/** The Lotus pays out and the Vault is ground; a loss costs a world life and no stake (ante was off).
 * The reflection's copies — prizeOnly included — never reach the collection: nothing crossed but
 * the prize. */
export function applyMirrorDuel(world: WorldState, knobs: KnobValues, result: MatchResult, record?: { seed: number; spec: MatchSpec }): MirrorOutcome {
  if (record) {
    recordDuel(world, record.seed, record.spec, result, {
      opponentId: "the_vault",
      catalogId: "the_vault",
      enemyName: "Your reflection",
      outcome: result.winner === 0 ? "win" : result.winner === 1 ? "loss" : "draw",
      anteWon: [],
      anteLost: [],
    });
  }
  if (result.winner === 0) {
    gauntletState(world).vault = "cleared";
    addToCollection(world, ["black_lotus"], "reward");
    return { type: "win", paidCards: ["black_lotus"] };
  }
  world.player.worldLife = Math.max(knobs.lifeFloor, world.player.worldLife - knobs.lossLifePenalty);
  if (world.player.worldLife <= 0) world.gameOver = true;
  return { type: "loss" };
}

// ---------- the town at the heart ----------

/** A virtual town index for the shop state (the flower's town is not on the outer map). */
export const COROLLA_TOWN_INDEX = 100_000;
export function corollaTown(def: CorollaDef, geom: CorollaGeometry): Town {
  return { index: COROLLA_TOWN_INDEX, name: def.town.name, region: COROLLA_HEART, at: { ...geom.town } };
}

/** The R-drawer shelf — the only place R is ever stocked (planner's proposal, Chris's yes): every
 * R-tier card (never prizeOnly, never tokens), priced × corollaShopMultiplier, one copy each.
 * Depletion persists in world.shops under the virtual index; the epoch never turns (the clock
 * stops here), so what you buy stays bought and what's left stays on the shelf. */
export function rollCorollaStock(world: WorldState, pool: Map<string, CardDef>, knobs: KnobValues): ShopItem[] {
  const st = (world.shops[COROLLA_TOWN_INDEX] ??= { epoch: 0, sold: {} });
  const shelf = [...pool.values()]
    .filter((d) => !(d as { isTokenDef?: boolean }).isTokenDef && !d.prizeOnly && d.shopTier === "R")
    .sort((a, b) => a.id.localeCompare(b.id));
  return shelf.map((def) => {
    const remaining = Math.max(0, 1 - (st.sold[def.id] ?? 0));
    return { cardId: def.id, price: Math.max(1, Math.round(shopPrice(def, knobs) * knobs.corollaShopMultiplier)), stock: 1, remaining };
  });
}

/** The inn at the heart: time does not pass in the flower, so rest costs nothing — you wake at
 * your full current maximum. (Ruling-by-doing, flagged: the outer inn trades steps for life; here
 * there are no steps to trade.) Returns the life restored. */
export function corollaInnRest(world: WorldState): number {
  const max = maxWorldLife(world);
  const before = world.player.worldLife;
  world.player.worldLife = Math.max(before, max);
  return world.player.worldLife - before;
}

// ---------- the outer doors ----------

/** Both doors' states in one read (the outer map's centre rail). */
export function gauntletDoors(world: WorldState): { corolla: ReturnType<typeof corollaDoor>; vault: ReturnType<typeof vaultDoor> } {
  return { corolla: corollaDoor(world), vault: vaultDoor(world) };
}

/** Which petal a tip belongs to (for the renderer's cleared-set and the telegraph). */
export function petalAt(geom: CorollaGeometry, p: Point): { color: PetalColor; index: number } | null {
  const i = geom.petals.findIndex((x) => samePoint(x.tip, p));
  return i >= 0 ? { color: geom.petals[i]!.color, index: i } : null;
}

/** Distance from the town — the rail's "how far to the tip" line. */
export function petalDistance(geom: CorollaGeometry, color: PetalColor): number {
  const p = geom.petals.find((x) => x.color === color)!;
  return manhattan(p.tip, geom.town);
}

// ---------- S27 (ADR-093): the Heart — the Manafleur ----------

/** The run's starting colour (the chronicle's key), from the starter id. */
export function startingColor(world: WorldState, catalog: Catalog): PetalColor {
  const st = catalog.starters.find((x) => x.id === world.player.starterId);
  return ((st?.color as PetalColor | undefined) ?? "G");
}

export interface ChronicleEntry {
  /** Running count across the profile ("The first cutting" …). */
  n: number;
  color: PetalColor;
  text: string;
  seed: number;
  difficulty: string;
  steps: number;
  /** ISO date of the folding (the profile's ledger; not game state). */
  when: string;
}

/** ADR-096 (S28): the Heart's ROOTS — one basic of each type on the Manafleur's side, untapped,
 * before turn one (the manalink path: one-sided `permanentOnBattlefield`; logged, replay-clean). */
export const HEART_ROOTS = ["plains", "island", "swamp", "mountain", "forest"] as const;
export function heartRootModifiers(player: 0 | 1 = 1): { type: "permanentOnBattlefield"; player: 0 | 1; cardId: string }[] {
  return HEART_ROOTS.map((cardId) => ({ type: "permanentOnBattlefield" as const, player, cardId }));
}

/** The Heart's spec: the Manafleur's deck under the master profile at heartLife (flat), the entrance
 * (the Manafleur in hand turn one) AND the roots (ADR-096: the five basics in play — WUBRG on the
 * table, a turn-one flower), ZERO ante, the default law sequence (the WBRUG ring). The player fights
 * at world life; manalinks apply. World-kind: nothing is escrowed. */
export function heartDuelSpec(world: WorldState, catalog: Catalog, knobs: KnobValues, def: CorollaDef, enemy: PetalEnemy, rng: WorldRng): { spec: MatchSpec; enemyName: string; enemyLife: number } {
  const legal = deckLegal(activeDeck(world));
  if (!legal.ok) throw new Error(`cannot face the Heart: ${legal.reason}`);
  const heart = def.heart;
  if (!heart) throw new Error("the Heart is not in this catalog");
  const enemyLife = Math.max(1, knobs.heartLife);
  const spec: MatchSpec = {
    seed: rng.int(1_000_000_000),
    players: [
      { name: world.player.name, decklist: activeDeck(world).map((e) => ({ ...e })), agent: "human" },
      { name: enemy.name, decklist: enemy.decklist.map((e) => ({ ...e })), agent: "heuristic:master" },
    ],
    rules: { startingLife: world.player.worldLife, handSize: 7, mulligan: "london", maxTurns: 100, ante: 0, startingPlayer: rng.chance(0.5) ? 0 : 1 },
    modifiers: [
      { type: "startingLife", player: 1, value: enemyLife },
      { type: "signatureToHand", player: 1, cardId: heart.boss.cardId },
      ...heartRootModifiers(1),
      { type: "lawSequence" },
      ...manalinkModifiers(world),
    ],
  };
  return { spec, enemyName: enemy.name, enemyLife };
}

export type HeartOutcome =
  | { type: "win"; paidCards: string[]; entry: ChronicleEntry; first: boolean }
  | { type: "loss" };

/** The Manafleur's fall: the card drops (sole-mechanism — once; a held copy is not duplicated), the
 * run is marked complete, and the chronicle entry for the run's starting road is written into the
 * per-run ledger (the caller copies it into the profile). A loss costs a world life; you stay at
 * the heart (world-kind; regroup and retry). */
export function applyHeartDuel(
  world: WorldState,
  catalog: Catalog,
  knobs: KnobValues,
  result: MatchResult,
  opts: { cuttingsSoFar: number; text: (color: PetalColor) => string },
  record?: { seed: number; spec: MatchSpec; enemyName: string },
): HeartOutcome {
  if (record) {
    recordDuel(world, record.seed, record.spec, result, {
      opponentId: "the_heart",
      catalogId: "the_heart",
      enemyName: record.enemyName,
      outcome: result.winner === 0 ? "win" : result.winner === 1 ? "loss" : "draw",
      anteWon: [],
      anteLost: [],
    });
  }
  if (result.winner === 0) {
    const g = gauntletState(world);
    const first = g.completed !== true;
    g.completed = true;
    const cardId = catalog.corolla?.heart?.boss.cardId ?? "the_manafleur";
    const paidCards = (world.player.collection[cardId] ?? 0) > 0 ? [] : [cardId];
    if (paidCards.length) addToCollection(world, paidCards, "reward");
    const color = startingColor(world, catalog);
    const entry: ChronicleEntry = { n: opts.cuttingsSoFar + 1, color, text: opts.text(color), seed: world.seed, difficulty: world.difficulty, steps: world.player.stepsTaken, when: new Date().toISOString() };
    (g.chronicle ??= []).push(entry);
    return { type: "win", paidCards, entry, first };
  }
  world.player.worldLife = Math.max(knobs.lifeFloor, world.player.worldLife - knobs.lossLifePenalty);
  if (world.player.worldLife <= 0) world.gameOver = true;
  return { type: "loss" };
}

// ---------- S27: the profile store — the chronicle's first phase (framing + carryover) ----------

/** The per-player LEGACY, outside the world save (the UI keeps it under its own key; read at
 * new-game, written at Manafleur victory). Versioned from day one. */
export interface Legacy {
  version: 1;
  /** Manafleur victories per starting colour. */
  cuttings: Partial<Record<PetalColor, number>>;
  /** Every entry ever written, in order (the Chronicle of Cuttings). */
  chronicle: ChronicleEntry[];
  victories: number;
}
export const LEGACY_VERSION = 1 as const;
export function emptyLegacy(): Legacy {
  return { version: LEGACY_VERSION, cuttings: {}, chronicle: [], victories: 0 };
}
/** Migration hygiene: accept any object, return a well-formed legacy (unknown shapes → empty). */
export function migrateLegacy(raw: unknown): Legacy {
  if (!raw || typeof raw !== "object") return emptyLegacy();
  const r = raw as Partial<Legacy>;
  if (r.version !== 1) return emptyLegacy();
  return { version: 1, cuttings: { ...(r.cuttings ?? {}) }, chronicle: [...(r.chronicle ?? [])], victories: r.victories ?? 0 };
}
/** Record a Manafleur victory: the colour's cutting count, the entry, the total. Returns a new legacy. */
export function recordCutting(legacy: Legacy, entry: ChronicleEntry): Legacy {
  return {
    version: 1,
    cuttings: { ...legacy.cuttings, [entry.color]: (legacy.cuttings[entry.color] ?? 0) + 1 },
    chronicle: [...legacy.chronicle, entry],
    victories: legacy.victories + 1,
  };
}
/** The colours cut at least once — the five FLAGS (ADR-095). */
export function cutColors(legacy: Legacy): PetalColor[] {
  return PETAL_ORDER.filter((c) => (legacy.cuttings[c] ?? 0) > 0);
}
/** ADR-095: did THIS cutting set the fifth flag? (The fifth-cutting line fires once, on the cutting
 * that completed the set — not on a sixth entry, and never on a repeated colour.) */
export function setsFifthFlag(before: Legacy, after: Legacy): boolean {
  return cutColors(before).length === 4 && cutColors(after).length === 5;
}

/** What a cut colour carries into a new road (the doc's table): the colour's power, its teaching
 * guardian's card (site pre-cleared), its lord's complement minister (the petal of that colour). */
export function legacyCarry(catalog: Catalog, color: PetalColor): { power: PetalColor; guardianCard?: string; powerSiteId?: string; minister?: string } {
  const pd = (catalog.powerDungeons ?? []).find((d) => d.color === color);
  const petal = catalog.corolla?.petals.find((p) => p.color === color);
  return { power: color, ...(pd ? { guardianCard: pd.prize.guardianCard, powerSiteId: pd.id } : {}), ...(petal ? { minister: petal.signature } : {}) };
}

/** Apply the profile's carryover to a NEW world (world-side only, the engine untouched): for every
 * cut colour — the power pre-unlocked (fuel still earned), the guardian's card in the collection
 * with its site pre-cleared (the power-dungeon does not exist that run), the minister in the
 * collection; plus legacyGoldPerCutting per SET FLAG (ADR-095, S28: the legacy is five flags — a
 * repeated colour sets nothing further; the chronicle keeps every entry, it is a record, not the
 * reward source). Idempotent per card (never duplicates). */
export function applyLegacy(world: WorldState, catalog: Catalog, legacy: Legacy, knobs: KnobValues): { colors: PetalColor[]; cards: string[]; gold: number } {
  const colors = cutColors(legacy);
  const cards: string[] = [];
  for (const color of colors) {
    const carry = legacyCarry(catalog, color);
    if (!world.powers.unlocked.includes(color)) world.powers.unlocked.push(color);
    if (carry.guardianCard && !(world.player.collection[carry.guardianCard] ?? 0)) { addToCollection(world, [carry.guardianCard], "reward"); cards.push(carry.guardianCard); }
    if (carry.powerSiteId) (world.dungeons[carry.powerSiteId] ??= { cleared: false, resets: 0 }).cleared = true;
    if (carry.minister && !(world.player.collection[carry.minister] ?? 0)) { addToCollection(world, [carry.minister], "reward"); cards.push(carry.minister); }
  }
  const gold = knobs.legacyGoldPerCutting * colors.length;
  world.player.gold += gold;
  return { colors, cards, gold };
}
