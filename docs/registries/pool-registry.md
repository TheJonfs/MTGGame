# Pool Registry

Every card in the pool, its status, and the vocabulary it uses. Implementer updates status; planner curates membership.

Status: `planned` / `implemented` / `tested` / `cut`.

## Session 1 slice

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| mountain | Mountain | tested | addMana | |
| plains | Plains | tested | addMana | |
| island | Island | tested | addMana | |
| raging_goblin | Raging Goblin | tested | haste | exercised via fuzz (haste path unit-covered by eligibleAttackers) |
| goblin_piker | Goblin Piker | tested | — | vanilla 2/1; fixture 1 |
| hill_giant | Hill Giant | tested | — | vanilla 3/3; fixtures 13–14 |
| gray_ogre | Gray Ogre | tested | — | vanilla 2/2 for 2R; fixtures 2, 8, 9 |
| lightning_bolt | Lightning Bolt | tested | damage(anyTarget) | fixtures 1–3, 13 |
| shock | Shock | tested | damage(anyTarget) | same path as Bolt; fuzz-exercised |
| brute_force | Brute Force | tested | modifyPT(EOT) | fixtures 2, 14 |
| savannah_lions | Savannah Lions | tested | — | fixtures 4, 5 |
| suntail_hawk | Suntail Hawk | tested | flying | fuzz-exercised; flying path fixture 9 |
| wind_drake | Wind Drake | tested | flying | fixture 9 |
| serra_angel | Serra Angel | tested | flying, vigilance | fixture 7 |
| man_o_war | Man-o'-War | tested | triggered(ETB) bounce | fixture 6 (self-bounce edge, no carve-out needed) |
| cloudkin_seer | Cloudkin Seer | tested | flying, triggered(ETB) draw | fixture 12 |
| counterspell | Counterspell | tested | counter | fixture 3 |
| boomerang | Boomerang | tested | bounce(permanent) | fixture 4 |
| pacifism | Pacifism | tested | aura, restrict(both) | fixtures 4, 5; uses new `attached` scope |
| divination | Divination | tested | draw | unit-covered (sorcery timing) + fuzz |

## Session 2 additions

(Implementer-derived in S2; ratified by ADR-023, including the Rumbling Baloth substitution.)

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| forest | Forest | tested | addMana | |
| grizzly_bears | Grizzly Bears | tested | — | vanilla 2/2 |
| elvish_visionary | Elvish Visionary | tested | triggered(ETB) draw | S2 fixture 9 |
| timberland_guide | Timberland Guide | tested | triggered(ETB) addCounters | fixtures 8, 9; self-target edge like Man-o'-War |
| centaur_courser | Centaur Courser | tested | — | vanilla 3/3; anthem + block-order fixtures |
| rumbling_baloth | Rumbling Baloth | tested | — | vanilla 4/4; **substituted for the brief's Rhox Brute**, which is {2}{R}{G} (uncastable in mono-green); Chris-approved 2026-08-19 |
| pelakka_wurm | Pelakka Wurm | tested | trample, triggered(ETB) gainLife, triggered(DIES) draw | dies-trigger quadruple fixture |
| giant_growth | Giant Growth | tested | modifyPT(EOT) | |
| blaze | Blaze | tested | damage(anyTarget, X) | X enumeration (ADR-017) |
| raise_the_alarm | Raise the Alarm | tested | createToken | |
| glorious_anthem | Glorious Anthem | tested | static modifyPT(creaturesYouControl) | |
| soldier_1_1 | Soldier Token | tested | — | token def, `data/cards/tokens/` |

## Session 3 additions

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| siege_gang_commander | Siege-Gang Commander | tested | triggered(ETB) createToken ×3, activated(sac Goblin) damage | S3 fixtures 1, 1b, 2 |
| goblin_1_1 | Goblin Token | tested | — | token def, colors R (ADR-019) |
| boggart_brute | Boggart Brute | tested | menace | fixtures 9–9c; dead-end-free enumeration |
| bonesplitter | Bonesplitter | tested | equipment, static modifyPT(attached) | fixtures 4, 8 |
| loxodon_warhammer | Loxodon Warhammer | tested | equipment, static modifyPT + grantKeyword(trample, lifelink)(attached) | fixtures 5, 6b, 13 |
| mind_stone | Mind Stone | tested | addMana {C}, activated(sac self) draw | first non-land producer (R-033); fuzz-caught canPay fix |
| darksteel_myr | Darksteel Myr | tested | indestructible | fixture 12 |
| fencing_ace | Fencing Ace | tested | double strike | fixtures 8, 8b |
| prey_upon | Prey Upon | tested | fight | ADR-022; fixtures 7, 7b, 13 |
| deadly_recluse | Deadly Recluse | tested | reach, deathtouch | fixtures 6, 6b, 7 |
| gladecover_scout | Gladecover Scout | tested | hexproof | fixture 10 |
| blurred_mongoose | Blurred Mongoose | tested | shroud, can't be countered | fixture 11 (R-032) |

## Session 4 additions

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| swamp | Swamp | tested | addMana | |
| doom_blade | Doom Blade | tested | destroy(nonblack creature) | S4 fixture 1, 1b |
| terror | Terror | tested | destroy(nonartifact nonblack creature) | regeneration clause ignored; fixture 1 |
| swords_to_plowshares | Swords to Plowshares | tested | exile, gainLife(ref targetPower, controllerOfTarget) | ADR-028; fixtures 2, 2b |
| wrath_of_god | Wrath of God | tested | destroyAll | fixture 3 |
| pyroclasm | Pyroclasm | tested | damageAll(2) | fixture 4 |
| duress | Duress | tested | discard(casterChooses, filter noncreature nonland) | ADR-029; fixtures 5, 5b; targets opponentPlayer (new predicate) |
| mind_rot | Mind Rot | tested | discard(ownerChooses, 2) | fixtures 6, 6b |
| hymn_to_tourach | Hymn to Tourach | tested | discard(random, 2) | power level flagged for later curation; fixture 7 |
| phyrexian_rager | Phyrexian Rager | tested | triggered(ETB) draw + loseLife | fixture 8; first loseLife user |
| nekrataal | Nekrataal | tested | first strike, triggered(ETB) destroy(targeted) | fixture 9; 603.3d path |
| vampire_nighthawk | Vampire Nighthawk | tested | flying, deathtouch, lifelink | keyword composition; fixture 12 |
| child_of_night | Child of Night | tested | lifelink | fixture 2 |
| typhoid_rats | Typhoid Rats | tested | deathtouch | fixtures 4, 9 |
| goblin_chieftain | Goblin Chieftain | tested | haste, static modifyPT + grantKeyword scope{creaturesYouControl, Goblin, other} | ADR-020 first user; fixture 10 |
| curiosity | Curiosity | tested | aura, triggered(DEALS_DAMAGE_TO_PLAYER, source attached, player opponentOfController, optional) draw | ADR-021/027 first user; fixtures 11a-c |

## Session 5 additions

| cardId | name | status | vocabulary | notes |
|---|---|---|---|---|
| control_magic | Control Magic | tested | aura, static gainControl(attached) | ADR-033; R-020; S5 fixtures 1–4 |
| zombify | Zombify | tested | returnFromGraveyard(to battlefield) | fixtures 7–7c |
| gravedigger | Gravedigger | tested | triggered(ETB, optional) returnFromGraveyard(to hand) | fixtures 8–8c |
| rancor | Rancor | tested | aura, static modifyPT + grantKeyword(trample)(attached), triggered(DIES, self) return to owner's hand | scope `self` first user (R-041); fixtures 9–9c |
| drana_kalastria_bloodchief | Drana, Kalastria Bloodchief | tested | flying, legendary, activated(X) modifyPT ×2 | legend rule (R-025); "-X" P/T deltas; fixtures 5–6c |
| mystic_snake | Mystic Snake | tested | flash, triggered(ETB) counter(target spell) | fixtures 10–11 |

## Ceiling anchors (not yet scheduled)
Ceiling complete as of S5 (see mechanics-manifest §3). Further additions are card batches using existing vocabulary.

## Slice decklists (S5 brief Part 3; 40 cards each)
- **A red:** 17 Mountain, 4 Raging Goblin, 2 Goblin Piker, 3 Lightning Bolt, 2 Shock, 2 Blaze, 3 Boggart Brute, 2 Siege-Gang Commander, 2 Bonesplitter, 2 Goblin Chieftain, 1 Pyroclasm.
- **B white-blue:** 8 Plains, 9 Island, 1 Savannah Lions, 2 Serra Angel, 2 Man-o'-War, 2 Cloudkin Seer, 2 Counterspell, 1 Pacifism, 1 Raise the Alarm, 1 Glorious Anthem, 2 Fencing Ace, 1 Loxodon Warhammer, 1 Mind Stone, 2 Swords to Plowshares, 1 Wrath of God, 2 Curiosity, 2 Control Magic.
- **C green:** 17 Forest, 3 Elvish Visionary, 3 Timberland Guide, 2 Centaur Courser, 2 Rumbling Baloth, 2 Pelakka Wurm, 1 Giant Growth, 3 Prey Upon, 2 Deadly Recluse, 2 Gladecover Scout, 1 Blurred Mongoose, 2 Rancor.
- **D black:** 17 Swamp, 2 Typhoid Rats, 2 Child of Night, 3 Vampire Nighthawk, 2 Phyrexian Rager, 3 Nekrataal, 2 Doom Blade, 1 Terror, 1 Duress, 1 Hymn to Tourach, 2 Drana, 2 Gravedigger, 2 Zombify.
- **E Simic (new, S5):** 9 Forest, 8 Island, 3 Mystic Snake, 2 Counterspell, 2 Boomerang, 2 Wind Drake, 2 Man-o'-War, 2 Cloudkin Seer, 2 Curiosity, 3 Grizzly Bears, 3 Elvish Visionary, 2 Deadly Recluse.

(Rotated out of decks but still `tested` pool members: Gray Ogre, Boomerang, Hill Giant, Brute Force, Suntail Hawk, Wind Drake, Darksteel Myr.)

## Test-only cards (not pool members)
`test_fs_soldier` (first strike body), `test_pinger` ({1},T: 1 damage), `test_wrath` ({2} sorcery, destroy all creatures), `test_goblin_martyr` ({R} 1/1 Goblin, dies: draw), `test_pyroclasm` ({1}{R} sorcery, 2 to all creatures) — live in the engine test harness, never in `data/cards/`. Per ADR-018 they are permanent fixtures: engine tests never depend on pool membership.
