# Session 58 brief — closing the revision round

*Planner → Implementer. 2026-10-08. Follows the running handoff.md (after S57 and the post-S57 work). A small session. Process rules unchanged: appends to `docs/decision-updates/s58.md`; a swap is measured against the table of record (pilot 111, `rr16_s57b`) unless a new pilot ships first.*

## Part 0 — Rulings and ADR appends
- **S57 Deviations 1–9 and the post-S57 work ratified** (the Undertow's second revision; the Larder archived; the Cinder as the sixth contributed list; the four fixes from play).
- **ADR-168 — The revision bar, re-read.** A swap is adopted when its point estimate is at least +2 against the field and its 95% lower bound is positive, with no defining matchup lost and the list's identity kept; a pair tested together is one trial; for a list near a threshold the bar is read on the final table. The strict reading (the lower bound ≥ 2) is withdrawn.
- **Adopted under ADR-168**: the Tally −2 Blaze +2 Control Magic; the Enchantress a fourth Pacifism (for a Giant Growth); the Pall Barren Moor → Swamp. Not adopted: the Locks' two Islands.
- **ADR-169 — The lists live in code.** `open-contributed.json` and `sim/open-lists.ts` are the source of truth; `docs/reference/open-lists.md` is generated from them by `open:gen` (every list, its revisions by session, its fifteen, its plan, its mean on the table of record) and sync-tested, as `enemies.md` is. The planner's lists document is retired to history.
- **ADR-170 — Staples are watched, not capped.** Flametongue Kavu and Control Magic are in five lists each and in every adopted revision; part of that is the format's, part the pilot's (cards that need no judgment rate highest in the AI's hands). No cap. The next revision round excludes them from trials; a card in more than half the field is named in the round-robin's report.
- **The Undertow** keeps its name and takes the title *Dimir Mill (U B)*; Zinnia's note moves to the list's history.
- **The Larder's archive stands**; its plan stays as the vocabulary's second customer. The mana wall (a four-mana start in four colours; the Pall's twenty lands) is recorded as a list question for a later round, not a pilot one.

## Part 1 — Registered fifteens
- **The Locks** (the planner's): 3 Essence Scatter · 2 Protocol · 2 Serra Angel · 2 Duress · 2 Tormod's Crypt · 2 Faerie Macabre · 2 Disenchant. The in/out pairs the rules read: Scatters in for Absorbs against creature decks (not the reverse); Protocol in for a Wrath against a list with few, large creatures; the Serras in for two counters against another control deck (a win condition the Locks lack post-board); Duress in against a plan or a counter deck; the hate in against a graveyard list (the walls out first — S56's rule); Disenchant in against Static Sphere, Bitterblossom, the Sphere's cousins. Measure with `--sideboarded-one` against the Locks' current −6.9.
- **The Sweep** (Chris's — owed; the slot stays open).

## Part 2 — The Cinder diff (a probe of the human's play; ADR-167)
From `docs/debug_logs/convocation-8-0-red.json`: replay each of Chris's games to every decision the human made, hand the position to the pilot, and record where the pilot's choice differs — the kind of decision (attack/hold, face/creature, which burn, which land), the turn, and the game's outcome from there if the pilot's line is played out (a short playout from the divergence). Report the divergences by kind and the three commonest; no rule written (the probe first). The Cinder's own list stays as contributed.

## Part 3 — Smalls
- The round-robin's report names any card in more than half the field (ADR-170).
- `open:gen` writes `docs/reference/open-lists.md` (ADR-169); the three adopted swaps in; the table of record re-run once (sixteen lists) as the baseline the next round reads.
- The retire count continues from this table (the Cinder, and three lists level at 41).

## Handoff
The Locks' fifteen measured; the Cinder diff's report; the reference doc; the new table; deviations, concerns — and the implementer's read for S59, **the campaign linkage** as it would be built (the S54 design: the outbox, the invitation, fence (a), the prize table), since the Convocation has reached maintenance.
