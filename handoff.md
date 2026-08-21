# Handoff — after Session 10 (2026-08-20)

## State of the world

M5's core is delivered: `pnpm viewer` → **/play** runs complete human-vs-AI matches in the browser — setup screen (decks, difficulty, seat, seed) → live play with ADR-058 interaction (auto-pass, per-step stops, hold-priority, click-to-cast with enumerator-lit targets, Arena-style combat staging, card-rendered dialogs, zone browsers) → concession/end screen with stats → watch-replay straight into the viewer. The engine is untouched except nothing: the only new seam is HumanAgent (a promise bridge in `agents`), and the no-peeking suite now guards it live. The interaction brain (MatchController) is React-free, and the automated acceptance test drives full games through the exact click path, both seats, plus concession. 152 tests green; default tier 11.2s; **FUZZ_FULL exits zero** (S9 concern 5 root-caused and fixed). What remains of DoD 1 is its human half: Chris's precon match vs journeyman.

## Done this session

- **Part 0.1–0.2 (plumbing):** `HumanAgent` in `agents` — engine awaits `chooseAction`, UI answers via `submit` (validated against the pending request's actions, so no hand-rolled action can reach the engine); `DelayedAgent` pacing wrapper. Browser match runner: `MatchController` constructs the live `Game` (mirroring `runMatch`), seats human 0 or 1, builds the AI from `difficultyProfile` + `DECK_ARCHETYPES` (moved browser-safe into `slice-decks`), random seed generated and displayed when unset, log accumulates as in sim → `savedGame()` feeds the viewer and download. No-peeking extended: a live HumanAgent match asserts every forwarded view carries exactly the redacted GameView shape.
- **Part 0.3:** FUZZ_FULL exit code fixed at the root — the 90s+ fuzz/ladder loops are pure microtasks and starved the event loop until vitest's worker RPC timed out; periodic macrotask yields (every 25 games) in `fuzzPairing`/`runLadder` cure it. `FUZZ_FULL=1 pnpm test` → exit 0, zero unhandled errors.
- **Part 1 (priority & flow):** auto-pass exactly per ADR-058 (no cast/activation/land enumerated → pass silently), every DecisionRequest pauses; per-step stops in a flyout persisted to localStorage; hold-priority checkbox on the cast confirm; turn/step ribbon with your-turn cue and seed; "Opponent is thinking…" with configurable AI delay (default 400ms, in the stops flyout).
- **Part 2 (actions):** click hand card → X dialog (enumerated values) → targets lit from the surviving variants (illegal dims; players targetable via their rail panels) → Confirm/Cancel; lands play on click (single-action, documented); battlefield click → activation (ability variants); combat per ADR-058 — click-to-stage attackers, blocker-then-attacker pairing with staged/pending marks, all staging UI-local until Confirm streams the incremental declarations + done (menace second-blocker fallback handled: if the engine withholds done, staging re-opens with a prompt); dialogs for mulligan/bottoming/discard/sacrifice/legend/trigger-order/damage-order/optional/trigger-targets, card-rendered with single Confirm, revealed cards (Duress) shown from the request payload; graveyard/exile browsers for both seats from the rail zone counts.
- **Part 3 (match shell):** setup (deck pickers, apprentice/journeyman/master, seat, optional seed), concede-with-confirm, end screen (result, MatchFacts table incl. per-spell casts, watch replay / rematch same seed / new match / download log).
- **DoD 1 (automated half):** `match-controller.test.ts` — a scripted human drives the controller's event path (the same methods the clicks call) through complete games vs journeyman from both seats, asserts the human seat actually played lands/spells through that path, the saved game is `shandalar-log-v1`, and `replayToDecision` reconstructs it mid-game; plus a concession test (CONCEDE result, AI wins).
- Browser-verified end to end at seed 42 (A vs journeyman-D): mulligan dialog, land click, **Shock with player targeting + confirm + hold-priority checkbox**, equipment cast (straight to confirm), auto-pass pacing, **block pairing with staged/pending marks** (Piker trades with Child of Night), graveyard browser, concede confirm, end screen stats, watch-replay opening the viewer at decision 1/144.

## Deviations from the brief

1. **Lands play on a single click, no Confirm** — ADR-058's Confirm/Cancel is specified for casting; a land is one action and the confirm felt like pure friction. Flag if the committed-actions-are-final principle wants the confirm anyway.
2. **The "scratch state" validation of ADR-058's combat staging is implemented as enumerated-set validation instead**: each staged declaration must be in the engine's currently offered actions, and confirms stream through the real incremental protocol (which re-validates every step). A separate scratch-state copy would duplicate what the enumerator already guarantees; nothing is re-derived in the UI either way. Menace's pair requirement surfaces exactly as the engine expresses it (done withheld → staging re-opens with a "needs a second blocker" prompt).
3. **Concede drains the in-flight decision with first-choice actions** after setting the CONCEDE result, so the engine unwinds at its own loop boundary (the engine has no concede action, and adding one is an engine change). Consequence: a conceded game's log may carry a couple of trailing auto-actions — visible only if you replay a conceded game past the concession point.
4. **The headless acceptance drives the controller API, not the DOM** — the controller is deliberately the entire interaction brain (React components call the same methods), so "the UI event path" is tested one layer below pixels. The DOM layer was verified by hand in the browser walkthrough above.

## Concerns

1. **Auto-pass's biggest annoyance is Blaze (X=0)** — an X spell castable at X=0 makes *every* priority window "meaningful," so a red player holding Blaze gets prompted at each step of every turn. Same shape: an equatable equipment with mana up. Candidate fixes for the planner: (a) treat casts whose only enumerated variant is X=0 as non-meaningful; (b) an explicit "to my next turn" fast-forward button; (c) Arena-style full-control toggle. I'd take (a) + (b). This is the brief's "where auto-pass felt wrong" — the rest of the pacing felt right in play.
2. **R-029's hand dedup shows in the UI**: with two Mountains in hand, only one carries the playLand action, so only one glows. Correct engine behavior, mildly confusing presentation — the UI could light all copies of a castable cardId and submit the enumerated one. Small follow-up.
3. **No DecisionRequest payload was insufficient** for a decent dialog (the S8 ADR-048 `source` addition covers trigger targets; `revealed` covers Duress). The cosmetic gaps are UI-side: the ribbon reads "Turn 0 · Cleanup" during mulligans (state pre-first-turn), and the AI's staged attacks are visible only once declarations commit (fine at 400ms pacing).
4. **AI delay default:** 400ms felt right for following the opponent's turns in my walkthrough; needs Chris's verdict after his match (DoD's open question). It's live-tunable in the stops flyout.
5. **The play screen reads the full GameState for rendering** (same as the viewer): redaction is enforced at the agent seam (the no-peeking suite guards it), and the UI renders opponent hands as backs — but the data is in browser memory by construction of a local engine. Worth stating in an ADR someday if hidden-information integrity vs. a local engine ever matters (it can't be otherwise without a server).

## Registry entries added/changed

None — no rules, no cards. (HumanAgent is an agent, not a rules surface; ADR-058 is the spec of record.)

## Test status

Default tier: **150 passing / 2 tier-skipped, 11.2s** (adds the 2 play-mode acceptance tests). FUZZ_FULL: **152 passing, exit 0, zero unhandled errors, ~98s** — the S9 concern 5 exit-code fix is verified. Typecheck (root + ui) clean. No agent behavior changed: no ladder re-runs needed (S9's 1,000/cell gates stand).

## Suggested next

**Chris plays** — DoD 1's human half, and his verdicts feed the queued knobs: auto-pass fixes (Concern 1), stop defaults, AI delay, land-confirm. After that, per the roadmap: **M6 (overworld manifest + first slice)** — the engine-facing stack is complete: engine → agents with difficulty dials → playable UI → replay. Alternatively a polish pass (Concern 1's fast-forward + 2's dedup lighting) is a half-session if the first plays surface friction.

## How to run

```
pnpm viewer                 # open the printed URL → "Play a match" (or /play)
pnpm test                   # default tier, 11.2s (incl. play-mode acceptance)
FUZZ_FULL=1 pnpm test       # full tier, ~98s, exits 0
pnpm gallery / pnpm ladder  # unchanged
```
