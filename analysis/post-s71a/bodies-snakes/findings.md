# New Emerald Snakes (Bodies) — Chris's play against the AI's

Sources: Chris's 18 Bodies games (event seed 541734, 16–2; `chris-narrated.txt`), and 79 AI games of the same 75 in the
Emerald Snakes seat against Mardu Control, Mono-Black Clio, the Aerie and Reaper Clio (8 matches each, seed 91;
`ai-games.json`, `ai-narrated.txt`; 28–51). Head-to-head (400 matches a pairing): new 41.4, old 59.2 (`new-report.txt`, `old-report.txt`).
The AI sample is its four worst pairings, so per-game rates are indicative, not like for like.

| play | Chris (18 games) | AI (79 games) |
|---|---|---|
| The Reaper's harvest (activations per Reaper cast) | 9 of 9 | 1 of 43 |
| Glory Hound's grant (activations per Hound cast) | 5 of 7 | 2 of 39 |
| Rage Cobra counters on Snake Tokens | 44% | 0% (not in top six) |
| Rage Cobra counters on the Rage Cobra itself | 6% | 41% (also Keeper 18%, Voracious Cobra 16%) |
| Games with one creature at 10+ power | 2 of 18 | 13 of 79 (30/30 Rage Cobra into Doom Blade, Control Magic) |
| Den of Vipers cast with 0–1 Snakes out | 2 of 15 | 30 of 77 |
| The Emerald Keeper cast (a game) | 0.28 | 0.63; 23 of 50 with 0–2 creatures out |
| Forerunner mode: tokens / fight | 12 / 6 | 19 / 45 |
| Blocks a game / attacks a game | 0.7 / 13.3 | 2.4 / 10.5 |

The harvest is the deck. Chris fires it before combat as a lifelink swing, not a kill. Against Mardu Control his
life went 18→53, 16→42, 11→34 and 20→44 on harvest turns, and the drain plan could not catch up. Mardu's own
Soul Wardens put counters on his Rage Cobras' targets. The AI's gate (`heuristic-agent.ts` ~3784) fires only when the
damage through blockers is at least half the opponent's life. It prices neither the lifelink nor the haste.

The counters are the harvest's fuel. Chris grows Snake Tokens (one reached 19/19 and another 20/20) and the
deathtouch and first-strike bodies (Den of Vipers, Domain Pouncer). A grown token is the body the harvest
sacrifices, X being its power. The AI stacks every trigger on one big body.

## After the two rules (post-S71a)

| run | the new list | report |
|---|---|---|
| before | 41.4 (re-run 41.5) | `new-report.txt`, `new2-report.txt` |
| the harvest gate and swing bonus (`harvestswing`) | 46.7 | `new3-report.txt` |
| plus the counter reach (`counterreach`) | 47.8 | `new4-report.txt` |
| the current Emerald Snakes | 59.2 | `old-report.txt`, `old2-report.txt` |

Reaper Clio: 67.0 with both rules off, 68.6 with the harvest, 68.7 with both (`rc0`, `rc3`, `rc4`). In a fresh 77-game
sample the AI harvested in 20 of 43 Reaper casts (was 1 of 43), and put 31% of Rage Cobra's counters on the Cobra (was 41%).
