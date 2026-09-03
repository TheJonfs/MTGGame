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

## S15 lessons (tutor batch: search, Lotus)

- **Request-payload reveal generalises**: the S4 discard `revealed` pattern carried `searchLibrary` unchanged — chooser-only, request-scoped, never logged. Any future "look at X" effect should take this shape before anyone reaches for a view field.
- **Shuffle-after-search is the replay trap**: it must go through `ctx.rng.shuffle` (logged) — a local shuffle would replay to a different library. The fixture that replays a Growth/Tutor game byte-identical is the guard.
- **Choice-bearing mana abilities are "not mana abilities" to every automatic path**: `isChoiceManaAbility` gates `producibleSymbols`, `tapForMana`, auto-pay, and the AI; the enumerator is the only place they appear (one action per colour). If a second choice shape ever comes (e.g., "any colour" per mana), widen the predicate, not the call sites.
- **`import.meta.glob` is evaluated at dev-server start**: new card JSON needs a server restart before the browser sees it ("unknown card rampant_growth" mid-verification).
- **Scripted drivers should take the non-default search option** (the S10 driver's "option 0" was `declineSearch`) — otherwise the dialog path is never exercised.

## S16 lessons (roaming world, starters, save v3, one-drops)

- **Registry claims need a grep, not a memory**: the S15 handoff said R-044/045 were added; `rules-registry.md` hadn't been touched since S12. Backfilled in S16 — principle 11 applies to the handoff's own claims: before writing "registry entries added", `grep R-0NN docs/registries/`.
- **Equal-speed pursuit is Manhattan geometry**: a roamer at distance 1 can never step onto a player who keeps moving away or sideways (after your step the distance is 2, it closes to 1). Contact happens when you step *toward* it, stop (the world stops with you), or walk into one from the side/front. `roamerSpeed` > 1 is the dial for hunters; the felt-wrong list decides.
- **`advance()` order matters for "stepped vs reached"**: player moves → lair check → stepped-onto check → roamers tick → reached check. Encounters carry `contact` so the UI/world-sim can tell the two apart; tests stage roamers by writing `inst.at` directly (the old `encounterRatePerStep: 1` trick is gone).
- **Tests that want a quiet map**: mark roamers `gone` and set `roamerRespawnSteps` to 0 via the event layer (`QUIET` in the tests) — respawn is a clock and will refill an emptied region otherwise.
- **v3 migration bug I wrote and caught**: spreading the *player's* rest into the world (`{...rest}` vs `{...worldRest}`) — the round-trip/migration test caught it immediately; keep those tests paranoid.
- **The AI's "who" resolution must be per effect**: mill copied the S11 discard lesson (Hymn-at-own-head) — a flat value let the Adept mill itself half the time (book of shame 10). Any new `who: target` effect needs the same treatment in `view-sim`.
- **`sim` must not import `world`** (world imports sim's decks) — `fuzz:starters` reads `starters.json` with `fs`.
- **HMR re-mounts the world app**: editing any UI file mid-verification resets `__wc` to the start screen; `continueFromAutosave()` restores.

## S17 lessons (Expansion 1: five amendments + 32 cards)

- **Verify before you ask**: running the Scryfall pass on all 31 real cards *before* the kickoff questions turned nine ⚠ rows into concrete rulings (five cost shifts, a P/T, "a creature" vs "another", Restoration Angel's "you may … target" vs "up to one") instead of mid-session surprises. Scryfall rate-limits bursts: pace ≥1s/request and send a User-Agent.
- **Observed triggers need the mover as its own observer**: DIES with `source: any` (Blood Artist) must collect the dying Blood Artist's *own* death through the observer scan — the self path deliberately skips non-`self` sources, and the moved object is no longer on the battlefield when ZONE_CHANGE fires. Simultaneous batches (SBA, Wrath) go through `moveBatchToGraveyard` so `ctx.lookback` lets already-moved observers see the rest.
- **One discard entry point**: `discardCard()` (effects, cleanup, costs, cycling) is what makes Waste Not's "whenever an opponent discards" true everywhere — a direct `moveObject(hand→graveyard)` anywhere else would silently miss it. Same lesson as MILLED: emit the event where the move happens.
- **Keyword-filtered statics recurse unless you cut the loop**: "creatures with flying get +2/+0" evaluated inside characteristics() — `baseKeywords()` (printed + stored + *unfiltered* static grants) is the one-level cut; documented as a simplification in R-053.
- **Zone abilities and the view**: the AI only sees graveyard *cardIds*; graveyard-zone actions (Mother Bear) are on object ids → `GameView.graveyardObjects`. Likewise `manaPool` for the mana-burst policy. Adding public fields to the view means updating the no-peeking key pin — that's the point of the pin.
- **Unused vocabulary hides**: `untapTarget` had existed since S1 with no resolver; Little Bear found it. The loader test now asserts every non-static word has a resolver.
- **Mana bursts and cantrips are agent-level rules, not evaluator values**: Ritual/Prospector (cast only when the burst enables something) and cycling (only dead spells) score −∞ otherwise; the view-sim prices `addMana` at 0 on purpose.
- **Promo printings**: "oldest highres English" picked a prerelease promo with alternate art for Restoration Angel — the Rager precedent applies; `art:fetch` caches resolutions in oracle.json, so an override needs the cache entry (and images) removed to re-resolve.

## S18 lessons (the Bestiary: catalog, spawn tables, renders, fog, dialogs)

- **A spoke-bound opponent is one field**: `spoke` on the catalog entry binds it to its colour's ring; kind stays independent (the Cunning Tactician is `kind: mage`, spoke W — mage parley, beast-style plate). The spawn table reads `spoke`, not `kind`.
- **Nearest-tier fallback silently changes a ring's difficulty**: black/red have no tier-1 beast, so "nearest" put tier-2 decks (Nighthawk, Warband) in civilized rings as the tier-1 beast — the first world-sim tables showed the Nighthawk at 13% player win over 89 fights. `beastTierFallback` is a knob (`mage` default: roll a mage of the intended tier). Any "fall back to what's available" rule needs a tier-honesty check.
- **Tie-breaks need a direction**: a green wild ring rolling tier 2 has a Bear (1) and the Wurm (3) equidistant — break down in civilized rings, up elsewhere, or the wild ring fills with bears.
- **Fog is three things**: a renderer rule (blank `--fog` tone, no wash/hatch/border/name; POIs only when explored; road stubs one cell into fog), a planner rule (`planPath` treats unexplored cells as passable and the walk re-plans when the ground turns out rough — the path preview must not leak rough terrain), and a rail rule (lists name only what's been seen). The data (`explored`) had been there since S16.
- **The W civilized wash is the parchment colour**: `--parchment` #ede3cc vs the W civilized wash #efe6c8 — fog as "blank parchment" was invisible next to white's home region. `--fog` (#f6efde) is a shade paler; art direction may want a different answer.
- **The `beast:<key>` deck ref resolves to sim infrastructure** (`packages/sim/src/expansion-decks.ts`, exported as `@shandalar/sim/expansion-decks`); the catalog validates keys. world → sim direction only (S16 rule).
- **`lastCast` on the MatchController** is what lets the A7 sacrifice dialog say what the sacrifice buys — the engine's request carries the source and its effects, not the chosen targets.
- **/play always takes the explicit-spec (`custom`) path now** so beast decks and slice decks mix; the old `humanDeck/aiDeck` form is still accepted by the controller (tests use it).
- **world-sim `--no-beasts`** is the S16-comparable baseline (beastShare 0 via the event layer on both `newWorld` and `advance`) — starter gates are judged on it; the full roster has its own table.
- **Ten renders, ten first-try keeps in the house style** — the bestiary-plate skeleton in `docs/prompts/portraits.md` is reliable; `--aspect 1:1` is mandatory now that the skill's default is 16:9.

## S19 lessons (shop tiers, bestiary round 2, quests)

- **shopTier lives on the card def**, like `prizeOnly` before it (the pool registry documents the rule, not a duplicated column); the loader guard makes a missing tier a structural error. Exempt classes: tokens, basics, prizeOnly, `test_` ids.
- **Sequencing discipline paid off** (ADR-078): gates at 1,000/cell FIRST, then a 12-opponent baseline, then content. The S19 baseline replaced the S18 tables in one session with zero ambiguity about which agent produced what.
- **A quest is world data + three hooks**: offers are a pure function of (seed, town); the only journey touchpoints are a step tick (deadlines, sighting marks), an arrival hook (couriers), and a defeat hook (bounties). No engine work; manalinks were exactly the manifest's "zero engine work" claim (`permanentOnBattlefield` + five isTokenDef defs).
- **Modifier-only permanents want isTokenDef**: never shop stock, never deck-legal, exempt from shopTier — and period-correct if bounced (a token ceases; the link returns next duel).
- **The reserved-field trick worked twice** (`explored` in v3, now `sieges: []` in v4): reserving an empty field costs nothing and spares a migration.
- **rng.pick in offer generation must come from a THROWAWAY WorldRng** seeded from (world.seed, town) — using the world's journey stream would make browsing a town's board advance the world's randomness (a UI read mutating state).
- **`world-sim` numbers move under content adds even when "nothing relevant changed"**: adding tier-1 beasts to the spawn tables shifted every starter's tier-1 percentage (more soft opponents in the mix). Compare per-opponent rows, not headline tiers, across content sessions.

## S20 lessons (the solver, A9/A8, dungeons)

- **The Hall-violation gap was real and silent**: the per-color count + total check passes {W}{U} against Tundra+Swamp. Any future "flexible producer" (Springleaf Drum-class, filtering) goes through `solvePayment` — never add another counting shortcut.
- **Duals as two plain abilities** was the whole trick: `producibleSymbols` already unioned abilities; `tapForMana(symbol)` picks the matching one; `isChoiceManaAbility` untouched (nothing new is "choice-bearing"). The Lotus rule narrowed itself.
- **A range-count spec must be LAST** — that one validator rule made flat-target validation (walk-consume), effect addressing (`targetSpec` fan-out), and the enumerator's subset expansion all trivially correct. Resist a mid-list range until a card forces it.
- **Modifiers apply after mulligans** (S13 ruling): don't panic when a law permanent is missing during the keep dialog — startingLife applies before, everything else after `setup()`.
- **The dungeon is world-data + the existing map stack**: `DungeonRun` in the save, `dungeonAsWorldMap` fabricates a one-region WorldMap for WorldMapView, minions render as roamer chips, treasures as marks. No new rendering machinery at all.
- **Interior bookkeeping must NOT go through applyDuelResult** — that function is overworld consequence law (renown, roamer removal, gold rewards, ante to collection). `applyInteriorDuel` is deliberately separate: ante → escrow, finalLife → interiorLife, loss → the world penalty only.
- **Reload-resumes-mid-dungeon is a LOAD-path feature**, not a save-path one — the run was always in the save; the gap was `loadText` dropping you on the map. Durability bugs hide on the read side.
- **Scryfall queries need a User-Agent** (urllib got 400s bare) and art-fetch bursts need exponential 429 backoff — a 25-override batch blew the old single-retry.
- **WBRUG spoke canon**: rotation+reflection preserve adjacency; two seeded tests broke on geometry/template assumptions, not on the invariant — pin templates (`catalogId = "a1"`) and add region guards in geometry-sensitive tests rather than hunting seeds.

## S20 playtest rounds (post-close, same-day: dungeon scale, solver preference, renown-by-colour, the two map registers, guardian portraits)

- **Measure before you scale.** "The dungeons feel too small" became a 30-line scratch instrument (BFS speedrun vs greedy full-loot tour over 1,000 generated interiors) before any knob moved: 12×9 full-loot averaged **22 steps** against a 60-step tier — the meter was provably decorative, and the doubled 24×18 numbers (speedrun 27 / full-loot 71) justified both the size and the later 30/60/90 threshold shift. The instrument lives in the session scratchpad; rebuild it in ~5 minutes from `generateDungeonRun` + a BFS if a future session needs it.
- **Scale content with geometry through one dial.** The generator's branch/minion/cross-link counts all ride `s = round(sqrt(w·h/108))`, so the grid knobs remain the only size input and s=1 reproduces the S20 shapes exactly.
- **A new visual register exposes camouflaged bugs.** Rendering the interior dark revealed that cache/minion chips were drawn into unexplored fog (invisible on parchment-on-parchment since S20 shipped) — and that subpixel seams between SVG cell rects bleed the page background through (paint a backdrop rect under any dark cell field). When you restyle a surface, re-audit what it was hiding.
- **Preference-order bugs live where two good rules cross.** The solver's "keep duals free" (fewest-symbols-first) silently outranked "creatures last" in the generic pass — Chris's Elves got tapped over his Breeding Pool. The fix made creatures-last dominate everywhere (colored pips too); pre-S20 replays are safe because mono-only boards sort identically. Any future producer-preference tweak must re-check that invariant.
- **Renown is per-colour now (world-save-v6).** `renownByColor` credits each colour of the defeated opponent's template `colors`; fleeing reads the roamer's own colours via `renownAgainst` (max over its colours; total-renown fallback for colourless templates). Migration zeros the new map — old saves' fear resets. Found in passing: the v1/v2 migration branch RETURNED EARLY and skipped every v3+ defaulting (quests/manalinks/dungeons undefined = crash on first tick for ancient saves); it falls through now. Migration chains must end at one shared defaulting tail.
- **One renderer, two registers.** The dungeon's dark-stone look is a single `interior` prop on WorldMapView (palette + patterns + glyph swaps + torch pools + fog-as-darkness); the overworld's campaign-map look is per-colour `TERRAIN_GLYPHS` picked by cell-coord hash. Neither touched the other's path, and no new rendering machinery was added — same lesson as the dungeon-as-world-data trick.
- **Image-filter refusals are content-shaped, and the director can debug them.** Drana refused twice; Chris isolated the trigger by hand in the chat interface (the "two great curved black horns" phrase — nothing else changed) and his own render of the corrected descriptor was adopted as canonical (provenance in MANIFEST; `source-chris.jpeg` kept). Externally-supplied art is fine as canonical as long as the descriptor is corrected to match and the ledger says who made it.
- **The guardian-sim TIERS table hand-mirrors `dungeonEmpowermentTiers`** — a two-place sync (flagged in the handoff; fold it onto the knob if it bites a third time).

## S21 lessons (sieges, the quest pack, the lore turn, the lords' art, the map program)

- **The reserved-field trick cashed at full value**: the whole siege system — timers, occupation, mid-engagement resume — lives in S19's reserved `sieges: []` with lazily-created per-town entries. Reserve empty collections early; they buy entire systems later without a migration. (Counter-case the same session: `quests.rumors` had no reservation and had to be defaulted-on-read with a flag — the trick only works if you plant the field.)
- **One deliberate ESM cycle**: journey→siege (the tick) and siege→journey (the consequence helpers) import each other; safe because every cross-call is call-time, never init-time — commented at the import site. Don't add a second one casually.
- **Planner content as data wants a validator with names in it**: `Catalog.questText` validation checks the five guardian keys and five lord keys BY NAME — a pack edit that drops a lord fails the load loudly instead of a rumor table silently thinning.
- **Placeholder-substitution audits are one regex**: every generated offer text is tested against `/\{(town|region|...)\}/` — the cheapest possible guard against a template landing unsubstituted in a player-facing string.
- **The multiply-blend sprite pipeline** (map Round 4): ink-on-white renders need NO alpha — `mix-blend-mode: multiply` erases the paper over any wash (the S6 icon precedent at map scale). Post-process to guarantee it: levels-to-white on the ~92nd-percentile white point, content-bbox crop, bottom-anchor in a square (feet plant on the spot), 256px. Watch for rendered *palette swatch strips* (the r-cone shipped one — crop before the pipeline).
- **Mirror-tiling makes any texture seamless**: centre-band crop → 512 → paste with H/V mirrors into a 2×2 1024 tile. Used for all six map surfaces; no seam ever, no tileable-prompt gymnastics.
- **De-gridding is three algorithms, not art**: chain shared-endpoint cell-edge segments into polylines → Chaikin (endpoints pinned on open chains) → seeded coordinate-hash wobble; stroke a fat paper gutter under the smoothed line to swallow the staircase it approximates. Blob-group contiguous rough cells and scatter features across the blob. Roads: same chaining at small amplitude. The grid model never changed; only the paint.
- **Fog as nothing**: the strongest fog rendering is NO paint — the paper ground shows through, and `fill="transparent"` keeps fogged cells clickable (plan-through-fog survives).
- **/__snapshot** (vite dev middleware): the page serializes the map SVG (inlining image hrefs), rasterizes at 2×, POSTs a PNG into `docs/art/snapshots/`. Use it for every art round's before/after; the S21 ledger starts with the posterity grid shot.
- **tsc is not a JSX gate**: a missing `}` after a JSX `&&` fragment typechecked clean and broke Vite's Babel on Chris's live server. If it recurs, add a babel-parse or eslint pass to the gate; until then, browser-verify catches it one step later.
- **Refusal shapes keep surprising**: a BLANK PAPER SHEET refused ("material texture" phrasing cleared it); Drana's trigger was one phrase ("two great curved black horns"). Isolate by phrase-stripping, one reword per the skill's law; the director can debug via the chat interface (precedent blessed in ADR-080).

## S22a lessons (A10's nine words, the batch, the pins)

- **Event context is one optional field, not a subsystem.** `PendingTrigger.eventContext {objectId, cardId, player}` (captured at collection = LKI by construction) rides onto the StackItem and powers three words at once: the Warden's "IT deals 1 to ITS controller" (`to: "eventPlayer"` / `from: "eventObject"` on damage — the source matters: lifelink on the untapped creature nets zero), the Stoker's payer (unlessPay reads `eventContext.player`), and future event-addressed effects. Resist widening it into general effect vocabulary until a third customer asks.
- **The request-loop pattern (Purge) is the chooseMode/ADR-013 fusion it was billed as**: enumerate ONE castSpell action (targets []), then a logged pick/done loop inside `applyPriorityAction` — replay just feeds the same actions back. The subtle parts: distinct-pick filtering by JSON key, the affordability gate INSIDE the loop (offer another pick only while (n+1)×life is payable), and the zero-target cast must NOT hit the fizzle path (`targets.length > 0` joined the fizzle guard — a zero-target resolution is CR 608.2b-clean).
- **Granted abilities = a virtual list, twice.** Engine: `abilitiesOf(ctx, objectId)` (printed + granted, battlefield order of granters); enumerator AND `applyPriorityAction` both index into it — stable because nothing moves inside one priority window. Agents: `viewAbilityAt` (granted-view.ts) mirrors it from the GameView — every agent-side `def.abilities[abilityIndex]` was a silent mis-resolve for granted abilities (pin 13 only "rides unchanged" because isCycling now resolves through it). If you add a THIRD ability-index consumer, wire it through one of these, never raw.
- **The who:any amendment surfaced a masked control bug**: `returnFromGraveyard` to battlefield entered under the card's OWNER (moveObject's default) — invisible for five sessions of own-graveyard customers, load-bearing the day the Usher reanimated the opponent's Serra. Battlefield returns now pass `{controller: effectController}`. Moral: when an amendment relaxes a "you"-assumption, grep moveObject option defaults for the same assumption.
- **Temporary reanimation is state + two riders, no delayed-trigger subsystem**: `state.endStepSacrifices {objectId, dueTurn}` processed at END-step start (dueTurn+1 when created at/after END), plus a haste grant riding the object id. The launder is FREE by construction — a blink issues a new id, both riders go inert. The view exposes `pendingEndStepSacrifices` (public info) so the blink pin can price the line.
- **Identical-trigger auto-order** (the Warden's untap step): when every pending trigger shares (sourceCardId, abilityIndex), skip the orderTriggers request — ADR-014's principle at trigger scale, outcome-equivalent, flagged in R-067 for planner review. The Blood-Artist-chattiness cousin now has a precedent shape.
- **Fixture scripts + the new loops**: the harness gained bounceCost/tapCost/pickTarget/doneTargets AND an explicit `pass` barrier — the S3 first-legal-moment lesson bit again (the launder's Resto bound while the Usher was still on the stack; two pass entries fixed it). Remember ADR-014 eats script entries: a lone tapCost/done candidate is auto-taken and the entry never matches — script only real choices.
- **printedAsset (ADR-082)**: customs' printed view = Chris's card-creator JPGs, resampled to 745px (Scryfall-large parity), committed under assets/generated/printed/ + packages/ui/public/printed-art/. CardFrame checks printedAsset BEFORE the oracle scan; the Gallery's printed-scans toggle now includes customs. The JPG-not-PNG delta from ADR-082's text is Chris-approved.
- **Scryfall S22 pass**: nine cards, zero mismatches vs the brief (the streak holds); Overload's "you may return … a card" is resolution-time selection CR-wise — encoded as an A8 up-to-one TARGET chosen at cast per the planner's bill (R-074 simplification, flagged).

## S22b lessons (the strongholds)

- **The stronghold IS the dungeon system** — one `kind: "stronghold"` value bought the whole seat: its own grid knobs, scaled minion/branch counts, and everything else (escrow, interior life, empowerment, fog, resume) rode along untouched. The reserved-field trick cashed a THIRD time (`world.strongholds` v5-reserved → typed `{color, seal, spokeMinionPoints}` entries, no save bump).
- **Partisan laws are one optional param.** `dungeonDuelSpec(..., extraModifiers)` — the stronghold passes `[lawModifier]` (+ `entranceModifier` for the lord); mox laws stay symmetric through the old path. Per-battle law re-injection is FREE (every duel is a fresh MatchSpec) — "destroyed in one battle, back the next" needed zero code.
- **Laws are real objects, not tokens, ON PURPOSE**: the blessed Boomerang quirk needs the bounced law to SURVIVE into a hand and be stuck there — `uncastable: true` (one enumerator line) + `prizeOnly` (never rolls/circulates) is the whole containment. isTokenDef would have made the bounce a destruction (tokens cease).
- **imposeEntersTapped lives at the one zone-move primitive** (moveObject + createObject), so every entry path pays the Intake — cast, reanimate, search, token — with no per-path guards. That's manifest principle 4 doing the work. (It joins the existing characteristics↔effect-context import tangle: zones→characteristics is call-time-only, safe.)
- **The entrance is a Modifier, and ADR-002's timing IS the spec**: modifiers apply post-setup = post-final-mulligan-keep, exactly where "after the lord's final keep" wants the swap. New RNG purpose "entrance" (RngPurpose union in core). The no-library-copy NO-OP is the discard counterplay's engine half — a Hymn'd signature stays gone.
- **Instrument at the agent seam, not the log**: lord-sim's launder/sphinx observations wrap the lord's agent (`InstrumentedAgent`) — the VIEW at choice time has `pendingEndStepSacrifices`, so "did she blink a pending-sacrifice guest" is one predicate at the moment of choice instead of replay archaeology.
- **The picker screen surfaced its own bug in browser verification**: `toggleStrongholdPick` accepted any cardId (my probe id got picked). Guard choice-screen inputs against their own offer list — the engine's actions-list validation has no equivalent at the world/UI layer.
- **The TIERS hand-mirror is now a THREE-place sync** (dungeonEmpowermentTiers ↔ guardian-sim ↔ lord-sim) — the S20 flag said fold it onto the knob if it bites a third time; it hasn't bitten yet, but the third copy exists. Next knob edit should fold it.
- **HMR resets the world app mid-walkthrough** (S16 note, still true) — batch UI edits between browser verification passes; the controller acceptance test is the reliable end-to-end (private `finishInteriorDuel` reachable via a test cast for ceremony paths whose duels are sim territory).

## S22 playtest r3 lessons (the misplay cluster, the world quiets)

- **Softmax noise cannot be trusted with AIM.** Every r3 misplay (Swords-own-creature, counter-own-spell, Mind-Rot-self, Boomerang-own-Island, Rancor-on-theirs) was apprentice's temperature 1.2 coin-flipping a 0.2–2.5-unit score gap — no single score was WRONG enough to matter, and one (counter) was actively wrong (unsigned credit). The architecture answer: noise picks WHAT to do, never WHERE to point it — the misaim rule is a finite 100-unit cliff (exp(−100/t) = 0 at any temperature) rather than −∞, so book-of-shame orderings among bad aims survive. Full-waste plays (all-discard at an empty hand, EOT pump outside combat) joined the −∞ X=0 family instead.
- **The view-sim treats every applied delta as permanent** — an UNTIL_END_OF_TURN pump on the copy reads as +N/+N material forever, which is exactly "cast Giant Growth to maximize mana usage." Any duration-bearing effect added to view-sim needs a decays-at-cleanup story (here: don't apply out-of-combat self-pumps; charge the card).
- **Sign every credit by whose thing it hits.** The counter case credited the countered spell's mana value regardless of controller — five sessions dormant because nothing enumerated counter-own-spell until an opponent held Counterspell + own Swords on the stack. Same family as S11's Hymn and S16's mill: when adding a vocabulary word to view-sim, ask "whose?" about every term, not just the `who` field.
- **mkView-harness gaps hide gate bugs**: the book-of-shame view builder hardcoded `stack: []` and `opponentHandCount: 3` — the new gates needed both knobs, and the extension was three optional fields. Keep test-view builders parameterized as the gates grow.
- **World tests that fast-clock a system must zero its grace knobs explicitly** — the siege FAST override needed `siegeGraceSteps: 0` the moment the knob existed. When adding a delay/grace knob to a clocked system, grep the tests for that system's event-layer overrides in the same commit.
- **The engagement spoils pattern**: accumulating totals as OPTIONAL fields on the in-save engagement object ({goldWon?, anteWon?}, defaulted at accumulation) reports whole-run ceremonies with zero migration — the reserved-field trick's little sibling for in-flight state.

## S23 lessons (the fun batch, rivers, footprints, smoothing, cue-first audio)

- **First-collector wirings are exactly as cheap as the skeleton promised.** END_STEP (off STEP_BEGIN at the END case, before the step's first priority) and BLOCKS (per declared blocker, the ATTACKS mirror) were each ~15 lines; the "adding a mechanic = adding a rule to an existing step" principle held at its ninth and tenth collectors. Passing eventContext from BOTH combat collectors let the Djinn's "deals 1 damage to you" compose from the Warden's to:eventPlayer/from:eventObject machinery with ZERO new effect vocabulary — check the event-addressing shelf before minting a word.
- **The Specter precedent answers "that player" for free in a two-player engine**: `who:"opponent"` on a self-damage-to-player trigger IS "that player" in every reachable state. The Traumatizer's whole bill was one value ref.
- **Widening an Amount to refs ripples to every raw-typed consumer**: mill.count going `number → number|ValueRef` broke three engine call sites typed against the OLD Exclude<> union (characteristics, enumerator reduceBy, evaluateValueRef) plus view-sim's arithmetic. Grep for the ref-family Exclude pattern when adding a member; the compiler finds them, but budget the sweep.
- **River generation order is the whole design**: AFTER roads (so crossings become bridges for free), BEFORE roamer spawn (so reachable() is honest). The reachability invariant EXTENDS rather than fights: plan through water, promote wet path cells to fords — the ribbon is never broken. Two catches from testing: a natural ford must CLEAR its cell (rough terrain under the water blocked a "passable" ford — seed 7), and repair fords can chain lengthwise when the wet path runs along the river (works; reads as a causeway; perpendicular-preference is future polish).
- **Meander tuning is a browser judgment, not a math one**: the first walk (55% forward, sticky drift) produced 44-cell flats that read as LAKES; capping lateral runs at 2 with 60% forward reads as a river. Screenshot the register before trusting any organic generator.
- **The organicPaths machinery generalizes to anything cell-edged**: rivers (cell-centre segments, two strokes: wide wash + dark line) and the interior's carved walls (cell-edge segments, dark gutter + pale chisel line) both rode the S21 chain+Chaikin+wobble unchanged. The interior wall smoothing was ~10 lines of segment-shape change.
- **Cue-first audio pays immediately**: game code names cues; mapping.json + a gitignored mount + a dev middleware make silence the natural state (the unit test pins the empty mapping as a total no-op). Browser reality: hold the pending music cue and retry on the first pointer/key gesture — autoplay policy makes "enabled" and "audible" different states. Watch for module double-evaluation in dev (audio.ts loaded twice = two singletons; harmless for idempotent cues, but don't hang state off "exactly one instance").
- **The underscore-documentation convention in mapping.json belongs on KEYS, not values** — I initially filtered values starting with "_" and silently muted my own smoke files named `_smoke-*.wav`. Typed cue lookups can never reach a "_comment" key; no value filter is needed.
- **`pnpm guardian-sim`/`lord-sim` live in packages/world now** (the TIERS fold): sims that need knobs must live above `world` in the dependency order — that's WHY the hand-mirror existed. When a sim needs world data, move the sim, never invert the import.

## S23 lessons (the fun batch, wilds, audio, and two art rounds)

- **The batch bill audit paid again**: the spec's "Tier 2, 12g" for Thundersnake was Bolt's mv-1 price riding along (formula says 18); the END_STEP and BLOCKS collectors weren't in the "two tiny pieces" count (skeleton per R-061, Chris-confirmed). Price-check every spec'd number against the formula that produces it, and count the first-collector wirings out loud.
- **A mechanic can be cheaper than its trigger**: the Djinn's whole tax is ATTACKS/BLOCKS collectors + eventContext + the Warden's event addressing — zero new effect words. Check what event addressing already reaches before pricing a new `who`. (Same lesson, Traumatizer: Hypnotic Specter's `who:"opponent"` IS the "that player" pattern for self-damage-to-player triggers in a 2-player game.)
- **Design rollbacks should remove machinery, not disable it**: rivers-to-flavor deleted the water law AND the fordTo repair loop rather than gating them. A barrier that no longer exists can't silently return through a knob merge, and the flavor-law test (open walkable water must exist) pins the ruling.
- **Moving the start one cell moves more than the start**: start-off-town broke exact-match `lastTownIndex` (new worlds + the v1 migration default), the "set out from" notice, two controller shop tests, and — subtlest — a respawn test whose stand-still loop suddenly attracted roamer contact (towns are pursuit-proof; open ground is not). Grep for `map.start`/position==town assumptions whenever spawn geometry changes.
- **Art round-2 discipline**: a whole-round rejection is cheap when the ceremony is scripted — 12 rejections ledgered, four NEW styles authored (stained glass / illuminated manuscript / art nouveau / dark surrealist oil — all four diverged properly, zero refusals, and three won). The round-2 style set is locked in card-art.md for reuse. Verify the printed faces against the defs word-for-word: caught "that players mills" AND the price of not checking would have been a committed typo face.
- **Contact sheets beat gallery links for verdicts**: a self-contained HTML (base64 thumbs, style-labeled) sent as a file renders inline and works anywhere; ~1.6MB for 12 thumbs.
- **Terrain variety is a sampling problem, not a sprite-count problem**: six-per-colour interleaved (1, 2-variant, 3, 1-variant, 2, 3-variant) makes neighbouring coord-hash picks rarely repeat a silhouette — the same blob machinery, no renderer changes.
- **The audio worksheet pattern**: when a system ships scaffolding-first, file the planner-facing worksheet (wired seams + candidate seams, each sized) in docs/ the moment the wiring is fresh — docs/audio-cues-s23.md took minutes to write with the seams in hand and is the whole step-2 interface.
- **Git hygiene**: the repo has never been gc'd (276MB loose, zero packs at S23 close) — pushes pack everything on the fly and can blow a 2-minute timeout. Push with a long window or `git gc` first.

## S24 lessons (recovery, the audio landing, and six SFX rounds)

- **Diff-detection beats reward-plumbing**: the manalink splash detects grants by comparing `world.manalinks.length` around the award seams — every current AND future grant path splashes with zero changes to award()'s return shape. When a UI ceremony needs to know "did X just happen inside that call," diff the state, don't thread a flag.
- **One-voice stingers are a design tool, not just dedup**: making the sting channel single-voice didn't just fix the Dueltune+Winduel stack — it made "the Manalink sting fades Winduel" the automatic consequence of showing the splash. Channel semantics do ceremony work.
- **A refused `play()` must not squat on its cue**: the "music sometimes fails to fire" bug was a rejected Audio element left as `current`, no-opping every later request for that context. Any async-resource cache needs the failure path to evict.
- **The reveal-burst detector is the fog system paying rent again**: the original Shandalar's "new segment revealed" trigger translated to a popcount diff on the explored bitmap (≥5 new cells = a sightline). When porting a mechanic keyed to the source game's engine internals, look for OUR system that produces the same *player-visible moment*.
- **Burst throttles (150ms, per-cue map) are the answer to simultaneity everywhere**: opening-hand draws, untap steps, combat damage, wrath deaths, Mind Rot discards — one shared helper.
- **Event-cause markers for sounds**: distinguishing Sacrifice from Destroy needed a `SACRIFICED` event emitted just before the zone move at each sac site — the ZONE_CHANGE payload carries no cause on purpose, and the marker-set-then-consume pattern (pendingSacIds) keeps it that way.
- **The world clock is reusable as a transaction**: innRest() is advance()'s tick loop minus movement — deadlines, sieges, respawns, growth all priced into a rest with news queued for waking. Any future "time passes here" feature (research? travel powers?) should copy this shape, not re-derive the consumer list.
- **maxWorldLife is computed, never stored** — suspension falls out of filtering active links at read time; the only mutation is the clamp at fall/load. Same shape as S5's statics lesson, world-scale.
- **mapping.json value polymorphism** (string | {file, volume}) let volume tuning land without touching any call site, and the /sound board (live sliders, persists nothing) beat the fill-a-deck-with-basics test Chris first proposed — build the tuner, not the test fixture.
- **Filename fidelity**: the package's own typo (`Sacrfice.wav`) is preserved in the mapping — renaming mounted assets invites drift between Chris's library and ours.

## S25 lessons (the five powers, the great swap, the court)

- **Check the payment plumbing before pricing an X extension**: {X}{X} needed ZERO payment-code change — parseManaCost counted xCount since S1, totalCost charged xCount·X, canPay/autoPay/the enumerator's X ladder all rode it. The whole double-X word was a validator confirmation, a fixture, and AI valuation. Audit what the skeleton already generalizes before writing a line.
- **Context-dependent refs go through eventContext, not the object**: xPaid stored only on the GameObject would blank when the Keeper dies in response (moveObject issues a NEW id; the trigger's sourceId goes stale). Capturing into the pending trigger's eventContext at collection = LKI by construction — the same shape eventDamage proved in S23. Any future "read a value off the trigger's source as-it-was" ref should copy this, not add object-graveyard plumbing.
- **The planner's zero-bills hide quarter-words**: the Tyrant's "Gallows Djinn self-damage" is EVENT-addressed (to:eventPlayer needs a trigger's eventContext) and cannot reach an activated ability — damage to:"you" had to be minted; the Sage's "controller predicates" existed for creatures only — permanentYou[Dont]Control had to be minted. Both trivial, both counted out loud (the S23 discipline). Grep the actual arm the bill names before believing "zero".
- **Computed forms beat migration flags**: powerAdvanced = lordSealed(color) — "retroactive for already-fallen lords on migration" costs NOTHING because there is no stored form to migrate. The S24 maxWorldLife lesson at its second customer; reach for the computed read first whenever a state is derivable from another system's ledger.
- **Two-speed movement is a parity bit, not a speed field**: the Stride's 2-cells-per-step is a free-half/paid-half split per cell with the carry persisted (strideCarry), so click-by-click walking and long paths price identically. The free half moves ONLY the player (no ticks, no roamers, no clocks) — "the world stands still" is what makes outrunning pursuit true, and it fell out of placing the tick block under the paid half.
- **The region tier can disambiguate shared fixed-point kinds**: power-dungeons reuse kind "dungeon" (mox sites) with tier === "approach" deciding at the threshold — zero renderer, zero rail, zero save work. Widening an enum ripples; a second discriminator you already carry doesn't. (The cost: tests that "find the first dungeon site" must now say which ring — three world tests learned this.)
- **Sim pilots need fuel access, not just rates**: the first --powers world-sim table showed quietus/barrage/balm at 0.0/tour NOT because rates are wrong but because a green tourist holds ZERO black spares — colour-matched fuel makes off-colour powers shopping-gated (the design's own gold-shadow valve). When a usage instrument reads zero, check the resource channel before the price.
- **Runtime privacy is compile-time only**: the browser walkthrough drove the controller's private startInteriorDuel through __wc to prove court-deck resolution without a 70-step dive — TS `private` doesn't exist at runtime, and the acceptance-test-through-controller doctrine extends to console verification.

## Known interims / watch list

See handoff Concerns for the authoritative list. Highlights: auto-pay greedy feasibility (correct while all producers are single-symbol — R-006); condition fields `controller`/`type`/`subtype` are validated but unexercised (first card to use them should add fixtures); value refs deliberately have no arithmetic (ADR-028 — resist until a card demands it); the `sba-unattach` ATTACHED cause is unreachable by legal play (test-forced only).

## S26 lessons (the Corolla's court + the petal-world + the Mirror)

- **A world-kind interior is cheaper than a dungeon-kind one.** The Corolla reuses the WorldMap shape + `findPath` + the renderer with a `register` prop; its state is three optional fields in the reserved `gauntlet` object and a pure geometry function (`generateCorolla`) — nothing about the flower's SHAPE is saved, only where you stand and what fell. If a future map class wants the same, copy `corolla.ts`'s split: pure geometry → `xAsWorldMap` → an `xAdvance` that owns its own clock policy.
- **The renderer's "void" trick**: a region whose tier is `"void"` paints the paper pattern and grows no terrain blobs under the corolla register. Region borders then draw the petal outlines for free (organic ink over parchment gutters — the Round-1 machinery). Empty region names now skip the cartouche everywhere (harmless for older maps).
- **Fixed points at the centre must be placed BEFORE the road/carve pass** (worldgen 5d sits before 6) — and the same placement runs idempotently in the save migration, so old radial saves grow the doors on load. Walk tests through the hub now meet door stops; the lair test legs past them like it legged past the S25 power thresholds.
- **ADR-014 bites fixture scripts**: a `pass` barrier only binds when the pass is a real request — a lone pass is auto-taken and never reaches the script. Give the passing player one other legal action (a land in hand) if the barrier must land.
- **`corollaAdvance` throws on an impassable cell** rather than stopping: the controller's click path plans over the flower's own map, so an impassable cell never reaches it; the throw is a guard, not a flow.
- **The heuristic's Lotus**: the S15 `-Infinity` on any colour-bearing activation sat BEFORE the mana-burst check, so the Mirror's reflection carried a blank card. The burst check runs first now and admits a choice-bearing burst only in a colour the enabled card wants; mirror-sim flipped from "weaker with the Lotus" to "as strong or stronger" in five of seven cells.
- **Chris's external card renders** arrive landscape ~4:3; the 5:4 centered crop to 1024×819 PNG is the court's precedent and reads fine at tile size. Printed faces resample to 745px width exactly as before. Verify the printed text against the def by READING THE JPEG (the Read tool renders images) — it is the S22 "verified word-for-word" step, and it costs a minute.
- **The tsc narrowing trap in controller tests**: after `c.screen = {kind:"map"...}` every later `c.screen` read is narrowed to that literal, and method calls don't widen it. Read through `const screen = () => (c as WorldController).screen` and bind each read to a const before comparing.
- **tsc never saw a single React screen.** `tsconfig.json` includes `packages/*/src/**/*.ts` — every `.tsx` was outside the typecheck, which is how the S25 cast-or-cycle chooser shipped referencing an unimported `viewAbilityAt` (a runtime ReferenceError the live browser caught in S26). `pnpm typecheck:ui` (tsconfig.tsx-check.json, Vite's bundler resolution) covers packages/ui now; run it beside `pnpm typecheck` until the planner folds it into the project config.

## S27 lessons (the Manafleur, the Heart, the chronicle's first phase)

- **A game-level sequence pointer is the right home for "the next X".** `GameState.lawSequence` (order, pointer, mode) makes copies, reanimations and thefts continue the cycle for free — the trigger reads state, not the creature. A `lawSequence` modifier sets it at init; `random` draws from the logged RNG (a new `RngPurpose`), so replays stay byte-exact.
- **"Exile all X" is a scope, not a loop of targets.** The `laws` scope on the Wrath-class scope machinery plus `exile` accepting a scope gave the Manafleur's first clause in two rows. Laws are tokens by construction (S26 r3), so the exile leaves no exile-zone residue and "create a copy" is a fresh token from the def.
- **Confine a rider by trigger + card id in the validator** (`createLaw` → the Manafleur's END_STEP only), the S25 `xPaid` pattern; the loader's warnings list would otherwise let a stray card carry it.
- **The profile is the UI's business.** The world package owns `Legacy`, `applyLegacy`, `recordCutting`, `migrateLegacy`; the controller owns the storage key (`shandalar-legacy`), reads it at new-game and writes it at victory. Tests inject `memStorage()` exactly as for the save.
- **Text packs over placeholders**: the Corolla's and the Heart's lines live in `quests.json` (`corolla`, `heart` sections; validated key-by-key in `catalogFrom`), the screens read them with fallbacks — the planner's next pack edits data, not JSX.
- **Baseline hygiene**: run the FUZZ_FULL baseline BEFORE editing any file it imports — staging the engine edits as a script and applying after the run kept the baseline honest (two spurious failures were a mid-run knob doc and a test written after the run started).

## Deploying the viewer (S27 — Vercel)

- `pnpm build:web` (scripts/build-web.sh): Scryfall art fetch (idempotent) → copy `data/art/real` into `packages/ui/public/real-art` (gitignored) → `vite build packages/ui` → `packages/ui/dist`. The tile derivatives are skipped (Pillow is not on the build image; the UI falls back from `.tile.jpg` to `.art.jpg`).
- `vercel.json`: install `pnpm install --frozen-lockfile`, build `pnpm build:web`, output `packages/ui/dist`, SPA rewrites for the pathname routes (`/world`, `/play`, `/gallery`, `/viewer`, `/sound`) excluding `/assets/`, `/real-art/`, `/audio/`, and the `/__*` dev endpoints (they 404 cleanly; the gallery's registry fetch catches).
- **The deploy is silent**: `assets/audio` is gitignored (Chris's local library) and never copied — silent-if-unmapped is the law. A fresh build refetches ~370 Scryfall images at 150 ms spacing (about a minute); Vercel does not cache `data/art/real` between builds.
- Toolchain: `engines.node >=22` (Vercel picks 22.x), `packageManager pnpm@11.0.9` (if Vercel's install fails on the pnpm version, set the project env `ENABLE_EXPERIMENTAL_COREPACK=1`). devDependencies (tsx, vite) install by default on Vercel.
- Weight: `public/` carries ~100 MB of PNG art (custom-art 55 MB, portraits 39 MB) — fine for Vercel, but a JPEG pass would cut it fivefold if cold loads feel slow.
