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
