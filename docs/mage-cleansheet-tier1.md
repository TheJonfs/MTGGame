# The mage cleansheet — Tier 1 (director round draft)

*Planner, 2026-09-04. First section of the S29 design doc. Portraits and names retained; every deck is new. Pool cards only except the five adds marked ⚠ (texts to be Scryfall-verified by the implementer before encoding, as in S28).*

## Rulings (Chris, 2026-09-05)
- Mages stay **40 cards**; the identity must sit in the top of the list (tier 1 is 8 life).
- The Cunning Tactician (tiers 1–2, kind=mage, spoke W) is **reclassified as white's tier-1/2 beast**. White then has beasts at every tier like the other colours, and the five named mages per tier are the mages.
- No tier-3 cards in tier-1 mage decks.
- Tier-1 mages: **apprentice, 8 life, anteCount 1**, roam anywhere (unchanged).
- No prizeOnly cards in tier-1 mage decks (the ante should be a fair find).

## The six adds (⚠ verify texts)
| Card | Colour | Printing | Text as I have it ⚠ | Words |
|---|---|---|---|---|
| Soul Warden | W | Exodus | {W} 1/1 Human Cleric. Whenever another creature enters, you gain 1 life. | 0 (Youthful Valkyrie's trigger, wider filter) |
| Hedron Crab | U | Zendikar | {U} 0/2 Crab. Landfall — Whenever a land enters under your control, target player mills three cards. | 0 (Yuloke's land-enters trigger, reminder-worded) |
| Young Pyromancer | R | M14 (verified) | {1}{R} 2/1 Human Shaman. Whenever you cast an instant or sorcery spell, create a 1/1 red Elemental creature token. | 1: a cast trigger filtered by spell type |
| Arc Mage | R | Nemesis (verified) | {2}{R} 2/2 Human Spellshaper. {2}{R}, {T}, Discard a card: This creature deals 2 damage divided as you choose among one or two targets. | ½–1: divided damage (the split as a modal choice over the existing modality handling — 2/0 or 1/1 across one or two targets) |
| Altar of Dementia | — | Tempest | {2} Artifact. Sacrifice a creature: Target player mills X cards, where X is the sacrificed creature's power. | ½: X read from the sacrificed creature's power (cost-object last-known information) |
| Blanchwood Armor | G | Urza's Saga | {2}{G} Aura. Enchant creature. Enchanted creature gets +1/+1 for each Forest you control. | 0 (Gaean Wurm's count) |

Tiers/prices by analogy: Soul Warden 1/8, Hedron Crab 1/8, Young Pyromancer 2/12, Arc Mage 2/16, Altar of Dementia 2/16, Blanchwood Armor 1/12. Elemental token: a new token def (1/1 red Elemental).

---

## Sister Oriel — white, "the Almoner" (lifegain)
*Was WU Skies (deck B). Now mono-W. Beats you by refusing to die, then with fliers.*

```
15 Plains · 2 Secluded Steppe
4 Soul Warden ⚠
3 Suntail Hawk
3 Youthful Valkyrie
2 Inspiring Overseer
2 Master Decoy
2 Spirit Link
2 Pacifism
2 Raise the Alarm
1 Swords to Plowshares
1 Glorious Anthem
1 Restoration Angel
```
40 cards, 17 lands, 23 spells. Curve: 7 one-drops, 9 two, 4 three, 1 four.
**Punishes:** the aggro starters (Dawn Levy, the red starter) that race — every Warden trigger and Spirit Link turns a race into a wall. **Teaches:** life is a resource the opponent can also grow; go around (fliers) or remove the Warden.
**AI:** Spirit Link on its own best flier by default; the S28 neutralizer line applies. Raise the Alarm at instant speed for the Warden triggers.

## Tessaly Reed — blue, "the Tidewright" (mill)
*Was Simic Tempo (deck E). Now mono-U. The only opponent in the world that wins through your library.*

```
15 Island · 2 Evolving Wilds
4 Hedron Crab ⚠
4 Cathartic Adept
3 Traumatizer
2 Brainstorm
1 Divination
2 Essence Scatter
1 Counterspell
2 Boomerang
2 Wind Drake
2 Altar of Dementia ⚠
```
40 cards, 17 lands, 23 spells. Evolving Wilds is here for the double landfall (the Wilds enters, then the Island). The Altar is the finisher (sacrifice the board for the last cards) and, for the player, one third of the Usher + Restoration Angel + Altar loop — see the combo note below.
**Punishes:** the 30-card starter that durdles — three Crab triggers and an Adept are a third of your deck by turn five. **Teaches:** deck size is a clock; kill the Crab on sight; and, for later, that milling *yourself* is a thing (Unearth, Zombify, Mother Bear all care).
**AI:** must value mill as a win path when the opponent's library is short — verify the Traumatizer valuation covers the Crab and the Adept; Adept taps at the opponent's end step; Boomerang the blocker, not the Crab's target. Altar: sacrifice for mill only when the opponent's library is within reach of the board's total power, else sacrifice a creature that is about to die anyway.

**The Altar loop (player-side, Chris):** The Usher + Restoration Angel + Altar of Dementia. With Resto's blink trigger targeting the Usher on the stack, sacrifice Resto to the Altar (mill 3; the Usher's dies-trigger drains 2). The blink resolves regardless; the Usher re-enters and returns Resto with haste; Resto's trigger targets the Usher; repeat. Infinite mill and drain, stoppable by the "may." Needs the response window — a stack-timing combo. Fixture: run the loop four iterations in the harness; the Usher's delayed end-step sacrifice on the returned Resto must not tangle with the repeated ETBs. The pieces are spread across the world: Resto (Oriel's ante), the Altar (Tessaly's ante), the Usher (a petal prize).

## Pale Edric — black, "the Sexton" (recursion)
*Was Mono Black goodstuff (deck D). Now the deck where your removal doesn't stick.*

```
15 Swamp · 2 Barren Moor
3 Unearth
2 Zombify
3 Gravedigger
2 Gallows Djinn
2 Blood Artist
2 Indulgent Aristocrat
2 Phyrexian Rager
2 Child of Night
2 Typhoid Rats
2 Terror
1 Dark Ritual
```
40 cards, 17 lands, 23 spells. Zero adds. Unearth's targets (MV ≤ 3): Rager, Child, Rats, Blood Artist, Aristocrat, Unearth-into-Gravedigger is off the table (MV 4) — Zombify does the Djinn and the Gravedigger. The Aristocrat is the outlet that fills the yard and grows the Vampires; Barren Moor cycles to fill it too.
**Punishes:** the removal-heavy starters (white's Swords/Pacifism, black's Terror) — every kill is a Blood Artist ping and an Unearth later. **Teaches:** exile beats destroy; Swords over Terror.
**AI:** Unearth's S28 policy (the target is worth its card). Aristocrat sacrifices a creature only when it's about to die or the counters swing a combat. Blood Artist targets face.

## Brann the Scorched — red, "the Sparkwright" (spells make bodies)
*Was Red Aggro (deck A), which was the Warband with a portrait. Now Chris's tokens-from-spells deck.*

```
15 Mountain · 2 Forgotten Cave
3 Young Pyromancer ⚠
2 Arc Mage ⚠
3 Lightning Bolt
3 Shock
2 Abrade
2 Blaze
2 Brute Force
2 Hordeling Outburst
2 Goblin Piker
1 Thundersnake
1 Bonesplitter
```
40 cards, 17 lands, 23 spells; 14 instants and sorceries to feed the Pyromancer. Forgotten Cave is the excess land that becomes a Pyromancer trigger by cycling — and any land is an Arc Mage shot. Hordeling Outburst is the best card in the deck (three bodies plus a trigger).
**Punishes:** the creature-light starters (Tidal Grimoire) — burn clears the few blockers and the Elementals swarm. **Teaches:** the Pyromancer is the engine; kill it before the spells, not after.
**AI:** Arc Mage split rule — if 2 kills a creature, kill it; if two 1-toughness creatures, split; else face. Discard lands first (kept: enough to cast the hand), then Brute Force. Pyromancer: hold cheap spells until the Pyromancer is on the table when the board is quiet.

## Old Hask — green, "the Wardener" (hexproof auras)
*Was Mono Green midrange (deck C), which half-wanted to be this. Now it is.*

```
16 Forest
4 Gladecover Scout
3 Blurred Mongoose
2 Birds of Paradise
3 Rancor
3 Blanchwood Armor ⚠
2 Timberland Guide
3 Giant Growth
2 Prey Upon
2 Elvish Visionary
```
40 cards, 16 lands, 24 spells. All sixteen lands are Forests on purpose (the Armor counts them; no cyclers). Birds is a mana creature that can wear an Armor in a pinch, but the plan is Scout or Mongoose plus Rancor plus Armor: an untargetable 6/6 trampler by turn four.
**Punishes:** the targeted-removal starters — Swords, Terror, Pacifism, Boomerang all whiff on hexproof and shroud. **Teaches:** blockers and edicts; Wrath; deathtouch (the Recluse starter cards are the answer, and they're green too).
**AI:** aura on the hexproof body first, never on the Birds while a Scout is in hand; Prey Upon with the armoured creature.

---

## Placement of the ten new cards
| Card | Tier-1 mage | Later |
|---|---|---|
| Spirit Link | Sister Oriel ×2 | WB tier 2 |
| Brainstorm | Tessaly Reed ×2 | UR / UG tier 2 |
| Unearth | Pale Edric ×3 | BR tier 2 |
| Birds of Paradise | Old Hask ×2 | WG / UG tier 2 |
| Orcish Lumberjack | — (no mono-R Forests) | a tier-3 splash or shop-only; flagged |
| Soul Warden | Sister Oriel ×4 | WB tier 2 |
| Hedron Crab | Tessaly Reed ×4 | UG tier 2 (mill + Rampant Growth) |
| Young Pyromancer | Brann ×3 | UR tier 2 |
| Arc Mage | Brann ×2 | UR tier 2 |
| Blanchwood Armor | Old Hask ×3 | WG tier 2 |
| Altar of Dementia | Tessaly Reed ×2 | Pale Edric's self-mill line at tier 2–3 (BR / UB-adjacent) |

## Open for the director
1. Mage epithets — I've given each a working name in quotes for the doc only; the in-world names stay as they are unless you want the epithets on the encounter line.

