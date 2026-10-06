# Session 56 brief — the pilot before the lists

*Planner → Implementer. 2026-10-06. Follows the running handoff.md (after S55 and the studies that followed it). One session, all AI and infrastructure; the decklist revision is S57 and is measured on this session's pilot. Process rules unchanged: appends to `docs/decision-updates/s56.md`; every AI change carries a ladder delta or reverts, **and** — per S55 Concern 6 — is measured on the matchups it is for before it ships.*

## Part 0 — Rulings and ADR appends
- **S55 Deviations 1–10 and the post-S55 studies ratified**: the loop draw as an engine rule field with the optional-action exception noted (R-103); book 100 for any looping legend; the Witch's test by in-place swap; the Pall's own fifteen; book 107 measured and left off (the shipped rule stands); the Kiln tuned and registered; the fourth sideboarding rule at eight graveyard cards.
- **ADR-163 — The Pall stands; the Usher mirror is the format's answer.** The Coin beats the Pall in matches (59–41) because whoever lands the first Usher wins and Buried Alive arms both players. No restriction (ADR-160 holds); the human read against a boarding field is still owed.
- **ADR-164 — Archive.** A list may carry `archived: true`: kept in the data, its plan and its history; out of the field, the round-robin and the retire count. The retire rule's exit (three reviews → a rescue attempt → archive). **The Loop is archived** (redundant with the Coin: 31 of 37 nonland cards, r = 0.88, worse against eleven of twelve).
- **ADR-165 — The reviews' rulings**: the Larder gets a plan (S57 — the second combo list and the vocabulary's test); the Locks an overhaul in family *after* the counter rule; the Undertow one overhaul attempt, archived if it does not reach 38.
- **The hate cards stay in campaign shops** (tier 2): real cards with campaign uses; the campaign AI never mains them.
- **The sequence**: AI first, lists second — tuning a control list to a pilot that casts three counters in twelve is the S30 lesson.

## Part 1 — The counter rule
The AI under-casts counterspells (the Locks three of twelve a game; the Kiln 0.8 of four). Design, measured before shipping: **held mana is spent on the turn's best spell at the opponent's end step** when no counter target arrived and the hand holds a castable spell worth more than the counter's option value for the coming turn; and a counter is cast on an opponent's spell when the spell's worth to them exceeds the counter's value held (the plan-aware gate from book 104 stays absolute for plan cards). Measure: counters cast per game for the Locks, the Kiln and the Undertow; their round-robin rows paired by seed (`open:rr --vs` with the old pilot); the ladder gate.

## Part 2 — Broader sideboarding
Four shapes added to `sideboard-ai.ts`, each keyed on the opponent's registered list (and its plan), each with a slot the field's builder reserves: **a sweeper against a wide board** (fifteen or more creatures of power ≤ 2 → Pyroclasm, Savage Twister, Wrath); **a creature counter against a creature deck** (twenty or more creatures → Essence Scatter in, Counterspell out — not the reverse); **Control Magic as an answer** (a list with three or more creatures rated 2.5+ → Control Magic in); **creatures as answers** (a flier-heavy list → reach and flying blockers in; an aggro list → Wall of Air, Wall of Blossoms, Tidewall in). The existing rules keep their order; the graveyard rule stays at eight. Measure: each list's sideboarded sixty against the field, paired, as S54's (+2.1 on average then); the Kiln's hand-tested plans (37 → 65 against the Pall) as the check that the rules now reach what a person would do.

## Part 3 — Dig harder
The Witch draws 1.55 a game and never in 58% of games. The dig rule (book 102) digs to a floor over the opponent's power; the floor is too high early. Design: dig while the plan is unassembled down to a floor of *half* the opponent's board power plus the draw's expected value, and always on our turn when the plan's start is one card away. Measure: Witch draws per game; the loop's turn (median 6 today; a person's 2–3); the Pall's game-one rate — then **the Witch at four against one** re-measured (the number ADR-160 names).

## Part 4 — The archive flag and the Loop
`archived` on the list data; `open:gen` and the field respect it; the Loop archived; the seventeen-list (sixteen active) round-robin re-run once on the new pilot as the strength table of record (S55 Concern 12) and the retire count's next measure.

## Part 5 — Measure
The ladder gate; the three rules' paired reads; the round-robin; `convocation-sim --events 8` once (does the Umbel still find the strong seats — r was −0.50 on the list draw).

## Handoff
The three rules and their numbers; the archive; the round-robin of record; deviations, concerns — and, for S57, the implementer's list of the swap trials that are cheapest to run (the planner brings the swaps).
