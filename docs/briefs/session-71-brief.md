# Session 71 brief — the consequence model

*Planner → Implementer. 2026-11-02. Follows the running handoff.md (after S70 and its post-session work). One session and a half: the pilot's consequence model is the session; the prize flow and two rulings are its small parts. Process rules unchanged: appends to `docs/decision-updates/s71.md`; probe before rule (ADR-167); every rule measured on the lists it is for and ladder-gated; push only when Chris asks.*

## Part 0 — Rulings and ADR appends
- **S70 and its post-session work ratified**: the five grounds as named and tuned (Hearthspire at 2; Nightbower at {X}{B}{G}; Burnfallow as card (b), the ping as a study def); R-118–R-122; books 152–160; the five tier-2 creatures; Highland Ritual; the Pinnacle (the fourth Kavu by trial; its name); WB Basilisk registered knowingly; Sealed days; the tap-for-mana toggle; the Angel's plainscycling fixed.
- **ADR-193 — Balance and Wheel of Fortune are restricted in the Open** (one copy), as in Vintage and for Vintage's reasons; the triads inherit where castable. Valakut unrestricted. The Open's restricted list grows for the second time (the five grounds were the first).
- **ADR-194 — The prize flow**: the full Convocation's champion chooses one High Ground of the ten; the short Convocation's champion one of the five still-pair grounds; Hard pays the choice of a second. A prize passes the fence (a kept card never does); each ground at most once per journey. One row in the prize table, one line in the fence, the choice on the finish screen; the outbox already carries cards. Built this session.
- **WB Basilisk** reads as a low seat by the list draw (no change); it is the first ADR-191 probe (Part 1).
- **Owed and scheduled**: Volmaw's and Ranksmere's triad reads (Part 3); Cloudshift and the archetype slots (S72 with Chris's candidates).

## Part 1 — The probes (ADR-191: the lists far below their authors)
`pilot-probe --consequences`: for each of WB Basilisk (11–3 vs 29.5), Temur Control (16–2 vs 53.9), Sour Worms (8–0 vs 58.0), BW Massacrats (8–0 vs 49.0) and the Pinnacle's lost pairings (Mardu Control 37, the Rabble 35): every decision where the human's and the pilot's lines diverge *and* a trigger, a sacrifice, a token or a death payoff fired within two turns — what the pilot's predictor valued the play at, what actually happened. Group by the shape of the thing the predictor did not see. The report is the session's first deliverable; the rules follow it.

## Part 2 — The model (rules by shape; each measured, each ladder-gated)
The predictor (`view-sim`) today sees a shrink's drains (book 151). Extend it, shape by shape, in the order the probe ranks them — the planner's expectation:
- **Death payoffs of every kind** (`deathpayoffs`): a DIES trigger that deals damage, makes a token, draws, or returns a card — both sides, the dying creature included — priced into every kill, block, sacrifice and sweep.
- **Sacrifice outlets** (`sacvalue`): the life, cards or damage an outlet's payoff moves when its fodder dies (Altar, the Aristocrat, Cairnbrand's cost, a Grenade); and the opponent's outlet as a reason not to kill its fodder.
- **Tokens as consequences** (`tokenvalue`): a trigger that makes a body is priced as the body (the Captain, Seasoned Pyromancer, Emeria, the Reaper's upkeep, Dragon Fodder's two).
- **A spell's own chain** (`chainvalue`): the triggers a spell's resolution sets off (a landfall from a fetch, the Pyromancer's elemental, the Sharpshooter's ping on a token) priced into the cast.
- **The Collar's host** (`equiphost` extended): deathtouch and lifelink on a first striker that can block is the Collar's worth; untapped matters.
Measure each on the engine lists (the Massacre decks, the Usher lists, the Reaper lists, Emerald Snakes, the Watch, the Pinnacle, WB Basilisk), paired, three columns; the ladder after each; the tables of the formats whose top moved re-run.

## Part 3 — The triad reads owed
Volmaw (UB) in the Undertow (Esper, Grixis) and a Sultai mill; Ranksmere (UW) in the Aerie (Esper, Jeskai) and the Roll? (WB — no) — Bant's Skies. 160 matches a pairing, paired for a land of the pair; the activation rate. Adopt by ADR-168 where a list wants one.

## Part 4 — Measure
The probe's report; the rules' paired reads; the ladder; the tables re-run where a top moved; WB Basilisk's number after (the probe's first subject); the prize flow walked (a champion chooses a ground; the journey drains it; a second win cannot choose it again).

## Handoff
The consequence report by shape; the rules adopted and their numbers; the tables; the prize flow; the restricted list; deviations, concerns — and which of Chris's lists are still far below their records after this, since that is the next probe by ADR-191.
