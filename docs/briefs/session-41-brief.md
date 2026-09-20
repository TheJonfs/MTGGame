# Session 41 brief — the seats

*Planner → Implementer. 2026-09-20. Follows the running handoff.md (after S40) and its S41 estimate. The working document (`docs/phase-two-legends-working.md`) remains authoritative for texts and lists, with the two list amendments below. Process rules unchanged: appends to `docs/decision-updates/s41.md`; fuzz before fixtures; every AI change carries a ladder delta or reverts; the map's placement is designed here (Part 3) so S41 ships whole.*

## Part 0 — Rulings and ADR appends
- **S40 Deviations 1–7 ratified.** The Cobra as printed earns its slot (first strike plus destroy-on-combat-damage does the document's job while it lives). The count (27), ADR-052's art variety, the unbuilt AI lines (each for a stated reason), the T3 row in the Lab, the first-failed-field line (superseded by Part 2), the token plates (done in the art round).
- **ADR-129 — The seats keep their own gates.** Every court's list satisfies the gate it imposes (Meliyan and Isaura already did; Odile and Zinnia amended below). Honesty at the door: the puzzle the court sets is one the court itself solves.
- **ADR-130 — The Calyx.** The five courts stand on the five High Grounds, which rise from the deep water where the Corolla was: five islands on a ring inside the flooded centre, each set between its pair's two shores, reached by ford or ferry from either territory's inner ring. The Heart of the flood lies beneath, at the centre. The five strongholds stand in the outer rings of their law's colour (the Bailiff in white's, the Reeve in black's, the Fordkeeper in red's, the Dredger in blue's, the Reaper in green's), as the phase-one lords did. **The Heart opens when the five lords have fallen** (⚠ Chris — the courts are prizes, not a gauntlet, per the design; the strongholds are the road to the Heart).
- **The Reaper's harvest** — loosen the alpha rule from three-fifths to half (one constant in `floodSinkGated`); re-run `pnpm flood-sim --only reaper`; keep if he plays like the Reaper without losing his seat's rate.
- **Shadow Summoning's scan** (⚠ Chris): keep LTR's, pin a later printing, or our frame only. The planner's lean: keep — the name is generic and the art is spirits.
- **Legends carry no price** (S40 Concern 9): correct; no new field.

## Part 1 — Two list amendments (the document updated)
- **Tallyflame Court**: −1 Divination, +1 Wind Drake (twelve creature cards — her own gate).
- **The Wrackroot Shallows**: −2 Hedron Crab, −2 Wall of Blossoms → +1 Man-o'-War (3), +1 Mist Raven (2), +1 Aether Channeler (2), +1 Rumbling Baloth (2) — nothing under power 2; her mill is Zinnia and the bounce, which is the seat's plan anyway.

## Part 2 — The door lines: by site, with field fallbacks
`quests.json` `door.bySite` keyed by the site id, carrying the planner's five lines exactly as written (numbers included); `door.byRule` becomes number-free fallbacks for any other ruled site or test gate: *"Bring bodies to the fire."* / *"Nothing small. The water takes the small things first."* / *"No sudden things."* / *"Half of what you bring must be ground."* / *"Nothing dear."* `doorRefusalText` prefers the site line, then the first failed field's fallback, then the colour line. The two S37/S38 controller tests re-based to the fallbacks.

## Part 3 — The ten sites
- **Lists into the catalog** (`lord:<key>` / `court:<key>`), the document as the source through a sync test; delete `flood-decks.ts`.
- **Five `StrongholdContentDef`s**: the seat name, the lord's signature ×3 in the list, the law on the seat's side, `signatureToHand` (the phase-one lords' entrance), `deckRule: { colorsWithin: <triad>, label: "the <name> gate" }`, the descent's host of battles as the phase-one strongholds have them (the phase-two mage roster at the phase-two column for the minions — the mages are still phase one's until the inversion round; that is accepted for S41), the parley/telegraph text (Part 5), the lord's portrait. Life row: **⚠ provisional 34 base** with `lordGrowthLife` as phase one; measured in Part 6.
- **Five court sites** on the `CorollaPetalDef` shape (or a `CalyxDef` if the Corolla's def is too bound to the gauntlet — the implementer picks the cheaper honest shape): the seat name, the minister ×3, the law on the seat's side, the High Ground on the seat's side via `permanentOnBattlefield` (the fuzz's path), the shape gate, the minister's portrait. Life row: **⚠ provisional 34** (the ground is the court's escalation; the phase-one court was 30). No gauntlet ordering; each court is its own site.
- **Prizes**: a stronghold's fall pays the lord's signature (one copy, prizeOnly) and the triad's duals as phase one's did, and the pair's two golds join the R drawer; a court's fall pays its High Ground (one copy) and the minister's signature. The Chronicle's lines for each (Part 5). The five golds of the strongholds' pairs are R-tier shop stock from the flood's first town (they are the flood's finds).

## Part 4 — The map
`generateWorld` at phase 2 places: the five strongholds in the outer ring of their colour's territory (the phase-one stronghold placement rule); the five High Grounds as fixed points on a ring inside the deep water, each between its pair's shores (the generator's fixed-point placement with a new `FixedPointKind` `ground`), with a ford or ferry tile from each of the two shores' inner rings; the Heart's site at the centre (`deep`, unchanged — it opens on the five lords' fall, Part 0 ⚠; until the Heart's content lands it says the deep-water line). The flood register draws the islands as high ground (a lighter tile inside the wash). Tests: placement per territory; every ground reachable from both its shores; the Heart's gate on the lords' flags; the save round-trip.

## Part 5 — Text (planner; Chris's pen)
Parley/telegraph lines for the ten seats and the Chronicle's lines for each fall, in the archaic register — the planner delivers them as a `flood-seats-text.md` beside the brief before the session starts (⚠ pending: the planner writes them once Chris's names pass stands; the S40 names are assumed).

## Part 6 — Measure
- **The "salvage + legends" references**: `salvage-WR` and `salvage-UB` with their pair's carried ministers and guardians added (the S39 Concern 7 entry, one deck each).
- `pnpm flood-sim` against those two and `chris-road-B` at the provisional rows (34/34), the courts on their ground with the gate's intruder deck legal by construction (the references may need a legal variant per court — the implementer builds the nearest legal cut and says what changed).
- Report per seat as S40; the read the planner wants: the lords 40–55% against a finished phase-one deck and 70–85% against salvage-plus-legends; the courts likewise; Odile's rate after her list change. The rows are ratified from this table.

## Part 7 — Smalls
- The phase-two column stays ⚠ (S39 Concern 1) — the salvage-plus-legends read serves it too; report the tier-2/3 mages against the new references in the same run.
- `world-ui.md`: the Calyx, the courts, the strongholds' phase-two doors.

## Handoff
The ten sites as built, the map's placement with a seed's screenshot, the rows' table, the references, deviations, concerns; the implementer's estimate for S42 (the mage inversion and the Heart's phase-two content).
