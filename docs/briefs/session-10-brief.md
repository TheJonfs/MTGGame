# Session 10 Brief — M5: playable UI

Read first: `CLAUDE.md`, `handoff.md`, `docs/decisions.md` ADR-058 (the spec for this session), ADR-011/013/014 (requests, incremental declarations, silent-forced), ADR-032 (reveals), `docs/art-direction.md` §2–3. The viewer (`packages/ui`) is the substrate: same board, rail, frames; the decision panel switches to play mode.

## Goal

Chris plays complete games against the AI in the browser: match setup → play → end screen → watch replay. Everything per ADR-058. No engine rules changes; the only engine-adjacent addition is the HumanAgent adapter.

## Part 0 — Plumbing

1. **HumanAgent** in `agents`: implements the Agent interface by forwarding each DecisionRequest to the UI and awaiting its answer (promise bridge). Human seat receives the **redacted** `buildView` (the no-peeking test now guards a live seam — extend it to cover the human path).
2. **Match runner in the browser**: `runMatch` with human seat 0 (or 1), agent opponent by profile, optional seed (default: random, displayed). The game log accumulates exactly as in sim; on game end it is offered to the viewer route and downloadable.
3. **Vitest teardown noise** (S9 concern 5): config fix for the FUZZ_FULL tier so exit code is trustworthy.

## Part 1 — Priority & flow (ADR-058)

Auto-pass windows with no meaningful action; DecisionRequests always pause. Per-step stops in a small settings flyout (persist in localStorage); hold-priority modifier on cast/activate. Visible turn/step ribbon with a "you have priority" cue; a subtle "thinking" indicator while the AI seat decides (add a small artificial delay so AI turns are followable — configurable, default ~400ms per visible action).

## Part 2 — Actions

- **Casting:** click a hand card → legal targets highlight (enumerator-derived; illegal dims), X/mode dialog if applicable, cost auto-paid (ADR-004), Confirm/Cancel before submission. Activations: click battlefield permanent → ability menu if any.
- **Combat:** per ADR-058 — dim ineligible, click-to-stage attackers; click-blocker-then-attacker pairing with a drawn pairing mark in the lane; local staging validated on a scratch state; Confirm attackers / Confirm blocks / Cancel. Menace/reach/flying legality comes from the enumerator, never re-derived in UI.
- **Dialogs:** discard, sacrifice, legend keep, trigger ordering, optional triggers, damage ordering, mulligan keep + bottoming — all as modal choices with single Confirm, rendered as card choices (not text lists) wherever the choice is over cards.
- **Zones (ADR-058):** graveyard/exile browsers for both seats from the rail icons; revealed-hand modal from request payloads (Duress path).

## Part 3 — Match shell

Setup screen (deck pickers over the five decks + tokens shown via gallery components, profile picker apprentice/journeyman/master, seat choice, seed field), concession (with confirm), end screen (result, key stats from MatchResult.facts, "watch replay", "rematch same seed", "new match").

## Definition of done

1. **The acceptance test:** Chris plays a precon match vs journeyman to completion — mulligan, casts with targets, combat both directions, at least one instant-speed response via a stop or hold-priority, zone browsing, and a clean end screen. (Automated: a scripted HumanAgent driving the UI event path through a full short game in a headless test.)
2. No-peeking extended to the human seam; all prior tests green; default tier ≤ ~15s.
3. FUZZ_FULL exits zero (Part 0.3).
4. `handoff.md`; Concerns expected: where auto-pass felt wrong in real play (candidate stop defaults), any DecisionRequest whose payload was insufficient to render a good dialog (ActionRequest growth candidates, cf. S8 concern 5), and what the AI-delay default should be after Chris plays.

## Out of scope

Animations beyond simple transitions; sound; mobile; information-leak cosmetic pauses; overworld; any engine rules change; new cards; M4c.

## Escalate, don't decide

Any engine change beyond the HumanAgent seam; any new ActionRequest field (report the gap, render a plainer dialog); any deviation from ADR-058's committed-actions-are-final rule.
