# Rules Registry

R-numbered entries describing which Comprehensive Rules mechanics the engine implements, how, and any simplification. Implementer appends; planner reviews. Cite CR section where known. Status: `implemented` / `slot-only` / `planned` / `excluded`. `(interim)` marks a deliberate simplification awaiting planner ratification.

| R | Mechanic | CR | Status | Implementation note / simplification |
|---|---|---|---|---|
| R-001 | Turn structure & steps | 500–514 | implemented (S1) | All steps present. First-strike step only runs when a first/double striker is in combat. Declare blockers/damage steps skipped when no attackers (508.8). Cleanup: no priority unless triggers are pending (S1 has no cleanup triggers; general path exists). |
| R-002 | Priority | 117 | implemented (S1) | APNAP; both pass on empty stack advances step; acting player retains priority (117.3c); SBAs + trigger placement before every priority grant (117.5). A lone legal `pass` is auto-taken and not logged (deterministic; see R-029). |
| R-003 | Casting spells | 601 | implemented (S1) | announce→targets→cost→pay→on stack. Targets validated at cast. X parsing supported, no X card castable yet (R-022). |
| R-004 | Resolution & fizzling | 608 | implemented (S1) | All targets illegal ⇒ countered by rules (logged as FIZZLE event); individually illegal targets skipped per-effect via EffectContext re-check. |
| R-005 | Zones & zone change identity | 400, 400.7 | implemented (S1) | New object id per move; `moveObject` is the only mover; battlefield state stripped on exit; attachments detached (SBAs clean up); tokens cease on leaving battlefield. |
| R-006 | Mana & auto-payment | 106, 601.2g | implemented (S1) | Auto-pay (ADR-004): cast legal if floating + untapped producers cover; taps producers in deterministic battlefield order, colored shortfalls first, generic deducted in WUBRG order. **(interim)** Feasibility check assumes mono-color producers — true for the whole current pool; revisit when a dual-producing rock enters. Pools empty at end of every step; no mana burn. |
| R-007 | SBAs | 704 | implemented (S1) | One routine, looped; one pass applies simultaneously. Covers: life ≤ 0, empty-draw loss, toughness ≤ 0, lethal damage, illegal/absent aura host. Legend rule and player-choice SBAs are M3. |
| R-008 | Combat steps | 506–511 | implemented (S1) | Assignment and dealing are separate functions (ADR-006). Lethal-in-order assignment with remainder to last blocker. Blocked-attacker-with-no-surviving-blockers deals nothing (no trample yet). **(interim)** Multi-blocker damage order = block declaration order, not attacker's choice (509.2); needs the chooseOne hook. |
| R-009 | Flying / reach | 702.9 / 702.17 | implemented (S1) | Block-legality predicate. |
| R-010 | First strike / double strike | 702.7 / 702.4 | first strike implemented; double strike slot-only | Damage-step split exists; `strikesInStep` already handles double strike, untested pending a pool card. |
| R-011 | Haste / summoning sickness | 302.6 | implemented (S1) | Sickness set on battlefield entry, cleared at controller's untap. Control change reset wired via moveObject identity rules; real test arrives with Control Magic (M3). |
| R-012 | Vigilance | 702.20 | implemented (S1) | No tap on attack declaration. |
| R-013 | Trample | 702.19 | slot-only | Assignment rule. |
| R-014 | Deathtouch / lifelink | 702.2 / 702.15 | slot-only | Assignment / dealing rules. |
| R-015 | Menace | 702.110 | slot-only | Blocker-count predicate at declaration. |
| R-016 | Triggered abilities & APNAP ordering | 603 | implemented (S1: ETB; DIES/LTB wiring present, unused) | Collected from ZONE_CHANGE into a pending queue; placed on stack before priority, APNAP. **(interim)** Same-controller ordering: timestamp order (ADR-007 chooseOne hook later). Triggers requiring targets with zero candidates never go on the stack (603.3d). S1 conditions: `self` only; "whenever another X" predicates are future vocabulary. **(interim)** DIES look-back uses owner as trigger controller — identical until control-change cards exist (M3 must fix). |
| R-017 | Continuous effects / layers | 613 | implemented (S1: P/T + restrict + keyword grant) | ADR-003 order. Statics computed live from battlefield each `characteristics()` call; resolved effects stored with timestamps; EOT effects expire in cleanup. |
| R-018 | Auras & attachment legality | 303.4, 704.5m | implemented (S1) | Aura spells target; enter attached to targets[0]; SBA sends aura to graveyard when host is illegal or gone. `attached` scope added to the vocabulary's Scope enum for aura/equipment statics. |
| R-019 | Equipment & equip | 301.5, 702.6 | slot-only | Shares attach system; activated-ability path tested synthetically. |
| R-020 | Control change | 108.4 | slot-only | Owner/controller split live from S1. |
| R-021 | Tokens | 111 | slot-only | moveObject already handles cease-to-exist. |
| R-022 | X costs | 107.3 | slot-only | Parser and StackItem.x support X end-to-end; enumerator skips X spells until one enters the pool (needs an X-choice enumeration rule). |
| R-023 | Sacrifice as cost | 701.17 | slot-only | Cost type exists; enumerator skips. |
| R-024 | Counters (+1/+1, −1/−1) | 122 | slot-only | characteristics() already applies them; no card grants them. |
| R-025 | Legend rule | 704.5j | planned (M3) | Controller chooses via agent hook. |
| R-026 | Hexproof / shroud / indestructible | 702.11 / 702.18 / 702.12 | implemented (predicate/SBA hooks live, no pool card) | Targeting predicate checks and lethal-damage exemption are in place and unit-testable when a card arrives. |
| R-027 | London mulligan | 103.5 | implemented (S1, simplified) | Sequential per player (not simultaneous). **(interim)** Bottomed cards = last N drawn, not a choice. Mulligan decisions are logged actions. |
| R-028 | Regeneration, protection, replacement effects, planeswalkers, copy, type/color change | various | excluded | Manifest §4. |
| R-029 | Legal-action enumeration | — | implemented (S1) | Everything the engine accepts comes from the enumerator (replay re-validates). Composite attack/block declarations enumerated exhaustively up to a deterministic cap (ENUM_CAP = 4096, no-op declaration always first). **(interim)** The cap silently truncates the block-assignment space on very wide boards — see handoff Concerns. Hand actions deduplicated by cardId. Decisions with exactly one legal option are auto-taken and not logged. |
