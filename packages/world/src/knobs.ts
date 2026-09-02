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
    default: 2.5,
    unit: "× base grid (40×28)",
    description: "World size multiplier (S16, Chris: scale is a variable). Distances scale linearly, counts (towns, roamers) by area; sight radius is absolute — the world grows, your eyes don't. S22 playtest r2 (Chris, seed 42: Duskmoor crossed in a handful of steps): 2 → 2.5 (80×56 → 100×70, +56% area).",
  }),
  townSpacingMin: knob<number>({
    default: 8,
    unit: "cells (Manhattan)",
    description: "Minimum distance between towns (and between a town and a lair). Relaxed deterministically if the map can't fit the count.",
  }),
  townsPer100Cells: knob<Record<RegionTier, number>>({
    default: { civilized: 0.6, approach: 0.35, wild: 0.12 },
    unit: "towns per 100 passable cells, by region tier",
    description: "Town density per region (S16 uniform towns): count = max(floor for civilized/approach = 1, round(density × area/100)). Every non-wild region has ≥1 town, so every colour has a home town. S22 playtest r2 (Chris): more towns along the way in ALL rings — and the wild rings settle (ADR-082's wild towns pulled forward on Chris's instruction; each wild region carries a planner-seeded town name, and the dormant siegeIntervalSteps.wild knob finally cashes).",
  }),
  riversPerWorld: knob<{ min: number; max: number }>({
    default: { min: 2, max: 4 },
    unit: "rivers (seeded roll in [min, max])",
    description: "S23 wilds polish (ADR-082/084): meandering river ribbons per world. S23 playtest r1 (Chris: hunted a crossing across the map's whole length — one bridge, unreadable fords): rivers are FLAVOR — pure rendering, never touching passability; bridges draw where roads cross and ford marks dot the water.",
  }),
  riverFordsPerRiver: knob<{ min: number; max: number }>({
    default: { min: 1, max: 2 },
    unit: "ford marks per river (seeded roll in [min, max])",
    description: "S23 wilds polish: seeded stepping-stone crossing marks per river — decorative since the flavor ruling (S23 playtest r1).",
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
  // ---- S26 (ADR-091): the Corolla and the Vault ----
  petalBossLife: knob<number>({
    default: 30,
    unit: "life",
    description: "S26: a petal boss's starting life (Chris: 30 to start, tuned after petal-sim and play). 0 = the content file's value.",
  }),
  petalGoldPrize: knob<number>({
    default: 100,
    unit: "gold",
    description: "S26: the purse a fallen petal pays beside the signature (sole-mechanism) and one copy of each of the pair's two duals (Chris's prize ruling).",
  }),
  corollaShopMultiplier: knob<number>({
    default: 4,
    unit: "× shop price",
    description: "S26: the R-drawer shelf at the flower's heart — the only place R is ever stocked — prices every R card at this multiple of its shop price (Chris: four times is a reasonable start).",
  }),
  corollaGridSize: knob<number>({
    default: 41,
    unit: "cells (odd)",
    description: "S26: the petal-world's square grid (the logo as geography; five lobes around the heart). Odd, so the town sits on a cell.",
  }),
  corollaEmpowermentTiers: knob<{ steps: number; addLife: number; addBasic?: boolean; addToken?: boolean; addCard?: boolean }[]>({
    default: [],
    unit: "cumulative tiers by steps walked in the flower",
    description: "S26 (ADR-091): an empowerment clock on Corolla steps, SHIPPED OFF (empty) — time stops in the flower unless play wants tension there. Same tier shape as dungeonEmpowermentTiers; reads steps walked inside since entry.",
  }),
  // ---- S21 (overworld manifest §5): sieges ----
  siegeIntervalSteps: knob<Record<RegionTier, number>>({
    default: { civilized: 1000, approach: 750, wild: 500 },
    unit: "steps between threats, by the town's ring (0 = never)",
    description: "S21 sieges (manifest §5): each town's seeded siege timer — a threat lands every ~interval steps (jittered ±25% per town/epoch; a town's FIRST threat takes a wide U(0.25,1.75) phase so a ring's openers spread — S25 r3). S25 r3 (Chris: post-grace they came fast): +25% across the rings (600/450/300 → 750/560/375), with siegeMaxActive as the harder brake. S26 r3 (Chris: still too frequent in succession once they start): +33% again (750/560/375 → 1000/750/500; difficulty ratios held). The world-sim siege table argues these baselines.",
  }),
  siegeMaxActive: knob<number>({
    default: 2,
    unit: "simultaneous telegraphing threats (≤ 0 = uncapped)",
    description: "S25 r3 (Chris): at most this many sieges IN PROGRESS (threatened, clock running) at once — easy/standard/hard = 1/2/3. A due threat under a full sky defers and re-knocks every 40 steps; a town falling (or being relieved) frees the slot. Occupations don't count — they are consequences, not sieges.",
  }),
  siegeWarningSteps: knob<number>({
    default: 60,
    unit: "steps",
    description: "S21: the relief window — a threatened town telegraphs for this many steps (§5's visible-schedules law: rail, map chip, and in town) before it falls to the party.",
  }),
  siegeGraceSteps: knob<number>({
    default: 300,
    unit: "steps",
    description: "S22 playtest r3 (Chris: an unheard-of wild town fell to a siege before the game had properly opened): the world's opening grace — every town's FIRST threat schedules from this step instead of step 0 (later threats roll from each resolution as before). Arguing baseline; easy/hard override it.",
  }),
  siegePartySize: knob<Record<RegionTier, number>>({
    default: { civilized: 1, approach: 2, wild: 3 },
    unit: "party members, by the town's ring",
    description: "S21: the besieging party's MAXIMUM size by ring — defense and liberation are consecutive duels with life carried between them (dungeon-style, Chris-ruled). The leader fights last. S26 r3: the actual size is rolled from siegePartySizeWeights, capped here.",
  }),
  siegePartySizeWeights: knob<Record<RegionTier, number[]>>({
    default: { civilized: [1], approach: [0.45, 0.55], wild: [0.3, 0.4, 0.3] },
    unit: "relative weights for party sizes 1, 2, 3… by the town's ring",
    description: "S26 r3 (Chris: most sieges were parties of three — more ones and twos): the party size is rolled from these weights (seeded per town/epoch), truncated to siegePartySize's cap. Difficulty bundles lean lighter (easy) or heavier (hard); siegePartyEpochLean shifts weight toward larger parties as a town's siege history grows.",
  }),
  siegePartyEpochLean: knob<number>({
    default: 0.1,
    unit: "weight moved from the smallest size to the largest per epoch",
    description: "S26 r3: with each threat a town has survived (its epoch), this much weight moves from size 1 toward the ring's largest party — the clock hardens the sieges. Capped so size 1 never falls below 0.",
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
    default: 100,
    unit: "world steps per growth increment",
    description: "S22b (the pace war): all five lords strengthen on the GLOBAL world step count — +lordGrowthLife every this-many steps, capped at lordGrowthCap. S25 r4 (Chris: still too fast at 2/100): rates re-set to 0.5/1/2 life per 100 steps by easy/standard/hard (was a flat 2/100) — standard = +1 per 100; easy stretches to +1 per 200; hard doubles the increment. A dawdler at ~1000 steps now meets standard lords at base+10, not the cap.",
  }),
  lordGrowthLife: knob<number>({
    default: 1,
    unit: "life per growth increment",
    description: "S22b: life each lordGrowthSteps increment adds to every lord (see lordGrowthSteps; S25 r4 rates).",
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
  roamerRestEveryNthStep: knob<number>({
    default: 4,
    unit: "every Nth roamer step is a stand-still (0 = never)",
    description: "S26 r3 (Chris: fleeing bounties were uncatchable and pursuers relentless at equal speed): every Nth movement a roamer would make, it stands still instead — a mild, tunable slowness (4 = a quarter slower). Counted per roamer across its movements; composes with roamerSpeed and the terrain factor.",
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
    unit: "offers per town per epoch",
    description: "S19 quests: every town offers this many quests per QUEST EPOCH (seeded; accepting consumes the offer for that epoch). S22 playtest r2 (Chris): boards refresh on the clock — see questRefreshSteps. The manifest floor is 1.",
  }),
  questRefreshSteps: knob<number>({
    default: 200,
    unit: "steps",
    description: "S22 playtest r2 (Chris): town quest boards repost on the clock — offer epoch = floor(stepsTaken / this), the shop-restock pattern (ADR-064). Consumed offers stay consumed within their epoch; a new epoch is a fresh board.",
  }),
  rumorRefreshSteps: knob<number>({
    default: 100,
    unit: "steps",
    description: "S22 playtest r2 (Chris): the tavern pours FEWER lines per sitting (one lore line beside the live trail) but rotates them on the shop cadence — lore epoch = floor(stepsTaken / this). Re-entering within an epoch repeats the same pour (no farming).",
  }),
  manalinkRewardChance: knob<number>({
    default: 0.4,
    unit: "probability per tier-2+ quest offer",
    description: "S19's 25% manalink roll, promoted to a knob and nudged up twice (S22 r2: 0.25→0.30, the thin-comeback-lever read; S24/ADR-086: 0.30→0.40 so the class SHOWS UP now that it carries the recovery half). Caps still apply at award (per-colour for basics; lifeManalinkCap for life).",
  }),
  lifeManalinkWeight: knob<number>({
    default: 0.5,
    unit: "probability a manalink reward rolls the LIFE kind",
    description: "S24 (ADR-086): the manalink class's kind split — life (+1 maximum world life, town-tied, suspension law shared) vs basic (the land in play). Arguing baseline; world-sim's life-economy table tunes it.",
  }),
  lifeManalinkCap: knob<number>({
    default: 0,
    unit: "life manalinks (total); ≤ 0 = uncapped",
    description: "S24 (ADR-086) gave the life kind a 2–3 cap; S25 playtest r2 (Chris) UNCAPPED it — life manalinks are the recovery economy's ceiling-raiser and hoarding them is the design working. ≤ 0 (the default) means no cap; a positive value restores one. Basic links keep manalinkCapPerColor (the in-duel board is the constraint there — under discussion).",
  }),
  innStepsPerLife: knob<number>({
    default: 8,
    unit: "steps per world life restored",
    description: "S24 (ADR-086): the inn's per-point price — rest trades steps for life (5/8/12 by difficulty, the perverse-incentive argument settled per-point over flat). The rest is a TRANSACTION bulk-advancing the world clock: sieges, deadlines, lord growth, respawns all tick; news queues for waking.",
  }),
  // ---- S25 (ADR-088): the five powers — all rates from five-powers-design.md §2, knob-forward. ----
  strideCells: knob<number>({
    default: 2,
    unit: "cells per step while the Stride runs",
    description: "S25 (ADR-088): the Stride's speed — double movement while active. G power; initial form.",
  }),
  strideDuration: knob<number>({
    default: 40,
    unit: "steps",
    description: "S25 (ADR-088): the Stride's duration in steps, initial form. The exchange frame: 4 green cards ≈ 40g buys 40 clock-steps — ~1g per step.",
  }),
  strideDurationAdvanced: knob<number>({
    default: 80,
    unit: "steps",
    description: "S25 (ADR-088): the Stride's duration once the Verdant Throne falls (G/R advance as duration/cap raises).",
  }),
  strideCost: knob<number>({
    default: 4,
    unit: "green spare cards",
    description: "S25 (ADR-088): the Stride's activation price in colour-matched spares.",
  }),
  crossingCost: knob<number>({
    default: 5,
    unit: "blue spare cards",
    description: "S25 (ADR-088): the Crossing's price — instant travel to any town under siege warning or occupation, ZERO clock cost, arrival at the gate. Anywhere-instantly is premium by design.",
  }),
  crossingCostAdvanced: knob<number>({
    default: 3,
    unit: "blue spare cards",
    description: "S25 (ADR-088): the Crossing's price once the Spiral Spire falls (W/U/B advance as cost reductions).",
  }),
  balmCostPerLife: knob<number>({
    default: 3,
    unit: "white spare cards per world life",
    description: "S25 (ADR-088): the Balm's per-point price — field healing capped at maximum world life. ~4x the inn's rate: anywhere-instantly priced as premium.",
  }),
  balmCostPerLifeAdvanced: knob<number>({
    default: 2,
    unit: "white spare cards per world life",
    description: "S25 (ADR-088): the Balm's per-point price once the Argent Bastion falls.",
  }),
  quietusCosts: knob<Record<1 | 2 | 3, number>>({
    default: { 1: 3, 2: 6, 3: 10 },
    unit: "black spare cards by roamer tier",
    description: "S25 (ADR-088): the Quietus — destroy a LONE roamer of the three regular tiers outright at the parley menu. Never lairs' residents, guardians, lords, or siege parties (named beings don't die to a gesture; armies aren't lone). Loot: the ante roll the fight would have paid — no gold, renown as fear only.",
  }),
  quietusCostsAdvanced: knob<Record<1 | 2 | 3, number>>({
    default: { 1: 2, 2: 4, 3: 8 },
    unit: "black spare cards by roamer tier",
    description: "S25 (ADR-088): the Quietus's prices once the Charnel Court falls.",
  }),
  barrageCostPerDamage: knob<number>({
    default: 1,
    unit: "red spare cards per damage",
    description: "S25 (ADR-088): the Barrage — the coming duel opens with damage already dealt (a one-shot startingLife delta on the MatchSpec; the dungeon-law hook). Legal against EVERYTHING; the enemy floors at 1 — red always leaves a fight standing.",
  }),
  barrageCap: knob<number>({
    default: 10,
    unit: "damage",
    description: "S25 (ADR-088): the Barrage's cap, initial form. Full cap ≈ 100g to carve a quarter from a lord.",
  }),
  barrageCapAdvanced: knob<number>({
    default: 15,
    unit: "damage",
    description: "S25 (ADR-088): the Barrage's cap once the Furnace Gate falls.",
  }),
  questGoldByTier: knob<Record<1 | 2 | 3, number>>({
    default: { 1: 20, 2: 50, 3: 100 },
    unit: "gold by quest tier (the offering town's ring)",
    description: "S19 quests: the all-gold reward; card/manalink rewards pay half this in gold beside the item. Arguing baseline — sits above the win-gold table (10/25/60) because a quest is a journey, not one fight.",
  }),
  cardCourierGoldFactor: knob<number>({
    default: 2,
    unit: "× the reward roll's gold",
    description: "S22 playtest r4 (Chris: 10 gold + a tier-1 card for surrendering a card from the collection reads thin): the card-courier's gold multiplies by this — the quest PAYS for the card it takes. Card/manalink riders on the roll are untouched.",
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
    siegeIntervalSteps: { civilized: 1500, approach: 1125, wild: 750 }, // S26 r3: +33% with the standard shift (ratio held)
    siegeMaxActive: 1, // S25 r3 (Chris): easy = one siege at a time
    siegePartySizeWeights: { civilized: [1], approach: [0.6, 0.4], wild: [0.45, 0.4, 0.15] }, // S26 r3: lighter parties
    lordGrowthSteps: 200, // S25 r4: 0.5 life per 100 steps
    siegeWarningSteps: 90,
    siegeGraceSteps: 500,
    innStepsPerLife: 5,
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
    siegeIntervalSteps: { civilized: 750, approach: 560, wild: 375 }, // S26 r3: +33% (ratio held)
    siegeMaxActive: 3, // S25 r3 (Chris): hard = three skies can burn
    siegePartySizeWeights: { civilized: [0.6, 0.4], approach: [0.25, 0.5, 0.25], wild: [0.15, 0.35, 0.5] }, // S26 r3: heavier parties (the cap still rules)
    lordGrowthLife: 2, // S25 r4: 2 life per 100 steps
    siegeWarningSteps: 40,
    siegeGraceSteps: 200,
    innStepsPerLife: 12,
    anteCount: 2,
    lossLifePenalty: 1,
    lifeFloor: 0,
    shopPriceMultiplier: 1.3,
    starterSpares: 6,
  },
};
