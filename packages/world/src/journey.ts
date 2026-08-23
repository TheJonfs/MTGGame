import type { MatchResult, MatchSpec, Modifier } from "@shandalar/engine";
import { enemyDeck, type Catalog, type OpponentTemplate } from "./catalog.js";
import { isTownCell, regionCells, roamerTarget, rollTemplate, type GoneReason, type OpponentInstance } from "./generate.js";
import type { KnobValues } from "./knobs.js";
import { findPath, fixedPointAt, idx, inBounds, manhattan, markExplored, regionAt, samePoint, townAt, type Point, type Town, type WorldMap } from "./map.js";
import { WorldRng } from "./rng.js";
import { activeDeck, deckSize, worldKnobs, type Decklist, type DuelRecord, type ProvenanceSource, type WorldState } from "./state.js";

/**
 * The headless loop (brief Part 3's logic, S12 Part 2 carving (b)): walk →
 * roamers move per step (S16, ADR-071: pursue in sight / flee by renown /
 * drift; contact = parley) → parley (fight / flee / buy off) → MatchSpec
 * from world state → the engine's runMatch (caller) → MatchResult back into
 * the collection, gold, and world life. No UI here; the play client and the
 * acceptance test both drive exactly this API.
 */

export interface Encounter {
  opponentId: string;
  catalogId: string;
  tier: 1 | 2 | 3;
  region: number;
  at: Point;
  /** S16: the roamer was fleeing you (renown rule) — you caught it. */
  fleeing: boolean;
  /** S16: how contact happened — you stepped onto it, it reached you, or a lair's certain encounter. */
  contact: "stepped" | "reached" | "lair";
}

export type StepEvent =
  | { type: "moved"; to: Point; steps: number }
  | { type: "arrived"; town: Town }
  | { type: "encounter"; encounter: Encounter }
  /** S16: a region below its density respawned a roamer (out of sight). */
  | { type: "spawned"; opponentId: string; region: number };

// ---------- S16 roamers: sight, flee, movement ----------

/** Cells on the straight line between a and b (Bresenham, endpoints excluded). */
export function lineCells(a: Point, b: Point): Point[] {
  const out: Point[] = [];
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) break;
    out.push({ x: x0, y: y0 });
  }
  return out;
}

/** The player's effective sight toward a cell: radius minus the rough-terrain
 * penalty per rough cell on the line of sight (ADR-071's only ambush). */
export function effectiveSight(map: WorldMap, knobs: KnobValues, from: Point, to: Point): number {
  const rough = lineCells(from, to).filter((c) => inBounds(map, c) && !map.passable[idx(map, c)]).length;
  return knobs.sightRadius - rough * knobs.roughSightPenalty;
}

export function playerSees(world: WorldState, knobs: KnobValues, at: Point): boolean {
  const d = manhattan(world.player.position, at);
  return d <= effectiveSight(world.map, knobs, world.player.position, at);
}

export function isFleeing(tmpl: OpponentTemplate, knobs: KnobValues, renown: number): boolean {
  return tmpl.tier * knobs.renownFleeFactor[tmpl.tier] < renown;
}

/** Roamers the player can currently see (map chips; the UI reads this). */
export function visibleRoamers(world: WorldState, catalog: Catalog, knobs: KnobValues = worldKnobs(world)): { inst: OpponentInstance; tmpl: OpponentTemplate; fleeing: boolean }[] {
  const out: { inst: OpponentInstance; tmpl: OpponentTemplate; fleeing: boolean }[] = [];
  for (const o of world.opponents) {
    if (o.gone || !o.at || o.fixedAt) continue;
    if (!playerSees(world, knobs, o.at)) continue;
    const tmpl = opponentTemplate(catalog, o);
    out.push({ inst: o, tmpl, fleeing: isFleeing(tmpl, knobs, world.player.renown) });
  }
  return out;
}

const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Legal destination cells for a roamer: in-region, passable, not a town/fixed point (region-bound — S16 ruling). */
function roamerMoves(map: WorldMap, o: OpponentInstance): Point[] {
  const out: Point[] = [];
  for (const d of DIRS) {
    const q = { x: o.at!.x + d.x, y: o.at!.y + d.y };
    if (!inBounds(map, q)) continue;
    const i = idx(map, q);
    if (!map.passable[i] || map.region[i] !== o.region || isTownCell(map, q)) continue;
    out.push(q);
  }
  return out;
}

/** One roamer's move for one tick: toward the player if in sight and not
 * fleeing; away if fleeing and in sight; random drift (or stay) otherwise.
 * Ties broken by the world RNG (seeded, logged by state). */
function moveRoamer(world: WorldState, catalog: Catalog, knobs: KnobValues, rng: WorldRng, o: OpponentInstance): void {
  const map = world.map;
  const me = world.player.position;
  const tmpl = opponentTemplate(catalog, o);
  const moves = roamerMoves(map, o);
  if (moves.length === 0) return;
  const dist = manhattan(o.at!, me);
  if (dist <= knobs.sightRadius) {
    const fleeing = isFleeing(tmpl, knobs, world.player.renown);
    const scored = moves.map((q) => ({ q, d: manhattan(q, me) }));
    const best = fleeing ? Math.max(...scored.map((s) => s.d)) : Math.min(...scored.map((s) => s.d));
    // A fleeing roamer that can't gain distance holds still rather than stepping into you.
    if (fleeing && best <= dist) return;
    const cands = scored.filter((s) => s.d === best).map((s) => s.q);
    o.at = { ...rng.pick(cands) };
    return;
  }
  // Drift: half the ticks stay put, else a random legal neighbour.
  if (rng.chance(0.5)) return;
  o.at = { ...rng.pick(moves) };
}

/** The player's terrain for roamer-speed purposes (ADR-072: roads are fast). */
export function playerTerrain(world: WorldState): "road" | "open" {
  return world.map.road?.[idx(world.map, world.player.position)] ? "road" : "open";
}

/** Advance every roamer by its speed (fractional debt) after a player step:
 * roamerSpeed[tier] × roamerStepsPerPlayerStep[the player's terrain]. */
export function tickRoamers(world: WorldState, catalog: Catalog, knobs: KnobValues, rng: WorldRng): void {
  const terrain = knobs.roamerStepsPerPlayerStep[playerTerrain(world)];
  for (const o of world.opponents) {
    if (o.gone || !o.at || o.fixedAt) continue;
    const tmpl = opponentTemplate(catalog, o);
    o.moveDebt = (o.moveDebt ?? 0) + knobs.roamerSpeed[tmpl.tier] * terrain;
    let guard = 0;
    while (o.moveDebt >= 1 && guard++ < 8) {
      o.moveDebt -= 1;
      moveRoamer(world, catalog, knobs, rng, o);
    }
  }
}

/** Respawn (S16): a region below its roamer target gains one roamer every
 * roamerRespawnSteps[tier] steps, at a seeded in-region cell the player
 * can't see. Returns the new instance ids. */
export function respawnRoamers(world: WorldState, catalog: Catalog, knobs: KnobValues, rng: WorldRng): OpponentInstance[] {
  const spawned: OpponentInstance[] = [];
  const map = world.map;
  for (const r of map.regions) {
    const every = knobs.roamerRespawnSteps[r.tier];
    if (every <= 0 || world.player.stepsTaken % every !== 0) continue;
    const live = world.opponents.filter((o) => o.region === r.index && !o.gone && o.at && !o.fixedAt).length;
    if (live >= roamerTarget(map, r, knobs)) continue;
    const cells = regionCells(map, r.index).filter((p) => !isTownCell(map, p) && !playerSees(world, knobs, p) && !samePoint(p, world.player.position));
    if (cells.length === 0) continue;
    const tmpl = rollTemplate(rng, catalog, r, knobs);
    const id = `opp_r${world.opponents.length}_${world.player.stepsTaken}`;
    const inst: OpponentInstance = { id, catalogId: tmpl.id, region: r.index, gone: false, at: { ...rng.pick(cells) }, moveDebt: 0 };
    world.opponents.push(inst);
    spawned.push(inst);
  }
  return spawned;
}

/** ADR-072 (reserved fog): mark every cell within the player's sight as explored. */
export function exploreAround(world: WorldState, knobs: KnobValues): void {
  if (!world.explored) return;
  const r = knobs.sightRadius;
  const me = world.player.position;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > r) continue;
      const p = { x: me.x + dx, y: me.y + dy };
      if (inBounds(world.map, p)) markExplored(world.explored, world.map, p);
    }
  }
}

/** Remove a roamer from the map (any parley outcome — Chris's S16 ruling);
 * lair residents leave only when defeated. */
export function removeOpponent(world: WorldState, opponentId: string, reason: GoneReason): void {
  const inst = world.opponents.find((o) => o.id === opponentId);
  if (!inst) return;
  if (inst.fixedAt && reason !== "defeated") return;
  inst.gone = true;
  inst.goneReason = reason;
}

const BASICS = ["plains", "island", "swamp", "mountain", "forest"];

export function opponentTemplate(catalog: Catalog, inst: OpponentInstance): OpponentTemplate {
  const t = catalog.opponents.find((o) => o.id === inst.catalogId);
  if (!t) throw new Error(`catalog has no opponent ${inst.catalogId}`);
  return t;
}

/** Knobs in force for one encounter: difficulty + the opponent's overrides (+ caller extras). */
export function encounterKnobs(world: WorldState, catalog: Catalog, enc: Encounter, extra: Parameters<typeof worldKnobs>[1] = {}): KnobValues {
  const inst = world.opponents.find((o) => o.id === enc.opponentId);
  const tmpl = inst ? opponentTemplate(catalog, inst) : undefined;
  return worldKnobs(world, { ...extra, ...(tmpl?.knobs ? { opponent: tmpl.knobs } : {}) });
}

/** Walk a path one cell at a time (each cell = one step = one clock tick).
 * S16: per step — the player moves; a town is safe (roamers still move, but
 * never onto it); a lair with a resident is a certain encounter; then every
 * roamer moves (pursue / flee / drift) and respawns roll; contact (a roamer
 * on the player's cell, whoever stepped) = encounter, which stops the walk
 * (remaining path discarded). Mutates world. */
export function advance(
  world: WorldState,
  catalog: Catalog,
  path: Point[],
  extra: Parameters<typeof worldKnobs>[1] = {},
): StepEvent[] {
  const events: StepEvent[] = [];
  const rng = new WorldRng(world.rng);
  const knobs = worldKnobs(world, extra);
  const contactAt = (cell: Point): OpponentInstance | undefined =>
    world.opponents.find((o) => !o.gone && o.at && !o.fixedAt && samePoint(o.at, cell));
  const encounterOf = (inst: OpponentInstance, cell: Point, contact: Encounter["contact"]): Encounter => {
    const tmpl = opponentTemplate(catalog, inst);
    return { opponentId: inst.id, catalogId: inst.catalogId, tier: tmpl.tier, region: regionAt(world.map, cell).index, at: { ...cell }, fleeing: !inst.fixedAt && isFleeing(tmpl, knobs, world.player.renown), contact };
  };
  try {
    for (const cell of path) {
      if (!world.map.passable[idx(world.map, cell)]) throw new Error(`advance: cell ${cell.x},${cell.y} is impassable`);
      world.player.position = { ...cell };
      world.player.stepsTaken += 1;
      events.push({ type: "moved", to: { ...cell }, steps: world.player.stepsTaken });
      exploreAround(world, knobs);
      const town = townAt(world.map, cell);
      if (town) {
        // Towns are safe nodes: no contact on the town cell itself (roamers never enter it).
        events.push({ type: "arrived", town });
        tickRoamers(world, catalog, knobs, rng);
        for (const sp of respawnRoamers(world, catalog, knobs, rng)) events.push({ type: "spawned", opponentId: sp.id, region: sp.region });
        continue;
      }
      // A lair with an undefeated resident: the encounter is certain.
      const lair = fixedPointAt(world.map, cell);
      if (lair?.opponentId) {
        const resident = world.opponents.find((o) => o.id === lair.opponentId);
        if (resident && !resident.gone) {
          events.push({ type: "encounter", encounter: encounterOf(resident, cell, "lair") });
          break;
        }
      }
      // You stepped onto a roamer (pursuit — the player-initiated contact).
      const stepped = contactAt(cell);
      if (stepped) {
        events.push({ type: "encounter", encounter: encounterOf(stepped, cell, "stepped") });
        break;
      }
      // Roamers move; one reaching you is contact.
      tickRoamers(world, catalog, knobs, rng);
      for (const sp of respawnRoamers(world, catalog, knobs, rng)) events.push({ type: "spawned", opponentId: sp.id, region: sp.region });
      const reached = contactAt(cell);
      if (reached) {
        events.push({ type: "encounter", encounter: encounterOf(reached, cell, "reached") });
        break;
      }
    }
  } finally {
    world.rng = rng.state();
  }
  return events;
}

/** Click-to-walk: shortest passable path then advance. Returns null if unreachable. */
export function walkTo(world: WorldState, catalog: Catalog, dest: Point, extra: Parameters<typeof worldKnobs>[1] = {}): StepEvent[] | null {
  const path = findPath(world.map, world.player.position, dest);
  if (path === null) return null;
  return advance(world, catalog, path, extra);
}

// ---------- collection / deck bookkeeping ----------

export function addToCollection(world: WorldState, cardIds: string[], source: ProvenanceSource = "reward"): void {
  for (const id of cardIds) {
    world.player.collection[id] = (world.player.collection[id] ?? 0) + 1;
    world.provenance.push({ cardId: id, source, step: world.player.stepsTaken });
  }
}

/** Remove ante'd-away cards from the collection AND the active deck, then
 * refill the deck with its basic land (Chris's slice ruling: the deck never
 * drops below the floor; the full game forks to the editor instead). */
export function forfeitCards(world: WorldState, cardIds: string[]): void {
  const deck = activeDeck(world);
  let replaced = 0;
  for (const id of cardIds) {
    world.player.collection[id] = Math.max(0, (world.player.collection[id] ?? 0) - 1);
    if (world.player.collection[id] === 0) delete world.player.collection[id];
    const e = deck.find((d) => d.cardId === id);
    if (e) {
      e.count -= 1;
      replaced += 1;
      if (e.count === 0) deck.splice(deck.indexOf(e), 1);
    }
  }
  if (replaced > 0) {
    const basic = world.player.basicLand;
    const b = deck.find((d) => d.cardId === basic);
    if (b) b.count += replaced;
    else deck.push({ cardId: basic, count: replaced });
    // Basics are free and infinite (manifest §2): the collection gains them too.
    world.player.collection[basic] = (world.player.collection[basic] ?? 0) + replaced;
  }
}

/** Deck legality for the slice: 30-card floor, 4-copy cap except basics. */
export function deckLegal(deck: Decklist): { ok: boolean; reason?: string } {
  if (deckSize(deck) < 30) return { ok: false, reason: `deck has ${deckSize(deck)} cards; the floor is 30` };
  for (const e of deck) {
    if (!BASICS.includes(e.cardId) && e.count > 4) return { ok: false, reason: `${e.cardId} ×${e.count} exceeds the 4-copy cap` };
  }
  return { ok: true };
}

/** The flee forfeit: no duel happens, so the world picks your stake the way
 * the engine would — n random nonland cards of the active deck. */
export function pickAnteFromDeck(rng: WorldRng, deck: Decklist, n: number): string[] {
  const pool: string[] = [];
  for (const e of deck) if (!BASICS.includes(e.cardId)) for (let i = 0; i < e.count; i++) pool.push(e.cardId);
  return rng.shuffle(pool).slice(0, Math.min(n, pool.length));
}

// ---------- parley ----------

export type ParleyChoice = "fight" | "flee" | "buyoff";

export type ParleyOutcome =
  | { type: "fled"; anteLost: string[] }
  | { type: "fleeFailed"; anteLost: string[] }
  | { type: "boughtOff"; goldPaid: number }
  | { type: "refused"; reason: string }
  | { type: "fight"; duel: PreparedDuel };

export interface PreparedDuel {
  encounter: Encounter;
  seed: number;
  spec: MatchSpec;
  /** The AI profile inputs for the caller's agent factory. */
  enemy: { name: string; difficulty: OpponentTemplate["difficulty"]; deck: OpponentTemplate["deck"]; archetype: "aggro" | "midrange" | "control"; portrait: string; worldLife: number; tier: 1 | 2 | 3 };
}

export function buyOffPrice(knobs: KnobValues, tier: 1 | 2 | 3, tmpl?: Pick<OpponentTemplate, "kind">): number {
  const base = knobs.buyOffBase * tier;
  return tmpl?.kind === "beast" ? Math.round(base * knobs.beastBuyOffMultiplier) : base;
}

export function parley(world: WorldState, catalog: Catalog, enc: Encounter, choice: ParleyChoice, extra: Parameters<typeof worldKnobs>[1] = {}): ParleyOutcome {
  const knobs = encounterKnobs(world, catalog, enc, extra);
  const rng = new WorldRng(world.rng);
  try {
    switch (choice) {
      case "buyoff": {
        const inst0 = world.opponents.find((o) => o.id === enc.opponentId);
        const tmpl0 = inst0 ? opponentTemplate(catalog, inst0) : undefined;
        if (tmpl0 && tmpl0.buyable === false) return { type: "refused", reason: `${tmpl0.name} cannot be bought off` };
        const price = buyOffPrice(knobs, enc.tier, tmpl0);
        if (world.player.gold < price) return { type: "refused", reason: `${tmpl0?.kind === "beast" ? "distraction" : "buy-off"} costs ${price} gold; you have ${world.player.gold}` };
        world.player.gold -= price;
        removeOpponent(world, enc.opponentId, "boughtOff"); // S16: any outcome removes the roamer
        return { type: "boughtOff", goldPaid: price };
      }
      case "flee": {
        // Ante is forfeit either way (manifest); success = escape, failure = fight.
        const stake = pickAnteFromDeck(rng, activeDeck(world), knobs.anteCount);
        forfeitCards(world, stake);
        const escaped = rng.chance(knobs.fleeOddsByTier[enc.tier]);
        if (escaped) {
          removeOpponent(world, enc.opponentId, "fled"); // S16: any outcome removes the roamer
          return { type: "fled", anteLost: stake };
        }
        // Forced fight after a failed flee: the duel still antes per rules
        // (you've already lost the flee stake — stakes compound, by design).
        return { type: "fleeFailed", anteLost: stake };
      }
      case "fight":
        return { type: "fight", duel: prepareDuel(world, catalog, enc, rng, knobs) };
    }
  } finally {
    world.rng = rng.state();
  }
}

/** Build the MatchSpec from world state (ADR-002 consumed from the world side). */
export function prepareDuel(world: WorldState, catalog: Catalog, enc: Encounter, rng: WorldRng, knobs: KnobValues): PreparedDuel {
  const inst = world.opponents.find((o) => o.id === enc.opponentId);
  if (!inst) throw new Error(`no opponent instance ${enc.opponentId}`);
  const tmpl = opponentTemplate(catalog, inst);
  const legal = deckLegal(activeDeck(world));
  if (!legal.ok) throw new Error(`cannot duel: ${legal.reason}`);
  const seed = rng.int(1_000_000_000);
  const modifiers: Modifier[] = [{ type: "startingLife", player: 1, value: tmpl.worldLife }];
  const spec: MatchSpec = {
    seed,
    players: [
      { name: world.player.name, decklist: activeDeck(world).map((e) => ({ ...e })), agent: "human" },
      { name: tmpl.name, decklist: enemyDeck(catalog, tmpl.deck).decklist, agent: `heuristic:${tmpl.difficulty}` },
    ],
    rules: { startingLife: world.player.worldLife, handSize: 7, mulligan: "london", maxTurns: 100, ante: knobs.anteCount },
    modifiers,
  };
  return { encounter: enc, seed, spec, enemy: { name: tmpl.name, difficulty: tmpl.difficulty, deck: tmpl.deck, archetype: enemyDeck(catalog, tmpl.deck).archetype, portrait: tmpl.portrait, worldLife: tmpl.worldLife, tier: tmpl.tier } };
}

/** Resolve a finished duel into the world: ante both ways, gold, world life. */
export function applyDuelResult(world: WorldState, catalog: Catalog, duel: PreparedDuel, result: MatchResult, extra: Parameters<typeof worldKnobs>[1] = {}): DuelRecord {
  const knobs = encounterKnobs(world, catalog, duel.encounter, extra);
  const [mine, theirs] = result.facts.ante;
  const inst = world.opponents.find((o) => o.id === duel.encounter.opponentId);
  let outcome: DuelRecord["outcome"];
  let anteWon: string[] = [];
  let anteLost: string[] = [];
  if (result.winner === 0) {
    outcome = "win";
    anteWon = [...theirs];
    addToCollection(world, anteWon, "ante");
    world.player.gold += knobs.goldRewardByTier[duel.encounter.tier];
    world.player.renown += duel.encounter.tier; // design round 1 §5: Σ tier of defeated opponents
    if (inst) removeOpponent(world, inst.id, "defeated");
  } else if (result.winner === 1) {
    outcome = "loss";
    anteLost = [...mine];
    forfeitCards(world, anteLost);
    world.player.worldLife = Math.max(knobs.lifeFloor, world.player.worldLife - knobs.lossLifePenalty);
    if (world.player.worldLife <= 0) world.gameOver = true;
    if (inst) removeOpponent(world, inst.id, "lost"); // S16: the roamer leaves either way (lair residents stay)
  } else {
    outcome = "draw"; // stakes return to both sides
    if (inst) removeOpponent(world, inst.id, "draw");
  }
  const record: DuelRecord = {
    index: world.duels.length,
    seed: duel.seed,
    opponentId: duel.encounter.opponentId,
    catalogId: duel.encounter.catalogId,
    outcome,
    anteWon,
    anteLost,
    saved: {
      format: "shandalar-log-v1",
      spec: duel.spec,
      result: { winner: result.winner, reason: result.reason, turns: result.turns, finalLife: result.finalLife },
      log: result.log,
    },
  };
  world.duels.push(record);
  return record;
}
