# Handoff — after Session 60 (2026-10-11)

## State of the world
The Open is fifteen lists. Reaper Clio (72 in matches) and the Rabble (68) are the two targets; against the other top-eight lists they are 66 and 63. No list reaches 55 against Reaper Clio. Three planner seeds are archived this session (the Locks, the Tally, the Enchantress). The Levy has a sideboard guide; nothing else earned one. `pnpm typecheck`, `pnpm test` (1009) and `pnpm build:web` pass. **Nothing from this session is pushed.** The linkage (S59) is unchanged and still wants a journey played through a sitting.

## Done this session
- **Part 0.** The Locks and the Tally archived (ADR-174).
- **Part 1 — Reaper Clio's guide: measured, not adopted.** Five plans at 1,500 matches each came out level (71.5–73.3, ± 2.3). She keeps the rules. Table in `docs/decision-updates/s60.md`.
- **Part 2 — the three that board down.** The Levy's guide adopted as its whole plan, with a registered fifteen (43.0 → 46.8). The Wurmspeaker's and the Muster's rows did not beat the rules; neither has a guide.
- **Part 3 — the Enchantress.** The overhaul took her from 33.4 to 38.5 in matches. Under 45: archived.
- **Part 4 — the read.** Both tables re-run with fifteen lists (after book 122); the top-eight sub-table.

| list | matches | game one | later − game one | against the other top seven |
|---|---|---|---|---|
| Reaper Clio | 72.1 | 67 | −0.7 | 65.7 |
| the Rabble | 68.3 | 57 | +3.3 | 63.0 |
| the Coin | 59.9 | 51 | +9.1 | 50.2 |
| the Hearth | 59.9 | 53 | +8.3 | 50.2 |
| the Pall | 56.3 | 63 | −14.5 | 45.5 |
| the Writ | 54.6 | 51 | +5.1 | 43.6 |
| Countersnake | 52.6 | 57 | −5.6 | 43.7 |
| the Muster | 46.4 | 44 | +0.7 | 38.1 |
| the Depths | 44.5 | 44 | +1.9 | |
| the Levy | 43.7 | 46 | −1.8 | |
| the Kiln | 42.0 | 45 | +4.8 | |
| the Warband | 39.0 | 43 | +1.5 | |
| the Tollgate | 38.8 | 41 | −4.5 | |
| the Sweep | 36.3 | 46 | −5.7 | |
| the Wurmspeaker | 35.6 | 40 | −1.3 | |

  - Reaper Clio's pairings in matches: the Pall 53, the Coin 57, the Rabble 58, the Tollgate 58, the Hearth 60; everything else 65 or more.
  - The matchup grid page (private to Chris) carries every pairing in all three columns.

## Deviations from the brief
1. **Reaper Clio has no guide.** The brief wanted one "if the rows beat the rules"; none did. Not adopted.
2. **"Against the Rabble (the Walls stay)" has no source in Chris's play.** He took the Walls out nearly everywhere, and his one Rabble plan was a gamble he disowned. Both readings were measured; the Walls staying is six points better against the Rabble (one pairing).
3. **Fifteens were authored for the Wurmspeaker, the Muster and the Levy** (they had none): the field builder's fifteen with the cards the planner's rows need. Only the Levy's is registered.
4. **The Levy's rows are not the brief's.** It plays three Swords, so "2 Swords in" is one; a Doom Blade row beside it was measured and dropped; two Macabres join the Crypts against the Pall (unmeasured alone — an existing test requires every list to bring its four graveyard cards in).
5. **The Enchantress's trials were adjusted to her list** (two Timberland Guides, one Glare, three Angelic Destinies — the brief had four, two, two). Four Forerunners were tried by cutting two Mongooses as well.
6. **The final table has fifteen lists, not the brief's sixteen**: the Enchantress fell under her bar and was archived before it ran.
7. **Matches at 60 a pairing** (50 before): fewer pairings, the same run time.

## Concerns
1. **The general sideboarding rules cost some lists points.** The Levy is 2.8 better with no sideboarding at all; Reaper Clio 0.4; the old Reaper Control was 8 better against the Rabble. The pattern each time is removal brought in for the lowest-rated creature, which is often a Wall or a token-maker. Guides paper over it list by list; the rule itself wants a look (`open:rr --deck-guide` with an empty guide measures "no sideboarding" for any list in a minute).
2. **A list's game-one-to-later delta is not a measure of its sideboard.** It moves with play order (the game-one winner is on the draw) and with the opponent's fifteen. The brief chose Part 2's lists by that column; two of the three had nothing to fix.
3. **ADR-173's bar is not met and the cycle is this table.** No list is at 55 against Reaper Clio (the Pall 47, the Coin 43, the Rabble 42). By the ADR the Lab measure of Clio at one copy against four comes next, unless Chris's predator arrives first — he is building one from the Coin and the Tollgate.
4. **Three archives in one session shrink the bottom of the field**, and every remaining list's field number fell with them (Reaper Clio 75 → 72, the Tollgate 42 → 39). Compare lists across tables by the top-eight column, not the field column.
5. **The Tollgate is now thirteenth of fifteen** (38.8). Its prey were the Tally and the old Reaper Control, both archived; ADR-174's count starts for it if the planner wants one.
6. **Scratch tooling was lost to the system's temp cleanup mid-session** (a launcher script a few days old), and one two-hour run silently did nothing. Recreated. The shard launcher and the paired-comparison scripts should live in the repo.
7. **The Levy's guide gain is mostly the rules not running** (+2.8 of +3.8); its rows are within noise alone.

## Registry entries added/changed
- None in the rules or pool registries.
- `data/convocation/open-contributed.json`: three archives (locks, tally, enchantress); the Levy's fifteen and guide; `guidesOnly` gains levy.
- `OPEN_MEANS` and `data/convocation/open-matches.json`: the fifteen-list tables.

## Test status
- `pnpm test`: 1009 passed, 2 skipped. Two pins moved: the archived-lists list, and a builder test that used the Tally as its instants deck (the Kiln stands in).
- No AI change this session; no ladder run.

## Suggested next
- **Chris's predator for Reaper Clio**, when it comes: the Rabble-style instrument (400 matches against Reaper Clio, then the field in matches).
- **The Clio measure ADR-173 names** (one copy against four, in Reaper Clio and the Writ), if no predator reaches 55.
- **The sideboarding rules' "creatures" rule** (Concern 1): a probe across every list of rules against none.
- **The scratch tools into the repo** (Concern 6).
- **A journey played through a sitting** (S59, still owed).

## How to run
```
pnpm viewer                                                    # /world the journey; /convocation the hall; /play a single match
pnpm typecheck && pnpm test
pnpm open:gen                                                  # after a list, fifteen or guide changes (also regenerates docs/reference/open-lists.md)
pnpm open:rr --games 100 --seed 56 --shard i/8 --out analysis/runs/rr_$i.json   # game one; then --merge and copy the means into OPEN_MEANS
pnpm open:rr --matches 60 --seed 56 --shard i/8 --out analysis/runs/m_$i.json   # matches; then:
pnpm open:rr --matches-report analysis/runs/m_*.json --record --out analysis/runs/matches.md
pnpm open:rr --only levy --matches 100 --deck levy:deck.json:midrange --deck-side side.json --deck-guide guide.json --out x.json   # a guide under test ({rows, only?}); an empty rows list is "no sideboarding"
pnpm sideboard:show --list levy --vs rabble,pall               # what a list's AI swaps
pnpm narrate docs/debug_logs/recorded_games/<file>.json --event <seed>   # a recorded game move by move
pnpm ladder                                                    # the gate for any AI change (run alone)
```
