# Handoff — after Session 60 (2026-10-11)

## State of the world
*(Brought up to date 2026-10-12; the sections "After the session" below carry the detail, newest last.)*

The Open is **fourteen lists with three pillars**: Reaper Clio (71.5 in matches), **Mardu Control** (69.7 — Chris's Usher control list, joined 2026-10-11 and revised 2026-10-12; the Coin and the Hearth are archived as the lists it replaces) and the Rabble (64.9). Then the Pall (56.5), the Writ (54.9) and Countersnake (54.0); the other eight stand between 34 and 45. Mardu Control is the first list at 55 against Reaper Clio (56 at 900 matches; 57 against the Rabble). Chris's ruling: the Usher returning the Usher stays, deliberately — the format's three things to do are go fast, play Clio, loop Ushers. Since Session 60: the engine's loop draw has a second count (R-103: a drifting loop), the pilot has book 123 (a spell whose targets are picked after the cast — the Purge had never been cast), the single match can be a best-of-three with sideboards and offers every list of the Open, and its games are recorded with the Convocation's. `pnpm typecheck`, `pnpm test` (1011) and `pnpm build:web` pass.

**Pushed through `05ab495` (2026-10-11). Everything after it is local and waiting** (`281cf95`, `fd90fe8` and the handoff commit after them): Chris is holding pushes for one larger push, until Vercel's deployment storage clears (each deployment of this project is about 400 MB; the Hobby plan keeps three). **Do not push until he asks.**

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

## After the session — a theft shell against Reaper Clio, explored (Chris's idea, 2026-10-11) — PUSHED (the two rules are off by default)
- **The idea (Chris):** if Clio is why Reaper Clio holds decks off, take her. A Jeskai core of four each of Protocol, Control Magic, Lumen and Restoration Angel. Eight shells tried around it (scratch; none registered).
- **Game one against the three pillars, 300 games each:** every shell is under 40 against the Rabble and the Pall (16–33). Against Reaper Clio 26–38 as the pilot stood.
- **Two rules on trial, off by default** (`trial: ["locksteal", "lockhold"]`): a steal Aura's cast at a creature whose static shrinks the other side's creatures is credited with the swing; and against a list with three or more such creatures the steal Auras are kept for her. With both, the pilot held Clio in 36 of the 47 games she appeared (23 of 45 before) and won 47% of those. Against Reaper Clio the shells rise to 35–44 (the fliers build and the Man-o'-War build 44).
- **The read:** stealing Clio makes the pairing about even; the shell around the theft is the weakness (2 wins in 13 when she never appeared), and it has nothing for the Rabble or the Pall. Not a predator as built.
- **Not measured:** Chris's line of Lumen's steal kept by a Restoration Angel's blink. The pilot never plays it (book 115 holds flash creatures for the opponent's end step; nothing values the blink of a borrowed creature).
- **Neither trial rule has a ladder run or a field measure**; neither is shipped.

## After the session — Chris's Mardu Control, the loop that never ended, book 123, the single match as a match (2026-10-11) — PUSHED

Chris went 8–0 in matches (one game lost) in a Convocation with a Mardu list: 4 Lumen, 4 Restoration Angel, 4 Phyrexian Purge, 4 Vindicate, 4 Jet Witch, 4 Nighthawk, 4 Blood Artist, 4 Soul Warden, 2 Swords, Tutor, Helix, power; side 3 Wrath, 3 Faerie Macabre, 3 Pyroclasm, 3 Tormod's Crypt, 3 Usher (`docs/debug_logs/convocation-MarduControl.json`, untracked; working name "Mardu Control", Chris's). His path held no Reaper Clio (Tollgate, Levy, Rabble, Coin, Muster; Coin, Countersnake, Tally in the eight). The recorded file also holds an earlier five-colour draft that lost 1–2 to Reaper Clio.

- **A game that never ended (engine, R-103).** The match run of the list hung on one Hearth game: an Usher returning the Usher against a larger drain, a Soul Warden giving the difference back — one life total climbing (past 260), the other oscillating, so no position repeats and the S55 count never trips. **The second count:** `LOOP_STALL_CAP` = 1000 stack items resolved in a turn with no player's life and no library at a new low for the turn is a draw (`LOOP_DRAW` with `stall: true`). Fixture in `sim/s55-loop-draw.test.ts`; registry R-103 amended. The same simplifications as the first count (it counts, it does not prove). **For the planner:** the AI chose that loop (book 99 asks only whether the loop gains nothing for us; here it gained for THEM) — a pilot rule is owed.
- **Book 123 — the Purge was never cast.** In 5,490 simulated games the pilot cast no Phyrexian Purge: the post-S43 rule against a targeted spell cast at nothing read the cast of an any-number spell (its targets are asked for AFTER the cast) as waste. `laterPicks`: such a cast is priced as the picks the request loop would make and the life they cost; nothing worth a pick, not cast. Off: `laterpicks`. No ladder deck holds an any-number spell (the ladder is the slice decks), so the ladder cannot move; **the lord decks and the Heart's deck do hold the Purge** (`sim/lord-decks.ts`, `heart-deck.ts`, `data/world/flood.json`) — those journey opponents now cast it. Not measured in the journey.
- **The list under the AI**, 160 matches against each of the fourteen others, the general rules for sideboarding: 28.4 before book 123, **38.7 ± 2.0 after** (game one 41.7). Tollgate 55, Sweep 54, Depths 53, Countersnake 50, Hearth 46, Coin 45, Kiln 41, Warband 39, Pall 37, Writ 33, Levy 31, Muster 26, **Reaper Clio 19**, **Rabble 13**. Matches are BELOW game one: the rules never bring in his Wraths, Pyroclasms or Ushers (cast 0.02, 0, 0 a game) — he brought in all nine against creature decks. The Witch is activated 2.3 times a game against his ~4 (in bursts of four to eleven, in response to removal). A guide written from his swaps is the next measurement; it is not a field list.
- **Chris against Reaper Clio in the new match mode: 5–0 in matches, 10–0 in games** (on the play in every game one; `docs/debug_logs/recorded_games/MarduControlVSReaperClio-1..5.json`, each the match's game two). His swap every time: +3 Usher, +3 Pyroclasm (not in the first); −2 Swords, −1 Vindicate, −1 Witch, −1 Lumen, −1 Angel. **Four of the five game twos ended on a second Usher returning the first** (the legend rule, the drain, again) by turn 10–12 — twice the first Usher had been countered by a Mystic Snake, which put it where the second wanted it. **A guide from his swaps** (Ushers in against every shape, Pyroclasm against small creatures, Wrath against creature decks; the whole plan), the AI piloting, 160 matches a list: **38.7 → 51.0 ± 2.1** (games two and three 43 → 55); Reaper Clio 19 → 35, the Rabble 13 → 38, the Kiln 41 → 66, the Sweep 70, the Depths 69, Countersnake 66; the Pall 37 → 28 (worse); the Tollgate and the Levy unmoved (no shape of the guide reads them). Scratch only — the list is not registered. Not tried: the Ushers in the sixty.
- **Chris's plan against the Usher decks, measured** (the Crypts and the Macabres in; no Usher, or one): the Pall 27.5 (three Ushers) → 42.5 (none) → **47.5 (one)**; but the Coin 52.5 → 40.0 → 45.0 and the Hearth 51.9 → 33.1 → 40.0 — against those two the three Ushers are better than the hate. The guide to write: the hate and one Usher against a graveyard PLAN (the Pall), three Ushers against the rest.
- **Chris's second configuration — the Ushers in the sixty** (−1 Lumen, −1 Angel, −1 Witch, +3 Usher; the side's Ushers become 1 Sacred Helix and 2 Flametongue Kavu), with a guide from his description, the AI piloting, 160 matches a list: **61.0 ± 2.0 (the Warden/Artist package leaves for the Wraths) / 63.3 ± 2.0 (the spot removal leaves)**, game one **58.1** (the first configuration: 51.0, game one 41.7). By list (the second guide): Tollgate 94, Sweep 78, Depths 75, Kiln 74, Levy 69, Warband 66, Countersnake 65, Muster 63, Hearth 60, Coin 54, **Reaper Clio 49, Rabble 48**, Writ 49, Pall 43. That is third in the field's table if it held in a full round-robin. The guide's shapes: `small` (Pyroclasm, the Kavus), a NEW shape `large` (eight or more creatures of toughness three or more: the Wraths, the Helix; `sideboard-ai.ts`), small-and-not-large (all of it), `graveyard` (the hate for two Ushers, a Swords... as he gave it). Scratch (`gx/mardu2*.json`); not registered. **The Tollgate at 90 in game one is a number to look at before it is believed.**
- **A single match's games are recorded** with the Convocation's (the same key and shape, the newest thirty): the Convocation's "download my games" carries them, `pnpm narrate` and `pnpm play-diff` read them (phase `match` or `single`). A one-off game with the human on the draw is not kept (the tools read seat 0 as the human). Type-checked; not exercised in a browser.
- **The single match can be a match** (`/play`, "the format": one game | a match — best of three, sideboards; remembered). The event's series (`MatchSeries`: the loser chooses play or draw, the AI always plays), the AI sideboarding from game two as in the Open (its fifteen, its guide), the human sideboarding between games from the seventy-five in the deck editor. A built deck has a Sideboard button (up to fifteen, kept with the deck); an Open list brings its registered fifteen; a deck with none gets the field builder's. "Your Convocation deck (as registered)" is offered under "Decks built here" when the browser holds a Constructed event (read, never written). Checked in the preview: a game conceded, the score, the choice, the sideboard editor. No unit test.
- **The single match offers every list of the Open** (Chris: the Open's deck builder already shows every card). The S37 unlock rule still holds for the mages, the beasts and the bosses.
- **Tools:** `open:rr --progress` (each match game's seed as it starts), `--match-only N`, `--trace-after N` (decisions past N printed — how the loop was found).

## After the session — Mardu Control joins; the Coin and the Hearth are archived (Chris, 2026-10-11) — PUSHED

- **Registered: `marducontrol`, "Mardu Control"** (Chris's name) — his revised sixty (the three Ushers in it; 3 Lumen, 3 Restoration Angel, 3 Jet Witch), the fifteen (3 Wrath, 3 Pyroclasm, 3 Tormod's Crypt, 3 Faerie Macabre, 2 Flametongue Kavu, 1 Sacred Helix) and its guide as the whole plan: Pyroclasms and Kavus against `small`; Wraths and the Helix against `large` (spot removal leaves); all of it against small-and-not-large; the six hate cards for two Ushers, two Swords and two Vindicates against `graveyard`. **`large` is a new guide shape** (eight or more creatures of toughness three or more). Against the Pall the Wraths come in too (the Pall reads as large) — as measured, not as Chris described.
- **Archived: the Coin and the Hearth** (Chris: the list does what both do; "replace both unless one of them has multiple matchups it does better"). Against the twelve shared opponents neither was better than Mardu Control by more than the noise except against the Pall (the Hearth 62, the Coin 52, Mardu Control 43). Two Usher decks remain: the Pall and this.
- **The tables of record, fourteen lists** (`analysis/runs/rr14_s61.json`, `matches14_s61.md/.json`; 100 games and 60 matches a pairing; `open-matches.json` and `OPEN_MEANS` updated). Matches / game one: Reaper Clio 72.2 / 69, the Rabble 66.3 / 58, **Mardu Control 62.3 / 58**, the Pall 56.7 / 65, Countersnake 55.7 / 51, the Writ 55.0 / 50, the Depths 44.5 / 45, the Sweep 44.0 / 43, the Muster 43.7 / 45, the Levy 42.9 / 43, the Kiln 41.7 / 43, the Tollgate 40.4 / 44, the Warband 40.1 / 42, the Wurmspeaker 34.5 / 41. **Mardu Control by opponent (matches):** Tollgate 92, Wurmspeaker 88, Depths 82, Sweep 72, Warband 63, Levy 60, Writ 57, Kiln 57, Muster 55, Countersnake 53, Pall 47, **Reaper Clio 43, Rabble 42**. Still no list at 55 against Reaper Clio (her closest: the Tollgate 44, Mardu Control 43); the field below sixth is a gap of ten points.
- **The Tollgate under the Usher decks** (92 to Mardu Control; 90 and 98 to the Coin and the Hearth before): a sweeper deck with no counter cannot stop a second Usher, and its Wraths bury the first. Read, believed.
- **For the planner:** the Usher returning the Usher is a two-card win of one card that ignores a counterspell on the first copy. Three of the top four lists by game one are now built on or around it (the Pall, Mardu Control) or lose to it. A design question, not an implementation one. And the AI still chooses that loop when it only helps the opponent (the drifting-loop draw catches it; a pilot rule is owed).
- **Chris's rulings on the field (2026-10-11):** the Usher returning the Usher stays, deliberately, for now. The Open's three things to do: go fast (the Rabble, backed by the Kavu), play Clio (Reaper Clio; Countersnake and the Writ are lesser Clio decks), loop Ushers (the Pall as combo, Mardu Control as a control deck's finisher). He reads it as a good field. **His next deck-building experiment:** a Clio/Usher hybrid that beats the two green Clio decks and/or the Rabble; after it, an initial metagame for another Constructed format.
- Not done: the top-eight sub-table; the matchup grid artifact (still fifteen lists); a ladder run (no rule changed here).

## After the session — the revised Mardu Control registered; the tables of record (2026-10-12) — NOT PUSHED (held for one larger push)

Chris: "register it and re-run the tables of record. Then we really will have three pillars in the format of Mardu Control, Reaper Clio, and Rabble." The sixty, the fifteen and the guide below are `marducontrol` now (`open-contributed.json`).

- **The tables of record, fourteen lists** (`analysis/runs/rr14_s62.json`, `matches14_s62.md/.json`; 100 games and 60 matches a pairing; `open-matches.json`, `OPEN_MEANS`, the reference regenerated). Matches / game one: **Reaper Clio 71.5 / 69, Mardu Control 69.7 / 61, the Rabble 64.9 / 59**, the Pall 56.5 / 65, the Writ 54.9 / 49, Countersnake 54.0 / 51, the Depths 44.5 / 45, the Sweep 44.2 / 43, the Levy 42.9 / 42, the Muster 42.9 / 44, the Kiln 40.6 / 43, the Tollgate 40.1 / 44, the Warband 39.0 / 41, the Wurmspeaker 34.1 / 40.
- **The three pillars against each other (matches, 60 a pairing):** Mardu Control over the Rabble 60, over Reaper Clio 52; Reaper Clio over the Rabble 75. (At 900 matches: Mardu Control 56 over Reaper Clio, 57 over the Rabble.) Mardu Control's worst: the Pall 48.
- **A correction to yesterday's game-one table:** the merge for `rr14_s61.json` took in two stale shard files from 8 October that shared its scratch tag (and so did today's first merge). Both are re-merged from their own eight shards (9,100 games); no figure moved by more than a point, and the match tables were never affected. Scratch tags are now checked for leftovers before a merge.

### The three pillars as registered (2026-10-12)

**Reaper Clio** — Four-Colour Snake Control (G B u r); `reaperclio`. 71.5 in matches. Sideboarded by the general rules (five guides were measured in S60; none beat them).
- Spells (41): 4 Birds of Paradise, 4 Clio, Lady of the Depths, 4 Flametongue Kavu, 4 Manaba, 4 Rage Cobra, 4 Reaper's Forerunner, 4 Wall of Blossoms, 3 Mystic Snake, 3 The Reaper, 1 Black Lotus, 1 Mox Emerald, 1 Mox Jet, 1 Mox Ruby, 1 Mox Sapphire, 1 The Reeve, 1 Time Walk
- Lands (19): 4 Bayou, 4 Taiga, 4 Tropical Island, 2 Volcanic Island, 1 Badlands, 1 Cairnbrand, 1 Tallyflame Court, 1 Underground Sea, 1 Wrackroot
- Sideboard (15): 3 Tormod's Crypt, 3 Essence Scatter, 3 Savage Twister, 3 Putrefy, 1 Drana, Kalastria Bloodchief, 1 Faerie Formation, 1 Seraphina, the Initiative

**Mardu Control** — Usher Control (W B R); `marducontrol`. 69.7 in matches. Sideboarded by its guide alone (Chris's plan).
- Spells (40): 4 Blood Artist, 4 Soul Warden, 4 Vampire Nighthawk, 4 Vindicate, 3 Lumen, the Hearth Fire, 3 Restoration Angel, 3 The Jet Witch, 3 The Usher, 2 Phyrexian Purge, 2 Swords to Plowshares, 2 Wrath of God, 1 Black Lotus, 1 Demonic Tutor, 1 Mox Jet, 1 Mox Pearl, 1 Mox Ruby, 1 Sacred Helix
- Lands (20): 4 Badlands, 4 Godless Shrine, 4 Plateau, 4 Scrubland, 1 Blood Crypt, 1 Cairnbrand, 1 Obsidian Observatory, 1 Sacred Foundry
- Sideboard (15): 3 Tormod's Crypt, 3 Faerie Macabre, 3 Pyroclasm, 2 Flametongue Kavu, 1 Phyrexian Purge, 1 Sacred Helix, 2 Wrath of God
- Guide: against many small creatures and few large (the Rabble, the Muster, the Warband) — 3 Pyroclasm, 2 Kavu, 2 Wrath, 1 Helix for 2 Swords, 4 Vindicate, 2 Purge. Against small and large together (Reaper Clio, the Wurmspeaker) — the same eight for the 4 Soul Wardens and 4 Blood Artists. Against large creatures only — 2 Wrath and the Helix for 2 Swords and a Vindicate. Against a graveyard plan (the Pall) — 3 Crypt, 3 Macabre for 2 Swords, 2 Ushers, 2 Vindicate (and the Wraths and the Helix come in too: the Pall reads as large).

**the Rabble** — Mono-Red Goblins (R); `rabble`. 64.9 in matches. Sideboarded by the general rules.
- Spells (42): 4 Char, 4 Dragon Fodder, 4 Flametongue Kavu, 4 Goblin Chieftain, 4 Goblin Grenade, 4 Hordeling Outburst, 4 Lightning Bolt, 4 Raging Goblin, 4 Seasoned Pyromancer, 2 Siege-Gang Commander, 1 Black Lotus, 1 Mox Jet, 1 Mox Ruby, 1 Mox Sapphire
- Lands (18): 8 Mountain, 4 Badlands, 4 Volcanic Island, 1 Cairnbrand, 1 Tallyflame Court
- Sideboard (15): 4 The Ruby Tyrant, 3 Abrade, 4 Tormod's Crypt, 4 Faerie Macabre

### The top eight against each other (matches, 60 a pairing; the row's rate against the other seven)

| | vs the seven | Reaper Clio | Mardu Control | Rabble | Pall | Writ | Countersnake | Depths | Sweep |
|---|---|---|---|---|---|---|---|---|---|
| **Reaper Clio** | 65.1 | — | 48 | 75 | 62 | 63 | 71 | 68 | 68 |
| **Mardu Control** | 63.3 | 52 | — | 60 | 48 | 58 | 75 | 82 | 68 |
| **Rabble** | 60.0 | 25 | 40 | — | 57 | 77 | 58 | 85 | 78 |
| **Pall** | 51.4 | 38 | 52 | 43 | — | 50 | 43 | 62 | 72 |
| **Writ** | 43.3 | 37 | 42 | 23 | 50 | — | 55 | 43 | 53 |
| **Countersnake** | 44.6 | 29 | 25 | 42 | 57 | 45 | — | 62 | 53 |
| **Depths** | 33.3 | 32 | 18 | 15 | 38 | 57 | 38 | — | 35 |
| **Sweep** | 38.8 | 32 | 32 | 22 | 28 | 47 | 47 | 65 | — |

The three pillars stand at 65, 63 and 60 against the rest of the top eight; the Pall is level (51); the other four are under 45. The matchup grid (https://claude.ai/artifact/DYsJLcx54Fd5pWJGMvTacA, private to Chris) shows the same fourteen lists.

### The revision as measured before it was registered

His revision after playing the Rabble: **two Wraths for two Purges in the sixty**; the fifteen 3 Crypt, 3 Macabre, 3 Pyroclasm, 2 Kavu, 2 Wrath, 1 Purge, 1 Helix. Against the Rabble: every spot removal out (2 Swords, 4 Vindicate, 2 Purge) for 3 Pyroclasm, 2 Kavu, 2 Wrath, 1 Helix — the Warden/Artist package stays. Against Reaper Clio (his guess): the package out for the same eight. Scratch: `gx/mardu4.json`, `mardu4_side.json`, `mardu4_gC1.json`.

- In its own seat, 160 matches against each of the thirteen others, paired with the registered list: **61.3 → 70.3 ± 2.0 in matches** (game one 57.4 → 60.2; games two and three 58.5 → 66.6). Better against twelve of thirteen (the Pall 46 → 44).
- **Confirmed at 900 matches each: Reaper Clio 55.8 ± 3.2, the Rabble 57.1 ± 3.2** (the 160-match run had read 58 and 66). The first list measured at 55 against Reaper Clio (ADR-173's line), and ahead of both top lists.
- The Clio plan three ways: the package out for the eight (58 at 160 matches) > Pyroclasms for Wardens and Kavus for spot removal, the registered way (53) > the package out and the third Purge for a Swords (49; that row also fired against the Rabble, and cost seven points there).
- At 70 in matches it would stand with Reaper Clio (72) at the top of the table; if registered the table of record must be re-run.

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
- **Chris's next deck-building experiment:** a Clio/Usher hybrid that beats the two green Clio decks and/or the Rabble (two untested starts: the Writ with Ushers; Mardu Control with blue for Clio — she shrinks only the opponent's creatures, so the Warden/Artist package can stay). After it, **an initial metagame for another Constructed format**.
- **A pilot rule for the Usher loop that helps only the opponent** (the AI chose it; the drifting-loop draw now ends it as a draw, which is still a game thrown away).
- **The journey's Purge** (book 123): the lord decks and the Heart's deck now cast it — not measured.
- **The deployment's size** (about 400 MB of art and audio a deployment) if Vercel's storage cap keeps biting: host the assets outside the deployment. Not scoped.
- **ADR-173's Clio measure** (one copy against four) is no longer forced: a list reaches 55 against Reaper Clio. The planner's call whether it is still wanted.
- Still owed from before: the sideboarding rules' "creatures" rule probe; the scratch tools into the repo; a journey played through a sitting (S59); a unit test for the single match's series and recording (checked by hand in the preview only).

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
