# Session 66 brief — Mardu, and Esper's second table

*Planner → Implementer. 2026-10-17. Follows the running handoff.md (after S65 and the post-S65 work). One session. Process rules unchanged: appends to `docs/decision-updates/s66.md`; probe before rule; a guide measured row by row; every AI change carries a ladder delta or reverts; push only when Chris asks.*

## Part 0 — Rulings and ADR appends
- **S65's deviations and the post-S65 work ratified**: Esper's seeds with their land swaps; books 57 (amended) and 133–139; Foxglove Dose (T2; the kill line is the card; the trick half on trial — `conditionaim`) and Tidal Shackle (T1, with the draw) by ADR-182's method; R-112–R-114; Karmic Mentor returning any permanent; Emerald Snakes in the Open and Naya; the Brood as Chris's; the trace and the glyphs; the stale-attacker fix; Naya's thresholds frozen.
- **ADR-185 — A triad's day-one top gets the pool-and-play order.** BW Tokens at 65.6 in Esper is read as Dungrove Auras was (ADR-178): a triad's pool is the Open's and does not grow, so the levers are the *sideboards* (Esper's sweepers in no seed), play (Chris's Esper run), then a card. No list is touched for being first on a first table.
- **ADR-186 — Shape thresholds freeze.** A format's `shapeScale` is frozen once it has eight lists, re-derived only on the planner's call (the rank rule ties at zero in a small field — Naya's lesson). Esper's and Mardu's frozen at their first eight.
- **ADR-168 restated for guides**: a person's plan is measured row by row, never copied (Naya +5.8, Esper −11.6).
- **The lords are texture** (recorded): the Fordkeeper wanted by some, the Dredger by none — a campaign boss was tuned as a seat with an entrance, not as a sixty's best card. Faldor seeds into Esper's UW Skies (Part 2).
- **The Dose's trick** waits for its own probe (book 129's shape on a conditional harm); not this round.
- **Esper's names** (the plane's register; keys unchanged): BW Tokens → **the Roll**; Dimir Tempo → **the Eddy**; UW Skies (Esper) → **the Aerie**; WB Control → **the Chancel**; Mono-Black Control → **the Barrow**; Esper Reanimator → **the Ossuary**. The Writ, the Levy, the Locks and the Undertow keep theirs.

## Part 1 — Mardu (`formats/mardu/`, RWB)
- **The rule**: `colorsWithin: RWB`, `manaWithin`; the Open's restricted list where it applies (the Lotus; Mox Pearl, Ruby, Jet; the Observatory, Cairnbrand; Demonic Tutor; Library); the laws banned. The door's line: *"Mardu — red, white and black. The Usher's loop lives here, and the race that beats it."*
- **The seeds — the family's reuse** (whole where legal; the implementer builds the rest; working names): **the Pall** (mono-black, whole — the loop in a triad for the first time); **Mardu Control** (whole); **the Rabble** (whole, its blue lands swapped); **the Muster** and **the Warband** (whole); **the Roll** (Esper's BW Tokens — whole); **the Levy** (whole); **the Chancel** (Esper's WB Control — whole); **the Watch** (Naya's RW Tokens — whole); **BR Removal, promoted** (Peasant's with Drana, Hypnotic Specter, the Specter's cousins, Vindicate? — no, WB; Char, Siege-Gang); **Mono-Red Burn** (the Tally's shape without blue: Guttersnipe, Pyromancer, Bolt, Char, Blaze, Shock, Seasoned Pyromancer, the Tyrant). Eleven.
- **The tables** (three columns; the seat draw by matches; the cap; the thresholds frozen at eight); the loops under books 99 and 124; **the read the triad is for**: does Mardu reproduce the Open's shape — the loop (the Pall, Mardu Control), the race (the Rabble, the Watch, the Roll), and whatever stands between (the Chancel, the Levy)? The top-eight sub-table.
- **The lords**: the Usher is Mardu's minister (hers already); the triad's three-colour lord — the implementer names him from the census — tried in Mardu Control and the Chancel, as the others were.

## Part 2 — Esper's second table
- **The sweeper round**: fifteens and guides for the control lists (the Locks, the Chancel, the Aerie, the Writ) with Wrath, the Wave and Retribution against `small` (the Roll, the Levy), measured row by row; the out-rule's `small` word on for the Esper lists where it gains.
- **Faldor** into the Aerie (two, for two Valkyries; his Soldiers on a draw) — cast rate and the list's number with and without.
- **The Ossuary's probe** (ADR-167): at each Zombify cast, what was in the graveyard (a piece? nothing?); the turn the first piece lands; the games lost with a piece on the battlefield (answered by what). If the pieces land and die to Swords and Edicts, the shape is dead in Esper and the Ossuary is archived; if they do not land, it is the plan's timing and a rule follows.
- **The Barrow** (40.6) is a seed; its retire count starts.
- Esper's table re-run (three columns).

## Part 3 — Measure
Mardu's table of record; Esper's second; the read across three triads for the handoff: which has an engine, which a race, which a lock — and whether the family needs a fourth by contrast (Jeskai by the census's balance; or BGU, the one triad without a sweeper).

## Handoff
Mardu's seeds, tables and door; Esper's second table, Faldor's read, the Ossuary's probe; the names in; deviations, concerns — and the implementer's estimate for building the remaining seven triads as a batch once three have been read (the reuse rate: how many seeds a new triad gets whole from the lists that exist).
