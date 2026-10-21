# Handoff — after Session 68 (2026-10-20)

## State of the world
The pilot now reads the defender's combat triggers, aims burn only to kill, plans a repeatable ping, and draws with the Witch once it is safe (books 141–145, each with an `off` switch). The ladder passes after each. Every Constructed field's table was re-run after the three rules (the Open, Naya, Esper, Mardu, Grixis, Jund, Jeskai). Jund Dragons (Chris's) is registered in Jund; Jund Coin is archived. `pnpm pilot-probe` has four new modes (`--mines`, `--diffs`, `--manaba2`, `--sweeps`). Tests: `pnpm test` (1,124 passed).

## Done this session
- **Part 0**: S67's deviations ratified; ADR-189 (the six-triad read); ADR-186 amended and built (`open:gen` refuses a frozen threshold below 2; Grixis's and Jund's `large` set to 3); Jund Coin archived; **Jund Dragons** registered (Chris's 11-game run; at his flip — three Drakuseth, two Ruby Tyrants) with his fifteen and a guide from his swaps; Jund's table before the rules (Jund Dragons 40.2).
- **Part 1 — combat reads the defender's triggers** (`triggercharge`, book 141; `deathcharge`, book 142): attackers charged the battlefield's ATTACKS triggers as declared, blockers weighed after BLOCKS triggers, the crack-back read without their trigger-killed attackers; an own combat death costs the opponent's death-trigger drain. Attackers killed by a Minefield's trigger alone: 2.5–6.9 a game → 0 in all eight pairings measured. Sacred Minefield −7.2 ± 0.8; the Tollgate +6.6 ± 1.1. Ladder PASS.
- **Part 2 — damage targeting** (`burnkills`, book 143; `pingplan`, book 144): a burn spell at a creature only when it kills (with committed combat and stack damage); a repeatable ping counts its pending pings and spends a short one only when the mana and life at hand finish the kill. The Rabble +0.6, the Kindling +1.1, the Tally +1.2, the Kiln +0.5 (+6.9 against the Clio lists). Ladder PASS.
- **Part 3 — the Witch early** (`witchearly`, book 145): life for cards from the turn it is safe — above the board's reach, three a burn spell seen and **a cushion of six** — not at a hand of two. Without the cushion it lost (the Witch −2.3); with it the Witch +2.3, the Barrow +4.1, Mono-Black Clio +2.1, Mardu Control +1.0, the Pall −0.9. Draws 4.8 → 6.4 a game, from turn 10.2 → 9.1. Ladder PASS.
- **Part 4 — the probes** (no rules): the pilot's extra blocks are its costliest racing difference (7 positions: Chris's choice 32.1%, the pilot's 3.6%; cast order neutral at 54); the pilot makes half the Manaba mana Chris does (0.45 Snakes tapped a turn against 0.86); the Jeskai Sweepers Wrath a board of one or none 64% of the time (Chris 13%), on turn 28 against 17.
- **Part 5 — the tables** (decision updates): the six-triad read stands — the red race unmoved (Grixis 79.7, Jeskai 77.5, Mardu 63.5); the Witch lists up (the Chancel +7.7, the Barrow +5.6, Mono-Black Clio +2.7); Sacred Minefield 55.5 (−9.0).

## Deviations from the brief
1. **Part 1's scope** (Chris's ruling at the kickoff): only the Minefield is an ATTACKS/BLOCKS trigger in the pool (the Observatory and Isaura are activated abilities, Soul Warden an enters trigger, Meliyan its own controller's death trigger); the defender's death triggers became `deathcharge`, measured apart (it moved nothing in Jeskai; in Mardu it rides the table).
2. **The Witch rule carries a cushion of six** the brief did not have — the brief's rule measured negative (−2.3 on the Witch); the cushion was tried as a trial and adopted on its measure.
3. **Peasant's Mono-Black** has no Witch (she is prize-only); Mono-Black Clio measured in its place.
4. **The Manaba probe reads the board, not the solver**: Snakes tapped on our turn and not attacking. No engine change; the pilot and the human read the same way.
5. **Book 102's old Witch pin** runs with `witchearly` off; the old "burn at own face" pin aims at a 3/3 the Bolt kills (a non-lethal Bolt is no longer a use).

## Concerns
1. **The red race is not a pilot problem these rules touch.** The Rabble tops Grixis and Jeskai by 10–20 points with none of this session's rules moving it. Two shapes the probes point at: the pilot's blocks (its extra blocks were its worst racing choices — the defence against the race is the side that blocks badly) and the sweeper timing (Concern 2). Both are S69-able rules.
2. **The sweeper pilot Wraths one creature at a time** (64% into a board of one or none, against Chris's 13%). A rule shaped like book 117's removal hold — a sweeper waits for a board worth it unless the race forces it — would be measured on the Jeskai Sweepers, the Locks, the Chancel and Mardu Control.
3. **A non-lethal burn was a score, not a gate** — the softmax cast what scored a quarter-point under passing. The same "friction, not a gate" shape is still elsewhere (the comment at the predictor's unchanged branch says so); other near-pass misplays may live there.
4. **The Tyrant had no gate at all** (the brief assumed "refused as now"): creature abilities outside the shrink/mill/counters sinks skip `floodSinkGated`. `pingPlanGated` now covers the creature ping; any other creature ability with a target (a creature that taps, bounces) is still ungated.
5. **The pilot makes half Chris's Manaba mana**; whether that is the solver's tap order or the pilot's spending is the next read — the solver's choices are not agent decisions, so a rule there is an engine-side change (ADR-worthy).
6. **The Pall dipped under `witchearly`** (−0.9 ± 0.4) though its own dig is untouched — its opponents' Witches draw better. Worth a look if the Pall's numbers matter.
7. **Post-S68 (Chris's Massacrats run, the Grixis Umbel final): the pilot sacrifices into the opponent's death payoffs.** The Rabble recurred Flametongue Kavus through Cairnbrand — sacrificing a creature each time — while Chris's Meathook Massacre and Blood Artist were out: each sacrifice gained him 1 and drained it 1 (game 17: 24-14 → 31-1 over eight turns). Book 142's `deathcharge` prices only combat deaths; a sacrifice cost, an Edict on its own side, a chump into a Massacre board are unpriced. The same `deathCharge` term belongs on a sacrifice choice and on any activation whose cost kills our own creature.

## Registry entries added/changed
- No R-entries. Books 141–145 (agents). Jund: `dragons` registered, `coin` archived; Grixis and Jund `shapeScale.large` 3.

## Test status
**1,124 passed**, 2 skipped (1,126). Books 141–145 new; book 102's second line and the "burn at own face" pin re-baselined (Deviation 5). Ladder gate/mirror PASS after Parts 1, 2 and 3.

## Suggested next
- **The shallow batch (S69)**: Sultai first by contrast (no sweeper), then Abzan, Temur, Bant — the batch pattern of S67.
- **Two pilot rules the probes earned**: the block that loses (the pilot's extra blocks) and the sweeper that waits for a board (Concerns 1–2), each measured and ladder-gated.
- **Jund Dragons' alternative builds** (Chris: "more room to explore once the AI fixes are in place") and the Minefield in Mardu.

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~13 min (two baselines)
scripts/open/rr.sh rec 100 [--format grixis]         # game one, every pairing, 8 shards → analysis/runs/scratch/rr/
scripts/open/rr.sh m 100 --matches 60 [--format grixis]
pnpm open:rr [--format grixis] --merge analysis/runs/scratch/rr/rec_?.json --record --out analysis/runs/rr.json   # --record writes formats/<id>/means.json; then open:gen
pnpm open:rr [--format grixis] --matches-report analysis/runs/scratch/rr/m_?.json --record --out analysis/runs/matches.md
pnpm open:gen && pnpm reference                      # after any change under data/convocation/formats/ (writes nothing if any check fails)
pnpm sideboard:show --format mardu --list witch --vs pall,rabble
pnpm rating:format --format peasant [--write]        # the format's own card score
pnpm format:census --colors UBR [--max-tier 2] ; pnpm format:census --triads   # a triad's shelf (the land rule applied); the ten side by side
python3 scripts/open/seat.py <list> <tag>…           # a trial in one seat: matches, games, by opponent, casts
scripts/open/rr.sh t 160 --matches 160 --format esper --only locks --deck locks:<main> --deck-side <side> [--deck-guide <guide>]   # a fifteen varied keeps the list's guide (ADR-188); --deck-guide replaces its rows
pnpm pilot-probe --witch|--manaba|--racing …            # S67 probes (see decision-updates/s67.md)
pnpm pilot-probe --mines --format jeskai --lists rabble,watch --vs minefield --games 20 [--off triggercharge]   # S68: attackers lost to a Minefield's trigger
pnpm pilot-probe --diffs --format open --recorded <file> --playouts 4     # S68: the human's blocks and casts against the pilot's, with playouts
pnpm pilot-probe --manaba2 --format open --lists emeraldsnakes --games 4 --recorded <file>   # S68: Manaba mana from the board
pnpm pilot-probe --sweeps --format jeskai --lists sweepers --games 4 --recorded <file>[,<file>]   # S68: each sweeper and the board it met
pnpm open:rr … --off triggercharge,deathcharge,burnkills,pingplan,witchearly   # S68's rules off (books 141–145)
```
