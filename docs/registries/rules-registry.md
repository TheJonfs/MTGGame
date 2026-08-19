# Rules Registry

R-numbered entries describing which Comprehensive Rules mechanics the engine implements, how, and any simplification. Implementer appends; planner reviews. Cite CR section where known. Status: `implemented` / `slot-only` / `planned` / `excluded`.

| R | Mechanic | CR | Status | Implementation note / simplification |
|---|---|---|---|---|
| R-001 | Turn structure & steps | 500–514 | planned (S1) | All steps present; untap/upkeep/draw/main1/combat(5)/main2/end/cleanup. |
| R-002 | Priority | 117 | planned (S1) | APNAP; both pass on empty stack advances step. |
| R-003 | Casting spells | 601 | planned (S1) | announce→targets→X→cost→pay→on stack. |
| R-004 | Resolution & fizzling | 608 | planned (S1) | All targets illegal ⇒ countered by rules. |
| R-005 | Zones & zone change identity | 400, 400.7 | planned (S1) | New object id per move. |
| R-006 | Mana & auto-payment | 106, 601.2g | planned (S1) | Auto-pay (ADR-004). |
| R-007 | SBAs | 704 | planned (S1) | One routine, looped. |
| R-008 | Combat steps | 506–511 | planned (S1) | |
| R-009 | Flying / reach | 702.9 / 702.17 | planned (S1) | |
| R-010 | First strike / double strike | 702.7 / 702.4 | S1 first strike; double strike slot-only | Damage step split exists from S1. |
| R-011 | Haste / summoning sickness | 302.6 | planned (S1) | Resets on control change. |
| R-012 | Vigilance | 702.20 | planned (S1) | |
| R-013 | Trample | 702.19 | slot-only | Assignment rule. |
| R-014 | Deathtouch / lifelink | 702.2 / 702.15 | slot-only | Assignment / dealing rules. |
| R-015 | Menace | 702.110 | slot-only | Blocker-count predicate. |
| R-016 | Triggered abilities & APNAP ordering | 603 | planned (S1: ETB only) | Controller's own ordering: deterministic interim in S1 (ADR-007). |
| R-017 | Continuous effects / layers | 613 | planned (S1: P/T + restrict) | ADR-003 order. |
| R-018 | Auras & attachment legality | 303.4, 704.5m | planned (S1) | |
| R-019 | Equipment & equip | 301.5, 702.6 | slot-only | Shares attach system. |
| R-020 | Control change | 108.4 | slot-only | Owner/controller split from S1. |
| R-021 | Tokens | 111 | slot-only | |
| R-022 | X costs | 107.3 | slot-only | Parser supports X from S1; no S1 card uses it. |
| R-023 | Sacrifice as cost | 701.17 | slot-only | |
| R-024 | Counters (+1/+1, −1/−1) | 122 | slot-only | Annihilation rule 704.5q when both present. |
| R-025 | Legend rule | 704.5j | planned (M3) | Controller chooses. |
| R-026 | Hexproof / shroud / indestructible | 702.11 / 702.18 / 702.12 | planned (M3) | Targeting predicate / SBA exemption. |
| R-027 | London mulligan | 103.5 | planned (S1, simplified) | |
| R-028 | Regeneration, protection, replacement effects, planeswalkers, copy, type/color change | various | excluded | Manifest §4. |
