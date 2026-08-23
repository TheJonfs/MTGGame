# Card tier audit — v2 (Chris's verdict round folded in; ship version pending kickoff flags)

*Supersedes the v1 proposal. Applied: Mother Bear → 2, Little Bear → 2, Restoration Angel → 2 (Chris); Demonic Tutor sole R for now, more to come (Chris); gold cards → R (Chris; Mystic Snake moves); multipliers 1.0/1.5/2.5 kept as baselines (Chris); starter cards at tier 2 accepted (Chris); Faerie Formation added at tier 3. **Two rows flagged ⚑ pending Chris's floor-promotion verdict at S19 kickoff** (Boggart Brute, Rumbling Baloth — shown at the proposed T2).*

## Schema (ratified per ADR-078)

**`shopTier: 1 | 2 | 3 | R`** — pool-registry column.
- A town's shop stocks only cards with `shopTier ≤ ring` (civilized = 1, approach = 2, wild = 3).
- **R:** never shop stock. Enters the collection via ante, quest rewards, and treasure; a dedicated R-acquisition mechanism is coming (Chris). Distinct from `prizeOnly` (Lotus): boss/lair treasure only, never even ante.
- **Gold cards are R by rule** (Chris) — rare hybrid magic; one card today (Mystic Snake).
- **Price:** `round(shopBasePrice × (1 + mv) × shopTierMultiplier[tier])`; multipliers **1.0 / 1.5 / 2.5** (knob). Gold-flow world-sim check rides in S19 before any retune.
- Basics: free and infinite in the editor; not shop stock (—).

## Tiers (103 cards)

Distribution: **T1 ×53 · T2 ×31 · T3 ×11 · R ×2** (+ Lotus prizeOnly, + 5 basics), with both ⚑ promotions applied.

### Black
| Card | MV | Tier | Price | Note |
|---|---|---|---|---|
| Dark Ritual | 1 | 2 | 12 | burst enabler |
| Duress | 1 | 2 | 12 | targeted discard |
| Indulgent Aristocrat | 1 | 1 | 8 | |
| Typhoid Rats | 1 | 1 | 8 | tier-1 signature (Plague of Rats) |
| Bitterblossom | 2 | 3 | 30 | spicy list; future R candidate |
| Blood Artist | 2 | 2 | 18 | engine piece |
| Child of Night | 2 | 1 | 12 | |
| Demonic Tutor | 2 | **R** | — | the consistency card (Chris-ratified sole R for now) |
| Doom Blade | 2 | 2 | 18 | premium removal (Terror covers T1) |
| Hymn to Tourach | 2 | 3 | 30 | spicy list; future R candidate |
| Terror | 2 | 1 | 12 | black's accessible removal |
| Waste Not | 2 | 2 | 18 | build-around |
| Hypnotic Specter | 3 | 3 | 40 | tier-3 signature |
| Mind Rot | 3 | 1 | 16 | |
| Phyrexian Rager | 3 | 1 | 16 | |
| Vampire Nighthawk | 3 | 2 | 24 | tier-2 signature |
| Gravedigger | 4 | 1 | 20 | |
| Nekrataal | 4 | 2 | 30 | |
| Tendrils of Corruption | 4 | 2 | 30 | |
| Zombify | 4 | 2 | 30 | |
| Drana, Kalastria Bloodchief | 5 | 3 | 60 | mana-sink finisher |

### Colorless
| Card | MV | Tier | Price | Note |
|---|---|---|---|---|
| Black Lotus | 0 | prizeOnly | — | unchanged (ADR-068) |
| Forest / Island / Mountain / Plains / Swamp | 0 | — | free | |
| Bonesplitter | 1 | 1 | 8 | |
| Mind Stone | 2 | 1 | 12 | |
| Darksteel Myr | 3 | 1 | 16 | |
| Loxodon Warhammer | 3 | 2 | 24 | |

### Green
| Card | MV | Tier | Price | Note |
|---|---|---|---|---|
| Giant Growth | 1 | 1 | 8 | |
| Gladecover Scout | 1 | 1 | 8 | |
| Llanowar Elves | 1 | 1 | 8 | |
| Moss Viper | 1 | 1 | 8 | |
| Prey Upon | 1 | 1 | 8 | green's accessible removal |
| Rancor | 1 | 2 | 12 | punches over mv |
| Blurred Mongoose | 2 | 1 | 12 | |
| Deadly Recluse | 2 | 1 | 12 | tier-1 signature |
| Elvish Visionary | 2 | 1 | 12 | |
| Grizzly Bears | 2 | 1 | 12 | tier-1 signature |
| Mother Bear | 2 | **2** | 18 | Chris's verdict |
| Rampant Growth | 2 | 1 | 12 | |
| Timberland Guide | 2 | 1 | 12 | |
| Werebear | 2 | 1 | 12 | |
| Airship Crash | 3 | 1 | 16 | accessible answer + cycling |
| Centaur Courser | 3 | 1 | 16 | |
| Little Bear | 3 | **2** | 24 | Chris's verdict |
| Baru, Wurmspeaker | 4 | 3 | 50 | spicy list |
| Gaean Wurm | 4 | 2 | 30 | custom |
| Rumbling Baloth | 4 | **2 ⚑** | 30 | floor promotion (tier-2 signature) — pending verdict |
| Treetop Snarespinner | 4 | 1 | 20 | |
| Pelakka Wurm | 7 | 3 | 80 | tier-3 signature |

### Gold
| Card | MV | Tier | Price | Note |
|---|---|---|---|---|
| Mystic Snake | 4 | **R** | — | gold-cards-are-R rule (Chris) |

### Red
| Card | MV | Tier | Price | Note |
|---|---|---|---|---|
| Blaze | 1 | 1 | 8 | |
| Brute Force | 1 | 1 | 8 | |
| Goblin Grenade | 1 | 2 | 12 | cheap power, tribal-gated |
| Lightning Bolt | 1 | 2 | 12 | the best burn; Shock covers T1 |
| Shock | 1 | 1 | 8 | |
| Raging Goblin | 1 | 1 | 8 | |
| Skirk Prospector | 1 | 1 | 8 | |
| Goblin Piker | 2 | 1 | 12 | |
| Pyroclasm | 2 | 2 | 18 | sweeper |
| Boggart Brute | 3 | **2 ⚑** | 24 | floor promotion (tier-2 signature) — pending verdict |
| Goblin Chieftain | 3 | 2 | 24 | tribal lord |
| Goblin Matron | 3 | 2 | 24 | tutor-lite |
| Gray Ogre | 3 | 1 | 16 | tier-1 signature (Gray Ogre) |
| Hordeling Outburst | 3 | 1 | 16 | |
| Hill Giant | 4 | 1 | 20 | |
| Siege-Gang Commander | 5 | 3 | 60 | tier-3 signature |

### Blue
| Card | MV | Tier | Price | Note |
|---|---|---|---|---|
| Cathartic Adept | 1 | 1 | 8 | |
| Curiosity | 1 | 1 | 8 | |
| Boomerang | 2 | 1 | 12 | |
| Counterspell | 2 | 2 | 18 | premium; Scatter covers T1 |
| Essence Scatter | 2 | 1 | 12 | |
| Waterfront Bouncer | 2 | 1 | 12 | |
| Aether Channeler | 3 | 2 | 24 | |
| Cloudkin Seer | 3 | 1 | 16 | |
| Divination | 3 | 1 | 16 | |
| Man-o'-War | 3 | 1 | 16 | tier-1 signature / starter |
| Wind Drake | 3 | 1 | 16 | |
| Aven Fisher | 4 | 1 | 20 | |
| Control Magic | 4 | 3 | 50 | spicy list |
| Mist Raven | 4 | 2 | 30 | |
| **Faerie Formation** | 5 | **3** | 60 | **new**; tier-3 signature (ADR-078) |
| Air Elemental | 5 | 2 | 36 | tier-2 signature |
| Gravitational Shift | 5 | 2 | 36 | |

### White
| Card | MV | Tier | Price | Note |
|---|---|---|---|---|
| Savannah Lions | 1 | 1 | 8 | tier-1 signature (Savannah Lion) |
| Suntail Hawk | 1 | 1 | 8 | |
| Swords to Plowshares | 1 | 2 | 12 | starter copy is the taste (Chris-accepted) |
| Disenchant | 2 | 1 | 12 | accessible answer |
| Fencing Ace | 2 | 1 | 12 | |
| Master Decoy | 2 | 1 | 12 | |
| Pacifism | 2 | 1 | 12 | white's accessible removal |
| Raise the Alarm | 2 | 1 | 12 | |
| Youthful Valkyrie | 2 | 1 | 12 | |
| Glorious Anthem | 3 | 2 | 24 | |
| Inspiring Overseer | 3 | 1 | 16 | |
| Scepter of Dominance | 3 | 2 | 24 | |
| Cunning Tactician | 4 | 2 | 30 | custom; signature |
| Restoration Angel | 4 | **2** | 30 | Chris's verdict |
| Wrath of God | 4 | 3 | 50 | spicy list |
| Serra Angel | 5 | 3 | 60 | tier-3 signature |
