/**
 * Knobs registry (overworld manifest principle 5; S12 Part 1).
 *
 * Every tunable the overworld exposes lives here, with a default, a unit, and
 * a description. Difficulty settings, regions, dungeons, opponents, and one-off
 * events are all just *sources of knob values*, merged in a fixed precedence:
 *
 *   world defaults < difficulty < region < dungeon < opponent < event
 *
 * "This dungeon is harder" and "this fight antes three cards" are the same
 * mechanism. Adding a knob = one row here (the doc is generated from it —
 * `pnpm knobs:doc`; a test fails when docs/knobs.md is out of sync).
 *
 * Values are resolved whole-value per key (an override replaces the entire
 * value, including tier maps) — simplest to reason about and to author.
 */

export type RegionTier = "civilized" | "approach" | "wild";
export type EnemyTier = 1 | 2 | 3;

export interface KnobSpec<T> {
  default: T;
  /** Human unit/shape hint for the doc. */
  unit: string;
  description: string;
}

const knob = <T>(spec: KnobSpec<T>): KnobSpec<T> => spec;

/** The v0 registry (brief Part 1). Keys are stable identifiers — catalog
 * files reference them; renaming one is a save-format event. */
export const KNOBS = {
  encounterRatePerStep: knob<Record<RegionTier, number>>({
    default: { civilized: 0.04, approach: 0.08, wild: 0.12 },
    unit: "probability per step, by region tier",
    description: "Chance that one step on the open map rolls an encounter. Regions (and difficulty) override the whole tier map.",
  }),
  anteCount: knob<number>({
    default: 1,
    unit: "cards (rules.ante)",
    description: "Cards each side stakes per duel — passed to the engine as rules.ante. 0 disables. Opponents/dungeons may raise it.",
  }),
  goldRewardByTier: knob<Record<EnemyTier, number>>({
    default: { 1: 10, 2: 25, 3: 60 },
    unit: "gold, by enemy tier",
    description: "Gold paid for defeating an enemy of each tier (on top of claiming their ante).",
  }),
  buyOffBase: knob<number>({
    default: 15,
    unit: "gold (× enemy tier)",
    description: "Parley buy-off price for a tier-1 enemy; multiplied by the enemy's tier. Card-offer buy-offs are M6b.",
  }),
  lossLifePenalty: knob<number>({
    default: 1,
    unit: "world life",
    description: "World life lost on a duel loss (manifest §2a). Applied after the duel, floored by lifeFloor.",
  }),
  lifeFloor: knob<number>({
    default: 0,
    unit: "world life",
    description: "Lowest world life penalties can reach. 0 = reaching 0 is game over; startingWorldLife = only gained life is ever at risk (the difficulty dial, manifest §2a).",
  }),
  shopStockSize: knob<number>({
    default: 8,
    unit: "cards",
    description: "Distinct cards a town shop offers from its seeded stock roll.",
  }),
  shopPriceMultiplier: knob<number>({
    default: 1.0,
    unit: "× base price",
    description: "Scales every shop price (difficulty and region both override it).",
  }),
  startingWorldLife: knob<number>({
    default: 10,
    unit: "world life",
    description: "World life at new game; duels start at current world life (engine startingLife is overridden every match).",
  }),
  starterSpares: knob<number>({
    default: 10,
    unit: "cards",
    description: "Basics-and-commons added to the collection beside the starter deck at new game (the slice's only spare pool until the editor).",
  }),
  startingGold: knob<number>({
    default: 20,
    unit: "gold",
    description: "Gold at new game (enough for one tier-1 buy-off, not two).",
  }),
  shopRefreshSteps: knob<number>({
    default: 50,
    unit: "steps",
    description: "A town's shop stock is rolled from (world seed, town, epoch) where epoch = floor(stepsTaken / this) — stock refreshes as the clock advances, with no per-shop state in the save (S13; depletion/sell are M6b).",
  }),
  shopBasePrice: knob<number>({
    default: 4,
    unit: "gold per (1 + mana value)",
    description: "Shop price = round(shopPriceMultiplier × shopBasePrice × (1 + mana value)). A 1-drop is 8, a 3-drop 16, a 5-drop 24 at defaults. Basics are never sold (free and infinite).",
  }),
  shopRowCopies: knob<number>({
    default: 3,
    unit: "copies (max per row)",
    description: "Each shop row rolls 1..N copies per epoch (S14 dev-3 follow-up, registry-first). Depletion persists within the epoch; restock on the next.",
  }),
  beastBuyOffMultiplier: knob<number>({
    default: 2,
    unit: "× buy-off price",
    description: "ADR-066: a beast is distracted, not negotiated with — its buy-off price is the tier price times this (when the catalog marks it buyable at all).",
  }),
  fleeOddsByTier: knob<Record<EnemyTier, number>>({
    default: { 1: 0.6, 2: 0.5, 3: 0.4 },
    unit: "probability, by enemy tier",
    description: "Parley flee contest: chance the escape succeeds (seeded). Success or failure, your ante is forfeit (manifest: fleeing forfeits yours); failure means the fight happens anyway.",
  }),
} as const;

export type KnobKey = keyof typeof KNOBS;
export type KnobValues = { [K in KnobKey]: (typeof KNOBS)[K]["default"] };
/** One source of overrides (a difficulty bundle, a region, an opponent…). */
export type KnobSource = Partial<KnobValues>;

/** Merge precedence, lowest to highest (manifest principle 5). */
export const KNOB_LAYERS = ["difficulty", "region", "dungeon", "opponent", "event"] as const;
export type KnobLayer = (typeof KNOB_LAYERS)[number];

export function defaultKnobs(): KnobValues {
  const out = {} as Record<string, unknown>;
  for (const [k, spec] of Object.entries(KNOBS)) out[k] = structuredClone((spec as KnobSpec<unknown>).default);
  return out as KnobValues;
}

/** Reject unknown keys loudly — catalog data is authored JSON and typos are silent otherwise. */
export function assertKnobSource(source: Record<string, unknown>, where: string): asserts source is KnobSource {
  for (const k of Object.keys(source)) {
    if (!(k in KNOBS)) throw new Error(`Unknown knob "${k}" in ${where} (add it to packages/world/src/knobs.ts first — that's the point)`);
  }
}

/**
 * Resolve the effective knob values: defaults, then each provided layer in
 * precedence order (later wins, whole-value per key). Missing layers are
 * simply skipped.
 */
export function resolveKnobs(layers: Partial<Record<KnobLayer, KnobSource>> = {}): KnobValues {
  const out = defaultKnobs() as Record<string, unknown>;
  for (const layer of KNOB_LAYERS) {
    const src = layers[layer];
    if (!src) continue;
    assertKnobSource(src as Record<string, unknown>, `layer "${layer}"`);
    for (const [k, v] of Object.entries(src)) {
      if (v !== undefined) out[k] = structuredClone(v);
    }
  }
  return out as KnobValues;
}

/** Difficulty bundles are knob sources and nothing more (manifest §2b).
 * Only `standard` is tuned for the slice (= the registry defaults); easy and
 * hard carry placeholder deltas flagged UNTUNED — slice playtesting sets them. */
export type DifficultyName = "easy" | "standard" | "hard";
export const DIFFICULTIES: Record<DifficultyName, KnobSource> = {
  standard: {},
  easy: {
    // UNTUNED placeholders
    encounterRatePerStep: { civilized: 0.03, approach: 0.06, wild: 0.1 },
    lossLifePenalty: 1,
    lifeFloor: 10, // only gained life is ever at risk
    shopPriceMultiplier: 0.8,
    starterSpares: 14,
  },
  hard: {
    // UNTUNED placeholders
    encounterRatePerStep: { civilized: 0.06, approach: 0.11, wild: 0.16 },
    anteCount: 2,
    lossLifePenalty: 1,
    lifeFloor: 0,
    shopPriceMultiplier: 1.3,
    starterSpares: 6,
  },
};
