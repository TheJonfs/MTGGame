# Session 68 brief — the pilot, from the probes

*Planner → Implementer. 2026-10-20. Follows the running handoff.md (after S67 and Chris's Grixis and Jeskai runs). One session, all pilot; the shallow batch is S69. Process rules unchanged: appends to `docs/decision-updates/s68.md`; probe before rule (ADR-167); every rule measured on the lists it is for and ladder-gated; push only when Chris asks.*

## Part 0 — Rulings and ADR appends
- **S67's deviations ratified**: no Grixis reanimator (the read stands: Control Magic and the field's hate); Jund Coin retires on its first count (the Sweep is Jund aristocrats); ADR-188's event reading confirmed (a seat holds its list's authored fifteen or a built one); the Kiln's Macabres as Pyroclasms in Jeskai; the Jund lord read. The Bailiff in the Theft adopted; the Stoker and the Reaper not. Vigil Keeper in the Muster; the Keeper answers the Pall and not Mardu Control (no fifth shape).
- **ADR-189 — The six-triad read**: Naya and Jund an engine over a race; Esper and Jeskai a race over a lock; Mardu an engine and a race; Grixis a race over everything. The red race tops three of six — re-read after Part 1.
- **The `large` thresholds in Grixis and Jund set by hand to 3** (the low-rank tie again); ADR-186 gains: a frozen threshold is never below 2.
- **Sacred Minefield** stands registered in Jeskai (Chris's 8–0); its number is re-read after Part 1 (the pilot feeds it attackers today).

## Part 1 — Combat reads the defender's triggers (the Minefield)
The attack evaluator charges each attacker (and the block evaluator each blocker) what the battlefield's ATTACKS/BLOCKS triggers and statics will do to it on declaration — the Minefield's 2 first; then any opposing permanent whose trigger an attack or block sets off (the Observatory's ground, Isaura's shrink, Meliyan's drain on a death, a Soul Warden's gain is the opponent's). The attack sim's view of *their* attackers reads our triggers the same way. Measure: the Rabble, the Muster, the Watch and the Aerie against Sacred Minefield and the Tollgate (attackers lost to a trigger per game, before and after: 127 of 127 for the Rabble today); the Jeskai and Naya tables re-run; the ladder. Off: `triggercharge`.

## Part 2 — Damage targeting
- **A burn spell aims at a creature only when it kills** — alone, or with what is already committed (combat damage assigned, pings on the stack); otherwise at the face if the archetype's face rule allows, else held. Off: `burnkills`.
- **Repeatable damage plans a kill**: the Tyrant (and any repeatable ping) stacks activations toward a creature it can kill this turn, counting its own pending pings; a single non-lethal ping is refused as now. Off: `pingplan`.
Measure on the Rabble, the Kindling, the Tally and the Kiln (Chris's recorded Grixis games as the probe set: 9 of 23 non-lethal; the Tyrant's doubled ping); the ladder.

## Part 3 — The Witch, early while it is safe
From the probe: the pilot's first activation on turn 10.2 against Chris's 6.6, 4.8 a game against 7.0. Rule: the Witch (and Dread Presence's draw, Sign in Blood, any life-for-cards) is used from the turn it is safe — life after payment above the opponent's board reach plus burn seen, no untapped racer — rather than held for an empty hand; book 113's floor stands as the stop. Measure on the Witch, the Pall, Mardu Control, the Barrow, Mono-Black (Peasant); Chris's Umbel as the human line (7.0 a game). Off: `witchearly`.

## Part 4 — The next probes (no rules this session)
- **Blocks and cast order** (the racing gap): from the Emerald Snakes diff, every turn where the human and the pilot blocked differently or cast in a different order; the playout from each; the commonest difference by kind.
- **The Manaba through the solver**: instrument the solver's payments so a Manaba tap is recorded as a decision; then the end-step read per turn (mana made, spent, wasted), the human against the pilot.
- **The Jeskai Sweepers' Wrath timing** (Concern 4): when the pilot Wraths (the board's value each side) against Chris's Jeskai Control games.

## Part 5 — Measure
The ladder after each rule; the Open's, Mardu's and Jeskai's tables re-run (the lists the rules touch: the Witch lists, the burn lists, the Minefield lists); the six-triad read re-stated if the red race moved.

## Handoff
The four rules with their paired reads and the ladder; the three probes' reports; the tables; deviations, concerns — and the shallow batch's plan for S69 (Sultai, Abzan, Temur, Bant; Sultai first).
