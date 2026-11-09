# Session 71a brief — Part 2 as it stands after the probes

*Planner → Implementer. 2026-11-09. Follows the running handoff.md (Session 71 in progress, 2026-11-06). This replaces S71's Part 2 and carries its Part 4. Half a session. Process rules unchanged: appends to `docs/decision-updates/s71.md`; probe before rule (ADR-167); every rule measured on the lists it is for and ladder-gated; push only when Chris asks.*

## Part 0 — Rulings
- **S71's work so far ratified**: ADR-194 built; the consequence and opponents' probes (both read as results: no decision shape ranks, and the field has no edge — the gap is in the seat); Confession at {1}{B} (R-124, book 163); Volmaw adopted in the Esper and Grixis Undertow and Sultai Mill; Ranksmere not adopted; Lumen Clio and 5C Earthrise registered; books 161–162; Molten Rain (R-123); the Minefield in the Open and Naya; the picker, the compact layout, the offline copy and the Duo fixes. The implementer's calls stand: book 162's weights, the Pinnacle's and the Minefield's names, the Naya fifteen as the rules read it.
- **ADR-195 — The per-decision instrument has reached its limit.** Four probes (S64's replay, S67's three, S71's two) value a divergence by the pilot's follow-up and read every human habit at ~0. S71's Part 2 as written (shape-by-shape consequence rules) is withdrawn: the model's real finds (books 161, 163; concern 23) came from reading recorded games, and that is how they will keep coming (ADR-191 stands as the trigger). What remains of Part 2 is one concrete book and one last probe at a coarser grain.
- **The sub-table is a reporting lens, not a draw**: the reference pages and the handoff report the top-N sub-table beside the full table; the field's draw stays as it is (the cap and the list draw).
- **Ranksmere's read was sent to the wrong lists**: a token-copy land wants token makers. One read owed (Part 3).

## Part 1 — Book 164, the plan dig (concern 23)
Two gaps in `lifeForCardsGated` for a combo list: the plan's `digGated` decides before book 159's full-hand stop, and `burnAcross` counts fixed damage only, so Sacred Helix (X) reads as no burn and book 113's floor never applies. **Rule**: the full-hand stop (pending draws counted, as book 159) applies to a plan's dig too; `burnAcross` counts an X burn spell as its list's typical X (the mana the list makes by the turn in question, or a flat four — the probe says which reads closer to what the Helix lists actually cast). Off: `digburn`. **Measure**: the Pall against Earthrise, the Minefield, the Pinnacle and the Rabble (160 matches a pairing, paired); the Witch and Mono-Black Clio against the same (the floor should not over-fire for a non-plan list); the ladder. The fixture is Chris's Earthrise final, game one: the Witch at 14 life paid for six into four Helixes and did not.

## Part 2 — The whole-turn probe (one run; a result either way)
`pilot-probe --turns`: for a recorded run, every turn of the human's where his line and the pilot's diverge at any decision. Two playouts from the start of that turn, same seeds, libraries reshuffled: (a) **the human's whole turn as recorded**, then the pilot from the next turn; (b) **the pilot's whole turn**, then the pilot on. Report per run and per turn: the mean difference, the turns with the largest difference, and for those turns what the human did that the pilot did not (a mulligan, a held card, a cast order, an attack). Run on **Lumen Clio** (seed 396379) and **Earthrise** (event 824660) — the two top lists furthest below Chris — and, as a control, one of his runs where the pilot's number is near his. **The read**: a separation of three points or more on either list names the grain the gap lives at and the next rule; a null says the gap is multi-turn planning, the tables are read from here as the pilot's ranking of lists (a floor under a human), and Chris's records stop being a target.

## Part 3 — Owed
- **Part 4 as briefed**: the Esper, Grixis and Sultai tables with Volmaw; Naya's with the Minefield.
- **Ranksmere** in the Roll (Esper) and the Watch (Naya) for a land of the pair, 160 matches a pairing, paired; adopt by ADR-168.
- The reference pages gain the sub-table (the lists above 50, against one another).

## Handoff
Book 164 and its numbers; the whole-turn probe's report and the read it supports; the four tables; Ranksmere's second read; deviations, concerns — and, by ADR-191, which of Chris's lists are furthest below his records on the new tables.
