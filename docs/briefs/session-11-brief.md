# Session 11 Brief — M4c: deterrence, posture, master search + M5 polish

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions.md` ADR-059..060 (the spec), ADR-049/050/056/057. Discipline unchanged from S9: every strength change carries a before/after ladder delta; zero-delta reverts unless labeled correctness/watchability.

## Goal

Close the human-relative gap the playtest exposed, without breaking the measured floor: deterrence in the evaluator, E's posture switch, a searched master profile — plus the ratified M5 polish. Gates (ADR-049 amended) re-verified at the end; the new human-facing bar is informal but real: Chris should have to work for a win.

## Part 0 — M5 polish (ratified riders; do first, they're quick)

1. Auto-pass: X=0-only casts non-meaningful; "fast-forward to my next turn" button (cancels on any DecisionRequest or on any opponent action that targets you or your permanents — never skips a Duress).
2. Ribbon reads "Mulligans" pre-game instead of "Turn 0 · Cleanup".
3. ADR-058's staging wording is amended per ADR-059 (docs only, one line, verify per principle 11).

## Part 1 — Deterrence (ADR-060.1)

A defensive-posture term in `evaluate`: each untapped own creature able to block credits deterrence = f(what it trades with among the opponent's likely attackers — deathtouch trades with anything; high toughness walls small boards; 0 when the opponent has no creatures). The attack sim naturally debits it when a creature leaves defense to attack — that asymmetry is the fix. Book of shame +1: a deathtouch 1/1 facing a bigger board scores holding > attacking-to-die-for-nothing. Ladder deltas at 200/cell mirrors per constant choice; keep it simple (one f, two or three constants).

## Part 2 — E posture switch (ADR-060.2)

`holdTricks` conditioned on board-value delta (behind → develop, ahead/even → hold), the approved input shape. Target: E seat1 mirror into the band (~65). Report deltas; stop at budget honestly.

## Part 3 — Master search (ADR-060.3)

`pnpm weight-search`: automated ladder search (coordinate descent or CEM — implementer's choice, documented) over a declared set of evaluator constants (keyword bonuses, hand/life weights, deterrence constants), objective = mirror win rate vs journeyman at fixed games/cell, seeds held out between search and verification. The found vector becomes `master`'s weights (journeyman keeps hand-tuned defaults). Escalate to 2-ply-on-high-stakes only if search plateaus < +8% overall vs journeyman. Guard: master must not regress vs sane/random rungs.

## Part 4 — Verification

Full gates at 1,000/cell (mirror + baseline floor) for the final configuration; profile ladder re-run (apprentice < journeyman < master, monotone, master's edge reported); book of shame green (now 7); `pnpm agent-stats` sanity. Tables in the handoff.

## Definition of done

1. Parts 0–4; gates PASS; every change's delta reported (including reverts).
2. Master vs journeyman ≥ +8% overall mirrors, or the honest plateau report + your 2-ply recommendation.
3. All tests green both tiers; exit 0.
4. `handoff.md`; Concerns expected: whether deterrence changed *human-visible* play (describe a before/after game moment, not just numbers), what the weight search found surprising (constants that moved far from intuition), and your ranked list of remaining AI tells for playtest 2.

## Out of scope

New cards (the tutor batch is queued separately), overworld, UI beyond Part 0, opponent hand inference, full multi-ply search.

## Escalate, don't decide

Any evaluator input beyond ADR-060's approved shapes; any gate change; 2-ply beyond the high-stakes escalation clause.
