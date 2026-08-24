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

## Known interims / watch list

See handoff Concerns for the authoritative list. Highlights: auto-pay greedy feasibility (correct while all producers are single-symbol — R-006); condition fields `controller`/`type`/`subtype` are validated but unexercised (first card to use them should add fixtures); value refs deliberately have no arithmetic (ADR-028 — resist until a card demands it); the `sba-unattach` ATTACHED cause is unreachable by legal play (test-forced only).
