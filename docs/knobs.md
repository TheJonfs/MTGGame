# Knobs registry

*Generated from `packages/world/src/knobs.ts` by `pnpm knobs:doc` — do not edit by hand; a test fails when this file is out of sync.*

Every overworld tunable (manifest principle 5). Difficulty bundles, regions, dungeons, opponents, and one-off events are all just sources of knob values, merged whole-value per key in this precedence (later wins):

`world defaults` < `difficulty` < `region` < `dungeon` < `opponent` < `event`

| knob | default | unit | description |
|---|---|---|---|
| `encounterRatePerStep` | `{"civilized":0.04,"approach":0.08,"wild":0.12}` | probability per step, by region tier | Chance that one step on the open map rolls an encounter. Regions (and difficulty) override the whole tier map. |
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
| `shopRefreshSteps` | `50` | steps | A town's shop stock is rolled from (world seed, town, epoch) where epoch = floor(stepsTaken / this) — stock refreshes as the clock advances, with no per-shop state in the save (S13; depletion/sell are M6b). |
| `shopBasePrice` | `4` | gold per (1 + mana value) | Shop price = round(shopPriceMultiplier × shopBasePrice × (1 + mana value)). A 1-drop is 8, a 3-drop 16, a 5-drop 24 at defaults. Basics are never sold (free and infinite). |
| `fleeOddsByTier` | `{"1":0.6,"2":0.5,"3":0.4}` | probability, by enemy tier | Parley flee contest: chance the escape succeeds (seeded). Success or failure, your ante is forfeit (manifest: fleeing forfeits yours); failure means the fight happens anyway. |

## Difficulty bundles

Named knob sources (manifest §2b). Only `standard` is tuned for the slice (it is the registry defaults); `easy` and `hard` are UNTUNED placeholders awaiting slice playtesting.

- **standard**: (defaults)
- **easy**: `encounterRatePerStep` = `{"civilized":0.03,"approach":0.06,"wild":0.1}`, `lossLifePenalty` = `1`, `lifeFloor` = `10`, `shopPriceMultiplier` = `0.8`, `starterSpares` = `14`
- **hard**: `encounterRatePerStep` = `{"civilized":0.06,"approach":0.11,"wild":0.16}`, `anteCount` = `2`, `lossLifePenalty` = `1`, `lifeFloor` = `0`, `shopPriceMultiplier` = `1.3`, `starterSpares` = `6`
