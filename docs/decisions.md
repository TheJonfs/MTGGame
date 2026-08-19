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
