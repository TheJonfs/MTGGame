# Session 45 brief — the tier-3 round

*Planner → Implementer. 2026-09-30. Follows the running handoff.md (after S44) and its cost read. Process rules unchanged: appends to `docs/decision-updates/s45.md`; re-verify every ⚠ real card by curl and encode Oracle verbatim from the printing named; the custom from its text exactly; fuzz before fixtures; every AI change carries a ladder delta or reverts.*

## Part 0 — ADR appends
- **ADR-140 — Six tier-3 cards, six beasts (pool 227 → 233).** Tier 3 was sized for a 173-card pool; red's shelf held one card. Each new card caps a line the pool already carries and fields as a roaming tier-3 beast on both maps (the Nighthawk's rule). Placement is the tier-3 shop (60 gold, the tier's price); none prizeOnly.
- **ADR-141 — The Wellhouse's tie rule.** Where a territory has two tier-3 beasts, the *newer* guards the flood's spring; the older keeps roaming. (Red: the Dragon Mage and the Guttersnipe are both newer than the Siege-Gang — the Guttersnipe takes the Wellhouse; the planner's pick, one line.)
- **The lairs' Chronicle lines** (S44 Deviation 2): *the Landing* — "The Landing is held. A foot of the flood is yours."; *the Wellhouse* — "The Wellhouse is yours. The spring gives back a little."; *the Hearthstead* — "The Hearthstead's fire is yours to sit by." Drop in as `fall` on the kinds.

## Part 1 — The cards
| card | printing ⚠ | text as the planner has it ⚠ | caps | words |
|---|---|---|---|---|
| **Dragon Mage** | Scourge | {5}{R}{R} 5/5 Dragon Wizard. Flying. Whenever it deals combat damage to a player, each player discards their hand, then draws seven cards. | red mill / the wheel | **discard-all** (½ — Hymn is two at random; "discards their hand" is a whole-hand discard) + draw N |
| **Guttersnipe** | M13 | {2}{R} 2/2 Goblin Shaman. Whenever you cast an instant or sorcery spell, it deals 2 damage to each opponent. | Pyromancer-and-burn's finisher | zero (the cast trigger) |
| **Dread Presence** | M20 | {3}{B} 3/3 Nightmare. Whenever a Swamp you control enters, choose one — draw a card and lose 1 life; or it deals 2 damage to any target and you gain 2 life. | Swamps matter (Tendrils) | zero (landfall with a Swamp filter; a mode) |
| **Emeria Angel** | Zendikar | {2}{W}{W} 3/3 Angel. Flying. Landfall — you may create a 1/1 white Bird creature token with flying. | tokens-and-skies; the Soul Warden line's payoff | zero + a Bird token def |
| **Seedborn Muse** | Legions | {3}{G}{G} 2/4 Spirit. Untap all permanents you control during each other player's untap step. | the mana creatures; everything attacks and blocks | **the opponent's untap step** as a trigger point (½) |
| **Tidewall** (custom) | — | {1}{U}{U} 0/4 Wall. Flying, defender. Whenever Tidewall blocks, return target instant or sorcery card from your graveyard to your hand. | spell-heavy blue on defence | zero (the Djinn's blocks trigger; the Dredger's typed return) |

Art: the five real cards through `art:fetch`; the Tidewall through the image skill (a wall of standing water, a spell surfacing in it — subject from the flood register), four candidates to Chris; six battle portraits (house ink-and-wash, two candidates each) for the beast rows.

## Part 2 — The beasts (thirty cards, twelve lands; the S18 pattern; tier 3, worldLife 12, master, the row's spoke, `buyable`; the parley verb and line — Chris's pen)

**The Dragon Mage** (R)
```
12 Mountain
2 Dragon Mage · 2 Goblin Piker · 2 Boggart Brute · 1 Thundersnake · 1 Arc Mage · 2 Hordeling Outburst
3 Lightning Bolt · 2 Shock · 1 Blaze · 1 Char · 1 Pyroclasm
```
**The Guttersnipe** (R)
```
12 Mountain
2 Guttersnipe · 2 Young Pyromancer · 1 Arc Mage · 1 Thundersnake
3 Lightning Bolt · 3 Shock · 1 Char · 1 Blaze · 2 Abrade · 1 Brute Force · 1 Hordeling Outburst
```
**The Dread Presence** (B)
```
11 Swamp · 1 Thawing Glaciers
2 Dread Presence · 2 Typhoid Rats · 2 Child of Night · 1 Vampire Nighthawk · 2 Phyrexian Rager · 1 Gravedigger
2 Tendrils of Corruption · 2 Doom Blade · 1 Terror · 1 Diabolic Edict · 1 Duress · 1 Dark Ritual
```
**The Emeria Angel** (W)
```
11 Plains · 1 Evolving Wilds
2 Emeria Angel · 2 Soul Warden · 2 Suntail Hawk · 2 Youthful Valkyrie · 1 Inspiring Overseer · 1 Master Decoy · 1 Restoration Angel
2 Raise the Alarm · 1 Glorious Anthem · 2 Pacifism · 1 Swords to Plowshares · 1 Spirit Link
```
**The Seedborn Muse** (G)
```
12 Forest
2 Seedborn Muse · 3 Llanowar Elves · 1 Birds of Paradise · 2 Wood Elves · 2 Grizzly Bears · 2 Centaur Courser · 1 Rumbling Baloth · 1 Gaean Wurm
2 Giant Growth · 1 Prey Upon · 1 Rancor
```
**The Tidewall** (U)
```
12 Island
2 Tidewall · 2 Wall of Air · 2 Hedron Crab · 1 Traumatizer · 1 Wind Drake
2 Thought Scour · 2 Brainstorm · 2 Counterspell · 1 Essence Scatter · 2 Boomerang · 1 Altar of Dementia
```
Validate every id; report a substitution. Rows into `opponents.json`; the rows roam both maps.

**The parley verbs and lines** (planner; the beast's row — the verb is the approach, the line the narration at the stakes menu, in the bestiary's register):
- **The Dragon Mage** — verb *circles*; line: *"It reads as it flies. Whatever it takes from you, it will hand back — and take again."*
- **The Guttersnipe** — verb *scuttles*; line: *"Every spark it throws lands twice. It has thrown many."*
- **The Dread Presence** — verb *seeps*; line: *"The ground is wet under it, and getting wetter. It is glad of every swamp you give it."*
- **The Emeria Angel** — verb *descends*; line: *"Birds rise from every place she lands. There are a great many places."*
- **The Seedborn Muse** — verb *stirs*; line: *"Nothing near it rests. Whatever attacks will stand again to block."*
- **The Tidewall** — verb *rises*; line: *"It does not come to you. It waits, and what it stops, it remembers."*

## Part 3 — AI (pinned; ladder gates)
- Dragon Mage: attacks when unblocked or the wheel is worth the trade (an empty hand wheels for free); the AI keeps burn in hand under it (the wheel refills).
- Guttersnipe: the cast-trigger damage priced as a clock (the S28 burn curve); cheap spells held until it's out when the board is quiet (the Pyromancer's rule).
- Dread Presence: the mode by state — draw when life is high and the hand is short; damage at a killable creature, else face when racing.
- Emeria Angel: the token is free — always; the AI plays lands after her when it can.
- Seedborn Muse: attack freely when she's out (the board untaps to block); mana creatures tap for instants on the opponent's turn (Giant Growth in combat).
- Tidewall: blocks whenever the block is safe (0 power never trades) — the trigger's target is the dearest spell in the yard; the attack planner treats it as a wall that costs the attacker a card.

## Part 4 — Measure
- The six beasts against the five starters and the post-lairs references (`mage-sweep --part 6` extended; `flood-sim` if the rows differ by phase); the tier-3 band is 30–45 for the starters.
- **The wild ring's density**: a second tier-3 beast in red changes `rollTemplate`'s weights — a `world-sim` read of encounter mix per ring, phase one and two, before and after; the planner rules on the weights if red's wilds get denser than the others.
- The Wellhouse tie rule pinned (red's spring is the Guttersnipe's).

## Handoff
The six cards and rows, the art candidates, the sweep and density tables, deviations, concerns.
