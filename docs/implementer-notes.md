# Implementer Notes

Practical notes for future implementer sessions. Owned by the implementer; append freely.

## Running things

- `pnpm install` once; Node ≥22 (Chris's machine: Node 26, pnpm 11).
- `pnpm test` — full suite including the 1,000-game fuzz test (~6s total).
- `pnpm typecheck` — strict tsc over every package (no emit).
- `pnpm fuzz --games 1000 --seed 1` — fuzzer CLI; prints terminations, mean turns, and any error with its seed for reproduction.
- Run pnpm scripts from the repo root; the vitest include globs are root-relative.

## How the monorepo is wired

- "Internal packages" pattern: each package's `exports` points at `src/index.ts`. No build step; vitest and tsx execute TS directly, and one root `tsc -p tsconfig.json` typechecks everything. A dist build only becomes necessary when the UI milestone needs bundling.
- Dependency direction is enforced by package.json deps only (`ui → agents/sim → engine → cards → core`). tsc will happily typecheck a backward import if you write one — don't.

## Architecture seams that matter

- **EffectContext** (`packages/cards/src/resolvers.ts`) is the vocabulary/engine seam. Resolvers live in `cards` and never see engine internals; `engine/src/effect-context.ts` implements the interface. Adding a vocabulary word = type + validator row + resolver + (maybe) a new EffectContext op.
- **Agent interface lives in `engine`** (`agent.ts`), not `agents` — engine calls it, and `agents` depends on `engine`. Every decision (priority, declarations, mulligan, discard, trigger targets) is a pick-one-action request, so every decision is a loggable, replayable Action.
- **Statics are computed live; resolved effects are stored.** `characteristics()` scans battlefield statics each call (Pacifism, future anthems) and merges `state.continuousEffects` (pump). Nothing about restrictions is ever stored on the object.
- **Replay feeds the log back**: ReplayRng returns logged RNG draws (asserting purpose/shape), a replay ActionSource returns logged ACTIONs (asserting the requesting player). Agent-internal randomness must NEVER go through the game's logged RNG — RandomAgent has a private PRNG for exactly this reason.

## Determinism gotchas (learned or designed around)

- Decisions with exactly one option are not requested and not logged (lone `pass`, forced empty attack declaration, single-candidate trigger targets). This is safe because it's state-derived and identical in replay — but it means "number of ACTION entries" ≠ "number of decision points."
- `Record` key order matters for byte-identical serialization only until `stableStringify` sorts keys — always compare via `stableStringify`, never raw JSON.
- Object ids are sequential per game (`obj_N`, `stk_N`); replay reproduces them because creation order is deterministic.

## Testing

- Scenario fixtures are JSON under `packages/engine/test/fixtures/`, interpreted by `test/harness.ts` (board state → script → run phases); assertions stay in the vitest cases. The script matcher consumes entries strictly in order, defaulting to pass/first-option, so fixtures read like a transcript of the interesting line of play.
- The harness clears `pendingTriggers` after setup: fixtures describe a standing board, so setup-time ETBs must not fire.
- Synthetic test-only cards (`test_fs_soldier`, `test_pinger`) live in the harness, validated through the normal validator. The slice pool has no first striker or non-mana activated ability; these keep those paths tested.

## Decision protocol (post-S2)

Every choice reaches agents as a request with an enumerated action list; single-option requests are auto-taken and unlogged (ADR-014). Multi-step choices are incremental: attack/block declarations (declare-one/done, ADR-013), blocker damage order (pick-next per multi-blocked attacker), trigger order (pick which goes on the stack next — first placed resolves LAST), mulligan bottoming (pick-per-card). When adding a new choice type: add the Action variant, a RequestPurpose, enumerate in order [safe-default-first, ...], and the harness gets a script-entry kind. The default-first convention matters — scripted fixtures and the "forced choice" auto-take both rely on actions[0] being the no-op/finish option.

Combat staging: declarations accumulate in `state.combat` uncommitted, then `commitAttackers`/`commitBlockers` applies taps/flags all at once — CR's "declared together" semantics with incremental input.

## S3 lessons

- **Run the fuzzer the moment new cards enter the decks, before writing fixtures.** It found the Mind Stone canPay bug (a {T}-cost ability counting its own source as a producer) in 300 games; no planned fixture would have. Cost-feasibility bugs live in fuzz territory, not fixture territory.
- **Scripted fixtures bind at the first legal moment.** The Siege-Gang fixture's "activate" matched in the priority window after the commander resolved but before its ETB trigger did — a legal line where the only sacrifice was the commander itself. If a script step depends on a trigger having resolved, put the prerequisite on the battlefield in setup instead of casting it in-script.
- **Attachment is a field mutation, not a zone move.** Equip resolution and re-equip just set `attachedTo`; no ZONE_CHANGE fires. If a card ever triggers on "becomes attached", that needs a new event (noted in handoff).
- Sacrifice-as-cost flows through `moveObject` during `applyPriorityAction` (now async); the DIES trigger pends and is placed *above* the paid-for ability at the next priority check — resolves first, which is CR-correct.

## S4 lessons

- **The fuzz-before-fixtures protocol worked as designed**: 1,800-game smoke came back clean before any fixture existed, so all fixture failures this session were fixture bugs, not engine bugs (Nekrataal needed two candidates to produce a request; a bare 1/1 double striker deals 2 not 6; Nighthawk flies — the brief's fixture 12 forgot).
- **Hand reveal is request-payload, not view mutation** (ADR-029): the Duress chooser gets `revealed` on the DecisionRequest; `GameView` redaction is untouched. A UI shows the reveal from the request. Replay is unaffected (the choice is a logged action).
- **LKI snapshots** live in `makeEffectContext`: captured once at resolution start for all object targets (power + controller). If a future card needs LKI of something other than a target, extend the snapshot, not the resolvers.
- **Damage-event trigger collection scans the battlefield** per DAMAGE event (engine-design §4 finally exercised). Condition evaluation lives in `wireTriggerCollection`; adding a condition field = one clause there + validator row.

## S5 lessons

- **Control is synced, not computed per-read.** `syncControl` (control.ts) writes effective control back to `obj.controller` at the top of every SBA pass, so the hundreds of existing `obj.controller` reads stayed untouched. `baseController` is what statics override — test-only steals must set BOTH fields (see S2 fixture 12's update).
- **The legend rule made `runSBAs` async** (requester param, optional). Callers without legendaries can still call it un-awaited safely — the body is synchronous until the first legend request — but new code should `await` it.
- **DIES/LTB trigger sourceId is now the graveyard object's id** (the card's current identity), not the stale battlefield id. That's what lets Rancor return *itself* via scope `self`. If you need the battlefield-time identity in a future trigger, it's `ev.oldId` in the ZONE_CHANGE payload.
- **Scope `self` resolves "wherever the source now is"** — battlefield (Drana) or graveyard (Rancor). It is not a target and gets no legality re-check.
- Suite structure per ADR-034: `pnpm test` = 100/pairing smoke (~13s); `FUZZ_FULL=1 pnpm test` = 500/pairing (~56s); handoff numbers from `pnpm fuzz --games 1000`.

## S6 lessons (viewer, art, fetch)

- **Registry edits must be verified**: my S5 close-out used `str.replace` with a stale source string and silently no-opped R-025 (the planner caught it). Every scripted doc edit now asserts the replacement landed. Check your replaces.
- **The viewer re-implements zero rules.** `replayToDecision(log, k)` reconstructs state AND the DecisionRequest for decision k — the enumerated alternatives ADR-014 deliberately doesn't log. Perf on a 761-decision game: ~3ms early indices, ~40ms late ones, cached per index; no optimization warranted yet.
- **Browser/Node split**: `@shandalar/cards` is browser-safe; the fs-bound loader moved to the `@shandalar/cards/loader` subpath export. The UI bundles card JSON via `import.meta.glob` and reads gitignored Scryfall art through a dev-server middleware (`/real-art/*`); `/__flag` POSTs write `fixtures-inbox/` entries.
- **Render-skill realities**: Gemini returns JPEG bytes that the skill names `.png` (browsers sniff; harmless, noted in MANIFEST). The house style's "generous unpainted paper" fights edge-to-edge textures — crop the saturated center band for tiles. Icon PNGs composite over parchment with `mix-blend-mode: multiply`; traced SVGs (potrace, now a brew dep) are the first-class form.
- Scryfall etiquette implemented per their docs: UA header, 150ms spacing, local cache, `unique=prints&order=released&dir=asc` + first `highres_scan` = the classic printings.

## Cold-start orientation (written at the S6→S7 session boundary)

Things a fresh session might otherwise rediscover slowly:

- **Seat conventions**: engine player 0 is always the first PlayerSpec; the viewer renders player 0 at the bottom as "You". In `pnpm play-random --decks B,D`, B is seat 0. The bundled `packages/ui/public/sample-game.json` is B(0) vs D(1), seed 4242.
- **Tooling acquired along the way**: `potrace`/`mkbitmap` (brew) for icon tracing; headless Chrome was used ad hoc for icon contact sheets (`/tmp/trace/sheet.html` pattern); `GEMINI_API_KEY` lives in the gitignored `.env`; `.claude/settings.json` pre-allows the render script.
- **The render skill conditions re-renders on the old canonical** — when *changing* a subject on purpose, pass `--force` to skip conditioning, or the old look reasserts itself (S6 surface lesson).
- **Verification track record, for motivation**: principle 9 (Scryfall) caught 2 planner card errors in S2 and 1 uncastable card in S3's brief; principle 10 (CR citations) caught rules errors in S3 and S4 briefs; the S6 brief's registry-staleness warning caught my own silent no-op edit. Run the checks even when they feel ceremonial — every session where they existed, they fired.
- **Session rhythm that has worked**: read protocol docs → apply planner appends verbatim (verify!) → Scryfall-verify any card batch → implement → **fuzz before fixtures** → fixtures → registries with asserted edits → handoff with Concerns as the centerpiece → commit and push. Deviations from briefs are fine when grounded; log every one.

## S7 lessons (sane agent, gallery, riders)

- **GameView is thinner than policy wants.** Two rule-5/rule-1 inputs aren't in the view: mulligan count (London always shows 7 cards) and combat state (who's attacking/blocked). SanePolicyAgent carries per-instance memory for both (`mulligansTaken`, `blockedAttackers` keyed by `view.turn`). The turn-key matters: single-option requests are auto-taken (ADR-014), so "reset on next non-block request" can silently span turns. If M4 wants pure functions, the view needs `mulligans` and `combat` fields — escalated in the S7 handoff.
- **The enumerator does the legality heavy lifting for policies.** Casts are only enumerated when affordable (auto-pay), block pairs only when legal, and "done" is withheld while a menace attacker has exactly one staged blocker. A policy can therefore be a pure filter — the one obligation is: when `doneDeclaringBlockers` is absent you owe a second menace blocker.
- **Sane games are ~2× shorter than random** (mean 15–26 vs 33–49 turns) and DECKED terminations nearly vanish; big-spell casts roughly double. Numbers: `pnpm agent-stats` (1,000 games/pairing, ~4 min).
- **Icon tracing at S7**: paper specks inflate potrace's `--tight` bbox and off-center the glyph — bump `-t` (turd size) way up for solid glyphs (1500 worked; the glyph areas are ~40k). qlmanage renders SVGs at their declared width/height; scale a copy up for visual QA.
- **Gallery data paths**: pool registry served raw by `/__registry` and parsed client-side (registry stays the source of truth); deck membership via the browser-safe `@shandalar/sim/decks` subpath (the sim root export pulls node:fs — same split as `@shandalar/cards/loader`); art notes append through `/__art-note` (same pattern as `/__flag`).
- **Feedback round addenda**: rule 8 (target-side preference) classifies effects harmful/helpful over the vocabulary — but `chooseTriggerTargets` fires *before* the stack item exists, so trigger targets are unclassifiable from (view, request); escalated. Scryfall `art_crop`s for classic printings are ~5:4 (563×451) — the frame's art window uses `aspect-ratio: 5/4` so nothing crops. Mana chips are em-sized and force `color: var(--ink)` (a light-text name strip otherwise makes chip numerals parchment-on-parchment). Token art: custom defs use `art.asset` (first live use); UI serves it from `packages/ui/public/custom-art/`.

## S8 lessons (M4a: view, evaluator, ladder, first custom card)

- **The book of shame earns its keep immediately**: three of its five entries failed on first run against the freshly written policy (self-steal scored positive because a mis-aimed aura still claimed board material; self-face burn was cheaper than losing a creature at aggro's life weight; no-benefit taps scored exactly equal to passing). Score-ordering tests over the evaluator catch what win rates hide.
- **One evaluator gap can be worth 25 points**: modeling targeted `modifyPT` lethality (Drana) took the D mirror from 46% to 72%. When a deck underperforms in its mirror, look for a card whose effect the view-sim treats as a flat constant.
- **Deck imbalance dominates agent skill in pairing cells**: sane-vs-sane baselines run 1–37% for the weak side of several pairings, so "beat sane in every pairing cell" is unreachable for any agent. Mirror cells (same deck both sides) isolate skill; the ladder reports both and carries two gates.
- **combat-sim's synthetic-def trick**: give each sim object a one-off def whose printed stats equal the view's live characteristics — the engine's own `characteristics()` then reproduces exactly what players see, and the real assignment/dealing/SBA code runs unmodified on the throwaway state.
- **Fixture JSONs consume scripts head-first** — a script entry only matches when it's at the head AND its player/purpose matches, so interleaving multi-player combat scripts (attack → block → activate) works by ordering entries in game order.
- **Custom-card validation ripples**: `text` required-iff-custom broke the five synthetic harness cards and a loader test's base card — grep for `source: "custom"` outside data/cards when changing card-level validation.

## S9 lessons (M4b tuning)

- **Wall-clock timings lie across laptop sleep.** A "293-second pathological game" and a ">600s stalled ladder" were both one sleep interval; the same seed replayed in 58ms. Before diagnosing perf regressions from wall time, re-run the exact seed — determinism makes reproduction free.
- **Tune by control experiment, not by stacking**: the counter-hold rewrite was verified by running the same cells with the bonus forced to 0 (worth +4.5 on B mirrors, +1.75 on E). An env-flag kill-switch on the term being tuned costs one line and buys a real measurement.
- **Archetype assignment is a tuning knob, not a label**: switching deck E's profile from control to midrange was worth +4.75 mirror points — more than any modeling change tried on E. When a deck underperforms, try its posture before its features.
- **Revert no-delta changes** even when "obviously correct" (the Curiosity-credit experiment measured exactly 0.0 and came back out). The brief's "never by vibes" cuts both ways.
- **Suite tiers (ADR-055)**: default 10.8s = 50/pairing fuzz + 20/cell mirror sanity; FUZZ_FULL = 500/pairing + 100/cell ladder + 1,000-game sane smoke. The 20/cell sanity bounds are deliberately loose (25% floor) — the 1,000/cell CLI is gate authority.

## S10 lessons (M5 playable UI)

- **Put the interaction brain in a React-free class** (MatchController): every click handler calls a controller method, so the acceptance test drives literally the same event path as the UI — no DOM automation needed, and the React layer stays presentation-only.
- **The promise bridge is all a human seat needs**: HumanAgent resolves the engine's `chooseAction` await from a UI callback, and `submit` validating against the pending request's action list means the UI cannot construct an illegal action even by bug.
- **Event-loop starvation, not vitest config, was the FUZZ_FULL exit-code bug**: 90s of pure-microtask game loops never yield a macrotask turn, so the worker's RPC heartbeat times out. `await setTimeout(0)` every 25 games fixes it at the source; pool/parallelism knobs did not.
- **Auto-pass interacts badly with X=0 casts** (Blaze makes every window "meaningful") — when defining "no meaningful action", think about degenerate enumerations, not just empty ones.
- **The incremental declare protocol is UI-friendly as-is**: local staging + streaming the declarations on Confirm needs no engine support, and menace's two-blocker rule surfaces naturally as "done withheld" → re-open staging.

## S11 lessons (M4c deterrence/posture/search + playtest fixes)

- **A predictor that ignores the chosen target makes every aim score identical** — view-sim's `discard` case debited the opponent for every `who:"target"` discard, so master coin-flipped Hymn to Tourach onto its own head (Chris's playtest, seed 43). Low temperature doesn't save you from an exact tie. When adding a vocabulary word to view-sim, handle every `Who` arm; the `loseLife` case was the correct template all along.
- **The sim memo keys by turn/set/life, not board** — sound live (the board is stable across one combat's declarations), but a test reusing one agent across different constructed views gets stale scores. Fresh agent per view in score-level tests.
- **Deterrence shape matters more than its weight**: pricing a blocker's threatened trade at the opponent's GROSS loss held good attackers (Nighthawk) home and cost −1.55 mirror points; pricing the NET profit (their loss minus what our blocker gives back) let valuable attackers keep attacking and cost only −0.8 at twice the weight. When a posture term back-fires, check whether it charges the whole exchange or the profit.
- **Deltas need a second seed batch**: the posture switch measured +2.0 on its target cell at seed 1 and −1.0 at seed 7001 (200/cell); at 500/cell paired it settled at ~+1. 200/cell is a screen, not a verdict — sign-check across seeds before believing any small delta.
- **Scratch scripts belong outside the repo but must be `.mts`** (the scratchpad has no ESM package.json, so tsx treats `.ts` as CJS and top-level await dies). Absolute-path imports into the repo's `src/*.ts` resolve fine from there.

## S11 lessons (M4c + playtest rounds)

- **Held-out seeds are the only honest objective.** The weight search gained +1.7 on its own seeds and exactly 0 on held-out ones; the start vector had to be re-measured on the held-out seeds too before the "edge" could be called zero. Any future search: verify the *baseline* on the verification seeds as well as the candidate.
- **A predictor that ignores its target is an exact tie, and softmax coin-flips exact ties at any temperature** (master Hymn'd itself). When an AI does something absurd with low temperature, suspect a score tie before a weight.
- **"Couldn't block" reports: replay the log first.** The menace report was the engine being right (ADR-014 auto-took a pass-only step); the fix was narration, not rules. `replayToDecision` + a grep over ACTION purposes settles it in minutes.
- **Lone-pass windows have NO request** — a UI that wants to pause there needs the engine's cooperation. `Game.onLonePass` is an observation hook (awaited, nothing requested/logged); don't be tempted to request single-option windows instead — that changes the log.
- **`autoPay` is pool-first**, which is what makes manual tapping a pure UI feature over `tapForMana`: float what you care about, let auto-pay cover the shortfall.
- **Browser-tool coordinates are in screenshot pixels, not viewport pixels** (screenshots come back scaled). Clicking with viewport coordinates lands off-target silently; read the screenshot size and click in that frame, or use refs.
- **The attack-set memo keys by turn/set/life, not board** — sound in play, but a test that scores two different boards with one agent must use two agents.

## S12 lessons (Parts 0–1: ante, knobs)

- **A new zone is cheap when zones are arrays nothing iterates.** The ante zone is one `ZoneName`, one `PlayerState` array, one `zoneArray` case — it is invisible to predicates/scopes/counts *by construction*, not by guarding each reader. Prefer that shape for any future "set aside" zone.
- **Fact-stream events over state inspection for results.** `facts.ante` comes from a logged `ANTE_SET` event, like every other fact — the overworld never reads engine state.
- **Generated docs are the only docs that stay true.** `docs/knobs.md` is rendered from the registry and a test asserts the file matches; `pnpm knobs:doc` regenerates. Do this for any registry-shaped doc.
- **Planner doc overwrites can regress implementer edits.** The S12 `decisions.md` silently reverted S11's ADR-058 amendment (stale copy). Diff planner-updated docs against HEAD at session start before trusting them.
- **Zero-delta proofs beat zero-delta arguments.** The race-threshold change was argued identical at 20 life; re-running the S11 mirror seeds and getting the same 1361/2000 *proved* it in 20 seconds.

## S12 lessons (Part 2: world core)

- **The world never reaches inside a duel — and it didn't need to.** Enemy world life is the existing per-player `startingLife` modifier; ante comes back through `facts.ante`. Build the seam from the contract (`MatchSpec` → `runMatch` → `MatchResult`) and you get replayability of every duel for free.
- **Two RNG streams, not one.** Generation is a pure function of the seed; the journey has its own serializable stream (`WorldRng` with explicit state — core's `SeededRng` has none). Regenerating a map can never perturb a saved journey, and a save resumes its rolls exactly.
- **Carve, don't retry.** Connectivity after random rough terrain is cheapest to guarantee by clearing the cells along an ignore-terrain BFS path to each town/region heart — deterministic, bounded, no retry loops.
- **Force the roll in tests through the knob layers** (`event: { encounterRatePerStep: 1 }`), not through test-only code paths — the registry's precedence merge is the test hook.
- **Acceptance through real duels is cheap at world life 10** (12 world tests incl. 200-seed fuzz + real duels run in ~0.2s); observe both outcomes across seeds instead of faking results.
- **Modifiers apply after setup/mulligans** (ADR-002 initialization order): a test asserting modified life must drive past the mulligan dialog first.

## S13 lessons (the visible world)

- **A React-free controller per screen family pays off again**: `WorldController` is driven by the acceptance test exactly as the clicks drive it, and the duel is just a `MatchController` it owns — the play client needed only names/portraits, nothing structural.
- **Overlay, don't stack**: screens that live "on" the map (town, parley) must be modal overlays; rendering them in the map's column squeezes the map to a sliver.
- **Autosave at every consequence**, not just at "safe" moments — a reload (or dev HMR) between a purchase and the next town entry silently undid the purchase until autosave-on-buy went in.
- **Dev HMR resets `useMemo` controllers**: during browser walkthroughs, batch edits between runs; an edit mid-duel throws the page back to the start screen (the autosave saves you, which is the point).
- **SVG maps are cheap at this size** (40×28 cells = 1,120 rects + borders): no canvas needed; labels need clamping near edges; `preserveAspectRatio="xMidYMid meet"` on a `width="100%"` svg scales cleanly in a flex column.
- **Scripted duel drivers need an "ignore activations" rule**, or a Bonesplitter equips itself every window until the mana is gone — slow, not wrong.

## S14 lessons (editor, save v2, beast PoC)

- **Drafts live in the screen, commits live in the world.** The editor keeps a draft decklist in its screen state and only `commitDeck` (legal-only) touches `WorldState` — an illegal deck cannot be saved by construction, and Cancel is free.
- **Versioned saves are cheap when the migration is "default the new fields"**: `SAVE_FORMATS_READABLE` + `migrateWorld(format, w)`; write the new fields on every path that should own them (town entry, purchase), never lazily on read.
- **Per-town shop state = (epoch, sold)**: depletion without storing stock — the stock is still a pure function of (seed, town, epoch); `sold` resets when the epoch changes.
- **A beast is data, not code**: catalog `kind/buyable/portraitChip` + one knob + one parley branch; the render pipeline needs one subject file, one render, one PIL chip crop, two MANIFEST rows.
- **Dev handles pay for themselves** (`__mc`, now `__wc`): forcing a beast encounter for a visual check was three lines in the console.
- **Planner full-file overwrites keep stomping ADR-058** — diff planner docs against HEAD first thing every session.

- **Simulate the tour before tuning the knobs**: `pnpm world-sim` answers "what do the defaults produce?" in a minute (encounters/100 steps by tier, W/L by tier, life trajectory) — run it before and after any knob or catalog change, the way the ladder guards agent changes.

## Known interims / watch list

See handoff Concerns for the authoritative list. Highlights: auto-pay greedy feasibility (correct while all producers are single-symbol — R-006); condition fields `controller`/`type`/`subtype` are validated but unexercised (first card to use them should add fixtures); value refs deliberately have no arithmetic (ADR-028 — resist until a card demands it); the `sba-unattach` ATTACHED cause is unreachable by legal play (test-forced only).
