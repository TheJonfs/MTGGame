# Handoff — after Session 72, with the post-S72 work and Session 73's Part 1 (2026-11-18)

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

## Session 73, Part 1 — the vintage audit (2026-11-18; the fresh session, commit 2f172a8)
The brief's Part 1, then Part 0's code items (the section after this one). Parts 2, 3, 4 and 5 are owed. `docs/decision-updates/s73.md` is the record; `docs/reference/vintage-audit-s73.md` is the table. **No list was edited**: every row is a trial.

- **ADR-199 built**: `poolAt` on all 187 lists, and `portOf` on the 102 ports (Chris's ruling: a port is read at its source's vintage). `data/convocation/pool-history.json` holds each card's place in the pool. `pnpm vintage-audit` prints a list's vintage and its delta. `world/src/vintage.test.ts` pins all three.
- **61 trial rows** (160 matches a pairing, paired, seed 91; four on seed 173), none failed. 39 of the planner's lists have rows, 68 lists are Chris's or ports of his (reported to him), 69 are owed.
- **33 rows clear ADR-168, as six findings**:
  1. **Hearthspire in fourteen planner lists** (the Muster ×6, the Warband ×4, the Tollgate ×2, the Chantry, Jeskai Sweepers): +5.2 to +30.2 for one land. **Nightbower in Abzan Warden**: +11.2. Chris (2026-11-18): the High Grounds are Power-class; a list in the pair needs a reason not to play its own.
  2. **Order Druid for Rampant Growth in the Wurmspeaker**: +10.3 to +13.9 in all seven formats. S72's −1.5 was the wrong slot.
  3. **Clutch Guard in the Snake lists** (Chris's): +8.5, +15.3, +9.5 for Elvish Visionary in Emerald Snakes (the Open, Temur, Bodies); +10.9 for Wall of Blossoms in Temur Snakes.
  4. **Daunting Terror for Child of Night in BR Removal**: +16.9 (Nothing Dear), +12.8 (Grixis).
  5. **Nyxathid for the Gallows Djinn in Peasant's Mono-Black Removal**: +10.8. In the Barrow +3.0 ± 1.8 pooled.
  6. **Storm Shaman** in the Kindling (pooled +5.0 ± 1.6) and the Tally's Ponder slot (+2.6 ± 1.2); **Dawnwing Marshal** in the Open's Muster (+3.2 ± 1.1).
- **Not clears**: Banishing Cleric in five hosts (best +2.3 ± 2.3); Revivalist in four; nothing moved the Undertow or the Levy; Nyxathid in BR Removal is conditional (it loses the Tally in both formats).
- **Deviations** (eight, in s73.md): ports read at the source's vintage; the Open's seeds at 260 (the brief's 244 leaves out the tokens); **no Naya row for Clutch Guard** (it is blue at Naya's and Jund's gates, ADR-197); the second seed only under +5; restricted cards named, not trialled; the top halves not reached.
- **Tests**: `vintage.test.ts` adds five (the count is in the Part 0 section below).
- **How to run**: `pnpm vintage-audit [--format <id>] [--list <key>] [--bottom N] [--summary]`; `zsh analysis/s73/trial.sh <format> <list> <tag> '<from:n:to>' [seed]`; `zsh analysis/s73/queue.sh <batch-file> [seed]`; `pnpm -s vintage-audit --summary --json analysis/s73/census.json && python3 analysis/s73/audit-doc.py` rebuilds the table. The shards are in `analysis/s73/audit/` (local, about 320 MB).

**Concerns from the audit** (59–66; they continue the list below):

59. **FIXED in S73 (the section above).** The sideboard builder read a hybrid card as both its colours (`buildSideboard`, `constructed-builder.ts`: `colors` from `cardColors`). A list that plays an off-colour hybrid card and has no registered fifteen is built one it cannot cast. BR Removal with Revivalist stops casting Phyrexian Purge after sideboarding. Four audit rows are read on game one because of it. This is live in the field wherever a builder-made fifteen meets a hybrid card. The fix is the regular implementer's; the four rows are owed a re-run after it.
60. **The tables of record are far from the pilot now.** The audit's base arms (v1.5, pilot 176, 160 matches) against the recorded match rates: the Undertow in Nothing Dear 37.2 → 23.5, the Open's Levy 38.0 → 26.2, Bodies' Stampede 46.6 → 35.6; Abzan Warden 39.0 → 48.9, the Kindling in Mardu 35.9 → 44.6. Part 5's re-run will move the tables more than concerns 48 and 55 suggest.
61. **The Undertow's fall may be a regression.** Book 176 moved tap-to-mill to the opponent's end step after that table was recorded. A probe before the re-run.
62. **About sixty High Ground gaps are untried.** The census in the audit table lists every planner list in a pair without its High Ground, the five older ones included. The fifteen rows run all clear. Whether to trial the rest or adopt by rule is the planner's and Chris's call.
63. **Jeskai Sweepers decks itself** in 23% of its games (957 of 4,233): three Serra Angels are its only way to win. Hearthspire's +30 is partly a second win condition.
64. **Clutch Guard's gain in Emerald Snakes is mostly sideboarding** (Bodies: game one +2.1, later games +9.1). The fifteen is the same; the pilot's out-rule takes the Visionary out and leaves the Guard in. Real under this pilot; it would shrink if the out-rule learned the Guard.
65. **The Gaean Wurm carries the Wurmspeaker**: replacing three costs eleven points in two formats. S72's Druid study read the Druid in that slot.
66. **Pool gaps seen in the slot pass** (for the Cube count, 320 of 360): mill beyond Silt Spirit; a white-black token payoff; control finishers outside the legends; two-drops outside the hybrid cycle; an answer to nonbasic lands and legends. In the audit table.

## Session 73, Part 0 — the code items (2026-11-18; after the audit)
- **Clutch Guard adopted in Nothing Dear's Emerald Snakes** (the brief's ruling): four for the four Elvish Visionaries, in place; `open:gen` re-run (`open-decks.ts`, `docs/reference/nothing-dear-lists.md`). Nothing Dear's table of record predates it.
- **`sourcePower` reads last-known information** (R-097 amended; CR 608.2h): `effect-context.ts` reads `state.lastKnownPT` once the source has left, as `sourceToughness` does. Census: Notion Flayer and Odile. `engine/test/s73-source-power.test.ts` (five; three fail on the old read). **Ladder PASS**, every number identical to `ladder-siltspirit.log` (`analysis/s73/ladder-sourcepower.log`). Concern 53 is resolved by it.
- **Not done**: the audit's adoptions (they wait for the planner's read of the table, as the brief says).
- **Tests**: see the next section.

## Session 73 — the builder fix, Part 3 and Part 4 (2026-11-18)
- **Concern 59 fixed** (Chris's word): `buildSideboard`, the builder's tinker and `aiSideboard` read the colours a list casts with (`castingColours`, `castableWith` in `cards/src/mana.ts`), not `cardColors`. The gates are unchanged. `world/src/s73-casting-colours.test.ts`. The four confounded audit rows are re-run (`analysis/s73/audit/*-fix59/`) and their match columns now agree with game one; **Daunting Terror for Centaur Courser in Bodies' Stampede clears on two seeds** (pooled +5.3 ± 1.7). The audit table is rebuilt: **34 clears**.
- **Part 3**: `landdeck` built (four or more lands that do more than make mana; a land that sacrifices or discards itself is not counted). The Warband's row keyed on it, against the whole Open field: **+2.4 ± 1.0 on seed 91, +0.7 ± 0.9 on seed 173, pooled +1.5 ± 0.6: below the bar, not adopted.** The shape costs nothing where it does not fire and loses no pairing where it does.
- **Part 4**: the narration of Chris's eleven Naya Valakut games against Mardu Control (`analysis/s73/minefield/narration.txt`) and the table of Wall, Minefield and Wrath turns (in s73.md). The AI wins 8 of 87 with the list and casts Wood Elves and Wall of Blossoms about half as often a game as he does. No rule.
- **Tests**: **1,360 passed**, 2 skipped (181 files; typecheck clean). `pnpm test` exits non-zero on the five vitest "Timeout calling onTaskUpdate" load errors, as before. **Re-baselined**: `constructed-builder.test.ts`'s repair test reads castability (mage:oriel's repair now takes a Revivalist).
- **Owed**: Part 2 (the forced-inclusion rating run and the Bolt probe) and Part 5 (the re-run of record, after the planner reads the audit).

**Concerns from this pass** (67–70):

67. **`landdeck` fires against eight Open lists, not three.** Any list with four High Grounds has it: Lumen Clio (7), the Sweep, the Writ and Emerald Snakes (4 each), beside the three land decks and the Fun Police. As more planner lists take their High Grounds (the audit's first finding), more lists will have the shape. A threshold of six names the land decks, the Fun Police and Lumen Clio only. The planner's to rule.
68. **S72's +7.3 for the Warband's row was one seed.** Against the three land decks: +8.5 on seed 91, +2.6 on seed 173.
69. **The hybrid colour read is still in the Limited builder, the drafter and three tools** (`limited-builder.ts`, `drafter.ts`, `rating-format-cli.ts`, `tinker-cli.ts`, `flood-sim-cli.ts`). Changing the Limited two changes what the rating runs build, which ADR-150 treats as a new table. Not changed.
70. **The builder fix changes the journey's repaired decks**: a one-colour list may now be repaired with a hybrid card of that colour (mage:oriel takes a Revivalist). Intended by the fix; said here because it reaches beyond the field.

## Since Session 72 (2026-11-15 to 18; commits a780ae3 to ec233c3)
Everything below came after the S72 handoff, at Chris's direction. The S72 sections further down are unchanged.

- **Books 170–173** (each ladder PASS):
  - **170 `fightwait`** (Chris's Nothing Dear finals): a flash fighter waits for the creature spell it would kill; the fight reads the power the creature enters with. Also `pnpm clio-probe` and the Grixis analysis (`analysis/s72/grixis`).
  - **171 `landburn`**: a land that deals fixed damage (Valakut, Hearthspire) counts as a burn spell in book 113's count.
  - **172** (RUW Spells through the Nothing Dear field, Chris's boarding as a guide): `scaledburn`, `burstaim`, `burstpay`, `exchangestatic`. RUW in the AI's hands 39.3 → 39.6% (`analysis/s72/ruw`).
  - **173 `doubleaim`**: nothing aimed at a permanent our own stack already removes.
- **The Grand Convocation** (e598c3b): one Constructed format, 128 seats, sixteen rounds; Chris went 19–0 with RUW Spells. Portraits recycle once every face is taken (d9f958c).
- **Chris's five-card batch** (all tier 2; Chris's designs, names and art picks; printed faces his). Pool 320.
  - **Nyxathid** (the reprint, CON #49, verified on Scryfall): {1}{B}{B} 7/7 Elemental; as it enters choose an opponent, −1/−1 for each card in that player's hand. **R-131** (`entersChoose: "opponent"`, `chosenPlayer`, the value ref `handCount`).
  - **Banishing Cleric** {1}{W}{W} 2/2 Human Cleric: when it enters, exile target nonland permanent an opponent controls until it leaves the battlefield. **R-130** (`exile.untilSourceLeaves`, `state.linkedExiles`).
  - **Order Druid** {1}{G}{G} 2/2 Elf Druid: {G}, {T}, sacrifice: search for a green creature card, put it onto the battlefield. **R-132** (`searchLibrary.color`, with study filters `monocolored` and `manaValueAtMost`).
  - **Storm Shaman** {1}{R}{R} 2/2 Elemental Shaman: whenever you cast an instant or sorcery, add {R}; **Chris's rider**: when it enters, return target instant or sorcery card from your graveyard to your hand. No new word.
  - **Silt Spirit** {1}{U}{U} 0/3 Spirit Wizard: creatures you control have "{T}: target player mills X, where X is this creature's toughness." **R-133** (`sourceToughness`, with last-known information, CR 608.2h).
  - **AI books**: **174** (`nyxsize`: the predictor reads the entering P/T, so a 0-toughness Nyxathid is not cast; `heldback`: removing a permanent in the sim returns what it was holding). **175 `orderfind`**: the search finds the best body from the library as it stands (decklist less what is visible), and a self-sacrifice search waits for the opponent's end step unless the creature is threatened. **176 `tapmill`**: a creature's {T}-only mill waits for the opponent's end step unless it is threatened or lethal. Ladder PASS for each, numbers unchanged.
  - **Studies** (160 games a pairing):
    - Order Druid as written: Wurmspeaker −1.5, Reaper Clio −9.3, Bant Countersnake +2.3. Not too strong; summoning sickness is the limiter (27 of 35 unused Druids that died were still sick). `analysis/s72/druid`.
    - Storm Shaman: −9.1 and −7.9 in the Pyromancers' slots as first designed; with the rider −3.3, −1.6, and +0.6 in Ponder's slot. `analysis/s72/shaman`.
    - Silt Spirit: Sultai Mill +7.9 (46.1 → 53.9); the Peasant walls Skies −2.0. `analysis/s72/silt`.
  - **Art**: two laps of four styles each (eight for Nyxathid and the Shaman), Chris's picks in `assets/generated/MANIFEST.md`.
- **The rating rebuild** (Chris: "a nice up-to-date look at the pool"), `card-rating.json` v1.5:
  - **Peasant** re-scored (11,400 games): Nyxathid 3.28, Order Druid 2.62, Silt Spirit 2.23 (prior; no Peasant list plays it), Banishing Cleric 2.01, Storm Shaman 1.32.
  - **Constructed** re-measured on pilot 176: 288 authored lists, 34,560 games. Correlation with the old table 0.93.
  - **Limited** re-measured on pilot 176: Sealed, noise and draft, 73,600 games. Correlation 0.72. The five: Silt Spirit 3.64, Nyxathid 2.82, Banishing Cleric 2.00, Storm Shaman 0.68, Order Druid 0.07.
  - **Fourteen cards carry their pilot-94 Limited numbers** (`limitedCarried`, `run.limited.carried`; Chris's ruling): seen under 100 times now and 500 or more before. Concern 54.
  - `analysis/s72/rating-compare.txt` has the movers.

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
13. **No guide shape names a land deck.** *(S73: `landdeck` built; the Warband's row is below the bar on two seeds — the S73 section above.)*
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
53. ~~`sourcePower` reads 0 once its source has left~~: **resolved in S73** (it reads last-known power; R-097 amended). The original note: **`sourcePower` read 0 once its source had left** (R-097), where the new `sourceToughness` reads last-known information (CR 608.2h). They could share `lastKnownPT`; left alone so existing behaviour does not move. The planner's to rule.
54. **The Limited rating has a blind spot.** The Sealed builder and the drafters pick by the current table, so a card rated low goes unplayed and is never re-measured; the noise run's ±0.4 does not lift it. Fourteen cards with 500 to 16,000 old sightings had 0 to 93 new ones and would have read their tier mean (Entomb −0.09 → 1.71, Demonic Tutor 0.74 → 2.30). **They carry their pilot-94 numbers** (Chris), marked `limitedCarried`: Altar of Dementia, Curiosity, Demonic Tutor, Disenchant, Duress, Entomb, Giant Growth, Orcish Lumberjack, Ovna, Scepter of Dominance, the Bailiff, the Pearl Cleric, Waste Not, Zinnia. ADR-150 forbids pooling across pilots, so this is an interim, not a measurement.
55. **A rating rebuild moves the field's sideboards.** The builder makes the fifteen of every list without an authored one, and the guide shapes fire on rating thresholds (a steal against three prizes rated 2.5 or more). Under v1.5 the Larder shows two prizes (its Reeves), so the Depths no longer brings in Control Magic against it. The tables of record were played under v1.4.
56. **Lightning Bolt fell in Limited**, 2.29 → 1.44 on 8,960 sightings; Evolving Wilds 1.55 → −0.78. Possibly the burn holds are too patient on Limited boards. Unprobed.
57. **The linked exile returns at the next state-based check**, not as its own one-shot (R-130's registered simplification; CR 610.3 makes the return its own one-shot effect). No card in the pool can see the gap.
58. **Order Druid reads 0.07 in Limited** and loses to summoning sickness in Constructed; **Storm Shaman 0.68 in Limited**. Fair cards, not pillar-makers. A design matter for Chris, if any.

## Registry entries added/changed
- **Post-S72**: **R-130** (linked exile), **R-131** (`entersChoose`, `handCount`), **R-132** (`searchLibrary` colour and filters), **R-133** (`sourceToughness`, `lastKnownPT`). Pool rows for nyxathid, banishing_cleric, order_druid, storm_shaman, silt_spirit (all T2; "Post-Session 72 additions"). Books 170–176 in `book-of-shame.test.ts`. `card-rating.json` v1.5. Grand Convocation door option.
- **Rules**: none in S72. Since the planner's last read: **R-128** (`DEALT_DAMAGE`), **R-129** (`exileThenReturn under: "owner"`).
- **Pool**: since the planner's last read, revivalist, daunting_terror, discontinuous_flash, intuitive_mastery, command_of_the_depths, glory_hound (custom, tier R; 315 cards). None in S72.
- **The Open**: `funpolice` in `contributed.json` (2026-11-13). Tables of record re-recorded 2026-11-14 (they predate `moxkeep`).
- **Bodies**: tables re-recorded 2026-11-14.
- **Nothing Dear**: `formats/nothing-dear/lists.json` (thirteen seeds, four guides, shapeScale small 18, large 2), `matches.json`, `means.json`. `docs/reference/nothing-dear-lists.md`. `NOTHING_DEAR_FORMAT` bans `POWER_IDS`. `FIELD_FORMAT_IDS` gains `nothing-dear`.
- **AI**: `moxkeep` (`mulliganChoice`), shipped. `harvestswing` and `counterreach` (2026-11-13). `landgate` was built and reverted.
- **Tools**: `counter-log-probe`, `target-probe` (`--windows`), `leak-census`, `mulligan-probe`, `nothingdear:census`.

## Test status
**1,342 passed**, 2 skipped (177 files; typecheck clean; 2026-11-18). Post-S72:
- `engine/test/s73-nyx-banisher.test.ts` (21 fixtures for the five cards) and four fuzz files in `sim/src` (`s73-*-fuzz`), run before the fixtures;
- books 170–176 pinned; book 10 and the S63 Adept test re-pinned to the opponent's end step (book 176 moves the Adept's mill there);
- **re-baselined by the rating rebuild**: the Peasant `unscored` list is now empty; the S56 steal test reads the Depths against the Levy, not the Larder (concern 55); the pool count (320) and shop-tier tally.

S72:
- the `moxkeep` pin in `book-of-shame.test.ts`;
- `constructed-builder.test.ts` moved off "Nothing Dear has no field": the repair test names its source list, and the field-less scale check reads Nothing Sudden.

`pnpm test` exits non-zero on five vitest "Timeout calling onTaskUpdate" load errors; every assertion passes (implementer-notes). Ladder PASS after `moxkeep` (`analysis/s72/ladder-moxkeep.log`).

## Suggested next
- **A method for the Limited rating's blind spot** (concern 54): a forced-inclusion or wider-noise run, so the fourteen carried cards get measured on the current pilot.
- **Lightning Bolt in Limited** (concern 56): a probe of the burn holds (books 88, 160, 172) on 40-card boards.
- **The tables of record after the rebuild** (concerns 48, 55): the Open's and the triads' re-run now also covers books 170–176 and the new ratings.
- **Homes for the five**: Silt Spirit in Sultai Mill (+7.9) is the one study that cleared ADR-168's bar; adopting it is Chris's call.
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
pnpm rating:format --format peasant --write          # the Peasant score
zsh analysis/s72/rating-rebuild.sh                   # the rating runs, sharded (rating:run, sealed-sim, its noise run, draft-cards; shards in analysis/runs, local)
pnpm rating:build analysis/runs/authored176_shard*.json --prefixes sealed176,noise176 --limited sealed176,noise176,draft176 --candidate p176
```
