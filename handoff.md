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

## After the session — a theft shell against Reaper Clio, explored (Chris's idea, 2026-10-11) — NOT PUSHED
- **The idea (Chris):** if Clio is why Reaper Clio holds decks off, take her. A Jeskai core of four each of Protocol, Control Magic, Lumen and Restoration Angel. Eight shells tried around it (scratch; none registered).
- **Game one against the three pillars, 300 games each:** every shell is under 40 against the Rabble and the Pall (16–33). Against Reaper Clio 26–38 as the pilot stood.
- **Two rules on trial, off by default** (`trial: ["locksteal", "lockhold"]`): a steal Aura's cast at a creature whose static shrinks the other side's creatures is credited with the swing; and against a list with three or more such creatures the steal Auras are kept for her. With both, the pilot held Clio in 36 of the 47 games she appeared (23 of 45 before) and won 47% of those. Against Reaper Clio the shells rise to 35–44 (the fliers build and the Man-o'-War build 44).
- **The read:** stealing Clio makes the pairing about even; the shell around the theft is the weakness (2 wins in 13 when she never appeared), and it has nothing for the Rabble or the Pall. Not a predator as built.
- **Not measured:** Chris's line of Lumen's steal kept by a Restoration Angel's blink. The pilot never plays it (book 115 holds flash creatures for the opponent's end step; nothing values the blink of a borrowed creature).
- **Neither trial rule has a ladder run or a field measure**; neither is shipped.

## After the session — Chris's Mardu Control, the loop that never ended, book 123, the single match as a match (2026-10-11) — NOT PUSHED

Chris went 8–0 in matches (one game lost) in a Convocation with a Mardu list: 4 Lumen, 4 Restoration Angel, 4 Phyrexian Purge, 4 Vindicate, 4 Jet Witch, 4 Nighthawk, 4 Blood Artist, 4 Soul Warden, 2 Swords, Tutor, Helix, power; side 3 Wrath, 3 Faerie Macabre, 3 Pyroclasm, 3 Tormod's Crypt, 3 Usher (`docs/debug_logs/convocation-MarduControl.json`, untracked; working name "Mardu Control", Chris's). His path held no Reaper Clio (Tollgate, Levy, Rabble, Coin, Muster; Coin, Countersnake, Tally in the eight). The recorded file also holds an earlier five-colour draft that lost 1–2 to Reaper Clio.

- **A game that never ended (engine, R-103).** The match run of the list hung on one Hearth game: an Usher returning the Usher against a larger drain, a Soul Warden giving the difference back — one life total climbing (past 260), the other oscillating, so no position repeats and the S55 count never trips. **The second count:** `LOOP_STALL_CAP` = 1000 stack items resolved in a turn with no player's life and no library at a new low for the turn is a draw (`LOOP_DRAW` with `stall: true`). Fixture in `sim/s55-loop-draw.test.ts`; registry R-103 amended. The same simplifications as the first count (it counts, it does not prove). **For the planner:** the AI chose that loop (book 99 asks only whether the loop gains nothing for us; here it gained for THEM) — a pilot rule is owed.
- **Book 123 — the Purge was never cast.** In 5,490 simulated games the pilot cast no Phyrexian Purge: the post-S43 rule against a targeted spell cast at nothing read the cast of an any-number spell (its targets are asked for AFTER the cast) as waste. `laterPicks`: such a cast is priced as the picks the request loop would make and the life they cost; nothing worth a pick, not cast. Off: `laterpicks`. No ladder deck holds an any-number spell (the ladder is the slice decks), so the ladder cannot move; **the lord decks and the Heart's deck do hold the Purge** (`sim/lord-decks.ts`, `heart-deck.ts`, `data/world/flood.json`) — those journey opponents now cast it. Not measured in the journey.
- **The list under the AI**, 160 matches against each of the fourteen others, the general rules for sideboarding: 28.4 before book 123, **38.7 ± 2.0 after** (game one 41.7). Tollgate 55, Sweep 54, Depths 53, Countersnake 50, Hearth 46, Coin 45, Kiln 41, Warband 39, Pall 37, Writ 33, Levy 31, Muster 26, **Reaper Clio 19**, **Rabble 13**. Matches are BELOW game one: the rules never bring in his Wraths, Pyroclasms or Ushers (cast 0.02, 0, 0 a game) — he brought in all nine against creature decks. The Witch is activated 2.3 times a game against his ~4 (in bursts of four to eleven, in response to removal). A guide written from his swaps is the next measurement; it is not a field list.
- **The single match can be a match** (`/play`, "the format": one game | a match — best of three, sideboards; remembered). The event's series (`MatchSeries`: the loser chooses play or draw, the AI always plays), the AI sideboarding from game two as in the Open (its fifteen, its guide), the human sideboarding between games from the seventy-five in the deck editor. A built deck has a Sideboard button (up to fifteen, kept with the deck); an Open list brings its registered fifteen; a deck with none gets the field builder's. "Your Convocation deck (as registered)" is offered under "Decks built here" when the browser holds a Constructed event (read, never written). Checked in the preview: a game conceded, the score, the choice, the sideboard editor. No unit test.
- **Tools:** `open:rr --progress` (each match game's seed as it starts), `--match-only N`, `--trace-after N` (decisions past N printed — how the loop was found).

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
