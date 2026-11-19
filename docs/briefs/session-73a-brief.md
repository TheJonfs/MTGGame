# Session 73a brief — the adoptions, the grounds by rule, and the run of record

*Planner → Implementer. 2026-11-18. Follows the running handoff.md (Session 73's Parts 0–4 done; Part 5 owed). This replaces S73's Part 5 and orders what comes before it. One session. Process rules unchanged: appends to `docs/decision-updates/s73.md` (§ S73a); probe before rule (ADR-167); every AI change ladder-gated; push only when Chris asks.*

## Part 0 — Rulings and ADR appends
- **S73's work so far ratified**: `poolAt` and `portOf` (a port read at its source's vintage — Chris); the Open's seeds at 260; the audit's 61 rows and its table; the second seed under +5; no Naya or Jund row for Clutch Guard (blue at the gate, ADR-197); Clutch Guard in Nothing Dear's Emerald Snakes; sourcePower on last-known information; the builder fix (`castingColours` — gates unchanged; the journey's repaired decks may take a hybrid card, intended); `landdeck` built; the Warband's row not adopted (+1.5 ± 0.6 pooled); Part 4's narration and table; forced inclusion and card-rating v1.6; the Bolt probe closed as a result (the holds are not the cause; 1.44 is the card under this pilot).
- **ADR-201 — The High Grounds by rule** (Chris, 2026-11-18: the grounds are Power-class; a list in the pair needs a reason not to play its own). By ground, not by list:
  - A ground **with clearing rows** (Hearthspire, Nightbower, Volmaw) enters every planner list whose mana makes both its colours (`castingColours`), one copy, for a basic of the pair's more plentiful colour.
  - A ground **with no row yet** gets three rows first, in three planner lists of different shapes (two seeds under +5); if all three clear, it joins the rule; if not, it is adopted only where it cleared.
  - **Ranksmere is exempt** (measured level in six hosts).
  - A list is exempt **with its reason recorded** on the list's data (`groundExempt`: it cannot pay the ground's cost; the ground's ability does nothing in it).
  - Contributed lists and their ports are reported to Chris, not swapped (ADR-200).
- **ADR-202 — A clear under +5 is read on two seeds**, pooled. S72's +7.3 for the Warband's row (one seed; +8.5 and +2.6 on two) is the record.
- **The bar is read strictly**: the gain less its error is at least +2. By it the Tally's Storm Shaman (+2.6 ± 1.2) and the Barrow's Nyxathid (+3.0 ± 1.8) are holds, not clears; the audit table marks them so.
- **`landdeck` fires at six**, not four: with the grounds in by rule, four names half the field. Six names the land decks, the Fun Police and Lumen Clio. The shape stays; no row is keyed on it yet.
- **Clutch Guard wherever it is legal and lifts** (Chris): a mostly superior Elvish Visionary. For the record of future formats: as a gold card at tier R it is out of Peasant, and a format may yet be cut on how much of tier 3, tier R and prizeOnly it leaves legal — the hybrid cycle is one of that dial's notches.
- **Silt Spirit into Sultai Mill** (Chris): the card was designed as the enabler for the mill lists that were not quite there, and to open toughness-matters.
- **The Limited hybrid read** (concern 69) is fixed with the next rating rebuild, not before — one new table for ADR-150, not two (Part 6).
- **Jeskai Sweepers gets no swap**: it decks itself in 23% of its games on three Serra Angels. It needs a finisher the pool does not have; that and the audit's other pool gaps go to Chris as card asks (the handoff lists them once more, with the lists each would serve).

## Part 1 — The base arms that left their records (first; nothing is recorded before this reads)
Every list whose audit base arm stands eight points or more from its table of record — the Undertow in Nothing Dear (37.2 → 23.5), the Open's Levy (38.0 → 26.2), Bodies' Stampede (46.6 → 35.6), Abzan Warden (39.0 → 48.9), the Kindling in Mardu (35.9 → 44.6), and any other the census shows. For each, **attribution by switching off**: `--off tapmill` (book 176) for the Undertow and every list with a tap-to-mill creature; books 170–175 singly; moxkeep; and the v1.4 ratings (the sideboards and the guide thresholds, concern 55). **The read**: a book costing a list its game is a bug in the book — fixed or narrowed, ladder-gated, before the run; a move owed to the field getting better around a list is a result and is recorded as one. The Undertow's is the one the planner expects to be a regression: a mill that waits for the end step and then does not happen.

## Part 2 — The adoptions (lists.json; `open:gen`)
- **Order Druid** for Rampant Growth in the Wurmspeaker, every format.
- **Daunting Terror** for Child of Night in BR Removal (Nothing Dear, Grixis); for Centaur Courser in Bodies' Stampede.
- **Nyxathid** for the Gallows Djinn in Peasant's Mono-Black Removal.
- **Storm Shaman** in the Kindling. **Dawnwing Marshal** in the Open's Muster.
- **Clutch Guard** for Elvish Visionary in Emerald Snakes (the Open, Temur, Bodies; Nothing Dear done) and for Wall of Blossoms in Temur Snakes.
- **Silt Spirit** in Sultai Mill by S72's study swap.
- Held: the Tally's Shaman, the Barrow's Nyxathid (a second seed each; adopt if the pooled read clears strictly). Not adopted: Banishing Cleric, Revivalist, Nyxathid in BR Removal.

## Part 3 — The unPowered formats, before the grounds
Bodies and Nothing Dear re-run **now**, with Part 1's fixes and Part 2's adoptions and *without* ADR-201 — the "before" tables (100 game ones, 60 matches a pairing, seed 91; not recorded as tables of record).

## Part 4 — The grounds
The three rows for each untried ground; then ADR-201 applied across the planner lists (the audit's census is the worklist); every `groundExempt` with its reason; the count of lists changed, by format and by ground.

## Part 5 — The run of record
Every format with a field, once: the Open, the ten triads, Peasant, Bodies, Nothing Dear — with moxkeep, books 170–176, v1.6, `landdeck` at six, the adoptions and the grounds. Sub-tables; the ADR-191 reading list refreshed. **Chris's question, answered from Parts 3 and 5** for Bodies and Nothing Dear: each list's rate before and after the grounds; the rank correlation of the two tables; the lists that moved three places or more; and each "after" table split into ground-holders and the rest (how many grounds a list plays against its rate). The read the planner wants stated plainly: do the grounds lift everything evenly (a tide) or reorder the format (a new Power)?

## Part 6 — Two smaller things
- **The Minefield's ramp** (Part 4's lead): the AI casts Wood Elves and Wall of Blossoms about half as often a game as Chris. *Probe only*: for each turn either was in hand and castable and went uncast, what was cast instead and what the scorer priced each at. The report names the cause (outpriced, held for mana, dead first); no rule this session.
- **card-rating v1.7, scheduled not run**: the Limited builder's and drafter's hybrid read moved to `castingColours`, the twenty cards under 100 sightings forced (a three-colour build for the legends), and the report regenerated — one rebuild, after the run of record, at Chris's word.

## Handoff
Part 1's attributions and any book fixed; the adoptions in; the grounds' new rows, the rule's count and the exemptions; the tables of record; the before-and-after read for Bodies and Nothing Dear; the Minefield probe; the audit's owed remainder (69 lists) restated against the new tables; the pool gaps as card asks; deviations, concerns.
