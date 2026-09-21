# Session 42b brief — the mage inversion

*Planner → Implementer. 2026-09-21. Follows the running handoff.md (after S42a). Rides with `mage-inversion-lists.md` (the ten lists, authoritative). Process rules unchanged: appends to `docs/decision-updates/s42b.md`; fuzz before fixtures; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S42a Deviations 1–6 ratified.** Extra turns as R-098 (the explicit turn order is the right shape; Concern 2 is noted as a rule for future code: read `activePlayer`, never infer it from the turn number). The tide on the card, not the mode — card-as-data was the correct call and phase three's player copy will thank it.
- **ADR-134 — The lords' rows.** `floodLordBasics` **2** at Standard (30 base + two basics of the triad: 48–58% against a finished deck, the band's top edge for all five lords at once); Easy 30 + 1; Hard 34 + 3. `baseLife` 30 in `flood.json`; the difficulty bundles carry the entrance. Ratified from the S42a grid.
- **ADR-135 — The fount is not tuned by life, and its row stands at 50 (45/55) until a post-lords read.** The tide at 86–89% against a finished deck equals the phase-one Heart's rotating ring at 40 (86% on today's code) — the fight Chris found "tough but beatable" by hand. The lever, if one is pulled, is the entrance (roots, the card in hand), not life. Before anything moves: (a) `heart-sim --roots` as an axis; (b) a **post-lords reference** — a salvage deck plus the five lords' cards, the ten golds' best five, and Time-Walk-less, at 12 life with two basics in play, journeyman — the honest yardstick for the fount and the courts; (c) Chris's hand read through a dev shortcut (Part 4). No change this session.
- **Odile stands.** Her 20% against a finished deck is a property of the design — a court that punishes tapped creatures against a deck that wins with few, vigilant or burning — and the five courts having different matchups (Isaura and Meliyan hard for a finished deck, Odile soft) is texture, not a defect. Her row ratifies with the rest.
- **The region names**: fifteen, in Part 5, one per territory per ring; "The Emberford" collision ends.

## Part 1 — The inversion
- `MAGE_DECKS` gains a phase-keyed table: the ten lists from the document as `mage:<key>@2` (or a `floodLists` map — the implementer picks); `mageListFor(key, phase)` — the one switch, the `strongholdContentFor` pattern; tier 1 reads phase one's list at both phases. `primaryColors` per phase (the pip order changes with the pair; the entrance follows it). The catalog's mage rows gain `colorsPhaseTwo` for the parley/rail colour and `enemies.md`'s phase-two column shows the pair.
- Names, portraits and epithets unchanged. The parley line at phase 2 may add one clause (Part 5) — or nothing.
- The Lumberjack has a home (Brennor, Quill): the pool-registry's "shop-only until phase two" note closes.
- Fuzz (the S29 pattern): the ten flood lists against a mage and a starter each, both seats, at the phase-two column; replays byte-exact. A sync test pins the lists to the document (the `flood:gen` pattern — extend the generator to read this document's code blocks too, or a sibling `mage-inversion:gen`).

## Part 2 — Measure
`mage-sweep --phase 2` with the inverted lists: part 1 (tier by tier, the flood's ten), part 3 (children vs parents — each flood list against its phase-one self at the phase-one column: the transformation should be a different deck, not a weaker one), part 11 (against salvage + legends). Cast counts. The read: no fold inside a tier that phase one did not have; every flood list beating its phase-one self at least 40% (a mirror, not a downgrade); tier 2 near even and tier 3 unfavourable against salvage + legends (the S42a numbers were 47 / 24 with phase one's lists — the inverted lists should sit near those).

## Part 3 — AI
Nothing new expected; every card in the ten lists is pinned already. If a list's plan does not execute in the sweep (the Lumberjack's burst, Corvane's Buried Alive into a wurm), say which and the planner amends.

## Part 4 — Smalls
- **A dev "fell the five lords"** for a phase-two world so the fount can be walked live (and Chris can hand-read it — ADR-135's (c)).
- `heart-sim --roots` (ADR-135's (a)).
- The **post-lords reference** in `sim/road-decks` (ADR-135's (b)): `salvage-WR+lords` = salvage-WR + the five lords' cards + Sacred Helix, Putrefy, Undermine, Powerstone Minefield, Char + two basics in play, 12 life. One deck; the UB sibling if cheap.
- The scripted phase-two stronghold run (S41 Deviation 9, still owed).

## Part 5 — Text (planner; Chris's pen)
**The flood's regions** (fifteen; inner / approach / wild):
- White — **the Chalkwater** · **the Saltings** · **the Strand of Bells**
- Blue — **the Deepreach** · **the Glassmere** · **the Drowned Verge**
- Black — **the Blackwash** · **the Sedgemoor** · **the Bonefens**
- Red — **the Cinderflats** · **the Scaldings** · **the Smokereach**
- Green — **the Rushlands** · **the Reedholt** · **the Wildwater**

**The mages' phase-two parley clause** (one line, appended after the phase-one greeting, or nothing — Chris): *"The water changed me, too."* — the same line for all ten; the deck is the transformation.

## Handoff
The ten lists in the catalog and the sweep's three parts with the S42a baseline, the fuzz, the smalls, deviations, concerns, and the implementer's estimate for what remains of phase two after this: the Calyx's tiles and the flood's art round, the shops' phase-two stock read (the purse at 100 is still ⚠), and the post-lords measurement of the fount and the courts.
