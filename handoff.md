# Handoff — after Session 72 (2026-11-14)

## State of the world
The ten-card hybrid two-drop cycle is complete in the pool: 315 cards, R-125 to R-129. The AI has a book for each card that needed one (165–169).

**Two of Chris's lists are built on the hybrid cards:**
- **the Fun Police**: registered in the Open, the twentieth list, 57.9 in matches;
- **his Bodies Snakes**: measured, not registered.

**Session 72** ran all six parts of its brief:
- **Part 0**: the rulings are recorded.
- **Part 1**: the Open read after book 164 matches its paired study.
- **Part 2**: three probes, and none produced a new book:
  - Mystic Snake already counters, so concern 30 was a measurement error;
  - a Vindicate gate measured level and was reverted;
  - the leak census found nothing past book 165.
- **The re-record**: the Open and Bodies tables now include the harvest and counter rules.
- **Part 3**: the mulligan read found one shape and shipped **`moxkeep`**, worth +1.3 a list in the Open.
- **Part 4**: **Nothing Dear** is the second gate format with a field of its own: thirteen seeds, a census and a first table. The Minefield leads at 67.6, with a cliff under the ninth list.
- **Part 5**: a land destruction sideboard row reads +7.3 in the Warband against the land decks, but cannot ship because no guide shape names a land deck.

`docs/decision-updates/s72.md` is the full record. Run the app with `pnpm viewer` and the tests with `pnpm test`.

## Since the planner's last read (2026-11-11 to 13; commits e386d8a to 20c3669)
The S72 brief follows the handoff of 2026-11-11. Everything below came after it, at Chris's direction. Each item is in `docs/decision-updates/s71.md` (post-S71a) or in its commit.

- **The hybrid cycle completed.** Six cards at tier R, each Chris's design, printed face and art. The brief's ADR-198 says six pairs remain; all ten exist now.
  - **Revivalist** ({W/B}{W/B}, 1/1 lifelink; when it dies, return another permanent card with mana value 3 or less from the graveyard to hand). No new word: Dutiful Attendant's shape.
  - **Daunting Terror** ({B/R}{B/R}, 3/3 menace; damage dealt to it is dealt to each player). **R-128**, the `DEALT_DAMAGE` trigger. Its design was chosen by study. **Book 166** teaches the AI to price the recoil.
  - **Discontinuous Flash** ({W/U}{W/U} instant; exile a permanent, return it under its owner's control, draw). **R-129** (`exileThenReturn under: "owner"`). The view now carries `owner` and `token`. **Book 167** covers its timing.
  - **Intuitive Mastery** ({R/W}{R/W} flash Aura; −1/−1 and double strike). Its −1/−1 was chosen by study; it reads below every card it replaced. **Book 168** covers a keyword grant paid for with a debuff.
  - **Command of the Depths** ({U/B}{U/B} instant; choose two of draw, −2/−2, a Faerie, a discard). No new word. **The play screen now asks a modal spell's mode before its targets** (`chooseMode`; Abrade too).
  - **Glory Hound** ({B/G}{B/G} 2/2; {B/G}{B/G}, discard: the team gets +1/+1 and menace). No new word. **Book 169** gates the team grant.
- **The concerns pass** (`a77cc41`):
  - resolved 37 (the Terror's recoil read from the blocker's side), 39 (a dead recoiler keeps its lifelink), 41 (the Flash's cantrip target), 44 (an instant waits out our own upkeep) and 45 (Glory Hound's grant in the attack plan);
  - tried 43 (double strike valued by power) and reverted it;
  - ladder PASS.
- **The Fun Police** (`funpolice`, Chris's five-colour land destruction list; 6–1 in his Open). The Open's tables were re-run with twenty lists. The list reads eighth: it beats the slow lists and loses to the Pall, the Pinnacle and Mardu Control.
- **Chris's Bodies Snakes** (8–0 in his Bodies event). Read against 79 of the AI's games, it gave two AI rules:
  - **the Reaper's harvest** as a lifelink swing (`harvestswing`: the AI harvested in 1 of 43 Reaper casts, Chris in 9 of 9);
  - **Rage Cobra's counters** out of the opponent's damage reach (`counterreach`, Chris's rule).

  His list in Emerald Snakes' seat went 41.4 → 47.8 under the AI; the current list reads 59.2, so it is not swapped. Reaper Clio gained 1.7.

## Done this session
Mapped to the brief's parts (`docs/decision-updates/s72.md`).

- **Part 0: the rulings recorded.**
  - ADR-196 (the tables are the pilot's ranking).
  - ADR-197 (a hybrid card is each of its colours at every gate) was already built: `cardColors`, R-125.
  - ADR-198, with the note that all ten pairs exist.
  - **Nothing Dear bans the Power** (Chris confirmed it at Part 4).
- **Part 1: the Open after book 164.** The twenty-list table (2026-11-13) was read against the nineteen-list one, like for like over the eighteen opponents both share.
  - **The Pall gained +4.1**, the paired study's +4.2. Its rows against the two Helix lists moved +6.7 (Earthrise) and +8.3 (the Minefield), where the study read +7 and +8.
  - Mono-Black Clio has no Open row; its own tables moved up.
  - The ADR-191 reading list is refreshed (concern 29).
- **Part 2, Mystic Snake** (concern 30): `pnpm counter-log-probe`. The AI counters in 98–100% of the windows where it can, and never casts the Snake into an empty main phase. Replaying the 11-10 scan's own 150 games shows 110 counters in 117 casts; that scan credited counters only to spells. **No book.** One open trial: the brief's end-step body clause (concern 47).
- **Part 2, Vindicate** (concern 31): `pnpm target-probe [--windows]`.
  - 24–39% of land hits pass over a creature worth more, by about a mana.
  - Against the land decks the land hits are right.
  - The Fun Police has no hold to lift: it casts its land destruction when it can.
  - **`landgate`** was built and measured level (+0.2, +0.3, −0.3, −0.6, paired at 160), then **reverted** (Chris).
- **Part 2, the leak** (concern 32): `pnpm leak-census`. 263 variants of 69 cards, on a null board and a Bears board, gave 45 no-ops. None scores above passing except Thought Replacement's caster pick, which book 153 prices on purpose. **No book.**
- **The re-record** (concern 46): the Open and Bodies tables re-run with the harvest and counter rules.
  - The Open: 286 of 380 pairings identical; Reaper Clio 63.2 → 64.1.
  - Bodies: Mardu Control 69.7, Reaper Clio 67.3, Mono-Black Clio 62.5, Emerald Snakes 58.6, Bant Countersnake 55.7.
- **Part 3, the mulligan** (`pnpm mulligan-probe`): 981 of Chris's opening decisions in 772 recorded games.
  - **One shape repeats: one land and a Mox or the Lotus.** He kept 37 such hands across 19 runs and won 35 of those games. The pilot's rule counted lands only. The reverse does not repeat.
  - **`moxkeep`**: a noncreature mana artifact counts toward the low bound; a land is still required.
  - Each list without it against the field with it, paired: **19 of 20 gain, mean +1.3** (the Sweep +2.8, Emerald Snakes +2.6, the Rabble +2.2; the Writ −0.4 ± 0.4).
  - Ladder PASS. **Shipped.**
- **Part 4, Nothing Dear** (`nothing-dear`):
  - **The format**: the Power banned, the High Grounds one each, the brief's door line.
  - **The census** (`pnpm nothingdear:census`): 203 nonland cards legal; 46 leave (11 Power, 35 above four).
  - **Thirteen seeds**, each swap in its source line. Mardu Control plays three Revivalists for the Usher (Chris).
  - **Guides carried**: Mardu Control, Mono-Black Clio, the Levy, Massocrafts.
  - **The table**: the Minefield 67.6, Emerald Snakes 61.1, Bant Auras and the Rabble 57.3, Mardu Control 56.1, Mono-Black Clio 54.9, the Muster 51.1, Massocrafts 48.6, the Thicket 48.3. Then a 9.4-point cliff: the Levy 38.9, the Tally 37.9, the Undertow 37.2, BR Removal 33.7.
  - **The two hybrid bodies**: Domain Pouncer in the Thicket **−4.0 ± 1.1**; Clutch Guard in Emerald Snakes **+3.9 ± 1.0**. Neither is adopted.
- **Part 5, the land destruction sideboard row**: two Molten Rain and two Terrain Collapse against the Pinnacle, the Minefield and Earthrise. **The Warband +7.3 ± 1.9** (Earthrise 31 → 48); the Rabble +0.7 ± 1.9. **Not adopted**: no guide shape can fire only against land decks (concern 13), and against the whole field the row is about +1.2, under ADR-168's bar.
- **The handoff's reading list (ADR-191)**: the three recorded games the implementer would have the planner read next.
  1. **The Minefield**, the widest gap (46) and never read. Chris's Naya Valakut run (`docs/debug_logs/recorded_games/convocation-games-30-NayaValakut.json`; `pnpm narrate … --match marducontrol`): his match wins over Mardu Control, which the AI's list loses 81–19.
  2. **His Bodies Snakes against Mono-Black Clio** (`convocation-games-30-Bodies-EmeraldSnakes.json`, round 1, both games won in ten turns), against the AI's 27%. The Forerunner's mode and Den of Vipers' timing are the open habits.
  3. **Lumen Clio's quarter-final against Emerald Snakes** (`convocation-games-30-LumenClio.json`): Confession at a 9/10 Rage Cobra. The list reads 32 there under the AI.

## Deviations from the brief
1. **The Open's table was not re-run for Part 1**: it had been run on 2026-11-13, at twenty lists, after book 164. Part 1's read used it. The re-record came after Part 2 instead, to cover concern 46 in one run.
2. **The Mystic Snake probe's tool is `counter-log-probe`**: it reads saved logs. My first draft overwrote S56's `counter-probe`, which plays its own games; that tool was restored before any commit.
3. **The Vindicate rule was built and reverted** (level). The second rule proposed after the probe (land destruction early for a list built on it) was **not built**: its premise failed.
4. **Nothing Dear has thirteen seeds, not eleven or twelve**: Mardu Control joined at Chris's call, with three Revivalists for its Ushers. Its folder is `formats/nothing-dear/`, after the format's existing id, not `nothingdear`.
5. **Nothing Dear's `large` shape threshold is frozen at ADR-186's floor of 2**, not the derived 0 (concern 49).
6. **Part 5's third Valakut list is Earthrise**: the Open has two Valakut lists, and S71a's probes grouped Earthrise with them as the land decks. The row's `when` is every shape, with the games only against the three.
7. **`fc25008` shipped a test that failed typecheck**: the `moxkeep` pin used `ActionRequest` without importing it. The tests passed; fixed in `e917bca`.

## Concerns
Open concerns carry their numbers. Resolved ones keep a line.

1. **The AI does not pilot Chris's sideboard plan.** The Pinnacle's guide read from his swaps measured 57.8 against the rules' 63.0, so it has no guide. The `small` rows are worth more study alone (+8 against the Rabble). This was measured through `--deck-guide`, which is suspect against `control` lists.
2. **Books 159 and 160 are pins, not gains** (level over 21,000 paired games).
3. **The Pinnacle's trials sat in the Wurmspeaker's chair**; the tables of record have that pairing.
4. **The ritual audit's win rates (54%) do not match the grid's (36%)**: undiagnosed.
5. **Highland Ritual's Peasant score was built with cycling {1}{R}**, before the correction to {2}. It refreshes on the next rebuild.
6. **The Ossuary's and Larder's read of the Angel fix** was without their plans.
7. **One restricted copy moves this pilot about a point**, so restricted studies read near the noise at 100–200 games a pairing.
8. **Hearthspire is the strongest High Ground** (+6.1, +2.8, +9.6). Chris kept 2 damage.
9. **The intervening if is read at trigger placement** (R-120's simplification); Balance's players choose in seat order (R-121's).
10. **The predictor prices a land search flat (0.5)**, whatever it fetches.
11. **The consequence model (ADR-191)** is unchanged.
12. **The AI cannot pilot WB Basilisk** (29.5, last in Peasant, against Chris's 11–3). The Collar move is the line to read first.
13. **No guide shape names a land deck.**
    - Land destruction from the sideboard is real against the land decks: the Warband +7.3 ± 1.9 (Part 5).
    - Neither a main-deck copy (S70) nor a guide can deliver it.
    - Candidate shapes for the planner (ADR-188's list):
      - four or more lands that do more than make mana;
      - Valakut;
      - a land-search plan.
14. **Both Valakut lists read below Chris**, the Minefield furthest (the reading list's first game).
15. **The Naya fifteen is the bare nine for the AI.**
16. ~~Chris's records are the seat~~: ruled by ADR-196 (the tables are the pilot's ranking).
17. **Confession at {1}{B} measured level with Sign in Blood**; Chris's play is the test.
18. **zsh**: `$h:child_of_night` reads `:c` as a modifier; brace variables in loops.
19. **Lumen Clio is a large pilot gap in a top list** (32, 53 and 25 against the three lists Chris went through). It is the reading list's third game.
20. **Confession is a power-shrink payoff** (Clio turns it into card draw); unpriced by trial.
21. **The Open's top is a cycle**; only Mardu Control beats the rest.
22. ~~Esper, Grixis and Sultai not re-run since Volmaw~~: re-run in S71a.
23. ~~The plan dig ignores a full hand and X burn~~: book 164.
24. **Earthrise is the second large pilot gap** (23, 66, 23 against the lists Chris beat).
25. ~~The Open's tables predate book 164~~: re-run 2026-11-13.
26. **Mono-Black Clio's lean against book 164** (−1.2 ± 2.0) has no Open row (S72 Part 1). Its own tables moved up. Not a book candidate.
27. **Ranksmere has no home**; it stays in the pool as built (S72 ruling).
28. **The Watch fell ten points in Naya** with the Minefield in the field.
29. **ADR-191, the reading list** (refreshed in S72: his game record in the source run, against the game-one rate now):

    | list | gap |
    |---|---|
    | the Minefield | 46 |
    | Countersnake | 41 |
    | his Bodies Snakes (unregistered) | 40 |
    | Massocrafts | 36 |
    | Massacrats | 35 |
    | Lumen Clio | 32 |
    | Emerald Snakes | 32 |
    | Bant Countersnake | 30 |
    | Mono-Black Clio | 30 |
    | the Pinnacle | 29 |
    | Mardu Control | 28 |
    | the Fun Police | 28 |
    | Earthrise | 24 |

30. ~~The AI never counters with Mystic Snake~~: **a measurement error** (S72). The 11-10 scan credited counters only to spells; the AI counters in 98–100% of its windows.
31. ~~Vindicate goes at lands~~: **measured** (S72). The land hits mostly have nothing better to hit, and a gate on the rest is level.
32. ~~The baseline leak~~: **the census found none past book 165** (S72).
33. **The AI cannot make Correspondence good**: its numbers are a floor.
34. **Domain Pouncer's land-type keywords are read as they stand**: the AI will not play a Mountain or Swamp to switch them on. In the Thicket (no Mountain, no Swamp) it measured −4.0 ± 1.1 for Blurred Mongoose.
35. **Hybrid counted half to each colour in the land split** (`colourPips`) is a guess.
36. **Bant Countersnake loses to Mono-Black Clio 27–73**; no test guide recovered it.
37. ~~The Terror's recoil from the blocker's side~~: resolved (the concerns pass).
38. **Each-player recoil makes the aware aggro pilot swing into a double block at low life**: consistent with the archetype's prices; unmeasured.
39. ~~A dead recoiler's lifelink~~: resolved.
40. **Discontinuous Flash in the AI's hands is a cantrip first**; the surprise blocker is a flat credit.
41. ~~The cantrip's target~~: resolved.
42. **The view carries `owner` and `token`**; only the owner blink reads them.
43. **Double strike is valued flat**: tried and reverted. The gap is the multi-turn race.
44. ~~Command of the Depths in our upkeep~~: resolved.
45. ~~Glory Hound's grant outside the attack plan~~: resolved.
46. ~~The tables predate the harvest and counter rules~~: re-recorded (S72).
47. **Mystic Snake is never cast as a body at the opponent's end step when no target came**: 124 such windows across four sets. The Snake's first cast comes at a mean of turn 13–20. Whether the body beats keeping the counter is unmeasured; it would be a trial of a new behaviour.
48. **The Open's and the triads' tables of record predate `moxkeep`.** Every list with the Power plays it; the field-alone read moved lists +0.1 to +2.8, all in the same direction. A re-run is owed: deferred by Chris, "for later". Bodies, Peasant and Nothing Dear have no mana artifacts, so they are current.
49. **Nothing Dear's `large` threshold derives to 0.** Six of thirteen seeds play no creature with toughness three or more, which is the format's shape. It is frozen at ADR-186's floor of 2, where it reads true against seven of the thirteen. Mardu Control's guide rows key on `large`. The planner's to re-derive or rule.
50. **Clutch Guard is +3.9 ± 1.0 in Emerald Snakes** (Nothing Dear, for Elvish Visionary), above ADR-168's bar. It is not adopted: the brief made it a first read, and adopting it is the planner's and Chris's call. Chris's own Bodies Snakes plays four.
51. **His Bodies Snakes' remaining habits** (from the 18-against-79 read): the Forerunner's mode (he makes the tokens 12 to 6; the AI fights 45 to 19), Den of Vipers onto 0–1 Snakes (30 of 77), the Keeper onto a small board, and the AI blocking three times as often. The list reads 47.8 against his 89%.
52. **`open:gen` wrote a hyphenated format id as a bare key**, so the generated `open-decks.ts` did not parse. Fixed: such ids are quoted. The broken file was patched by hand once so the fixed generator could run, because `open:gen` imports the file it writes.

## Registry entries added/changed
- **Rules**: none in S72. Since the planner's last read: **R-128** (`DEALT_DAMAGE`), **R-129** (`exileThenReturn under: "owner"`).
- **Pool**: since the planner's last read, revivalist, daunting_terror, discontinuous_flash, intuitive_mastery, command_of_the_depths, glory_hound (custom, tier R; 315 cards). None in S72.
- **The Open**: `funpolice` in `contributed.json` (2026-11-13). Tables of record re-recorded 2026-11-14 (they predate `moxkeep`).
- **Bodies**: tables re-recorded 2026-11-14.
- **Nothing Dear**: `formats/nothing-dear/lists.json` (thirteen seeds, four guides, shapeScale small 18, large 2), `matches.json`, `means.json`. `docs/reference/nothing-dear-lists.md`. `NOTHING_DEAR_FORMAT` bans `POWER_IDS`. `FIELD_FORMAT_IDS` gains `nothing-dear`.
- **AI**: `moxkeep` (`mulliganChoice`), shipped. `harvestswing` and `counterreach` (2026-11-13). `landgate` was built and reverted.
- **Tools**: `counter-log-probe`, `target-probe` (`--windows`), `leak-census`, `mulligan-probe`, `nothingdear:census`.

## Test status
**1,294 passed**, 2 skipped (172 files; typecheck clean; 2026-11-14). New this session:
- the `moxkeep` pin in `book-of-shame.test.ts`;
- `constructed-builder.test.ts` moved off "Nothing Dear has no field": the repair test names its source list, and the field-less scale check reads Nothing Sudden.

`pnpm test` exits non-zero on five vitest "Timeout calling onTaskUpdate" load errors; every assertion passes (implementer-notes). Ladder PASS after `moxkeep` (`analysis/s72/ladder-moxkeep.log`).

## Suggested next
- **The Open's and the triads' tables re-run with `moxkeep`** (concern 48), and the ADR-191 list with them.
- **A land-deck guide shape** (concern 13), then the Warband's row adopted by ADR-168 if it clears.
- **Clutch Guard in Nothing Dear's Emerald Snakes** (concern 50), and Nothing Dear's `large` threshold (concern 49).
- **The reading list's three games** (above), and from them books, as 161, 163, 164 and the harvest came.
- **His Bodies Snakes' remaining habits** (concern 51): the Forerunner's tokens and Den of Vipers' timing, as a probe first.
- **Mystic Snake's end-step body** (concern 47), as a trial, if the planner wants one.
- **Chris's play of Nothing Dear** (his run is what the table gets read against), and of the hybrid cards still in no list: Correspondence, Daunting Terror, Discontinuous Flash, Intuitive Mastery, Command of the Depths.
- **The other gate formats** (Nothing Small, Nothing Sudden, Half Ground), with Bodies and Nothing Dear as the pattern.

## How to run
```
pnpm install && pnpm typecheck && pnpm test          # FUZZ_FULL=1 pnpm test for the full fuzz
pnpm viewer                                          # the app (dev); pnpm build:web before any push
pnpm ladder                                          # the AI gate — alone, ~5 min
pnpm open:rr [--format <id>] --games 100 --seed 91 --shard i/9 --out rr_i.json     # a table's game ones; then --merge rr_?.json --record
pnpm open:rr [--format <id>] --matches 60 --seed 91 --shard i/9 --out m_i.json     # its matches; then --matches-report m_?.json --record; then pnpm open:gen
pnpm open:rr --only <k> --off <rule> --off-for <k> --games 100 --seed 91           # one list without a rule against the field with it (S72's moxkeep read)
pnpm open:rr --only <k> --vs <a,b> --matches 20 --seed 91 --save-games g.json      # games with logs, for the probes and narrate
pnpm counter-log-probe g.json --list <k> [--card mystic_snake]                     # S72: a flash counter's windows
pnpm target-probe g.json --list <k> [--card vindicate] [--windows]                 # S72: a removal spell's targets and timing
pnpm leak-census                                                                   # S72: no-op casts against passing
pnpm mulligan-probe [docs/debug_logs/recorded_games]                               # S72: Chris's keeps against the pilot's rule
pnpm nothingdear:census | pnpm bodies:census                                       # the gate formats' censuses
pnpm open:rr --only <k> --vs <a,b> --matches 160 --deck <k>:sixty.json --deck-side fifteen.json --deck-guide guide.json [--guide-drop <cards>]   # a sideboard row, paired
pnpm narrate <recorded-games.json> --event <seed>    # a recorded run, move by move
pnpm art:fetch                                       # after adding a real card
```
