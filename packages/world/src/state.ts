import { DECKS, type DeckKey } from "@shandalar/sim/decks";
import type { Catalog } from "./catalog.js";
import { generateWorld, type GeneratedWorld, type GeneratorOptions, type OpponentInstance, DEFAULT_GENERATOR } from "./generate.js";
import { resolveKnobs, DIFFICULTIES, type DifficultyName, type KnobSource, type KnobValues } from "./knobs.js";
import type { Point, WorldMap } from "./map.js";
import { WorldRng, type WorldRngState } from "./rng.js";

/**
 * WorldState + save format (brief Part 2). One serializable object: seed,
 * catalog version, map, player, opponent instances, RNG state, duel logs.
 * `world-save-v1` is the first shipped save format — changes after this
 * ships are VERSIONED, never edited (brief "escalate, don't decide").
 */

/** S14 (brief Part 1): v2 adds `shops` (depletion + restock on epoch), `visits`,
 * `lastTownIndex`, and the cosmetic `deckName`. v1 saves load with all four
 * defaulted (migration below). Any further field is a v3 — escalate first. */
export const SAVE_FORMAT = "world-save-v2";
export const SAVE_FORMATS_READABLE = ["world-save-v1", "world-save-v2"] as const;

/** Per-town shop state (S14): which epoch the stock was rolled for and how
 * many of each card were sold in it; a new epoch restocks (sold resets). */
export interface ShopState {
  epoch: number;
  sold: Record<string, number>;
}

export type Decklist = { cardId: string; count: number }[];
/** The collection is the character sheet (manifest §1.4): cardId → copies owned. */
export type Collection = Record<string, number>;

export interface DuelRecord {
  index: number;
  seed: number;
  opponentId: string;
  catalogId: string;
  outcome: "win" | "loss" | "draw";
  anteWon: string[];
  anteLost: string[];
  /** The duel's full saved game (shandalar-log-v1 payload) — every duel log is viewable. */
  saved: unknown;
}

export interface PlayerState {
  name: string;
  position: Point;
  /** World life (manifest §2a): duels START at this; only overworld events move it. */
  worldLife: number;
  gold: number;
  collection: Collection;
  /** Fixed for the slice (no editor); the 30-floor is validated at duel start. */
  activeDeck: Decklist;
  /** The deck's basic land — the slice's ante-replacement card (Chris's ruling). */
  basicLand: string;
  stepsTaken: number;
}

export interface WorldState {
  catalogVersion: string;
  seed: number;
  difficulty: DifficultyName;
  map: WorldMap;
  player: PlayerState;
  opponents: OpponentInstance[];
  rng: WorldRngState;
  duels: DuelRecord[];
  /** Set when world life hits the floor at 0 — the game-over screen reads it. */
  gameOver: boolean;
  /** S14 v2: per-town shop depletion, keyed by town index. */
  shops: Record<number, ShopState>;
  /** S14 v2: visits per town (first-visit text, future shop rules). */
  visits: Record<number, number>;
  /** S14 v2: the town the collection/editor "Back" returns to (−1 = none). */
  lastTownIndex: number;
  /** S14 v2: cosmetic name of the active deck (the editor edits it). */
  deckName: string;
}

export interface NewWorldOptions {
  seed: number;
  catalog: Catalog;
  difficulty?: DifficultyName;
  /** Starter deck = the slice deck for the chosen colour (manifest §2b). */
  starterDeck: DeckKey;
  playerName?: string;
  generator?: GeneratorOptions;
  /** Extra knob layers (tests force encounters via the `event` layer). */
  knobLayers?: Partial<Record<"region" | "dungeon" | "opponent" | "event", KnobSource>>;
}

/** The deck's basic land: the most numerous basic in its list. */
export function basicLandOf(deck: Decklist): string {
  const basics = ["plains", "island", "swamp", "mountain", "forest"];
  let best = "forest";
  let bestN = -1;
  for (const e of deck) {
    if (basics.includes(e.cardId) && e.count > bestN) {
      best = e.cardId;
      bestN = e.count;
    }
  }
  return best;
}

export function deckSize(deck: Decklist): number {
  return deck.reduce((n, e) => n + e.count, 0);
}

export function collectionFrom(deck: Decklist): Collection {
  const c: Collection = {};
  for (const e of deck) c[e.cardId] = (c[e.cardId] ?? 0) + e.count;
  return c;
}

/** Effective knobs for this world: difficulty bundle + any extra layers (opponent layer is per-encounter). */
export function worldKnobs(world: WorldState, extra: Partial<Record<"region" | "dungeon" | "opponent" | "event", KnobSource>> = {}): KnobValues {
  return resolveKnobs({ difficulty: DIFFICULTIES[world.difficulty], ...extra });
}

export function newWorld(opts: NewWorldOptions): WorldState {
  const difficulty = opts.difficulty ?? "standard";
  const knobs = resolveKnobs({ difficulty: DIFFICULTIES[difficulty], ...(opts.knobLayers ?? {}) });
  const gen: GeneratedWorld = generateWorld(opts.seed, opts.catalog, opts.generator ?? DEFAULT_GENERATOR);
  const deck: Decklist = DECKS[opts.starterDeck].decklist.map((e) => ({ ...e }));
  const basic = basicLandOf(deck);
  const collection = collectionFrom(deck);
  // Starter spares (knob): half basics of the deck's colour, half the deck's
  // cheapest nonland commons — the slice's only spare pool until the editor.
  const spares = knobs.starterSpares;
  const basicsN = Math.ceil(spares / 2);
  collection[basic] = (collection[basic] ?? 0) + basicsN;
  const nonlands = deck.filter((e) => !["plains", "island", "swamp", "mountain", "forest"].includes(e.cardId));
  for (let i = 0; i < spares - basicsN; i++) {
    const e = nonlands[i % Math.max(1, nonlands.length)];
    if (e) collection[e.cardId] = (collection[e.cardId] ?? 0) + 1;
  }
  // The world RNG continues from the generator's stream? No — generation is a
  // pure function of the seed; the journey stream is its own seeded stream so
  // regenerating a map never perturbs a saved journey.
  const rng = new WorldRng((opts.seed * 2654435761) >>> 0);
  return {
    catalogVersion: opts.catalog.version,
    seed: opts.seed,
    difficulty,
    map: gen.map,
    player: {
      name: opts.playerName ?? "You",
      position: { ...gen.map.start },
      worldLife: knobs.startingWorldLife,
      gold: knobs.startingGold,
      collection,
      activeDeck: deck,
      basicLand: basic,
      stepsTaken: 0,
    },
    opponents: gen.opponents,
    rng: rng.state(),
    duels: [],
    gameOver: false,
    shops: {},
    visits: {},
    lastTownIndex: gen.map.towns.findIndex((t) => t.at.x === gen.map.start.x && t.at.y === gen.map.start.y),
    deckName: DECKS[opts.starterDeck].name,
  };
}

// ---------- save / load (world-save-v1) ----------

export function serializeWorld(world: WorldState): string {
  return JSON.stringify({ format: SAVE_FORMAT, world }, null, 1);
}

export function deserializeWorld(text: string): WorldState {
  const parsed = JSON.parse(text) as { format?: string; world?: Partial<WorldState> };
  if (!parsed.format || !(SAVE_FORMATS_READABLE as readonly string[]).includes(parsed.format)) {
    throw new Error(`Unsupported save format: ${parsed.format ?? "(none)"} (readable: ${SAVE_FORMATS_READABLE.join(", ")})`);
  }
  const w = parsed.world;
  if (!w || typeof w.seed !== "number" || !w.map) throw new Error("Malformed world save");
  return migrateWorld(parsed.format, w);
}

/** v1 → v2: the four new fields default empty/derived; nothing else moves. */
export function migrateWorld(format: string, w: Partial<WorldState>): WorldState {
  if (format === "world-save-v2") return w as WorldState;
  // world-save-v1
  const map = w.map!;
  const pos = w.player!.position;
  const lastTownIndex = map.towns.findIndex((t) => t.at.x === pos.x && t.at.y === pos.y);
  return {
    ...(w as WorldState),
    shops: {},
    visits: {},
    lastTownIndex,
    deckName: w.deckName ?? "Deck",
  };
}
