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
