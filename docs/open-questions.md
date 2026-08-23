# Open questions — pending Chris's resolution

*Created S18 (2026-08-23) at Chris's request: a persistent, living list of open director questions that have no ADR yet. Implementer-maintained; Chris resolves in director rounds or chat; resolved items move to the ADR that rules them (or are struck with the ruling noted). Not a substitute for handoff Concerns — those are per-session; this carries across.*

| # | Raised | Question | Default in code today | Status |
|---|---|---|---|---|
| OQ-1 | S16/S18 | **Deck-picker polish list** — the S16 "concern 8" deck-picker items were lost to time. S18 shipped: in-page new/duplicate/delete (no `prompt()`), unsaved-draft guard on switching, "unsaved" marker. What else belongs on the list? | as shipped | open |
| OQ-2 | S14/S16 | **Pending verdict lists**: S13 world-loop felt-wrong list, S14 editor usability list, portrait verdicts (five mages + the wurm; now + ten bestiary plates). | candidates stay "candidate" in MANIFEST | open |
| OQ-3 | S18 | **Lair residents roam too**: the lair host is the spoke's top-tier signature (Serra, Gale, Specter, Siege-Gang, Wurm) and the same template also roams its wild ring. Held-out (lair-only, as the S14 wurm was) or roaming-as-well? | roaming as well | open |
| OQ-4 | S18 | **Beast-tier fallback**: `beastTierFallback` = `mage` (ring difficulty holds) vs `nearest` (more beasts; a tier-2 deck in a tier-1 slot). Also the gaps it exposes: no W tier-1/2 *beast* (the Tactician covers), no B/R tier-1 beast, no U tier-3 beast, no G tier-2 beast. | `mage` | open |
| OQ-5 | S18 | **Beast `buyable` defaults** beyond the ruled ones (Warband yes, Gale no, Serra yes/tithe): Grizzly yes (rations), Recluse no, Man-o'-War no, Nighthawk yes (tribute), Siege-Gang yes, Specter no, Wurm yes (S14). | as listed | open |
| OQ-6 | S18 | **Display names** (ADR-074 said suggestions): "A Cunning Tactician" (tier 1) / "The Cunning Tactician" (tier 2) for the two entries; the rest as ADR-074 drafted; the wurm keeps its lowercase "the Pelakka Wurm" from S14. | as listed | open |
| OQ-7 | S18 | **Fog path planning** treats unexplored cells as passable and re-plans on contact with rough ground ("Rough ground ahead — going around"). Alternative: only let the player click explored cells. | plan-through-fog | open |
| OQ-8 | S18 | **The Pelakka Wurm's PoC stats** (S14: journeyman, world life 14) were aligned to the tier-3 mapping (master, 12, anteCount 2). Keep the alignment or restore the harder lair boss? | aligned | open |
| OQ-9 | S18 | **Blue starter** misses the tier-1 gate again (35% mage-only; S16 40%) after the ADR-073 swap — list edits, tier-1 enemy life, or AI control/tempo work? (S16 concern 2 carried.) | as shipped | open |
