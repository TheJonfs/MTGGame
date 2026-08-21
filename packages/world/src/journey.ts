import type { MatchResult, MatchSpec, Modifier } from "@shandalar/engine";
import { DECKS } from "@shandalar/sim/decks";
import type { Catalog, OpponentTemplate } from "./catalog.js";
import type { OpponentInstance } from "./generate.js";
import type { KnobValues } from "./knobs.js";
import { findPath, idx, regionAt, townAt, type Point, type Town } from "./map.js";
import { WorldRng } from "./rng.js";
import { deckSize, worldKnobs, type Decklist, type DuelRecord, type WorldState } from "./state.js";

/**
 * The headless loop (brief Part 3's logic, S12 Part 2 carving (b)): walk →
 * encounter roll per step → parley (fight / flee / buy off) → MatchSpec from
 * world state → the engine's runMatch (caller) → MatchResult back into the
 * collection, gold, and world life. No UI here; the play client and the
 * acceptance test both drive exactly this API.
 */

export interface Encounter {
  opponentId: string;
  catalogId: string;
  tier: 1 | 2 | 3;
  region: number;
  at: Point;
}

export type StepEvent =
  | { type: "moved"; to: Point; steps: number }
  | { type: "arrived"; town: Town }
  | { type: "encounter"; encounter: Encounter };

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

/** Walk a path one cell at a time (each cell = one step = one clock tick);
 * roll an encounter per step by the region's rate; stop on the first
 * encounter (remaining path discarded) or on arrival. Mutates world. */
export function advance(
  world: WorldState,
  catalog: Catalog,
  path: Point[],
  extra: Parameters<typeof worldKnobs>[1] = {},
): StepEvent[] {
  const events: StepEvent[] = [];
  const rng = new WorldRng(world.rng);
  const knobs = worldKnobs(world, extra);
  try {
    for (const cell of path) {
      if (!world.map.passable[idx(world.map, cell)]) throw new Error(`advance: cell ${cell.x},${cell.y} is impassable`);
      world.player.position = { ...cell };
      world.player.stepsTaken += 1;
      events.push({ type: "moved", to: { ...cell }, steps: world.player.stepsTaken });
      const region = regionAt(world.map, cell);
      const town = townAt(world.map, cell);
      if (town) {
        // Towns are safe nodes: no encounter roll on the town cell itself.
        events.push({ type: "arrived", town });
        continue;
      }
      const rate = knobs.encounterRatePerStep[region.tier];
      if (rng.chance(rate)) {
        const roster = world.opponents.filter((o) => o.region === region.index && !o.defeated);
        if (roster.length === 0) continue; // region cleared
        const inst = rng.pick(roster);
        const tmpl = opponentTemplate(catalog, inst);
        const encounter: Encounter = { opponentId: inst.id, catalogId: inst.catalogId, tier: tmpl.tier, region: region.index, at: { ...cell } };
        events.push({ type: "encounter", encounter });
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

export function addToCollection(world: WorldState, cardIds: string[]): void {
  for (const id of cardIds) world.player.collection[id] = (world.player.collection[id] ?? 0) + 1;
}

/** Remove ante'd-away cards from the collection AND the active deck, then
 * refill the deck with its basic land (Chris's slice ruling: the deck never
 * drops below the floor; the full game forks to the editor instead). */
export function forfeitCards(world: WorldState, cardIds: string[]): void {
  const deck = world.player.activeDeck;
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
  if (deckSize(deck) < 30) return { ok: false, reason: `deck has ${deckSize(deck)} cards; the floor is 30 (the deck editor is M6b)` };
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
  enemy: { name: string; difficulty: OpponentTemplate["difficulty"]; deck: OpponentTemplate["deck"]; portrait: string; worldLife: number; tier: 1 | 2 | 3 };
}

export function buyOffPrice(knobs: KnobValues, tier: 1 | 2 | 3): number {
  return knobs.buyOffBase * tier;
}

export function parley(world: WorldState, catalog: Catalog, enc: Encounter, choice: ParleyChoice, extra: Parameters<typeof worldKnobs>[1] = {}): ParleyOutcome {
  const knobs = encounterKnobs(world, catalog, enc, extra);
  const rng = new WorldRng(world.rng);
  try {
    switch (choice) {
      case "buyoff": {
        const price = buyOffPrice(knobs, enc.tier);
        if (world.player.gold < price) return { type: "refused", reason: `buy-off costs ${price} gold; you have ${world.player.gold}` };
        world.player.gold -= price;
        return { type: "boughtOff", goldPaid: price };
      }
      case "flee": {
        // Ante is forfeit either way (manifest); success = escape, failure = fight.
        const stake = pickAnteFromDeck(rng, world.player.activeDeck, knobs.anteCount);
        forfeitCards(world, stake);
        const escaped = rng.chance(knobs.fleeOddsByTier[enc.tier]);
        if (escaped) return { type: "fled", anteLost: stake };
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
  const legal = deckLegal(world.player.activeDeck);
  if (!legal.ok) throw new Error(`cannot duel: ${legal.reason}`);
  const seed = rng.int(1_000_000_000);
  const modifiers: Modifier[] = [{ type: "startingLife", player: 1, value: tmpl.worldLife }];
  const spec: MatchSpec = {
    seed,
    players: [
      { name: world.player.name, decklist: world.player.activeDeck.map((e) => ({ ...e })), agent: "human" },
      { name: tmpl.name, decklist: DECKS[tmpl.deck].decklist.map((e) => ({ ...e })), agent: `heuristic:${tmpl.difficulty}` },
    ],
    rules: { startingLife: world.player.worldLife, handSize: 7, mulligan: "london", maxTurns: 100, ante: knobs.anteCount },
    modifiers,
  };
  return { encounter: enc, seed, spec, enemy: { name: tmpl.name, difficulty: tmpl.difficulty, deck: tmpl.deck, portrait: tmpl.portrait, worldLife: tmpl.worldLife, tier: tmpl.tier } };
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
    addToCollection(world, anteWon);
    world.player.gold += knobs.goldRewardByTier[duel.encounter.tier];
    if (inst) inst.defeated = true;
  } else if (result.winner === 1) {
    outcome = "loss";
    anteLost = [...mine];
    forfeitCards(world, anteLost);
    world.player.worldLife = Math.max(knobs.lifeFloor, world.player.worldLife - knobs.lossLifePenalty);
    if (world.player.worldLife <= 0) world.gameOver = true;
  } else {
    outcome = "draw"; // stakes return to both sides
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
