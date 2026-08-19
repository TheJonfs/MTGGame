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

(The S2 brief referenced this section but the planner had not created it; rows below are implementer-derived from the brief's Part 2 and card texts verified against Scryfall. Planner to ratify — especially the Rumbling Baloth substitution.)

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

## Ceiling anchors (not yet scheduled)
Doom Blade, Terror, Swords to Plowshares, Wrath of God, Blaze, Pyroclasm, Mystic Snake, Control Magic, Drana Kalastria Bloodchief, Pelakka Wurm, Prey Upon, Raise the Alarm, Siege-Gang Commander, Glorious Anthem, Phyrexian Rager, Curiosity, Rancor, Loxodon Warhammer, Bonesplitter, Zombify, Giant Growth, Duress, Mind Stone.

## Test-only cards (not pool members)
`test_fs_soldier` (first strike body), `test_pinger` ({1},T: 1 damage), `test_wrath` ({2} sorcery, destroy all creatures) — live in the engine test harness, never in `data/cards/`. Per ADR-018 they are permanent fixtures: engine tests never depend on pool membership.
