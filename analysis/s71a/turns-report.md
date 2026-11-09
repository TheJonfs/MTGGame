# The whole-turn probe (S71a Part 2) — 2026-11-09

`pnpm pilot-probe --turns --recorded <run> --event <seed> --archetype <a> --playouts 24 --shard i/10 --json …`, then `--turns-report`. For every turn of Chris's (turn 0 is the mulligan) where the pilot — master, his deck, asked at each of his decisions in that turn from the branch on — would have answered otherwise at any of them (mana taps aside): two playouts from the branch (his first decision of the turn after the draw), 24 each, the same seeds, both libraries reshuffled where each leaves the log. (a) his whole turn as recorded, then the pilot (master, both seats) from the next turn; (b) the pilot from the branch. A turn's value is (a) − (b) in wins.

Runs: **Lumen Clio** (event 396379; 16–2), **5C Earthrise** (event 824660; 15–4) — the two top lists furthest below Chris — and the control, **WB Basilisk in Peasant** (event 345700; 11–3), the run where the pilot in his seat came nearest him in S71's opponents probe (59% against his 79%).

## The result

| run | his turns | divergent | his turn, then the pilot | the pilot's turn | (a) − (b) a turn | divergent turns a game | summed a game | his record less the pilot's |
|---|---|---|---|---|---|---|---|---|
| Lumen Clio | 200 | 163 | 68.8 | 65.4 | **+3.3 ± 2.5** | 9.1 | +30.1 | 89 − 56 = 33 |
| 5C Earthrise | 192 | 161 | 65.4 | 62.8 | **+2.6 ± 2.0** | 8.5 | +22.1 | 79 − 57 = 22 |
| WB Basilisk (control) | 167 | 125 | 67.2 | 65.1 | **+2.1 ± 2.0** | 8.9 | +18.5 | 79 − 59 = 20 |

(The last column: his game record in the run against the pilot's — the list's game-one rate in the Open's table for the two Open lists, the opponents probe's 59% for WB Basilisk.)

## The read
1. **No separation.** Neither list's turn is worth three points more than the control's (Lumen Clio +1.2 above it, Earthrise +0.5; each within the error). By the brief's terms this is the null: no whole turn of his carries the gap, and no rule is named.
2. **But the gap is in the turns, evenly.** About nine of his turns a game differ from the pilot's, each worth two to three points, and the sum a game matches each run's gap to within a few points (30 / 33, 22 / 22, 18.5 / 20). The playouts are not strictly additive, so this is suggestive, not a decomposition — but it says the gap accrues a little on nearly every turn, rather than living in a multi-turn plan the per-turn grain cannot see, or in any one kind of decision.
3. **By what differed**, nothing ranks clear of its error: the largest are the mulligan in Earthrise (**+14.3 ± 6.9**, 7 turns — he mulliganed where the pilot kept) and "another spell first" in Lumen Clio (+7.9 ± 6.6, 36 turns). The mulligan is the one lead; seven turns are not a rule.
4. **For the tables**: the pilot's per-turn deficit is the same on the lists furthest below Chris as on the control. The tables read as the pilot's ranking of the lists, under a human by a roughly constant margin a turn — the brief's reading of a null.

## Limits
After the first difference in a turn, the pilot is still asked on Chris's line (a later "difference" may follow from the first). (a) leaves the log a turn later than (b), so its libraries are reshuffled later; the draw of the turn itself is shared (the branch is after it). 24 playouts a side; the per-run error is the turns' spread.

---

| run | his turns | divergent | his turn, then the pilot | the pilot's turn | (a) − (b) |
|---|---|---|---|---|---|
| lumenclio | 200 | 163 | 68.8 | 65.4 | **+3.3 ± 2.5** |
| earthrise | 192 | 161 | 65.4 | 62.8 | **+2.6 ± 2.0** |
| wbbasilisk | 167 | 125 | 67.2 | 65.1 | **+2.1 ± 2.0** |

## lumenclio

By what differed (a turn counts under each kind it holds):

| what differed | turns | (a) − (b) |
|---|---|---|
| a land against something else | 91 | +4.0 ± 3.4 |
| an activation against something else | 90 | +4.9 ± 3.5 |
| the pilot cast, he held | 43 | +0.1 ± 3.3 |
| another spell first | 36 | +7.9 ± 6.6 |
| the attack | 29 | +5.7 ± 5.5 |
| another land | 28 | +1.6 ± 5.6 |
| another activation or target | 20 | +1.5 ± 6.4 |
| the same spell, another target or X | 14 | +10.4 ± 16.3 |
| he cast, the pilot held | 9 | +4.6 ± 10.9 |
| other (discard) | 7 | +6.5 ± 16.8 |
| other (searchLibrary) | 5 | +8.3 ± 12.7 |
| other (chooseSacrifice) | 3 | -8.3 ± 16.3 |
| other (chooseTarget) | 3 | +0.0 ± 0.0 |
| other (orderTriggers) | 2 | +2.1 ± 4.1 |
| other (orderBlockerDamage) | 2 | +0.0 ± 0.0 |
| other (entersChoice) | 2 | +22.9 ± 44.9 |
| the mulligan | 2 | +2.1 ± 4.1 |
| other (legendRule) | 1 | +0.0 ± 0.0 |

His turns worth most over the pilot's:

- game 5 (open:reaperclio) T11, life 19–19: 95.8 against 0.0 (+95.8) — he: pass / the pilot: activate Drana, Kalastria Bloodchief → Clio, Lady of the Depths; he: cast Confession → The Reeve / the pilot: cast Lumen, the Hearth Fire; he: pass / the pilot: activate Drana, Kalastria Bloodchief → Manaba; he: land Tallyflame Court / the pilot: cast Confession → The Reeve (+1)
- game 4 (open:reaperclio) T13, life 6–20: 79.2 against 20.8 (+58.3) — he: land Cairnbrand / the pilot: cast Protocol → The Reaper; he: activate Cairnbrand → Clio, Lady of the Depths / the pilot: activate Cairnbrand → Drana, Kalastria Bloodchief; he: cast Protocol → Wall of Blossoms / the pilot: cast Protocol → The Reaper; he: doneDeclaringAttackers / the pilot: attack The Jet Witch
- game 9 (open:reaperclio) T4, life 22–20: 91.7 against 37.5 (+54.2) — he: activate Black Lotus / the pilot: cast Confession → Rage Cobra
- game 15 (open:marducontrol) T19, life 16–15: 75.0 against 25.0 (+50.0) — he: pass / the pilot: activate The Jet Witch; he: pass / the pilot: activate The Jet Witch; he: pass / the pilot: activate The Jet Witch
- game 15 (open:marducontrol) T17, life 20–22: 70.8 against 25.0 (+45.8) — he: pass / the pilot: activate Drana, Kalastria Bloodchief → The Usher; he: land Godless Shrine / the pilot: cast The Jet Witch; he: acceptOptional / the pilot: declineOptional
- game 12 (open:emeraldsnakes) T9, life 17–20: 58.3 against 20.8 (+37.5) — he: activate Lumen, the Hearth Fire → The Emerald Keeper / the pilot: cast Protocol → Elvish Visionary; he: pass / the pilot: cast Protocol → Elvish Visionary; he: attack The Emerald Keeper / the pilot: doneDeclaringAttackers; he: pass / the pilot: cast Protocol → Elvish Visionary
- game 13 (open:emeraldsnakes) T9, life 11–18: 79.2 against 41.7 (+37.5) — he: cast Mox Ruby / the pilot: land Tundra; he: land Tundra / the pilot: cast Control Magic → Rage Cobra; he: cast Wrath of God / the pilot: cast Control Magic → Rage Cobra; he: discard / the pilot: discard (+3)
- game 12 (open:emeraldsnakes) T19, life 18–19: 83.3 against 50.0 (+33.3) — he: land Plateau / the pilot: activate Cairnbrand → Lumen, the Hearth Fire; he: cast Clio, Lady of the Depths / the pilot: activate Cairnbrand → Lumen, the Hearth Fire; he: pass / the pilot: activate Cairnbrand → Lumen, the Hearth Fire; he: pass / the pilot: activate Cairnbrand → Lumen, the Hearth Fire

The pilot's turns worth most over his:

- game 5 (open:reaperclio) T9, life 20–19: 25.0 against 62.5 (-37.5) — he: land Scrubland / the pilot: cast Confession → Clio, Lady of the Depths
- game 14 (open:marducontrol) T13, life 11–25: 33.3 against 66.7 (-33.3) — he: pass / the pilot: activate Drana, Kalastria Bloodchief → The Jet Witch; he: activate Library of Alexandria / the pilot: cast Clio, Lady of the Depths; he: pass / the pilot: activate Drana, Kalastria Bloodchief → The Jet Witch; he: land Underground Sea / the pilot: cast Clio, Lady of the Depths (+14)
- game 9 (open:reaperclio) T2, life 20–20: 33.3 against 62.5 (-29.2) — he: land Watery Grave / the pilot: land Scrubland; he: pass / the pilot: activate Black Lotus
- game 15 (open:marducontrol) T11, life 20–17: 16.7 against 45.8 (-29.2) — he: cast Tormod's Crypt / the pilot: pass

## earthrise

By what differed (a turn counts under each kind it holds):

| what differed | turns | (a) − (b) |
|---|---|---|
| the pilot cast, he held | 65 | +1.4 ± 3.1 |
| a land against something else | 64 | +2.4 ± 3.4 |
| another spell first | 39 | +3.5 ± 3.5 |
| an activation against something else | 35 | +3.0 ± 5.0 |
| another land | 29 | +1.7 ± 5.0 |
| he cast, the pilot held | 21 | +4.8 ± 4.5 |
| other (searchLibrary) | 20 | +7.1 ± 5.2 |
| the same spell, another target or X | 15 | -1.9 ± 6.6 |
| the attack | 11 | -1.1 ± 7.3 |
| the mulligan | 7 | +14.3 ± 6.9 |
| another activation or target | 5 | -6.7 ± 9.9 |
| other (discard) | 5 | -0.8 ± 4.8 |
| other (chooseMode) | 3 | +4.2 ± 8.2 |
| other (chooseTarget) | 2 | -4.2 ± 16.3 |
| other (orderTriggers) | 2 | +0.0 ± 24.5 |
| other (chooseSacrifice) | 1 | -12.5 ± 0.0 |

His turns worth most over the pilot's:

- game 15 (open:rabble) T12, life 16–8: 100.0 against 33.3 (+66.7) — he: pass / the pilot: cast Sacred Helix → Boggart Brute; he: land Taiga / the pilot: cast Sacred Helix → Boggart Brute
- game 7 (open:pall) T13, life 22–9: 100.0 against 58.3 (+41.7) — he: activate Library of Alexandria / the pilot: pass; he: land Taiga / the pilot: cast Experimental Overload → Sacred Helix; he: cast The Meathook Massacre / the pilot: cast Experimental Overload → Confession
- game 1 (open:wurmspeaker) T3, life 20–20: 41.7 against 8.3 (+33.3) — he: land Obsidian Observatory / the pilot: land Plateau
- game 1 (open:wurmspeaker) T7, life 20–18: 75.0 against 41.7 (+33.3) — he: cast Mox Emerald / the pilot: land Plateau; he: cast Earthrise / the pilot: pass; he: searchPick / the pilot: searchPick; he: searchPick / the pilot: searchPick
- game 3 (open:wurmspeaker) T7, life 20–20: 91.7 against 62.5 (+29.2) — he: pass / the pilot: cast Sacred Helix → Seedborn Muse; he: cast Demonic Tutor / the pilot: cast Sacred Helix → Seedborn Muse; he: searchPick / the pilot: searchPick
- game 17 (open:pall) T5, life 19–6: 100.0 against 70.8 (+29.2) — he: cast Black Lotus / the pilot: cast Savage Twister; he: activate Black Lotus / the pilot: cast Savage Twister
- game 13 (open:pinnacle) T5, life 19–18: 62.5 against 37.5 (+25.0) — he: cast Confession → Burnfallow Exuberant / the pilot: land Plateau; he: cast Confession → Burnfallow Exuberant / the pilot: land Cairnbrand; he: land Hearthspire / the pilot: land Cairnbrand
- game 15 (open:rabble) T0, life 20–20: 62.5 against 37.5 (+25.0) — he: mulligan / the pilot: keepHand; he: bottomCard / the pilot: bottomCard

The pilot's turns worth most over his:

- game 13 (open:pinnacle) T13, life 16–18: 37.5 against 83.3 (-45.8) — he: land Tallyflame Court / the pilot: land Plateau; he: activate Tallyflame Court / the pilot: pass; he: cast Savage Twister / the pilot: cast Savage Twister
- game 7 (open:pall) T8, life 20–20: 50.0 against 70.8 (-20.8) — he: land Taiga / the pilot: land Volmaw; he: pass / the pilot: cast Reaper's Forerunner; he: pass / the pilot: cast Reaper's Forerunner; he: pass / the pilot: cast Reaper's Forerunner (+1)
- game 15 (open:rabble) T6, life 15–20: 62.5 against 83.3 (-20.8) — he: pass / the pilot: cast Sacred Helix → them; he: pass / the pilot: cast Sacred Helix → them; he: doneDeclaringAttackers / the pilot: attack Vigil Keeper; he: pass / the pilot: cast Sacred Helix → them (+1)
- game 10 (open:marducontrol) T10, life 20–19: 45.8 against 66.7 (-20.8) — he: pass / the pilot: cast Powerstone Minefield; he: pass / the pilot: cast Powerstone Minefield

## wbbasilisk

By what differed (a turn counts under each kind it holds):

| what differed | turns | (a) − (b) |
|---|---|---|
| an activation against something else | 55 | +3.0 ± 3.7 |
| another spell first | 43 | +1.7 ± 2.8 |
| a land against something else | 34 | +5.0 ± 5.4 |
| the attack | 31 | +3.0 ± 4.4 |
| another land | 16 | +3.1 ± 6.3 |
| another activation or target | 16 | +10.4 ± 10.6 |
| other (searchLibrary) | 12 | +5.9 ± 7.9 |
| the pilot cast, he held | 12 | -1.7 ± 2.7 |
| he cast, the pilot held | 8 | +5.2 ± 7.2 |
| other (chooseTarget) | 5 | +3.3 ± 6.5 |
| other (orderTriggers) | 4 | +0.0 ± 0.0 |
| the same spell, another target or X | 4 | +5.2 ± 7.7 |
| other (entersChoice) | 3 | +1.4 ± 19.1 |
| the mulligan | 3 | -9.7 ± 16.6 |
| other (discard) | 1 | +12.5 ± 0.0 |

His turns worth most over the pilot's:

- game 8 (peasant:brdjinn) T34, life 14–21: 79.2 against 16.7 (+62.5) — he: land Godless Shrine / the pilot: activate Loxodon Warhammer → Blood Artist; he: activate Loxodon Warhammer → Fencing Ace / the pilot: activate Loxodon Warhammer → Blood Artist; he: activate Basilisk Collar → Fencing Ace / the pilot: pass; he: attack Fencing Ace / the pilot: attack Fencing Ace (+1)
- game 11 (peasant:skieswall) T20, life 16–17: 62.5 against 25.0 (+37.5) — he: land Evolving Wilds / the pilot: cast Karmic Mentor; he: activate Evolving Wilds / the pilot: activate Loxodon Warhammer → Blood Artist; he: activate Loxodon Warhammer → Longbow Archer / the pilot: cast Karmic Mentor
- game 10 (peasant:skieswall) T12, life 7–20: 62.5 against 29.2 (+33.3) — he: pass / the pilot: activate Barren Moor; he: cast Loxodon Warhammer / the pilot: cast Unearth → Karmic Mentor; he: pass / the pilot: activate Barren Moor; he: pass / the pilot: activate Barren Moor (+6)
- game 4 (peasant:rabble) T14, life 21–12: 83.3 against 54.2 (+29.2) — he: land Plains / the pilot: cast Fencing Ace; he: activate Basilisk Collar → Dazzling Angel / the pilot: activate Basilisk Collar → Fencing Ace; he: activate Basilisk Collar → Fencing Ace / the pilot: pass
- game 6 (peasant:muster) T1, life 20–20: 70.8 against 45.8 (+25.0) — he: land Secluded Steppe / the pilot: land Evolving Wilds
- game 12 (peasant:stompy) T4, life 19–20: 83.3 against 62.5 (+20.8) — he: land Swamp / the pilot: land Secluded Steppe; he: cast Blood Artist / the pilot: pass; he: doneDeclaringAttackers / the pilot: attack Soul Warden
- game 13 (peasant:stompy) T8, life 16–20: 66.7 against 45.8 (+20.8) — he: cast Shevelport Quartermaster / the pilot: cast Karmic Mentor; he: searchPick / the pilot: searchPick; he: cast Basilisk Collar / the pilot: pass
- game 8 (peasant:brdjinn) T6, life 19–20: 66.7 against 45.8 (+20.8) — he: cast Thought Replacement → them / the pilot: cast Blood Artist

The pilot's turns worth most over his:

- game 13 (peasant:stompy) T0, life 20–20: 20.8 against 45.8 (-25.0) — he: bottomCard / the pilot: bottomCard
- game 9 (peasant:brdjinn) T16, life 13–15: 50.0 against 70.8 (-20.8) — he: cast Soul Warden / the pilot: activate Loxodon Warhammer → Blood Artist; he: activate Loxodon Warhammer → Shevelport Quartermaster / the pilot: activate Loxodon Warhammer → Blood Artist
- game 2 (peasant:stompy) T10, life 17–18: 79.2 against 100.0 (-20.8) — he: cast Longbow Archer / the pilot: cast Shevelport Quartermaster; he: activate Basilisk Collar → Longbow Archer / the pilot: cast Shevelport Quartermaster; he: land Evolving Wilds / the pilot: land Plains; he: activate Evolving Wilds / the pilot: pass (+1)
- game 13 (peasant:stompy) T2, life 20–20: 41.7 against 62.5 (-20.8) — he: activate Evolving Wilds / the pilot: pass
