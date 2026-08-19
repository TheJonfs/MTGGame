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

## Ceiling anchors (not yet scheduled)
Doom Blade, Terror, Swords to Plowshares, Wrath of God, Blaze, Pyroclasm, Mystic Snake, Control Magic, Drana Kalastria Bloodchief, Pelakka Wurm, Prey Upon, Raise the Alarm, Siege-Gang Commander, Glorious Anthem, Phyrexian Rager, Curiosity, Rancor, Loxodon Warhammer, Bonesplitter, Zombify, Giant Growth, Duress, Mind Stone.

## Test-only cards (not pool members)
`test_fs_soldier` (first strike body), `test_pinger` ({1},T: 1 damage) — live in the engine test harness, never in `data/cards/`. They cover paths the slice deliberately lacks (first strike combat, non-mana activated ability). Replace with real pool cards in M2 and consider retiring.
