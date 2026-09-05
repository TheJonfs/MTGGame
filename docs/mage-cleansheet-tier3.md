# The mage cleansheet — Tier 3 (director round draft)

*Planner, 2026-09-05. Third section of the S29 design doc. Tier 3: master, 12 life, anteCount 2, roam the wilds. 40 cards, 17 lands: fourteen basics, two of the pair's Ravnica dual, one of the pair's ABU dual (the headline ante, R-tier). No gold cards; one or two tier-3 titles per deck. The crosses are the ones ratified from the tier-2 doc's matrix: the other parent lines of each pair.*

## The five crosses
| Mage | Pair | Cross | Kind | Deck |
|---|---|---|---|---|
| Lord Corvane | WB | Sexton × the Choir | mage-beast | reanimating angels |
| Varro Flamebrand | UR | Tidewright × Sparkwright | mage-mage | mill and burn |
| High Warden Sorrel | BR | Sparkwright × the Specters | mage-beast | spells and discard |
| Thornmother Ysolde | WG | Wardener × the Pride | mage-beast | auras on a wide board |
| Magister Quill | UG | Tidewright × the Wurms | mage-beast | mill until the Wurms |

(Corvane was mono-B, Sorrel UW, Quill GU, Ysolde G, Varro R. Assignments by name flavour; swap freely.)

---

## Lord Corvane — WB, "the Sepulchre" (reanimating angels)
```
7 Plains · 7 Swamp · 2 Godless Shrine · 1 Scrubland
2 Youthful Valkyrie
2 Inspiring Overseer
2 Indulgent Aristocrat
2 Blood Artist
2 Gravedigger
2 Unearth
2 Zombify
1 Restoration Angel
2 Serra Angel          ← tier 3
1 Reya Dawnbringer
2 Swords to Plowshares
1 Pacifism
1 Dark Ritual
1 Terror
```
40 / 17 / 23. Eight angels; the Valkyrie grows with each one. The Sexton's engine (Aristocrat bins, Artist drains, Unearth and Zombify return) pointed at the Choir's bodies: Zombify on a Serra on turn four, and Reya — the one card in the pool that reanimates *every upkeep* — is the deck's late game, whether cast or Zombified. Reya's price/tier row reads tier 1 at 40 gold in cards.md, which looks wrong for a nine-drop; flag for the implementer.
**Teaches:** exile is the only removal that matters here; kill the Aristocrat or the angels never stay dead.

## Varro Flamebrand — UR, "the Ashwright" (mill and burn)
```
7 Island · 7 Mountain · 2 Steam Vents · 1 Volcanic Island
3 Hedron Crab
2 Young Pyromancer
2 Arc Mage
2 Traumatizer
3 Lightning Bolt
2 Shock
1 Blaze
2 Brainstorm
1 Divination
2 Boomerang
1 Counterspell
1 Essence Scatter
1 Faerie Formation     ← tier 3
```
40 / 17 / 23; thirteen instants and sorceries. Two clocks the player has to count at once: the library (Crabs, Traumatizers) and the life total (burn, Elementals). Arc Mage turns dead lands into damage; Brainstorm feeds the Pyromancer and finds the burn. The Formation is the flying finisher when neither clock closes.
**Teaches:** you can't defend both axes — pick which one you're dying to and race the other.

## High Warden Sorrel — BR, "the Inquisitor" (spells and discard)
```
7 Swamp · 7 Mountain · 2 Blood Crypt · 1 Badlands
3 Young Pyromancer
2 Arc Mage
2 Hypnotic Specter    ← tier 3
1 Hymn to Tourach     ← tier 3
2 Duress
2 Mind Rot
3 Lightning Bolt
2 Shock
1 Blaze
2 Terror
1 Vampire Nighthawk
1 Dark Ritual
1 Unearth
```
40 / 17 / 23; fifteen instants and sorceries. Every discard spell is a Pyromancer trigger; the Specter is the Warband's old headline in a deck that finally supports it. Duress on turn one, Hymn on two, a Pyromancer with two Elementals on three.
**Teaches:** play around discard — don't sandbag; the Sparkwright's lesson (kill the engine) still applies.

## Thornmother Ysolde — WG, "the Thornmother" (auras on a wide board)
```
8 Forest · 6 Plains · 2 Temple Garden · 1 Savannah
2 Savannah Lions
2 Suntail Hawk
2 Fencing Ace
2 Gladecover Scout
2 Blurred Mongoose
2 Birds of Paradise
2 Raise the Alarm
2 Glorious Anthem
2 Rancor
2 Blanchwood Armor
1 Giant Growth
1 Swords to Plowshares
1 Serra Angel          ← tier 3
```
40 / 17 / 23. The Pride's width under Anthem, with the Wardener's hexproof bodies to carry the auras when the board gets swept. Two plans in one deck; the AI's cast policy should pick by hand — Anthem with three creatures out, Armor with a Scout out.
**Teaches:** Wrath answers the width but not the Scout; edicts answer the Scout but not the width.

## Magister Quill — UG, "the Drowned Grove" (mill until the Wurms)
```
7 Forest · 6 Island · 2 Breeding Pool · 1 Tropical Island · 1 Evolving Wilds
3 Hedron Crab
2 Cathartic Adept
2 Traumatizer
3 Rampant Growth
2 Llanowar Elves
1 Man-o'-War
2 Gaean Wurm
1 Pelakka Wurm         ← tier 3
1 Baru, Wurmspeaker    ← tier 3
2 Altar of Dementia
2 Essence Scatter
1 Counterspell
1 Brainstorm
```
40 / 17 / 23. The Tidewright's mill until the Wurms' ramp lands something huge, then the Altar turns a Wurm into a library's worth of mill: sacrifice a Gaean Wurm and the game ends. Baru makes the Wurms trample if the mill is too slow.
**Teaches:** the Altar with a fatty is lethal at any life total; counting the AI's library-kill is as important as counting its damage.

---

## Placement of the S28 five and the six adds across all fifteen
| Card | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Spirit Link | Oriel | Vael, Brennor | — |
| Brainstorm | Tessaly | Kessa, Pell | Varro, Quill |
| Unearth | Edric | Vael, Maelin | Corvane, Sorrel |
| Birds of Paradise | Hask | Brennor, Pell | Ysolde |
| Orcish Lumberjack | — | — | — (shop-only until phase two; ratified) |
| Soul Warden | Oriel | Vael, Brennor | — |
| Hedron Crab | Tessaly | Pell | Varro, Quill |
| Young Pyromancer | Brann | Kessa | Varro, Sorrel |
| Arc Mage | Brann | Kessa | Varro, Sorrel |
| Blanchwood Armor | Hask | Brennor | Ysolde |
| Altar of Dementia | Tessaly | Pell | Quill |

## Open for the director
1. The tier-3 assignments (Sorrel to BR is the least name-obvious).
2. Reya Dawnbringer's tier/price row (tier 1 / 40 looks like a data error; a nine-drop reanimator reads tier 3).
3. Whether tier-3 mages should hold a *second* copy of their ABU dual (two headline antes for anteCount 2) — I've given one.
