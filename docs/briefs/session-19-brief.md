# Session 19 Brief — Quests (+ gates first, shop tiers, bestiary round 2)

Read first: `CLAUDE.md`, `handoff.md` (S18's), ADR-073..078 (078 is in `docs/decision-updates/`), `docs/card-tier-audit-v2.md`, `docs/bestiary-round-2.md`, overworld manifest §5 (quest shapes, the clock), ADR-069 (card-courier variant; manalink rules), `docs/world-sim-s18.md`. Budget a director round (kickoff verdicts + mid-session: post-baseline deck adjustments, quest feel).

**Kickoff verdicts to collect from Chris before Parts 2–3 encode content** (the ADR-078 pending list): five beast display names; buyable flags; the ⚑ floor promotions (Brute/Baloth → T2); W1 Tactician retire-or-keep; lair reassignment U → Formation; OQ-4 nod.

## Parts

**Part 0 — Gates and baseline first (ADR-078 sequencing; blocks everything downstream).** Run the full 1,000/cell ladder against the ADR-049 (amended) gates for the current agent (post-pin-16 attack search). Then a fresh world-sim baseline: 30 seeds × 5 starters (blue = list C, applied here), current 12-opponent roster, same policy/format as S18's tables. These are the new baselines; the S18 tables are retired for tuning purposes. If the gates fail, stop and escalate — nothing else in this brief proceeds on a failing agent.

**Part 1 — Shop tiers + riders.** Pool registry gains `shopTier` per `card-tier-audit-v2.md` (with kickoff ⚑ verdicts applied); stock generation filters `shopTier ≤ ring`; price applies `shopTierMultiplier` (knob, 1.0/1.5/2.5); R cards never stock (distinct from `prizeOnly` — R still flows through ante/rewards). `starters.json` takes blue list C. Existing seeded-stock/epoch machinery untouched — tiering is a filter and a factor.

**Part 2 — Bestiary round 2 encode.** Per `docs/bestiary-round-2.md` with kickoff verdicts: Faerie Formation card def + `faerie_1_1_u` token def (**Scryfall re-verification is a blocker; the activation cost {3}{U}-vs-{3} flag specifically — mismatch flagged, not fixed**), `art:fetch`, registry/printings rows; five catalog entries (spoke, tier, kind, parley, buyable, `beast:` deck refs) + decklists into `expansion-decks.ts`; lair-host reassignment per verdict; five plates + chips (ADR-066 full-body discipline — the rat plague is a mass, the Formation a throng) + Faerie token art; `fuzz:expansion` extended over the 16 beast decks, standard tiers.

**Part 3 — Quests slice (the milestone).** The first quest shapes, scoped to what exists (no dungeons yet — retrieval and rumor-chains defer to S21):
- **Courier:** deliver A→B through danger. Includes the **card-courier variant** (ADR-069): deliver a predicate-matching card *from your collection* — it leaves the collection on acceptance; off-colour collecting gains an economy. Optional **step deadline** per quest (knob; a clock consumer — the second, after respawn) — expiry fails the quest, no further penalty.
- **Bounty:** a named roaming enemy — spawn/flag a specific catalog instance in a target region, map-marked once seen (fog rules apply); reward on defeat. Roamer machinery already supports everything but the flag.
- **Offers:** every town offers ≥1 quest per game (seeded from a small authored template table; placeholder text fine — quest *text* authoring is planner content, and stronghold-referencing text waits on the boss round). Accept/track/abandon in a rail quest log; town interfaces stay clock-free.
- **Rewards:** gold by tier; cards (tier-appropriate, incl. R-class as the premium quest payoff — the first R-acquisition path); **manalinks** (ADR-069: reward-class only, cap one per colour via knob, tier-2+ quests, town-tied — the `permanentOnBattlefield` modifier path, zero engine work; suspension-on-town-fall machinery deferred to S20 sieges, losable-per-stakes deferred with it).
- **Save:** active/completed quests need persistence — implementer proposes the `world-save-v4` migration (consider reserving obvious S20 fields — siege timers — to avoid a v5; escalate the field list). Durability: autosave on accept, complete, and expiry.
- **MatchResult facts** (§1a) are the quest-condition source where duel outcomes matter; no engine additions expected — escalate if a shape needs one.

**Part 4 — World-sim, full roster.** Post-encode: 16-signature roster tables in the S18 format against the Part 0 baseline. Report per-opponent vs tier expectations; the five new decks' tier fit is measured here. **Nighthawk/Warband adjustments are ruled in the mid-session director round against these tables** — planner/Chris live, not implementer-decided. Watch items: the Formation AI's activation discipline (if it never banks toward the engine, that's a pin candidate — report, don't fix); gold-flow sanity (income per ring vs tier prices) for the multiplier baselines.

**Part 5 — Acceptance.** Scripted: courier accept → travel → deliver → reward applied → autosaved; bounty accept → target flagged → defeat → reward; deadline expiry fails cleanly. Human: Chris takes a courier and a bounty, shops a tiered town (and finds a wild-town shelf), meets two of the new beasts, fights the Nighthawk (the Blood Artist request-chattiness feel-check, S18 concern 9), verdicts quest feel / names / plates / dialogs.

## Definition of done

Gates re-run and reported; baseline tables filed; tiers live; round-2 bestiary live with verified Formation; both quest shapes playable end-to-end with save-v4; world-sim tables + gold-flow read; director-round rulings recorded; felt-wrong harvest. Concerns wanted: quest-shape friction, deadline feel, R-reward pacing, new-deck tier fits, anything save-v4 had to guess.

## Out of scope

Sieges (S20), dungeons/strongholds/retrieval/rumor-chains (S21), boss content (planner + Chris co-author in parallel — do not touch strongholds), new cards beyond Formation, AI evaluator work, pool balance beyond the director-round deck rulings, meta-progression.

## Escalate, don't decide

Gate failures; any quest shape wanting engine additions or new vocabulary; the save-v4 field list; reserved threads (legendary identity, boss residents); any tuning conclusion beyond reporting tables; Formation verification mismatches.
