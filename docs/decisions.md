# Architecture Decision Record

Planner-maintained. Implementer proposes via handoff Concerns; planner records.

**ADR-001 — Real cards, curated pool, no carve-outs.** Pool designed to the engine. A card needing special-case code is cut or triggers a deliberate vocabulary addition. (Manifest §1.)

**ADR-002 — Rules engine is a library with a MatchSpec/MatchResult contract; overworld modifiers are applied only at initialization and only via the card effect vocabulary.** Prevents a parallel rules system. (Manifest §1a; data-model §5.)

**ADR-003 — Simplified layer order for `characteristics()`.** printed → copy(reserved) → control → setPT(reserved) → static P/T → EOT P/T (timestamp) → counters → keyword grants/restrictions. Known deviation from CR 613: no layer 4/5 (type/color) at all; layer 7 sub-ordering honored. Acceptable because type/color changers are excluded by manifest §4.

**ADR-004 — Legal-action enumeration is exhaustive for targets but mana payment is auto-resolved.** Enumerating every payment permutation explodes; auto-pay is deterministic and sufficient for the slice. Revisit if a card makes payment choice strategic (e.g., colorless vs colored pools).

**ADR-005 — Owner/controller split and exile zone exist from Session 1** despite no Session-1 card using them. Retrofit cost dominates.

**ADR-006 — Damage assignment and damage dealing are separate functions.** Keyword combat rules attach to one or the other.

**ADR-007 — SBAs may consult the agent** (legend rule, later sacrifice choice). The agent hook is `chooseOne`. Session 1 may stub it with deterministic choice and log an interim.

**ADR-008 — Card art is a pointer plus rendered fallback; real-card images fetched at build time, only for the pool.** (Manifest §7.)

**ADR-009 — TypeScript monorepo, pnpm, vitest.** Consistent with SFB and ReactMon; browser-targetable for M5.

**ADR-010 — Early AI may play control poorly.** Control Magic and Wrath enter the pool on schedule; AI quality for them is an M4+ concern.

**ADR-011 — Single agent interface: `chooseAction(view, request)` over enumerated actions.** Mulligan/bottoming, trigger targets and ordering, blocker damage order, sacrifice selection, legend-rule keep: all are requests returning one of an enumerated list. Every decision is an Action in the log. Interface lives in `engine`. Supersedes engine-design §12 sketch. (S1 deviation 1.)

**ADR-012 — Effect resolvers live in `cards` and mutate state only through an `EffectContext` that `cards` defines and `engine` implements.** Preserves `engine → cards → core`. A stack-item-less `EffectContext` variant exists for initialization-time effects (modifiers). (S1 deviation 3; S2.)

**ADR-004 (amended) — Cast legality uses floating mana + untapped producers; execution auto-taps deterministically.** Explicit `tapForMana` remains. Multi-color producers are out of the pool until payment enumeration exists (S1 concern 5).

**ADR-013 — Attack and block declarations are incremental actions** (declare one / done), not composite subsets. Replaces the S1 `ENUM_CAP` prefix. Log grows; legality is never truncated. (S1 concern 1.)

**ADR-014 — Action-log semantics.** The log records non-forced decisions and RNG draws; single-option decisions are taken silently and re-derived on replay. Viewers needing a full transcript consume the optional `EVENT` stream. (S1 concern 4.)

**ADR-015 — "All randomness through the seeded RNG" applies to game randomness.** Agent-internal randomness (RandomAgent's PRNG) is outside it by design; agent outputs enter the log as Actions. (S1 concern 8.)

**ADR-016 — `ZONE_CHANGE` payload captures pre-move controller.** DIES/LTB triggers and any "controller of the object that left" logic read it from the payload, not the post-move object. (S1 concern 3.)

**ADR-017 — X enumeration.** X-cost casts/activations are enumerated once per affordable X value (0..max). Linear; no cap.

**ADR-018 — Test-only cards are permanent fixtures.** Engine tests never depend on pool membership (the pool is curated by taste and will change). `test_fs_soldier`, `test_pinger`, and future synthetic cards stay; real pool cards add coverage, they don't replace it.

**ADR-019 — Explicit `colors` field.** Card/token defs may carry `colors: ["W"|"U"|"B"|"R"|"G"]`. Derived from mana cost when absent; **required on token definitions** (validator error if missing); required on any card whose color differs from its mana cost (none in pool yet). Color predicates (nonblack etc.) read the field, never the mana cost. (S2 concern 2.)

**ADR-020 — Parameterized scopes, not a predicate language.** Static/mass scopes are a closed enum (`creaturesYouControl`, `allCreatures`, `attached`, …) optionally narrowed by `{subtype}` / `{type}` parameters. Tribal anthems are `{scope:"creaturesYouControl", subtype:"Goblin"}`. Implement the parameter when the first tribal card enters (M3). (S2 concern 3.)

**ADR-021 — Trigger condition object.** Triggered abilities may carry `condition: {source: "self"|"other"|"any", controller: "you"|"opponent"|"any", type?: [...], subtype?: [...]}`. `self` is the S1/S2 default. Implement beyond `self` in M3 with the first "whenever another creature" or "whenever you cast" card. (S2 concern 4.)

**ADR-022 — Fight legality is all-or-nothing** (CR 701.12b): if either fighting creature is an illegal target or has left the battlefield at resolution, no damage is dealt. This is a generic fight rule in the resolver, not a card carve-out.

**ADR-023 — Ratifications from S2:** Rumbling Baloth replaces Rhox Brute; S2 pool rows ratified; initialization-time triggers are discarded (modifiers are static starting conditions); `destroy` resolver waits for Doom Blade (M3).

**ADR-024 — Fuzz-before-fixtures is protocol.** See CLAUDE.md session protocol. (S3 concern 1.)

**ADR-025 — Rules claims cite CR.** CLAUDE.md principle 10. (S3 concern 2.)

**ADR-026 — `ATTACHED` event.** Attach/unattach/re-attach emits an event with {object, previousHost, newHost, cause}. Needed by the replay viewer (M3.5) and by any "becomes attached/equipped" trigger later. Implemented in S4. (S3 concern 3.)

**ADR-027 — Optional ("you may") triggers.** A triggered ability with `optional: true` asks its controller yes/no via a DecisionRequest on resolution (CR 603.5 / 608.2b). Curiosity is the first.

**ADR-028 — Value references in effects.** Effect amounts may be `{"ref": "targetPower", "target": i}` (last known information at resolution, CR 608.2h) in addition to literals and `"X"`. `who` gains `controllerOfTarget`. Swords to Plowshares is the first user; kept deliberately minimal — no arithmetic, no counting.

**ADR-029 — Discard modes.** `ownerChooses` (Mind Rot), `random` (Hymn; game RNG, logged), `casterChooses` with optional filter (Duress: noncreature, nonland). Revealing a hand is a view-level effect: the choosing agent sees the revealed cards as candidates; the log records the choice.

**ADR-030 — Ratifications from S3:** deathtouch assignment is the source's (510.1c) and fixture 6 was a planner error; fixture 1 split 1a/1b; `damageAll` landed on the `destroyAll` precedent; cost-side `{C}` is an accepted boundary; B–C decking rate noted as an M4 baselining data point. M3 split into S4 (removal, discard, conditions/scopes, Deck D) and S5 (control change, reanimation, legend rule, Drana, Mystic Snake).

**ADR-031 — Async resolver seam.** `resolveEffect` and `EffectContext` ops that need a player decision are `Promise`-shaped. Resolvers never block on anything but DecisionRequests; determinism is preserved because every awaited decision is a logged Action. (S4 concern 1; ADR-012 amended.)

**ADR-032 — Hand reveal is request payload.** Revealed cards ride on the DecisionRequest (`revealed: [...]`) for the chooser, for that decision only. `GameView` redaction is untouched. Ongoing-reveal effects are out of the ceiling. (S4 concern 2.)

**ADR-033 — Static control effects.** "You control enchanted creature" is a static `gainControl` with `scope: attached` from the aura as source, applied in the ADR-003 control layer and ending when the aura leaves. Control change resets summoning sickness for the new controller (302.6) and again on reversion. Stolen objects keep `owner`; zone moves route by owner (bounce → owner's hand, death → owner's graveyard, 400.3). DIES/LTB triggers use pre-move controller (ADR-016).

**ADR-034 — Fuzz suite structure.** Default `pnpm test` runs a 100-games-per-pairing smoke; `FUZZ_FULL=1 pnpm test` runs 500/pairing; the handoff's table comes from the CLI at 1,000/pairing. (S4 concern 7.)

**ADR-035 — Ratifications from S4:** fixture 12 was a planner rules error (Nighthawk flies, 702.9c); fixture 9's second target; `opponentPlayer` predicate; `damageAll`/`destroyAll` precedent stands. B–D decking rate accepted as a baselining data point; no deck tuning for fuzz speed.

**ADR-036 — Deck E (Simic) joins the slice** so Mystic Snake and Curiosity-on-fliers get fuzz coverage; ten pairings.

**ADR-037 — Ceiling complete (S5).** Every mechanic in mechanics-manifest §3 has a tested pool card. Vocabulary is frozen; further pool growth is card batches. Any new word requires a manifest amendment first.

**ADR-038 — "Own graveyard only" is load-bearing.** Graveyard target candidates are enumerated from the targeting player's own graveyard; opponent-graveyard targeting would require generalizing `targetCandidates`. The manifest exclusion stands and is now an architectural assumption, not just curation. (S5 concern 3.)

**ADR-039 — Control model has two inputs** (`baseController`, control statics) and a documented test convention (set both to stage a steal). A Threaten-style timed override would be a third input and needs its own ADR before any card enters. (S5 concern 4.)

**ADR-040 — Event sequencing and the fixtures inbox.** EVENT log entries carry `seq` (monotonic) and `afterAction` (index of the last ACTION entry before them) so viewers can align events to the action timeline without re-simulating. The viewer's "flag this" writes `fixtures-inbox/<seed>-t<turn>-a<index>.json` per data-model §8; a later session converts inbox entries into scenario fixtures. (S5 suggested-next a/b.)

**ADR-041 — Ratifications from S5:** deviations 1–2; no `characteristics()` caching until M4 measures it hot; legend-rule keep-choice at end of SBA pass accepted (704.3 nuance unobservable with current pool); B–D deck-out rate accepted as matchup property.

**ADR-042 — Ratifications from S6:** viewer reads engine state via view-ctx + seat-shaped selectors (`buildView` intact for play-mode redaction); icons are one-render-with-targeted-rerolls; unicode transport glyphs accepted as cosmetic debt; the gemini-image skill's asset conventions are canonical (`assets/images/` + `assets/manifest.json` skill-owned; `assets/generated/` + `MANIFEST.md` derived/human; subjects in `docs/art/subjects/`). CardDef `text` field deferred until custom cards exist.

**ADR-043 — Hand frames drop oracle text in the play UI** (name/art/cost/P&T only); the inspector carries rules text. Matches physical play and fixes 8px squint. (S6 concern 3; art-direction §3 updated.)

**ADR-044 — Small-items rider for the next implementation session:** DAMAGE event payloads gain `targetCardId` (viewer log readability); transport glyphs redrawn in ink when convenient; Phyrexian Rager printing override to `apc` in printings.md (PMEI promo was the deterministic-but-unintended pick).

**ADR-045 — SanePolicyAgent.** A policy-filtered random agent joins `agents`: random choice within a filtered legal-action set (mulligan keeps 2–5 land hands; always play a land; tap only toward an intended cast; prefer casting over passing; attack by simple filter). Purposes: watchable games, deeper fuzz coverage of expensive cards, and the bottom rung of M4's sparring ladder. RandomAgent remains the legality fuzzer — Sane never replaces it in the engine-correctness suites, and its policies live entirely in `agents` (never in the engine or enumerator).

**ADR-046 — Card gallery + art notes.** A `/gallery` route in `packages/ui` renders every pool card in our frame (printed-scan toggle), grouped/filterable, with set/artist captions from the printings data. A per-card note button appends to `docs/art/art-notes.md` (same pattern as the fixtures inbox): Chris's browsing produces a work list the planner converts into printings.md overrides or frame fixes.

**ADR-045 (amended) — Rule 8, target-side preference, is part of SanePolicyAgent.** Targeted effects classify over the vocabulary as harmful (damage, destroy, bounce, counter, restrict, steal, negative pump → prefer opponent-side targets) or helpful (positive pump, keyword grants, equip, draw auras → own side); uniform within the preferred set; fall back to all tuples if the preferred set is empty. The classification table lives in `agents` and is the first shared brick of M4's evaluator. Trigger targets remain uniform until ADR-048 lands.

**ADR-047 — Ratifications from S7:** shipped block rule (kill-or-absorb-2, never chump) accepted as the floor; agent per-instance memory (mulligan count, blocked-attackers set) blessed as documented view-gap workarounds, to be retired by ADR-048; menace never block-targeted at the floor; `pnpm agent-stats` is the standing source for handoff tables; `ui → sim/decks` (browser-safe subpath) is a legal dependency; StripTile duplication accepted; token `art.asset` live. Frame follow-ups are Chris's call via the gallery (font step-down vs scroll; W body warmth).

**ADR-048 — What the agent-facing view owes (implement as M4 Part 0).** `GameView` gains: (a) `combat` — attackers, block assignments so far, and step; (b) `mulliganCount` for the viewing seat; (c) live characteristics on every visible object — effective power/toughness/keywords as the engine computes them, not printed values. Target-choice requests (including trigger targets) carry `sourceCardId` and the pending item's effect summary so side-preference and evaluation can apply; trigger targets are chosen when the ability goes on the stack (603.3d timing already holds — this adds identity to the request, no rules change). Retires S7 deviations 1–2 and concern 6. Redaction invariant unchanged: nothing hidden (hands, libraries) is ever in the other seat's view, enforced by a permanent no-peeking test.

**ADR-049 — M4 measurement ladder.** Progress is measured, never asserted: (rung 0) RandomAgent; (rung 1) SanePolicyAgent with S7's per-deck baselines; (rung 2+) each HeuristicAgent version. Every rung reports per-pairing Monte Carlo win rates in both seatings (the two-number methodology — on-the-play and on-the-draw reported separately, since seat advantage is real). A heuristic version ships only if it beats sane in every deck's hands and never regresses a prior rung. The book of shame — known-dumb moves (self-Control-Magic, same-host re-equip churn, self-face burn, chumping into nothing) — is a permanent scenario-test suite over the evaluator: each entry asserts the dumb action scores below the sane alternative.

**ADR-050 — Evaluator noise.** Action selection is softmax-over-scores with a per-profile temperature: near-ties are genuine coin flips, clear gaps are near-certain, and the "suboptimal" option lands a tunable ~5–10% of the time at default temperature. Runs on the agent's seeded PRNG (ADR-015) — reproducible. Temperature is a difficulty knob (weak opponents run hot). Book-of-shame tests assert score *ordering*, which noise never changes.

**ADR-051 — The AI knows both decklists, never hidden zones.** The AI profile includes the opponent's decklist (Shandalar-honest: you know what each wizard plays) — this is how "playing around Wrath" exists for a shallow evaluator. Hands and libraries remain redacted (ADR-048's no-peeking invariant); no draw-order or hand knowledge ever.

**ADR-052 — Card art policy (custom cards).** Card illustrations are exempt from `docs/prompts/style.md`: the ink-and-wash law governs the interface and world, not the art set into frames. Every custom card gets **four candidates in distinct styles and compositions** (directions specified per card in `docs/prompts/card-art.md`), Chris picks; kept + rejected all logged in MANIFEST. Chosen art is cropped 5:4 to `assets/generated/card-art/`.

**ADR-053 — First custom card: Cunning Tactician** ({2}{W}{W} Human Soldier 2/2, vigilance, "{W}, {T}: Tap target creature."). Uses only frozen vocabulary — `tapTarget` gets its first resolver; no manifest amendment. CardDef gains the deferred `text` field (ADR-042) for custom cards' rules text; real cards keep sourcing oracle.json.

**ADR-049 (amended) — Ladder gates, corrected.** The skill gate is: challenger wins **every mirror, both seatings** (deck-neutral skill). The no-regression rider is: every pairing cell ≥ its sane-vs-sane baseline. The S8 phrase "beats sane in every deck's hands" is retired — deck imbalance dominates pairing cells and is a curation signal, not an agent failure. Committed ladder smokes assert flake-resistant bounds (documented in the test); the 1,000/cell CLI is gate authority. HeuristicAgent v1 passes the corrected gates.

**ADR-054 — Ratifications from S8:** two-gate ladder implementation; `--no-style` as the skill's sanctioned card-art path; ranked heuristics for trigger/discard/sacrifice choices in v1; spot-check re-hunts on deck changes are expected maintenance; token `text: ""`; no rules-registry row for the view contract (engine surface lives in ADRs). Deck imbalance measured by the ladder (D dominant, E weak) is **parked as curation input** — pool balance is its own future workstream, done with mirror-gated agents so deck and pilot quality stay separable.

**ADR-055 — Suite tiers (ADR-034 extended).** Default `pnpm test`: fuzz smoke + a 20-games/cell mirror sanity check (loose bounds), target ≤ ~15s. `FUZZ_FULL=1`: adds the 100/cell ladder smoke and 500/pairing fuzz. CLI (`pnpm ladder`, `pnpm fuzz`, `pnpm agent-stats`) remains the authority for handoff numbers.

**ADR-056 — Evaluator accounting: creatures carry their buffs.** Board material values each creature at its *live* characteristics (already in the view); auras and equipment themselves are worth ~0 standing material (a small salvage term for unattached equipment is allowed). The view-sim and evaluator thus tell one story; the S8 symmetric standing-value term is removed. (S8 concern 6.)

**ADR-057 — M4 closed (S9); ratifications.** HeuristicAgent passes both amended gates at 1,000/cell; three difficulty profiles with a demonstrated monotone ladder. Ratified: combat-model fixes kept at neutral delta as correctness; the revert-at-zero rule is refined — zero-delta changes revert *unless* justified and labeled as correctness/watchability (flash-hold stays, Curiosity credit reverted); default-tier smoke counts are tier-defined (ADR-034/055 harmonized). **Parked M4c leads** (reopen on playtesting evidence): master needs an evaluator edge, not lower temperature — near-determinism measurably loses (T=0.05 collapsed B mirrors to 41.6%); E's on-the-draw gap wants a board-delta-conditioned hold posture (new evaluator input shape — needs an ADR); weight-search over the untested keyword/hand constants; archetype fit per deck by ladder search (parked with ADR-054 curation).

**ADR-058 — M5 interaction design (Chris-ratified).**
- *Priority:* auto-pass any window with no meaningful action (nothing castable/activatable at instant speed with current mana); structural pauses (all DecisionRequests — declarations, choices, mulligans) always stop. Player-configurable per-step stops; a hold-priority modifier when casting/activating (retain priority to respond to your own spell). Known v1 limitation, deliberately accepted: instant auto-pass leaks hand-emptiness; cosmetic pauses are future polish.
- *Combat input:* Arena-style click. Ineligible creatures dimmed (sickness, defender, tapped, restrictions); click toggles a staged highlight; blocks are click-blocker-then-click-attacker with a visible pairing mark. Staging is **UI-local, engine-validated** (each staged declaration must be among the enumerator's currently offered actions; Confirm streams the incremental declare actions + done, which the enumerator re-validates — amended per ADR-059); Cancel clears the local stage. The engine gains no un-declare; committed actions are final — no takebacks, ever.
- *Dialogs:* X values, modes, discard/sacrifice/legend/trigger-order/optional-trigger choices, mulligan keep/bottom — all local-choice + single-Confirm on the same pattern.
- *Zones:* graveyard and exile browsable for both players (public); revealed hands render from the DecisionRequest payload (ADR-032 — Duress needs nothing new). Library inspection deferred: `searchLibrary` has no pool card or resolver; the CR 701.19 shuffle-after-search rule rides in with that resolver when a card ever enters.
- *Scope:* match setup (your deck, opponent deck, difficulty profile, optional seed) → play screen → concession available → end screen with "watch replay" into the viewer (every played game is a log). Acceptance test: Chris carries a precon match vs `journeyman` to completion.

**ADR-059 — M5 shipped; S10 ratifications.** DoD 1 complete (Chris won his first full game, then two more piloting E vs journeyman-D). Ratified: lands play on single click (Confirm is for multi-choice casts); combat staging validates against the enumerator's offered set rather than a scratch state (the enumerator is the authority — ADR-058 wording amended); concession drains in-flight decisions with first-choice actions (logs of conceded games may carry trailing auto-actions past the CONCEDE result); acceptance tests drive the controller API (the interaction brain), with DOM verified by hand. Auto-pass fixes adopted: X=0-only casts are non-meaningful; a fast-forward-to-my-turn button. **Hidden-information honesty:** with a local engine, full state is in browser memory by construction; redaction is an agent-seam guarantee (no-peeking suite), not a secrecy guarantee against the person. Accepted permanently.

**ADR-060 — M4c authorized (playtest-driven).** Chris's E-vs-journeyman-D easy wins show the sane-relative gates don't measure human-relative challenge. M4c adds: (1) **deterrence** — a defensive-posture evaluator term: untapped potential blockers carry value keyed on what they threaten to trade with (deathtouch and high toughness earn more; ~0 when the opponent's board is empty), so the Typhoid Rats over-attack class of misplay is priced; (2) the parked E posture switch — board-delta-conditioned hold behavior is an **approved evaluator input shape** (own-vs-opponent board value delta from the view); (3) master weight-search — automated ladder search over evaluator constants for the master profile (the ADR-057 lead), 2-ply on high-stakes decisions only as an escalation if search plateaus. All measured: ladder deltas per change, gates re-verified, book of shame extended (deathtouch holder does not attack into a death-for-nothing when deterrence exceeds the attack's value).

**ADR-061 — S11 rulings.** Ratified: deterrence in trade-profit form (measured −0.8 vs −1.55 for gross); posture switch kept at +1 under the watchability label; 300/cell guard budget; the `Game.onLonePass` observation seam (no request, no log entry, replay identical — the sanctioned shape for UI observation of silent windows; ADR-014 unamended); draggable inspector; mid-session director rounds are an established pattern. **Overruled: master reverts to `DEFAULT_CONSTANTS`** — the searched vector's held-out edge is zero, and zero-delta discipline admits no "distinct personality" exception; master = low temperature until it earns a real edge. `gate/aggregate` renamed `info/per-deck` in ladder output (a non-gate that has cost two sessions of re-investigation).

**ADR-062 — AI workstream (standing, parked).** The +8% constant-search path is closed by measurement (noise floor ≈ single-constant effect at affordable games/eval). Next scheduled item when the workstream runs: **surgical 2-ply** — score-gap-triggered, high-stakes purposes only (removal targeting, alpha-strike sizing, sweeper timing), held-out protocol. Approved input shapes awaiting that session: on-the-play/draw posture; revealed-information memory. The ranked tells list (S11 concern 7) is the workstream's backlog. Difficulty in the shipped game is worldcraft first (overworld manifest §1.1).

**ADR-063 — S12 rulings.** Ratified: the S12/S13 carving; two registry-first knobs (`startingGold`, `fleeOddsByTier`); flee forfeits are world-picked (no duel exists to set an ante zone) and **a failed flee fights and antes again — compounding stakes stand, with the requirement that the parley UI telegraphs both the forfeit and the compounding before the choice**; human on the play in world duels (seat choice is a later world option); `GameView.startingLife`, required `rules.ante`, and the `max(8, startingLife/2)` race threshold; generator invariant is region-reachability (terrain pockets are scenery). WorldState facts adopted into the manifest's skeleton: per-player `basicLand` refill, `defeated` flags thinning rosters, a journey RNG stream separate from generation, explicit `gameOver`. Loss-side deck integrity (slice): forfeited cards leave collection and deck; the deck refills with its basic land and never drops below the floor.

**Planner process note (self-imposed):** full-file doc replacements must fold in every ratified in-repo amendment before shipping — a replacement that reverts implementer-applied wording is the planner-side version of the silent no-op principle 11 guards against. (S12: ADR-058 wording was stomped and re-applied.)
