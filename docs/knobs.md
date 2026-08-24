# Knobs registry

*Generated from `packages/world/src/knobs.ts` by `pnpm knobs:doc` — do not edit by hand; a test fails when this file is out of sync.*

Every overworld tunable (manifest principle 5). Difficulty bundles, regions, dungeons, opponents, and one-off events are all just sources of knob values, merged whole-value per key in this precedence (later wins):

`world defaults` < `difficulty` < `region` < `dungeon` < `opponent` < `event`

| knob | default | unit | description |
|---|---|---|---|
| `mapScale` | `2` | × base grid (40×28) | World size multiplier (S16, Chris: scale is a variable). Distances scale linearly, counts (towns, roamers) by area; sight radius is absolute — the world grows, your eyes don't. |
| `townSpacingMin` | `8` | cells (Manhattan) | Minimum distance between towns (and between a town and a lair). Relaxed deterministically if the map can't fit the count. |
| `townsPer100Cells` | `{"civilized":0.5,"approach":0.25,"wild":0}` | towns per 100 passable cells, by region tier | Town density per region (S16 uniform towns): count = max(floor for civilized/approach = 1, round(density × area/100)). Every non-wild region has ≥1 town, so every colour has a home town. |
| `roamerDensityPer100Cells` | `{"civilized":1,"approach":1.5,"wild":2}` | roamers per 100 passable cells, by region tier | Spawn density (ADR-071; replaces encounter rates). Region target = round(density × passable cells / 100), minimum 1. Lair residents don't count. |
| `roamerRespawnSteps` | `{"civilized":40,"approach":30,"wild":20}` | steps, by region tier | A region below its roamer target spawns one roamer every N steps (the clock, manifest §5), out of the player's sight. Any parley outcome removes a roamer (S16 ruling), so this is what keeps regions alive. |
| `beastShare` | `{"civilized":0.35,"approach":0.5,"wild":0.5}` | probability a spawned roamer is a spoke-bound signature opponent (beast), by region tier | S18 spawn tables: each roamer (generation and respawn) is a spoke-bound signature opponent of the region's colour (the bestiary, plus the mage-voiced Cunning Tactician) with this probability, else a mage of any colour. Arguing baseline (implementer-picked); world-sim reports it. Beast decks are built from a wider pool than the mages' and can be stronger than their tier suggests (Chris, S18 kickoff). |
| `beastTierBlend` | `{"civilized":[85,15,0],"approach":[33,50,17],"wild":[0,50,50]}` | relative weights for beast tiers 1/2/3, by region tier | S18 (Chris): civilized rings are mostly tier-1 beasts with the occasional tier 2; approach ≈ 33/50/17; wild 50/50 tiers 2 and 3. When the spoke has no beast of the rolled tier, the nearest tier available on that spoke is used; a spoke with no beasts spawns a mage. |
| `beastTierFallback` | `"mage"` | mage | nearest | S18: what a ring does when its spoke has no beast of the rolled tier (black/red have no tier-1 beast, blue no tier-3). `mage` keeps the ring's difficulty honest — a mage of the rolled tier spawns instead (civilized rings stay mostly tier 1); `nearest` puts the spoke's nearest-tier beast there (ties break down in civilized rings, up elsewhere) — more beasts, but a tier-2 deck in a tier-1 slot. The S18 handoff tables were measured under `nearest` first, then `mage`. |
| `lairResidentLifeBonus` | `2` | world life added to a lair resident's duel life | S18 director round (Chris, OQ-8): lair bosses fight harder than their roaming kin — the resident's world life is the template's + this (the Pelakka Wurm in its lair: 12 + 2 = 14, the S14 PoC value). A full opponent life-total tuning pass is scheduled later. |
| `ringRadii` | `{"civilized":0.18,"approach":0.45,"wild":0.78}` | normalised radius (0 = centre, 1 = map edge), by ring | ADR-072: region hearts sit on five colour spokes at these elliptically-normalised radii (jittered per sector by ringJitter). Strongholds sit at strongholdRadius. |
| `strongholdRadius` | `0.92` | normalised radius | ADR-072: each colour's castle is a fixed point this far out along its spoke (present, unused until S19–S21). |
| `spokeJitterDeg` | `12` | degrees (±) | ADR-072: seed jitter on each spoke's angle (the whole pentagram also gets a random rotation and colour order) — maps differ per seed without losing the radial structure. |
| `ringJitter` | `0.06` | normalised radius (±) | ADR-072: seed jitter on each heart's ring radius. |
| `lairsPerRegion` | `{"civilized":0,"approach":0,"wild":1}` | lairs per region, by tier | S14 lair pattern generalised (ADR-072 proposal §2): fixed points with a held-out beast resident (the catalog's beasts, round-robin). Certain encounter until defeated. |
| `roamerStepsPerPlayerStep` | `{"road":0.5,"open":1}` | roamer steps per player step, by the PLAYER's terrain | ADR-072: roads are fast and safe-ish — while you stand on a road every roamer moves at this fraction (fractional-accumulating; composed with roamerSpeed by tier). Future terrains (marsh, deep forest >1) and boots-class effects are keys/modifiers here. |
| `roamerSpeed` | `{"1":1,"2":1,"3":1}` | cells per player step, by enemy tier | Roamer movement rate (fractional accumulates: 0.5 = every other step). The hook for speed effects (roads, boots, slowing terrain) — S16 ships 1 per the brief; tune from world-sim. |
| `sightRadius` | `6` | cells (Manhattan) | How far the player sees roamers, and how far roamers notice the player (symmetric). Absolute — does not scale with mapScale. |
| `roughSightPenalty` | `2` | cells per rough cell on the line of sight | Each rough (impassable) cell on the straight line between you and a roamer shortens YOUR effective sight by this much — the only surviving ambush (ADR-071). Roamers' own sight is unaffected. |
| `renownFleeFactor` | `{"1":4,"2":8,"3":16}` | × enemy tier vs renown, by enemy tier | Design round 1 §5: a roamer flees when tier × factor < player renown (Σ tier of defeated opponents). Fleeing roamers move away; contact is player-initiated. Evaluated every step. |
| `anteCount` | `1` | cards (rules.ante) | Cards each side stakes per duel — passed to the engine as rules.ante. 0 disables. Opponents/dungeons may raise it. |
| `goldRewardByTier` | `{"1":10,"2":25,"3":60}` | gold, by enemy tier | Gold paid for defeating an enemy of each tier (on top of claiming their ante). |
| `buyOffBase` | `15` | gold (× enemy tier) | Parley buy-off price for a tier-1 enemy; multiplied by the enemy's tier. Card-offer buy-offs are M6b. |
| `lossLifePenalty` | `1` | world life | World life lost on a duel loss (manifest §2a). Applied after the duel, floored by lifeFloor. |
| `lifeFloor` | `0` | world life | Lowest world life penalties can reach. 0 = reaching 0 is game over; startingWorldLife = only gained life is ever at risk (the difficulty dial, manifest §2a). |
| `shopStockSize` | `8` | cards | Distinct cards a town shop offers from its seeded stock roll. |
| `shopPriceMultiplier` | `1` | × base price | Scales every shop price (difficulty and region both override it). |
| `startingWorldLife` | `10` | world life | World life at new game; duels start at current world life (engine startingLife is overridden every match). |
| `starterSpares` | `10` | cards | Basics-and-commons added to the collection beside the starter deck at new game (the slice's only spare pool until the editor). |
| `startingGold` | `20` | gold | Gold at new game (enough for one tier-1 buy-off, not two). |
| `shopRefreshSteps` | `100` | steps | A town's shop stock is rolled from (world seed, town, epoch) where epoch = floor(stepsTaken / this) — stock refreshes as the clock advances, with no per-shop state in the save (S13; depletion/sell are M6b). |
| `shopBasePrice` | `4` | gold per (1 + mana value) | Shop price = round(shopPriceMultiplier × shopBasePrice × (1 + mana value)). A 1-drop is 8, a 3-drop 16, a 5-drop 24 at defaults. Basics are never sold (free and infinite). |
| `shopTierMultiplier` | `{"1":1,"2":1.5,"3":2.5}` | price factor by shopTier | ADR-078 (S19): shop price = round(shopPriceMultiplier × shopBasePrice × (1 + mv) × shopTierMultiplier[shopTier]). Arguing baselines 1.0/1.5/2.5 pending the S19 gold-flow world-sim read. R cards never stock (a sale of an R card from the collection is priced at the tier-3 factor — interim, flagged S19). |
| `shopRowCopies` | `3` | copies (max per row) | Each shop row rolls 1..N copies per epoch (S14 dev-3 follow-up, registry-first). Depletion persists within the epoch; restock on the next. |
| `questsPerTown` | `2` | offers per town per game | S19 quests: every town offers this many quests per game (seeded, static; accepting consumes the offer). The manifest floor is 1. |
| `questGoldByTier` | `{"1":20,"2":50,"3":100}` | gold by quest tier (the offering town's ring) | S19 quests: the all-gold reward; card/manalink rewards pay half this in gold beside the item. Arguing baseline — sits above the win-gold table (10/25/60) because a quest is a journey, not one fight. |
| `questDeadlineSteps` | `{"1":220,"2":300,"3":400}` | steps from acceptance, by tier (0 = no deadline) | S19 quests: courier deadlines — the second clock consumer (after roamer respawn). A tour of all towns is ~210 steps (world-sim), so tier 1 is comfortable, not idle. Expiry fails the quest with no further penalty. Bounties never expire. |
| `manalinkCapPerColor` | `1` | manalinks per colour | ADR-069: manalinks are reward-class only, capped per colour; an over-cap reward converts to its gold value. Tied to the granting town (suspension when towns can fall — S20). |
| `beastBuyOffMultiplier` | `2` | × buy-off price | ADR-066: a beast is distracted, not negotiated with — its buy-off price is the tier price times this (when the catalog marks it buyable at all). |
| `fleeOddsByTier` | `{"1":0.6,"2":0.5,"3":0.4}` | probability, by enemy tier | Parley flee contest: chance the escape succeeds (seeded). Success or failure, your ante is forfeit (manifest: fleeing forfeits yours); failure means the fight happens anyway. |

## Difficulty bundles

Named knob sources (manifest §2b). Only `standard` is tuned for the slice (it is the registry defaults); `easy` and `hard` are UNTUNED placeholders awaiting slice playtesting.

- **standard**: (defaults)
- **easy**: `roamerDensityPer100Cells` = `{"civilized":0.7,"approach":1.1,"wild":1.5}`, `lossLifePenalty` = `1`, `lifeFloor` = `10`, `shopPriceMultiplier` = `0.8`, `starterSpares` = `14`
- **hard**: `roamerDensityPer100Cells` = `{"civilized":1.4,"approach":2,"wild":2.6}`, `anteCount` = `2`, `lossLifePenalty` = `1`, `lifeFloor` = `0`, `shopPriceMultiplier` = `1.3`, `starterSpares` = `6`
