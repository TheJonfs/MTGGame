/**
 * S20 Part 3 — the dungeon system (dungeon-design v2, ADR-079; the session's milestone).
 *
 * A dungeon is a MINI-WORLD: a small fogged grid on the existing map stack with branching,
 * interconnecting carved paths — treasures on branch tips, stationary minions at chokepoints
 * (contact = fight, no parley), the guardian at the far end. THE EXTERIOR CLOCK FREEZES at the
 * threshold; an interior step counter drives the guardian's EMPOWERMENT on discrete, visible,
 * difficulty-parameterized tiers (`dungeonEmpowermentTiers` — steps are the only input). INTERIOR
 * LIFE persists across battles (loss and gain, `MatchResult.finalLife` written forward), seeded
 * from world life at entry and discarded at exit; an interior LOSS still pays the world loss
 * penalty. EVERYTHING gained inside sits in ESCROW until the guardian falls — payout on victory,
 * forfeit on walk-out, forfeit plus normal loss consequences on defeat; walk-out and defeat RESET
 * the dungeon (repopulate, steps zero — the topology is remembered, the fog stays lifted). Entry
 * telegraphs all of it before the choice. Dungeons are one-time: cleared = ground.
 *
 * Two classes in the slice (dungeon-design §5): the five authored MOX dungeons (one per wild
 * region; symmetric-but-boss-favoring laws; prize = the Mox + the guardian's card + a color-prize
 * roll) and LAIR-DUNGEONS (the tier-3 signatures' lairs converted to small procedural dungeons
 * with R-card rewards, no law, small empowerment schedule). Strongholds (S22) reuse everything.
 */
import type { CardDef } from "@shandalar/cards";
import type { Modifier, MatchResult, MatchSpec } from "@shandalar/engine";
import type { Catalog, OpponentTemplate } from "./catalog.js";
import { enemyDeck } from "./catalog.js";
import { addToCollection, forfeitCards, opponentTemplate, pickAnteFromDeck } from "./journey.js";
import { manalinkModifiers } from "./quests.js";
import type { KnobValues } from "./knobs.js";
import { exploredNone, idx, isExplored, markExplored, type Point, type WorldMap } from "./map.js";
import { WorldRng } from "./rng.js";
import { activeDeck, deckSize, type WorldState } from "./state.js";
import { creditSpokeKill } from "./stronghold.js";

// ---------- Content shapes (data/world/dungeons.json) ----------

export interface MoxDungeonDef {
  id: string;
  name: string;
  /** Wild-region colour this dungeon sits in (one per spoke's wild region). */
  color: "W" | "U" | "B" | "R" | "G";
  /** Guardian: a key into the sim guardian decklists + presentation. */
  guardian: { key: string; name: string; life: number; portrait: string };
  /** The dungeon law — symmetric modifiers applied to BOTH sides of the guardian duel
   * (and minion duels? No — dungeon-design §6: the law is the dungeon's table rule; slice
   * scope applies it to every duel fought inside). */
  law: { name: string; text: string; both: LawModifier[] };
  /** Prize beyond the escrow: the Mox (fixed), the guardian's own card, one color-prize roll. */
  prize: { mox: string; guardianCard: string };
}

export interface LawModifier {
  type: "permanentOnBattlefield" | "extraCards";
  cardId?: string;
  count?: number;
}

export interface DungeonsFile {
  catalogVersion: string;
  mox: MoxDungeonDef[];
}

export function validateDungeons(file: DungeonsFile, pool?: Map<string, CardDef>): string[] {
  const errors: string[] = [];
  if (file.mox.length !== 5) errors.push(`expected 5 mox dungeons, got ${file.mox.length}`);
  const colors = new Set(file.mox.map((m) => m.color));
  if (colors.size !== 5) errors.push("mox dungeons must cover the five colours");
  for (const m of file.mox) {
    for (const law of m.law.both) {
      if (law.type === "permanentOnBattlefield" && !law.cardId) errors.push(`${m.id}: law permanent needs cardId`);
      if (law.type === "extraCards" && !law.count) errors.push(`${m.id}: extraCards law needs count`);
      if (pool && law.cardId && !pool.has(law.cardId)) errors.push(`${m.id}: unknown law card ${law.cardId}`);
    }
    if (pool && !pool.has(m.prize.mox)) errors.push(`${m.id}: unknown mox ${m.prize.mox}`);
    if (pool && !pool.has(m.prize.guardianCard)) errors.push(`${m.id}: unknown guardian card ${m.prize.guardianCard}`);
  }
  return errors;
}

// ---------- Run state (world-save-v5) ----------

export interface DungeonMinion {
  id: string;
  catalogId: string;
  at: Point;
  defeated: boolean;
}

export interface DungeonTreasure {
  at: Point;
  /** S21 r2: gold/card ESCROW; life pays interior life IMMEDIATELY; boon rides your side of
   * every remaining interior duel this run (both die at exit, like the life track). */
  kind: "gold" | "card" | "life" | "boon";
  gold?: number;
  cardId?: string;
  cardName?: string;
  /** kind life: interior life gained on pickup. */
  life?: number;
  taken: boolean;
}

export interface DungeonEscrow {
  gold: number;
  cardIds: string[];
}

/** A dungeon in progress — the whole interior lives in the save (reload resumes mid-dungeon). */
export interface DungeonRun {
  dungeonId: string;
  kind: "mox" | "lair" | "stronghold";
  /** The overworld fixed point we entered from (returned to on any exit). */
  enteredFrom: Point;
  grid: { width: number; height: number; passable: boolean[] };
  explored: number[];
  position: Point;
  entry: Point;
  guardianAt: Point;
  steps: number;
  interiorLife: number;
  escrow: DungeonEscrow;
  minions: DungeonMinion[];
  treasures: DungeonTreasure[];
  /** Lair-dungeons: the resident's catalog id (the boss); mox dungeons use the content file. */
  residentCatalogId?: string;
  /** S21 r2–r3: boon permanents held (cardIds) — spent on the NEXT interior battle, all at
   * once (Chris: the Shandalar hold-or-spend tension; a boon picked up is a boon committed to
   * whatever fight comes next). Cleared when that battle resolves; die with the run at exit. */
  boons?: string[];
}

export interface DungeonStatus {
  cleared: boolean;
  resets: number;
}

// ---------- Generation ----------

const rngFor = (world: WorldState, dungeonId: string): WorldRng => {
  let h = 2166136261 >>> 0;
  for (const ch of dungeonId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return new WorldRng(((world.seed * 69069) ^ h) >>> 0);
};

/** Carve the interior: a wiggling main path (entry → guardian), 2–4 treasure branches, and one
 * cross-link so routes interconnect (the topology's tradeoff: minions sit on the trunk). */
export function generateDungeonRun(
  world: WorldState,
  catalog: Catalog,
  knobs: KnobValues,
  pool: Map<string, CardDef>,
  opts: {
    dungeonId: string;
    kind: "mox" | "lair" | "stronghold";
    color: "W" | "U" | "B" | "R" | "G";
    enteredFrom: Point;
    residentCatalogId?: string;
    /** lair: fewer twists, R-card rewards. */
    small?: boolean;
  },
): DungeonRun {
  // S22b: strongholds are the system at maximum scale — their own grid knobs (30×22 proposed).
  const { w, h } = opts.kind === "stronghold"
    ? { w: knobs.strongholdGridWidth, h: knobs.strongholdGridHeight }
    : { w: knobs.dungeonGridWidth, h: knobs.dungeonGridHeight };
  // Content scales with grid area (S20 playtest: 12×9 → 24×18): s = 1 at the design doc's
  // 12×9 baseline, 2 at the doubled default — branch/minion/cross-link counts and branch
  // lengths all ride it, so the knobs stay the only size dial.
  const s = Math.max(1, Math.round(Math.sqrt((w * h) / (12 * 9))));
  const rng = rngFor(world, opts.dungeonId);
  const passable = new Array<boolean>(w * h).fill(false);
  const at = (p: Point) => p.y * w + p.x;
  const carve = (p: Point) => { passable[at(p)] = true; };
  const entry: Point = { x: 0, y: Math.floor(h / 2) };
  const guardianAt: Point = { x: w - 1, y: rng.int(h) };

  // A wiggling walk toward `to`, carving as it goes (the S20 trunk, extracted for reuse).
  const walk = (from: Point, to: Point): Point[] => {
    const cells: Point[] = [];
    let cur = { ...from };
    carve(cur); cells.push({ ...cur });
    while (cur.x !== to.x || cur.y !== to.y) {
      const dy = Math.sign(to.y - cur.y);
      const toward = Math.sign(to.x - cur.x);
      const wiggle = rng.float();
      if (toward !== 0 && (wiggle < 0.55 || dy === 0)) cur = { x: cur.x + toward, y: cur.y };
      else if (dy !== 0 && wiggle < 0.9) cur = { x: cur.x, y: cur.y + dy };
      else if (toward !== 0) cur = { x: cur.x + toward, y: cur.y };
      else cur = { x: cur.x, y: cur.y + (dy || (rng.float() < 0.5 ? 1 : -1)) };
      cur.y = Math.max(0, Math.min(h - 1, cur.y));
      cur.x = Math.max(0, Math.min(w - 1, cur.x));
      carve(cur); cells.push({ ...cur });
    }
    return cells;
  };

  // Main trunk: entry → guardian.
  const trunk: Point[] = walk(entry, guardianAt);

  // S22 playtest r1 (Chris, seed 146764: "too small and too linear"): a stronghold is a SEAT, not
  // a mine tunnel — it gets a SECOND route through the opposite half of the grid (entry → a far
  // waypoint mirrored across the mid-line → the lord's approach), and CHAMBERS (3×3 rooms) at
  // junctions along both routes. Both routes join the trunk list, so minions guard each and
  // cross-links stitch them into a web.
  if (opts.kind === "stronghold") {
    const mirrorY = Math.max(1, Math.min(h - 2, h - 1 - guardianAt.y));
    const waypoint: Point = { x: Math.floor(w * 0.55), y: mirrorY };
    const routeB = [...walk(entry, waypoint), ...walk(waypoint, { x: guardianAt.x - 1, y: guardianAt.y })];
    trunk.push(...routeB);
    const chambers = 2 * s;
    for (let c = 0; c < chambers; c++) {
      const centre = trunk[Math.floor(((c + 1) * trunk.length) / (chambers + 2))]!;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const q = { x: centre.x + dx, y: centre.y + dy };
          if (q.x >= 0 && q.y >= 0 && q.x < w && q.y < h) carve(q);
        }
      }
    }
  }

  // Branches: sprout from mid-trunk cells, run away vertically/backward, end in treasure.
  const branchCount = opts.kind === "stronghold" ? 2 * s + rng.int(s) : opts.small ? 2 * s : 2 * s + rng.int(2 * s + 1); // s=1: 2 / 2..4 · s=2: 4 / 4..8 · stronghold s=3: 6..8
  const branchTips: Point[] = [];
  for (let b = 0; b < branchCount; b++) {
    const from = trunk[1 + rng.int(Math.max(1, trunk.length - 3))]!;
    let p = { ...from };
    const dir = rng.float() < 0.5 ? -1 : 1;
    const len = 2 * s + rng.int(opts.small ? 2 * s : 3 * s); // s=1: 2..3 / 2..4 · s=2: 4..7 / 4..9
    for (let i = 0; i < len; i++) {
      const q = rng.float() < 0.7 ? { x: p.x, y: p.y + dir } : { x: p.x - 1, y: p.y };
      if (q.x < 0 || q.y < 0 || q.y >= h) break;
      p = q; carve(p);
    }
    if (!(p.x === from.x && p.y === from.y) && !branchTips.some((t) => t.x === p.x && t.y === p.y)) branchTips.push({ ...p });
  }

  // Cross-links (interconnection): join two trunk cells a few columns apart via an L; s per scale
  // (strongholds 2s — the two routes want stitching, S22 r1).
  const linkCount = opts.kind === "stronghold" ? 2 * s : s;
  for (let link = 0; link < linkCount && trunk.length > 8; link++) {
    const a = trunk[2 + rng.int(Math.floor(trunk.length / 3))]!;
    const b = trunk[Math.floor(trunk.length / 2) + rng.int(Math.floor(trunk.length / 3))]!;
    const viaY = Math.max(0, Math.min(h - 1, (a.y + b.y) / 2 + (rng.float() < 0.5 ? -2 : 2)) | 0);
    for (let y = Math.min(a.y, viaY); y <= Math.max(a.y, viaY); y++) carve({ x: a.x, y });
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) carve({ x, y: viaY });
    for (let y = Math.min(b.y, viaY); y <= Math.max(b.y, viaY); y++) carve({ x: b.x, y });
  }

  // Minions at chokepoints: trunk cells past the first quarter, spaced out; never entry/guardian.
  const minionCount = opts.kind === "stronghold" ? 2 * s + rng.int(2) : opts.small ? s + rng.int(2) : s + 1 + rng.int(s + 1); // s=1: lair 1–2 / mox 2–3 · s=2: lair 2–3 / mox 3–5 · stronghold s=3: 6–7 across both routes (spoke-themed floors)
  const spokeMinions = catalog.opponents.filter(
    (o) => o.spoke === opts.color && o.tier <= 2 && o.id !== opts.residentCatalogId,
  );
  const minions: DungeonMinion[] = [];
  const usable = trunk.filter((p, i) => i > trunk.length / 4 && !(p.x === guardianAt.x && p.y === guardianAt.y) && !(p.x === entry.x && p.y === entry.y));
  for (let m = 0; m < minionCount && usable.length > 0; m++) {
    const slot = Math.floor(((m + 1) * usable.length) / (minionCount + 1));
    const p = usable[Math.min(slot, usable.length - 1)]!;
    if (minions.some((x) => x.at.x === p.x && x.at.y === p.y)) continue;
    const tmpl = spokeMinions.length ? rng.pick(spokeMinions) : rng.pick(catalog.opponents.filter((o) => o.kind !== "beast" && !o.spoke && o.tier <= 2));
    minions.push({ id: `dmin_${m}`, catalogId: tmpl.id, at: { ...p }, defeated: false });
  }

  // Treasures on branch tips (S21 r2, Chris: caches leaned too hard on R cards — the prize room
  // is the R channel). Four kinds by knob weights: gold/card escrow; life pays the dive NOW;
  // a boon fights beside you for the rest of the run.
  const BOON_BASIC: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
  const BOON_TOKEN: Record<string, string> = { W: "bird_1_1_flying", U: "faerie_1_1_u", B: "faerie_rogue_1_1_flying", R: "goblin_1_1", G: "bear_2_2" };
  const weights = knobs.dungeonTreasureWeights[opts.kind === "lair" ? "lair" : "mox"];
  const wTotal = weights.gold + weights.card + weights.life + weights.boon;
  const treasures: DungeonTreasure[] = branchTips.map((tip) => {
    const roll = rng.float() * wTotal;
    if (roll < weights.gold) {
      return { at: tip, kind: "gold" as const, gold: 15 + rng.int(4) * 5 + (opts.small ? 10 : 0), taken: false };
    }
    if (roll < weights.gold + weights.card) {
      // S21 r3 (Chris): mox caches roll T3 or R at even odds; mundane lairs T2 or T3 at even
      // odds — the boss's prize room (lairPrizeRoll's 2×R / the mox ceremony) stays the R channel.
      const premium = rng.float() < 0.5;
      const wantTier: (2 | 3 | "R")[] = opts.kind === "lair" ? (premium ? [3] : [2]) : premium ? ["R"] : [3];
      const candidates = [...pool.values()]
        .filter((d) => !d.isTokenDef && !d.prizeOnly && wantTier.includes(d.shopTier as 2 | 3 | "R"))
        .filter((d) => {
          if (d.types.includes("Land")) return true; // duals are colourless by cost; any dungeon may hold one
          const colors = d.manaCost?.replace(/[^WUBRG]/g, "") ?? "";
          return colors === "" || colors.includes(opts.color);
        })
        .sort((a, b) => a.id.localeCompare(b.id));
      const c = candidates.length ? rng.pick(candidates) : undefined;
      if (c) return { at: tip, kind: "card" as const, cardId: c.id, cardName: c.name, taken: false };
      return { at: tip, kind: "gold" as const, gold: 25, taken: false };
    }
    if (roll < weights.gold + weights.card + weights.life) {
      return { at: tip, kind: "life" as const, life: 2 + rng.int(2), taken: false }; // +2–3, immediate
    }
    const boonId = rng.float() < 0.6 ? BOON_BASIC[opts.color]! : BOON_TOKEN[opts.color]!;
    const def = pool.get(boonId);
    return { at: tip, kind: "boon" as const, cardId: boonId, cardName: def?.name ?? boonId, taken: false };
  });

  const explored = exploredNone({ width: w, height: h });
  const run: DungeonRun = {
    dungeonId: opts.dungeonId,
    kind: opts.kind,
    enteredFrom: { ...opts.enteredFrom },
    grid: { width: w, height: h, passable },
    explored,
    position: { ...entry },
    entry,
    guardianAt,
    steps: 0,
    interiorLife: world.player.worldLife,
    escrow: { gold: 0, cardIds: [] },
    minions,
    treasures,
    ...(opts.residentCatalogId ? { residentCatalogId: opts.residentCatalogId } : {}),
  };
  exploreInterior(run, knobs);
  return run;
}

/** The interior as a WorldMap the existing map view can draw (one wild region in the dungeon's colour). */
export function dungeonAsWorldMap(run: DungeonRun, color: string, name: string): WorldMap {
  const { width, height, passable } = run.grid;
  return {
    width,
    height,
    region: new Array(width * height).fill(0),
    regions: [{ index: 0, name, color, tier: "wild", heart: { x: -99, y: -99 } } as never],
    passable: [...passable],
    towns: [],
    strongholds: [{ kind: "lair", at: run.guardianAt, region: 0, name: "The guardian" } as never],
    road: new Array(width * height).fill(false),
    start: { ...run.entry },
  } as WorldMap;
}

export function exploreInterior(run: DungeonRun, knobs: KnobValues): void {
  const r = knobs.sightRadius;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > r) continue;
      const p = { x: run.position.x + dx, y: run.position.y + dy };
      if (p.x < 0 || p.y < 0 || p.x >= run.grid.width || p.y >= run.grid.height) continue;
      markExplored(run.explored, { width: run.grid.width }, p);
    }
  }
}

// ---------- Empowerment (§3) ----------

export interface EmpowermentTier {
  steps: number;
  addLife: number;
  addBasic?: boolean;
  addToken?: boolean;
  addCard?: boolean;
}

/** The empowerment schedule a run reads: strongholds have their own (S22 r1 — 50/75/100). */
export function empowermentTiersFor(run: Pick<DungeonRun, "kind">, knobs: KnobValues): EmpowermentTier[] {
  return run.kind === "stronghold" ? knobs.strongholdEmpowermentTiers : knobs.dungeonEmpowermentTiers;
}

/** All tiers the interior step count has reached (cumulative — the guardian keeps what it grew). */
export function reachedTiers(run: DungeonRun, knobs: KnobValues): EmpowermentTier[] {
  return empowermentTiersFor(run, knobs).filter((t) => run.steps >= t.steps);
}

/** The empowerment package as modifiers on the guardian's seat (basic land colour = the dungeon's). */
export function empowermentModifiers(tiers: EmpowermentTier[], color: "W" | "U" | "B" | "R" | "G"): { lifeBonus: number; modifiers: Modifier[] } {
  const BASIC: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
  const TOKEN: Record<string, string> = { W: "bird_1_1_flying", U: "faerie_1_1_u", B: "faerie_rogue_1_1_flying", R: "goblin_1_1", G: "bear_2_2" };
  let lifeBonus = 0;
  const modifiers: Modifier[] = [];
  for (const t of tiers) {
    lifeBonus += t.addLife;
    if (t.addBasic) modifiers.push({ type: "permanentOnBattlefield", player: 1, cardId: BASIC[color]! });
    if (t.addToken) modifiers.push({ type: "permanentOnBattlefield", player: 1, cardId: TOKEN[color]! });
    if (t.addCard) modifiers.push({ type: "extraCards", player: 1, count: 1 });
  }
  return { lifeBonus, modifiers };
}

// ---------- Movement + events ----------

export type DungeonEvent =
  | { type: "moved"; to: Point; steps: number }
  | { type: "treasure"; treasure: DungeonTreasure }
  | { type: "minion"; minion: DungeonMinion }
  | { type: "guardian" }
  | { type: "atEntry" };

/** One interior step per cell; stops at minions (fight), treasures (escrow), and the guardian.
 * The EXTERIOR clock does not tick (§5's frozen threshold). Mutates the run; caller autosaves. */
export function dungeonAdvance(run: DungeonRun, knobs: KnobValues, path: Point[]): DungeonEvent[] {
  const events: DungeonEvent[] = [];
  for (const cell of path) {
    if (!run.grid.passable[cell.y * run.grid.width + cell.x]) break;
    run.position = { ...cell };
    run.steps += 1;
    exploreInterior(run, knobs);
    events.push({ type: "moved", to: { ...cell }, steps: run.steps });
    const treasure = run.treasures.find((t) => !t.taken && t.at.x === cell.x && t.at.y === cell.y);
    if (treasure) {
      treasure.taken = true;
      if (treasure.kind === "gold") run.escrow.gold += treasure.gold ?? 0;
      else if (treasure.kind === "card" && treasure.cardId) run.escrow.cardIds.push(treasure.cardId);
      // S21 r2: life and boons help the DIVE, not the payout — immediate, never escrowed,
      // discarded with the run (exactly like the interior life track).
      else if (treasure.kind === "life") run.interiorLife += treasure.life ?? 2;
      else if (treasure.kind === "boon" && treasure.cardId) (run.boons ??= []).push(treasure.cardId);
      events.push({ type: "treasure", treasure });
    }
    const minion = run.minions.find((m) => !m.defeated && m.at.x === cell.x && m.at.y === cell.y);
    if (minion) {
      events.push({ type: "minion", minion });
      break; // contact = fight; no parley inside
    }
    if (cell.x === run.guardianAt.x && cell.y === run.guardianAt.y) {
      events.push({ type: "guardian" });
      break;
    }
    if (cell.x === run.entry.x && cell.y === run.entry.y) events.push({ type: "atEntry" });
  }
  return events;
}

/** BFS inside the dungeon (fog-honest like the overworld: unexplored counts as passable for planning). */
export function dungeonPath(run: DungeonRun, to: Point): Point[] | null {
  const { width, height, passable } = run.grid;
  if (to.x < 0 || to.y < 0 || to.x >= width || to.y >= height) return null;
  const plannable = (p: Point) => !isExplored(run.explored, { width }, p) || passable[p.y * width + p.x]!;
  if (!plannable(to)) return null;
  const prev = new Int32Array(width * height).fill(-2);
  const q: Point[] = [run.position];
  prev[run.position.y * width + run.position.x] = -1;
  while (q.length) {
    const p = q.shift()!;
    if (p.x === to.x && p.y === to.y) {
      const path: Point[] = [];
      let cur = p;
      while (!(cur.x === run.position.x && cur.y === run.position.y)) {
        path.push({ ...cur });
        const pi = prev[cur.y * width + cur.x]!;
        cur = { x: pi % width, y: Math.floor(pi / width) };
      }
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue;
      if (prev[n.y * width + n.x] !== -2 || !plannable(n)) continue;
      prev[n.y * width + n.x] = p.y * width + p.x;
      q.push(n);
    }
  }
  return null;
}

// ---------- Duels inside ----------

/** MatchSpec for an interior duel. Minions: their catalog deck + profile at the INTERIOR life
 * track; the dungeon law applies to every duel fought inside (§6). Guardian: content-defined deck,
 * master profile, life + empowerment. */
export function dungeonDuelSpec(
  world: WorldState,
  catalog: Catalog,
  knobs: KnobValues,
  run: DungeonRun,
  enemy:
    | { kind: "minion"; tmpl: OpponentTemplate }
    | { kind: "guardian"; name: string; decklist: { cardId: string; count: number }[]; archetype: "aggro" | "midrange" | "control"; life: number; color: "W" | "U" | "B" | "R" | "G" },
  law: LawModifier[],
  rng: WorldRng,
  /** S22b: PARTISAN additions — the stronghold law (defender-side, re-injected every battle) and,
   * for the lord duel, his entrance. Mox dungeons pass nothing; their laws stay symmetric. */
  extraModifiers: Modifier[] = [],
  /** S25 (ADR-088): the Barrage's one-shot delta on the enemy's starting life, floored at 1 —
   * "legal against everything" includes the interiors (softening a 45-life Stoker is its
   * endgame identity). The dungeon-law hook, as the design named it. */
  opts: { enemyLifeDelta?: number } = {},
): { spec: MatchSpec; enemyName: string; enemyLife: number; empowerment: EmpowermentTier[] } {
  const lawMods = (player: 0 | 1): Modifier[] =>
    law.map((l) =>
      l.type === "extraCards"
        ? ({ type: "extraCards", player, count: l.count ?? 1 } as Modifier)
        : ({ type: "permanentOnBattlefield", player, cardId: l.cardId! } as Modifier),
    );
  const empowerment = enemy.kind === "guardian" ? reachedTiers(run, knobs) : [];
  const emp = enemy.kind === "guardian" ? empowermentModifiers(empowerment, enemy.color) : { lifeBonus: 0, modifiers: [] };
  const base =
    enemy.kind === "minion"
      ? {
          name: enemy.tmpl.name,
          decklist: enemyDeck(catalog, enemy.tmpl.deck).decklist,
          agent: `heuristic:${enemy.tmpl.difficulty}`,
          archetype: enemyDeck(catalog, enemy.tmpl.deck).archetype,
          life: enemy.tmpl.worldLife,
        }
      : { name: enemy.name, decklist: enemy.decklist.map((e) => ({ ...e })), agent: "heuristic:master", archetype: enemy.archetype, life: enemy.life };
  const enemyLife = Math.max(1, base.life + (enemy.kind === "guardian" && run.residentCatalogId ? knobs.lairResidentLifeBonus : 0) + emp.lifeBonus + (opts.enemyLifeDelta ?? 0));
  const spec: MatchSpec = {
    seed: rng.int(1_000_000_000),
    players: [
      { name: world.player.name, decklist: activeDeck(world).map((e) => ({ ...e })), agent: "human" },
      { name: base.name, decklist: base.decklist, agent: base.agent },
    ],
    rules: { startingLife: run.interiorLife, handSize: 7, mulligan: "london", maxTurns: 100, ante: knobs.anteCount, startingPlayer: rng.chance(0.5) ? 0 : 1 }, // S22 r2: the coin flip inside too
    modifiers: [
      { type: "startingLife", player: 1, value: enemyLife },
      ...lawMods(0),
      ...lawMods(1),
      ...extraModifiers,
      ...emp.modifiers,
      // Manalinks still apply inside (they are the player's persistent buffs) — through the one
      // source, so an occupied granting town's link is dark here too (S21 suspension).
      ...manalinkModifiers(world),
      // S21 r3: held boons fight beside you in this battle — and are spent by it
      // (applyInteriorDuel clears them; the hold-or-spend tension is the design).
      ...(run.boons ?? []).map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 0 as const, cardId })),
    ],
  };
  return { spec, enemyName: base.name, enemyLife, empowerment };
}

export type InteriorDuelOutcome =
  | { type: "win"; anteToEscrow: string[]; lifeNow: number }
  | { type: "loss"; ejected: true; anteLost: string[] };

/** Apply an interior duel result. WIN: interior life carries forward, their ante goes to ESCROW
 * (not the collection), the minion falls. LOSS: normal loss consequences (your ante forfeits from
 * the collection, the world loss penalty applies), ejection + reset + escrow forfeit happen at the
 * caller (resetDungeon). Draws count as losses inside (the mountain keeps its gold). */
export function applyInteriorDuel(
  world: WorldState,
  knobs: KnobValues,
  run: DungeonRun,
  result: MatchResult,
  minionId?: string,
  /** S22b: with the catalog, a defeated spoke-bound minion credits its lord's hunt (the pace war —
   * interior kills count too). Callers without it (older tests) simply feed no one. */
  catalog?: Catalog,
): InteriorDuelOutcome {
  // S21 r3: held boons were spent on this battle, whichever way it went (hold-or-spend).
  delete run.boons;
  if (result.winner === 0) {
    run.interiorLife = Math.max(1, result.finalLife[0]);
    const won = [...result.facts.ante[1]];
    run.escrow.cardIds.push(...won); // §4: interior ante winnings are escrowed
    if (minionId) {
      const m = run.minions.find((x) => x.id === minionId);
      if (m) {
        m.defeated = true;
        if (catalog) {
          const tmpl = catalog.opponents.find((o) => o.id === m.catalogId);
          creditSpokeKill(world, tmpl?.colors, tmpl?.tier ?? 0); // S22 r1: colours, mirroring renown
        }
      }
    }
    return { type: "win", anteToEscrow: won, lifeNow: run.interiorLife };
  }
  const lost = [...result.facts.ante[0]];
  forfeitCards(world, lost);
  world.player.worldLife = Math.max(knobs.lifeFloor, world.player.worldLife - knobs.lossLifePenalty);
  if (world.player.worldLife <= 0) world.gameOver = true;
  return { type: "loss", ejected: true, anteLost: lost };
}

// ---------- Exit paths ----------

/** Walk-out or defeat: forfeit the escrow, repopulate, zero the steps. The topology and fog stay
 * (you remember the halls); treasures return (they were never yours). Mutates world. */
export function resetDungeon(world: WorldState, run: DungeonRun): void {
  const status = (world.dungeons[run.dungeonId] ??= { cleared: false, resets: 0 });
  status.resets += 1;
  world.activeDungeon = null;
  world.player.position = { ...run.enteredFrom };
}

/** Victory: escrow pays out, the prize lands, the dungeon is ground forever. Mutates world. */
export function clearDungeon(
  world: WorldState,
  run: DungeonRun,
  prize: { gold: number; cardIds: string[] },
): { paidGold: number; paidCards: string[] } {
  const paidGold = run.escrow.gold + prize.gold;
  const paidCards = [...run.escrow.cardIds, ...prize.cardIds];
  world.player.gold += paidGold;
  addToCollection(world, paidCards, "reward");
  const status = (world.dungeons[run.dungeonId] ??= { cleared: false, resets: 0 });
  status.cleared = true;
  world.activeDungeon = null;
  world.player.position = { ...run.enteredFrom };
  return { paidGold, paidCards };
}

/** The colour-prize roll (§8): one R-or-T3 card of the dungeon's colour, seeded per dungeon. */
export function colorPrizeRoll(world: WorldState, pool: Map<string, CardDef>, dungeonId: string, color: "W" | "U" | "B" | "R" | "G"): string | null {
  const rng = rngFor(world, `${dungeonId}:prize`);
  const candidates = [...pool.values()]
    .filter((d) => !d.isTokenDef && !d.prizeOnly && (d.shopTier === "R" || d.shopTier === 3))
    .filter((d) => (d.manaCost ?? "").includes(color) || (d.types.includes("Land") && (d.subtypes ?? []).length > 0))
    .sort((a, b) => a.id.localeCompare(b.id));
  return candidates.length ? rng.pick(candidates).id : null;
}

/** Lair-dungeon prize (§5): a couple of R-tier cards + a purse, seeded per dungeon. */
export function lairPrizeRoll(world: WorldState, pool: Map<string, CardDef>, dungeonId: string): { gold: number; cardIds: string[] } {
  const rng = rngFor(world, `${dungeonId}:prize`);
  const rs = [...pool.values()].filter((d) => !d.isTokenDef && !d.prizeOnly && d.shopTier === "R").sort((a, b) => a.id.localeCompare(b.id));
  const cardIds: string[] = [];
  for (let i = 0; i < 2 && rs.length; i++) cardIds.push(rng.pick(rs).id);
  return { gold: 30, cardIds };
}

/** The ante the player stakes inside (same rules as outside — the deck's top nonlands at shuffle
 * are engine-side; this helper only reports the count for the telegraph). */
export function interiorAnteCount(knobs: KnobValues): number {
  return knobs.anteCount;
}

void deckSize;
void pickAnteFromDeck;
void opponentTemplate;
void idx;
