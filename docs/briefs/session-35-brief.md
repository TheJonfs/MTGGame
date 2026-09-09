# Session 35 brief — closing the tuning arc

*Planner → Implementer. 2026-09-08. Follows the running handoff.md (after S34). A short session: ratify, regenerate, record, and one AI check. Process rules unchanged.*

## Part 0 — Rulings and ADR appends (docs/decision-updates/s35.md)

- **ADR-117 (ratified) — the tier tables.** Mages: T1 8/0 at every mode; T2 12/0 · **12/1** · 14/2; T3 14/1 · **16/2** · 20/2. Beasts: T1 +0; T2 +0 · **+2** · +4; T3 +2 · **+4** · +8. The ⚠ comes off. Rationale per tier in the S34 handoff's Concern 1 and the planner's read: tier 2 is the tier the player grows into (stock 36, mid-road 70); tier 3 punishes a raw starter and is a fight a mid-road deck mostly wins (stock 21, mid-road 56), and 16/2 is the cell where the reanimator turns once a game.
- **ADR-116 amended.** The tier-3 stock-starter bound reads "unfavourable, and winnable by a human" rather than "roughly 25–40" — the raw starter in the wilds is meant to be punished; the human bound is Chris's own play, not the roster.
- **ADR-119 — Row offsets, not tier moves, for the outliers.** `worldLifeOffset`: Thornmother Ysolde −4 (the aggro mage wants life, not roots; she is past the band at 12/2), the Vampire Nighthawks −4, the Living Gale +4 (the tier-2 beast spread), the Serra Angel −4 (stands from S34). The Specter is a plan beast that life does not touch — noted, not offset.
- **ADR-120 — The lifegain walls stand.** Oriel (40), Vael (24) and the Nighthawks (18) wall the journeyman-piloted stock starters and nothing else does; that is the AI racing lifegain badly (ADR-118's family). Chris played Dawn Levy into Oriel three times at Standard — tight games, three wins, two on the play — and rules her a testing wall, not an in-practice one. The Part 4 trims are withdrawn. Revisit only from world play.

## Part 1 — Encode
The four offsets on the catalog rows; `pnpm knobs:doc && pnpm reference`; the mage rows' `worldLife` follow through the sync test; `enemies.md` shows the offsets per mode; the Lab reads them.

## Part 2 — The baseline of record
Re-run the stock-starter roster at the final Standard cells (`--mode standard --part 2/5/6`, 100 games both seats) and save it as `analysis/runs/s35_standard_final.json` — the number every later change is read against. Report the three tier means for mages and beasts beside S34's (59/36/21; 72/44/34) and the four offset rows' new cells. No further tuning; report only.

## Part 3 — The apprentice's first land (an AI check)
In Chris's three games Oriel skipped her first-turn land drop twice, then made consistent drops. Two hypotheses: a kept no-lander (the apprentice's mulligan policy) or the apprentice's temperature putting "pass" over "play a land" on turn one. Measure, don't guess: over 1,000 apprentice openings with a land in hand, the rate of a turn-one land drop (should be ~100% — a land drop is never the wrong play on turn one with nothing else to do); and the apprentice's keep rate on zero- and one-land sevens. If the temperature is the cause, a land drop with no competing play should be gated out of the softmax at every profile (a pin, a ladder run); if the mulligan policy keeps no-landers, say so and the planner rules.

## Part 4 — Handoff
The offsets' registry rows, the baseline file, Part 3's numbers and fix (if any), deviations, concerns. Then the arc closes: the planner's next brief is phase two.
