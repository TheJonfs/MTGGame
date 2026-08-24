import type { Catalog, StarterId, StarterTemplate } from "./catalog.js";
import { generateWorld, type GeneratedWorld, type GeneratorOptions, type OpponentInstance, DEFAULT_GENERATOR, spawnRoamers } from "./generate.js";
import { resolveKnobs, DIFFICULTIES, type DifficultyName, type KnobSource, type KnobValues } from "./knobs.js";
import { exploredAll, type Point, type WorldMap } from "./map.js";
import { WorldRng, type WorldRngState } from "./rng.js";
import { emptyQuestState, type Manalink, type QuestState } from "./quests.js";

/**
 * WorldState + save format (brief Part 2). One serializable object: seed,
 * catalog version, map, player, opponent instances, RNG state, duel logs.
 * `world-save-v1` is the first shipped save format — changes after this
 * ships are VERSIONED, never edited (brief "escalate, don't decide").
 *
 * v2 (S14): `shops`, `visits`, `lastTownIndex`, `deckName`.
 * v3 (S16, ADR-071): roamer positions (`OpponentInstance.at`/`gone`/`moveDebt`),
 * `decks` + `activeDeckName` (multiple decks; `player.activeDeck`/`deckName`
 * retired), `provenance` (append-only acquisition log), `player.renown`,
 * `player.starterId`. v1/v2 saves migrate with everything defaulted.
 */
export const SAVE_FORMAT = "world-save-v4"; // S19: quests + manalinks + reserved sieges
export const SAVE_FORMATS_READABLE = ["world-save-v1", "world-save-v2", "world-save-v3", "world-save-v4"] as const;

/** Per-town shop state (S14): which epoch the stock was rolled for and how
 * many of each card were sold in it; a new epoch restocks (sold resets). */
export interface ShopState {
  epoch: number;
  sold: Record<string, number>;
}

export type Decklist = { cardId: string; count: number }[];
/** The collection is the character sheet (manifest §1.4): cardId → copies owned. */
export type Collection = Record<string, number>;

/** S16 v3: where a copy came from (append-only; never pruned on loss/sell —
 * it is history, and "new since last visit" reads it by step). */
export type ProvenanceSource = "starter" | "ante" | "shop" | "reward";
export interface ProvenanceEntry {
  cardId: string;
  source: ProvenanceSource;
  step: number;
}

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
  /** S19: reward text for bounties this duel completed (the result screen reads it). */
  questRewards?: string[];
}

export interface PlayerState {
  name: string;
  position: Point;
  /** World life (manifest §2a): duels START at this; only overworld events move it. */
  worldLife: number;
  gold: number;
  collection: Collection;
  /** The deck's basic land — the slice's ante-replacement card (Chris's ruling). */
  basicLand: string;
  stepsTaken: number;
  /** S16 v3 (design round 1 §5): Σ tier of defeated opponents; losses subtract nothing. */
  renown: number;
  /** S16 v3: which catalog starter this world began with (home colour; pilot archetype). */
  starterId: StarterId;
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
  /** S16 v3: every saved deck by name; the active one duels. Spares subtract the ACTIVE deck only (S16 ruling). */
  decks: Record<string, Decklist>;
  activeDeckName: string;
  /** S16 v3: append-only acquisition log. */
  provenance: ProvenanceEntry[];
  /** S16 v3 (ADR-072, reserved): packed explored bits over map cells — the home region + everything ever within sight. Fog rendering is deferred. */
  explored: number[];
  /** S19 v4: quest state (active / completed log / consumed offers). */
  quests: QuestState;
  /** S19 v4 (ADR-069): owned manalinks — every duel starts with each on your battlefield. */
  manalinks: Manalink[];
  /** S19 v4 (reserved for S20 sieges — the field exists so v4 saves survive the siege session without a v5). */
  sieges: unknown[];
}

export interface NewWorldOptions {
  seed: number;
  catalog: Catalog;
  difficulty?: DifficultyName;
  /** Starter deck = the catalog starter for the chosen colour (manifest §2b; ADR-069). */
  starter: StarterId;
  playerName?: string;
  generator?: GeneratorOptions;
  /** Extra knob layers (tests force behaviour via the `event` layer). */
  knobLayers?: Partial<Record<"region" | "dungeon" | "opponent" | "event", KnobSource>>;
}

const BASICS = ["plains", "island", "swamp", "mountain", "forest"];

/** The deck's basic land: the most numerous basic in its list. */
export function basicLandOf(deck: Decklist): string {
  let best = "forest";
  let bestN = -1;
  for (const e of deck) {
    if (BASICS.includes(e.cardId) && e.count > bestN) {
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

/** The deck that duels (v3: `decks[activeDeckName]`). Always present — the
 * active name is validated on every switch. */
export function activeDeck(world: WorldState): Decklist {
  const d = world.decks[world.activeDeckName];
  if (!d) throw new Error(`active deck "${world.activeDeckName}" is missing`);
  return d;
}

export function starterTemplate(catalog: Catalog, id: StarterId): StarterTemplate {
  const s = catalog.starters.find((x) => x.id === id);
  if (!s) throw new Error(`catalog has no starter ${id}`);
  return s;
}

/** The starter's decklist for a difficulty (manifest §2b; design round 1 §2):
 * easy adds, hard swaps — as authored in the catalog. */
export function starterDecklist(starter: StarterTemplate, difficulty: DifficultyName): Decklist {
  const deck: Decklist = starter.decklist.map((e) => ({ ...e }));
  const adj = difficulty === "easy" ? starter.easy : difficulty === "hard" ? starter.hard : undefined;
  if (!adj) return deck;
  for (const e of adj.remove ?? []) {
    const d = deck.find((x) => x.cardId === e.cardId);
    if (!d) throw new Error(`starter ${starter.id}: cannot remove ${e.cardId}`);
    d.count -= e.count;
    if (d.count <= 0) deck.splice(deck.indexOf(d), 1);
  }
  for (const e of adj.add ?? []) {
    const d = deck.find((x) => x.cardId === e.cardId);
    if (d) d.count += e.count;
    else deck.push({ ...e });
  }
  return deck;
}

/** Effective knobs for this world: difficulty bundle + any extra layers (opponent layer is per-encounter). */
export function worldKnobs(world: WorldState, extra: Partial<Record<"region" | "dungeon" | "opponent" | "event", KnobSource>> = {}): KnobValues {
  return resolveKnobs({ difficulty: DIFFICULTIES[world.difficulty], ...extra });
}

export function newWorld(opts: NewWorldOptions): WorldState {
  const difficulty = opts.difficulty ?? "standard";
  const knobs = resolveKnobs({ difficulty: DIFFICULTIES[difficulty], ...(opts.knobLayers ?? {}) });
  const starter = starterTemplate(opts.catalog, opts.starter);
  const gen: GeneratedWorld = generateWorld(opts.seed, opts.catalog, opts.generator ?? DEFAULT_GENERATOR, { knobs, homeColor: starter.color });
  const deck = starterDecklist(starter, difficulty);
  const basic = starter.basicLand;
  const collection = collectionFrom(deck);
  const provenance: ProvenanceEntry[] = [];
  for (const e of deck) for (let i = 0; i < e.count; i++) provenance.push({ cardId: e.cardId, source: "starter", step: 0 });
  // Starter spares (knob): half basics of the deck's colour, half the deck's
  // cheapest nonland commons — the slice's only spare pool until the editor.
  const spares = knobs.starterSpares;
  const basicsN = Math.ceil(spares / 2);
  collection[basic] = (collection[basic] ?? 0) + basicsN;
  for (let i = 0; i < basicsN; i++) provenance.push({ cardId: basic, source: "starter", step: 0 });
  const nonlands = deck.filter((e) => !BASICS.includes(e.cardId));
  for (let i = 0; i < spares - basicsN; i++) {
    const e = nonlands[i % Math.max(1, nonlands.length)];
    if (e) {
      collection[e.cardId] = (collection[e.cardId] ?? 0) + 1;
      provenance.push({ cardId: e.cardId, source: "starter", step: 0 });
    }
  }
  // The world RNG continues from the generator's stream? No — generation is a
  // pure function of the seed; the journey stream is its own seeded stream so
  // regenerating a map never perturbs a saved journey.
  const rng = new WorldRng((opts.seed * 2654435761) >>> 0);
  const start = gen.map.start;
  return {
    catalogVersion: opts.catalog.version,
    seed: opts.seed,
    difficulty,
    map: gen.map,
    player: {
      name: opts.playerName ?? "You",
      position: { ...start },
      worldLife: knobs.startingWorldLife,
      gold: knobs.startingGold,
      collection,
      basicLand: basic,
      stepsTaken: 0,
      renown: 0,
      starterId: starter.id,
    },
    opponents: gen.opponents,
    rng: rng.state(),
    duels: [],
    gameOver: false,
    shops: {},
    visits: {},
    lastTownIndex: gen.map.towns.findIndex((t) => t.at.x === start.x && t.at.y === start.y),
    decks: { [starter.name]: deck },
    activeDeckName: starter.name,
    provenance,
    explored: gen.explored,
    quests: emptyQuestState(),
    manalinks: [],
    sieges: [],
  };
}

// ---------- save / load ----------

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

/** Legacy (v1/v2) shapes the migration reads. */
interface LegacyWorld extends Partial<WorldState> {
  deckName?: string;
  player?: PlayerState & { activeDeck?: Decklist };
  opponents?: (OpponentInstance & { defeated?: boolean })[];
}

/** v1 → v2 → v3 chain. v1 → v2: shops/visits/lastTownIndex/deckName default.
 * v2 → v3: decks from the old active deck under the old name; provenance
 * empty; renown 0; starterId guessed from the basic land; roamers get
 * `gone` from `defeated` and deterministic in-region positions seeded from
 * the world seed (their old selves never had any). */
export function migrateWorld(format: string, input: Partial<WorldState>): WorldState {
  let w = input as LegacyWorld;
  if (format === "world-save-v1") {
    const map = w.map!;
    const pos = w.player!.position;
    const lastTownIndex = map.towns.findIndex((t) => t.at.x === pos.x && t.at.y === pos.y);
    w = { ...w, shops: {}, visits: {}, lastTownIndex, deckName: w.deckName ?? "Deck" };
    format = "world-save-v2";
  }
  if (format === "world-save-v2") {
    const player = w.player!;
    const oldDeck: Decklist = player.activeDeck ?? [];
    const name = w.deckName ?? "Deck";
    const { activeDeck: _drop, ...rest } = player;
    void _drop;
    const basic = player.basicLand ?? basicLandOf(oldDeck);
    const starterId = ({ plains: "white", island: "blue", swamp: "black", mountain: "red", forest: "green" } as Record<string, StarterId>)[basic] ?? "green";
    const opponents = (w.opponents ?? []).map((o) => {
      const { defeated, ...o2 } = o;
      return { ...o2, gone: !!defeated, ...(defeated ? { goneReason: "defeated" as const } : {}), moveDebt: 0 };
    });
    const { player: _p, opponents: _o, deckName: _n, ...worldRest } = w;
    void _p; void _o; void _n;
    const out: WorldState = {
      ...(worldRest as unknown as WorldState),
      player: { ...rest, renown: 0, starterId } as PlayerState,
      opponents: opponents as OpponentInstance[],
      decks: { [name]: oldDeck },
      activeDeckName: name,
      provenance: [],
      explored: exploredAll(w.map!),
    };
    if (!out.map.road) out.map.road = new Array<boolean>(out.map.width * out.map.height).fill(false);
    spawnRoamers(out.map, out.opponents, new WorldRng((out.seed ^ 0x5bd1e995) >>> 0));
    return out;
  }
  // v3 fields that landed after the first v3 commit (same session, before any human save): default them.
  const v3 = w as WorldState;
  if (!v3.explored) v3.explored = exploredAll(v3.map);
  if (!v3.map.road) v3.map.road = new Array<boolean>(v3.map.width * v3.map.height).fill(false);
  // v3 → v4 (S19): quests, manalinks, reserved sieges — all empty defaults; nothing to convert.
  if (!v3.quests) v3.quests = emptyQuestState();
  if (!v3.manalinks) v3.manalinks = [];
  if (!v3.sieges) v3.sieges = [];
  return v3;
}
