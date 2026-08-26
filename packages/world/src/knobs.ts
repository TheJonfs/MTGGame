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
  // ---- S16 (ADR-071): roaming visibility replaces encounter rolls. encounterRatePerStep retired. ----
  mapScale: knob<number>({
    default: 2,
    unit: "× base grid (40×28)",
    description: "World size multiplier (S16, Chris: scale is a variable). Distances scale linearly, counts (towns, roamers) by area; sight radius is absolute — the world grows, your eyes don't.",
  }),
  townSpacingMin: knob<number>({
    default: 8,
    unit: "cells (Manhattan)",
    description: "Minimum distance between towns (and between a town and a lair). Relaxed deterministically if the map can't fit the count.",
  }),
  townsPer100Cells: knob<Record<RegionTier, number>>({
    default: { civilized: 0.5, approach: 0.25, wild: 0 },
    unit: "towns per 100 passable cells, by region tier",
    description: "Town density per region (S16 uniform towns): count = max(floor for civilized/approach = 1, round(density × area/100)). Every non-wild region has ≥1 town, so every colour has a home town.",
  }),
  roamerDensityPer100Cells: knob<Record<RegionTier, number>>({
    default: { civilized: 1.0, approach: 1.5, wild: 2.0 },
    unit: "roamers per 100 passable cells, by region tier",
    description: "Spawn density (ADR-071; replaces encounter rates). Region target = round(density × passable cells / 100), minimum 1. Lair residents don't count.",
  }),
  roamerRespawnSteps: knob<Record<RegionTier, number>>({
    default: { civilized: 40, approach: 30, wild: 20 },
    unit: "steps, by region tier",
    description: "A region below its roamer target spawns one roamer every N steps (the clock, manifest §5), out of the player's sight. Any parley outcome removes a roamer (S16 ruling), so this is what keeps regions alive.",
  }),
  // ---- S18 (ADR-066/074): the bestiary roams — spawn tables by ring ----
  beastShare: knob<Record<RegionTier, number>>({
    default: { civilized: 0.35, approach: 0.5, wild: 0.5 },
    unit: "probability a spawned roamer is a spoke-bound signature opponent (beast), by region tier",
    description: "S18 spawn tables: each roamer (generation and respawn) is a spoke-bound signature opponent of the region's colour (the bestiary, plus the mage-voiced Cunning Tactician) with this probability, else a mage of any colour. Arguing baseline (implementer-picked); world-sim reports it. Beast decks are built from a wider pool than the mages' and can be stronger than their tier suggests (Chris, S18 kickoff).",
  }),
  beastTierBlend: knob<Record<RegionTier, [number, number, number]>>({
    default: { civilized: [85, 15, 0], approach: [33, 50, 17], wild: [0, 50, 50] },
    unit: "relative weights for beast tiers 1/2/3, by region tier",
    description: "S18 (Chris): civilized rings are mostly tier-1 beasts with the occasional tier 2; approach ≈ 33/50/17; wild 50/50 tiers 2 and 3. When the spoke has no beast of the rolled tier, the nearest tier available on that spoke is used; a spoke with no beasts spawns a mage.",
  }),
  beastTierFallback: knob<"mage" | "nearest">({
    default: "mage",
    unit: "mage | nearest",
    description: "S18: what a ring does when its spoke has no beast of the rolled tier (black/red have no tier-1 beast, blue no tier-3). `mage` keeps the ring's difficulty honest — a mage of the rolled tier spawns instead (civilized rings stay mostly tier 1); `nearest` puts the spoke's nearest-tier beast there (ties break down in civilized rings, up elsewhere) — more beasts, but a tier-2 deck in a tier-1 slot. The S18 handoff tables were measured under `nearest` first, then `mage`.",
  }),
  // ---- S20 (ADR-079 / dungeon-design v2): dungeons ----
  dungeonGridWidth: knob<number>({
    default: 24,
    unit: "cells",
    description: "Interior grid width. S20 playtest (Chris): the design doc's ~12×9 measured too small — full-loot tours averaged 22 steps, so the 60-step empowerment tier never fired; doubled to 24×18 with branch/minion/treasure counts scaling with grid area (the generator's scale factor).",
  }),
  dungeonGridHeight: knob<number>({
    default: 18,
    unit: "cells",
    description: "Interior grid height (see dungeonGridWidth for the S20 playtest doubling).",
  }),
  dungeonEmpowermentTiers: knob<{ steps: number; addLife: number; addBasic?: boolean; addToken?: boolean; addCard?: boolean }[]>({
    default: [
      { steps: 30, addLife: 2 },
      { steps: 60, addLife: 2, addBasic: true },
      { steps: 90, addLife: 2, addToken: true, addCard: true },
    ],
    unit: "cumulative tiers by interior steps",
    description: "The guardian's empowerment clock (dungeon-design §3, Normal column; difficulty bundles override whole-value per principle 5 — easy shifts thresholds up, hard doubles life). Steps are the ONLY input; tiers are visible in the dungeon UI with the next threshold named. S20 playtest r2 (Chris): 60/120/180 → 30/60/90 — even at the doubled 24×18 grid an optimal full-loot tour (~71 steps) barely crossed the old tier 1; pending future shifts.",
  }),
  // ---- S21 (overworld manifest §5): sieges ----
  siegeIntervalSteps: knob<Record<RegionTier, number>>({
    default: { civilized: 600, approach: 450, wild: 300 },
    unit: "steps between threats, by the town's ring (0 = never)",
    description: "S21 sieges (manifest §5): each town's seeded siege timer — a threat lands every ~interval steps (jittered ±25% per town/epoch). Deeper rings besiege harder. The world-sim siege table argues these baselines.",
  }),
  siegeWarningSteps: knob<number>({
    default: 60,
    unit: "steps",
    description: "S21: the relief window — a threatened town telegraphs for this many steps (§5's visible-schedules law: rail, map chip, and in town) before it falls to the party.",
  }),
  siegePartySize: knob<Record<RegionTier, number>>({
    default: { civilized: 1, approach: 2, wild: 3 },
    unit: "party members, by the town's ring",
    description: "S21: the besieging party's size — defense and liberation are consecutive duels with life carried between them (dungeon-style, Chris-ruled). The leader fights last.",
  }),
  dungeonTreasureWeights: knob<Record<"mox" | "lair", { gold: number; card: number; life: number; boon: number }>>({
    default: { mox: { gold: 30, card: 15, life: 20, boon: 25 }, lair: { gold: 30, card: 10, life: 25, boon: 25 } },
    unit: "relative weights per cache, by dungeon class",
    description: "S21 playtest r2–r3 (Chris): cache kinds — gold (escrowed), card (escrowed; mox rolls T3 or R at even odds, mundane lairs T2 or T3 at even odds — the boss's prize room stays the R channel), life (+2–3 interior life, IMMEDIATE), boon (a permanent on YOUR side of the NEXT interior battle only — the Shandalar hold-or-spend tension; the dungeon colour's basic land or its 1/1-class token creature). Chris tunes from play.",
  }),
  // ---- S22b (the strongholds — stronghold-bosses.md systems, brief Part 4–5) ----
  strongholdGridWidth: knob<number>({
    default: 36,
    unit: "cells",
    description: "S22b: the stronghold interior grid width — the dungeon system at maximum scale. S22 playtest r1 (Chris, the Verdant Throne at seed 146764): the brief's 30×22 read too small and too linear — 36×26 (scale s=3) with the two-route + chambers topology.",
  }),
  strongholdGridHeight: knob<number>({
    default: 26,
    unit: "cells",
    description: "S22b: the stronghold interior grid height (see strongholdGridWidth).",
  }),
  strongholdEmpowermentTiers: knob<{ steps: number; addLife: number; addBasic?: boolean; addToken?: boolean; addCard?: boolean }[]>({
    default: [
      { steps: 50, addLife: 2 },
      { steps: 75, addLife: 2, addBasic: true },
      { steps: 100, addLife: 2, addToken: true, addCard: true },
    ],
    unit: "cumulative tiers by interior steps",
    description: "S22 playtest r1 (Chris): the LORD's empowerment clock — the dungeon 30/60/90 hit too hard at stronghold scale (a thorough tour fought a fully-grown lord every time); 50/75/100 gives the speed-vs-thoroughness dial real travel. Same package shapes as dungeonEmpowermentTiers; strongholds read THIS table.",
  }),
  lordGrowthSteps: knob<number>({
    default: 250,
    unit: "world steps per growth increment",
    description: "S22b (the pace war): all five lords strengthen on the GLOBAL world step count — +lordGrowthLife every this-many steps, capped at lordGrowthCap. Chris's calibration target: a dawdling player faces lords at 40–50 life (base 30 + cap 20 at ~1000 steps).",
  }),
  lordGrowthLife: knob<number>({
    default: 5,
    unit: "life per growth increment",
    description: "S22b: life each lordGrowthSteps increment adds to every lord (see lordGrowthSteps).",
  }),
  lordGrowthCap: knob<number>({
    default: 20,
    unit: "life",
    description: "S22b: the growth term's ceiling — lords top out at base + cap before hunting reductions.",
  }),
  lordLifeFloor: knob<number>({
    default: 15,
    unit: "life",
    description: "S22b (Chris-ratified): spoke-hunt reductions never drop a lord below this — the fight is never trivial. Reduction = floor(spokeMinionPoints / spokePointsPerLife), points uncapped.",
  }),
  spokePointsPerLife: knob<number>({
    default: 3,
    unit: "spoke minion points per −1 lord life",
    description: "S22b: a defeated spoke-bound opponent credits its TIER in points to its colour's lord (inside and outside the stronghold); every N points shave one life. The asymmetry is the design: grinding one spoke softens ONE lord while the clock fattens all five.",
  }),
  strongholdPrizePicks: knob<number>({
    default: 5,
    unit: "cards",
    description: "S22b treasures: picks from the colour prize list (the colour's R and T3 shelf including gold cards and the lord's duals; prizeOnly blocked) when a lord falls — beside the guaranteed sole-drop of his own card and the seal.",
  }),
  lairResidentLifeBonus: knob<number>({
    default: 2,
    unit: "world life added to a lair resident's duel life",
    description: "S18 director round (Chris, OQ-8): lair bosses fight harder than their roaming kin — the resident's world life is the template's + this (the Pelakka Wurm in its lair: 12 + 2 = 14, the S14 PoC value). A full opponent life-total tuning pass is scheduled later.",
  }),
  // ---- S16 (ADR-072): the radial world ----
  ringRadii: knob<Record<RegionTier, number>>({
    default: { civilized: 0.18, approach: 0.45, wild: 0.78 },
    unit: "normalised radius (0 = centre, 1 = map edge), by ring",
    description: "ADR-072: region hearts sit on five colour spokes at these elliptically-normalised radii (jittered per sector by ringJitter). Strongholds sit at strongholdRadius.",
  }),
  strongholdRadius: knob<number>({
    default: 0.92,
    unit: "normalised radius",
    description: "ADR-072: each colour's castle is a fixed point this far out along its spoke (present, unused until S19–S21).",
  }),
  spokeJitterDeg: knob<number>({
    default: 12,
    unit: "degrees (±)",
    description: "ADR-072: seed jitter on each spoke's angle (the whole pentagram also gets a random rotation and colour order) — maps differ per seed without losing the radial structure.",
  }),
  ringJitter: knob<number>({
    default: 0.06,
    unit: "normalised radius (±)",
    description: "ADR-072: seed jitter on each heart's ring radius.",
  }),
  lairsPerRegion: knob<Record<RegionTier, number>>({
    default: { civilized: 0, approach: 0, wild: 1 },
    unit: "lairs per region, by tier",
    description: "S14 lair pattern generalised (ADR-072 proposal §2): fixed points with a held-out beast resident (the catalog's beasts, round-robin). Certain encounter until defeated.",
  }),
  roamerStepsPerPlayerStep: knob<Record<"road" | "open", number>>({
    default: { road: 0.5, open: 1 },
    unit: "roamer steps per player step, by the PLAYER's terrain",
    description: "ADR-072: roads are fast and safe-ish — while you stand on a road every roamer moves at this fraction (fractional-accumulating; composed with roamerSpeed by tier). Future terrains (marsh, deep forest >1) and boots-class effects are keys/modifiers here.",
  }),
  roamerSpeed: knob<Record<EnemyTier, number>>({
    default: { 1: 1, 2: 1, 3: 1 },
    unit: "cells per player step, by enemy tier",
    description: "Roamer movement rate (fractional accumulates: 0.5 = every other step). The hook for speed effects (roads, boots, slowing terrain) — S16 ships 1 per the brief; tune from world-sim.",
  }),
  sightRadius: knob<number>({
    default: 6,
    unit: "cells (Manhattan)",
    description: "How far the player sees roamers, and how far roamers notice the player (symmetric). Absolute — does not scale with mapScale.",
  }),
  roughSightPenalty: knob<number>({
    default: 2,
    unit: "cells per rough cell on the line of sight",
    description: "Each rough (impassable) cell on the straight line between you and a roamer shortens YOUR effective sight by this much — the only surviving ambush (ADR-071). Roamers' own sight is unaffected.",
  }),
  renownFleeFactor: knob<Record<EnemyTier, number>>({
    default: { 1: 4, 2: 8, 3: 16 },
    unit: "× enemy tier vs renown, by enemy tier",
    description: "Design round 1 §5, amended S20 playtest (Chris): a roamer flees when tier × factor < the player's renown IN THE ROAMER'S COLOURS (max over its template `colors`; renown credits per colour of each defeated opponent) — beating up green enemies scares green enemies; white tier 1s still line up. Fleeing roamers move away; contact is player-initiated. Evaluated every step.",
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
    default: 100, // S16: clocks retune with mapScale 2 (was 50 on the 40×28 map)
    unit: "steps",
    description: "A town's shop stock is rolled from (world seed, town, epoch) where epoch = floor(stepsTaken / this) — stock refreshes as the clock advances, with no per-shop state in the save (S13; depletion/sell are M6b).",
  }),
  shopBasePrice: knob<number>({
    default: 4,
    unit: "gold per (1 + mana value)",
    description: "Shop price = round(shopPriceMultiplier × shopBasePrice × (1 + mana value)). A 1-drop is 8, a 3-drop 16, a 5-drop 24 at defaults. Basics are never sold (free and infinite).",
  }),
  shopTierMultiplier: knob<Record<1 | 2 | 3, number>>({
    default: { 1: 1.0, 2: 1.5, 3: 2.5 },
    unit: "price factor by shopTier",
    description: "ADR-078 (S19): shop price = round(shopPriceMultiplier × shopBasePrice × (1 + mv) × shopTierMultiplier[shopTier]). Arguing baselines 1.0/1.5/2.5 pending the S19 gold-flow world-sim read. R cards never stock (a sale of an R card from the collection is priced at the tier-3 factor — interim, flagged S19).",
  }),
  shopRowCopies: knob<number>({
    default: 3,
    unit: "copies (max per row)",
    description: "Each shop row rolls 1..N copies per epoch (S14 dev-3 follow-up, registry-first). Depletion persists within the epoch; restock on the next.",
  }),
  // ---- S19 (overworld manifest §5): quests ----
  questsPerTown: knob<number>({
    default: 2,
    unit: "offers per town per game",
    description: "S19 quests: every town offers this many quests per game (seeded, static; accepting consumes the offer). The manifest floor is 1.",
  }),
  questGoldByTier: knob<Record<1 | 2 | 3, number>>({
    default: { 1: 20, 2: 50, 3: 100 },
    unit: "gold by quest tier (the offering town's ring)",
    description: "S19 quests: the all-gold reward; card/manalink rewards pay half this in gold beside the item. Arguing baseline — sits above the win-gold table (10/25/60) because a quest is a journey, not one fight.",
  }),
  questDeadlineSteps: knob<Record<1 | 2 | 3, number>>({
    default: { 1: 220, 2: 300, 3: 400 },
    unit: "steps from acceptance, by tier (0 = no deadline)",
    description: "S19 quests: courier deadlines — the second clock consumer (after roamer respawn). A tour of all towns is ~210 steps (world-sim), so tier 1 is comfortable, not idle. Expiry fails the quest with no further penalty. Bounties never expire.",
  }),
  manalinkCapPerColor: knob<number>({
    default: 1,
    unit: "manalinks per colour",
    description: "ADR-069: manalinks are reward-class only, capped per colour; an over-cap reward converts to its gold value. Tied to the granting town (suspension when towns can fall — S20).",
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
    dungeonEmpowermentTiers: [
      { steps: 60, addLife: 2 },
      { steps: 90, addLife: 2 },
    ],
    roamerDensityPer100Cells: { civilized: 0.7, approach: 1.1, wild: 1.5 },
    siegeIntervalSteps: { civilized: 900, approach: 675, wild: 450 },
    siegeWarningSteps: 90,
    lossLifePenalty: 1,
    lifeFloor: 10, // only gained life is ever at risk
    shopPriceMultiplier: 0.8,
    starterSpares: 14,
  },
  hard: {
    // UNTUNED placeholders
    dungeonEmpowermentTiers: [
      { steps: 30, addLife: 4 },
      { steps: 60, addLife: 4, addBasic: true },
      { steps: 90, addLife: 4, addToken: true, addCard: true },
    ],
    roamerDensityPer100Cells: { civilized: 1.4, approach: 2.0, wild: 2.6 },
    siegeIntervalSteps: { civilized: 450, approach: 340, wild: 225 },
    siegeWarningSteps: 40,
    anteCount: 2,
    lossLifePenalty: 1,
    lifeFloor: 0,
    shopPriceMultiplier: 1.3,
    starterSpares: 6,
  },
};
