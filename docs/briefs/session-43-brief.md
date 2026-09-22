# Session 43 brief — the flood's lairs

*Planner → Implementer. 2026-09-22. Follows the running handoff.md (after S42b). Process rules unchanged: appends to `docs/decision-updates/s43.md`; fuzz before fixtures; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **S42b Deviations 1–7 ratified.** Concern 4 (tier 3's three basics beside tier 2's one) is intended: the post-lords deck at 47% against the wilds is where the end of the journey should sit. Concern 5 (Sorrel's entrance leads with the Mountain) stands — the pip rule decides; the document's "keeps" column is a note, not a rule.
- **ADR-136 — The phase-two manalink economy (Chris).** No start manalinks (ADR-126 stands). Quests received from towns may award manalinks of both kinds (basics and world life), as phase one's did. **Each coloured region carries three lairs across its approach and wild rings**, each with a manalink at the end: a **basic-land** link guarded by a **tier-3 mage**; a **life** link guarded by a **tier-3 beast**; a **life** link guarded by a **tier-2 mage**. Fifteen lairs, five basics and ten life links across the map, harder to earn than phase one's parcels and there to be earned before a stronghold. The stronghold and the High Ground stay in the wild ring. **The stronghold interior is unchanged** (Concern 1 is answered by the economy, not the seat).
- **ADR-135 ratified as measured: the fount keeps five roots and the card in hand.** The sim's long odds are an AI piloting a deck with no earned links; a player arrives with basics of their own and plays better than journeyman. `floodHeartLife` 50 (45/55) stands. Chris's hand read follows his phase-one run.
- **ADR-134 stands** (30 + 2); re-read in Part 4 with a deck that has earned its lairs.
- **List amendments** (the inversion document, then `pnpm mage-inversion:gen`): Brennor −1 Boggart Brute −1 Brute Force +2 Wall of Blossoms; Kessa −2 Essence Scatter +1 Wall of Air +1 Vampire Nighthawk; Sorrel −2 Savannah Lions +1 Siege-Gang Commander +1 Thundersnake (two tier-3 titles). Vael and Varro accepted as matchups.

## Part 1 — The lairs
- **Placement**: `generateWorld` at phase 2 places three lair sites per territory — one in the approach ring, two in the wild (or two/one; the generator's choice by room), never adjacent to the stronghold or the ground. `FixedPointKind` `lair` with a `contentId` per site (the S41 pattern).
- **Residents**: the phase-one lair machinery (`lairResidentLifeBonus`, the resident's parley, the fixed duel) with the resident drawn by rule from the phase-two roster: the **basic lair's** guardian is the tier-3 mage whose kept colour is the territory's (the inversion's assignment: Ysolde in white, Varro in blue, Corvane in black, Sorrel in red, Quill in green); the **beast life lair's** guardian is the territory's tier-3 beast (the Serra in white, the Formation in blue, the Specter in black, the Siege-Gang in red, the Wurm in green); the **mage life lair's** guardian is the tier-2 mage whose kept colour is the territory's (Vael, Pell, Maelin, Kessa? — Kessa keeps U and Pell keeps U: **Pell in blue, Kessa is the wild card — place her in red** by her Mountain pips at phase one; the planner accepts the implementer's alternative if the pip rule says otherwise; Brennor in green). A resident fights at its tier's phase-two row plus the lair bonus; the lair is a single duel; the resident does not roam while its lair stands (as phase one's).
- **Prizes**: the basic lair pays one basic of the territory's colour **in play** (a manalink of the land kind — the S25 award path); the two life lairs pay **+2 max life** each (the life kind). The Chronicle notes the link; the rail shows it kind-aware. A lair pays once (the phase-one rule); the resident's ante and stake as a roamer's.
- **Quests**: the phase-two quest board may award manalinks of both kinds as phase one's rules allow — the implementer reports which quest kinds award them today and whether any are switched off at phase 2; nothing is re-tuned this session.
- **Names and text** (planner, Part 5): the lairs by their prize, not their resident — the resident is a surprise until the telegraph.

## Part 2 — Fuzz and fixtures
Generation (fifteen lairs per seed, the rings, never adjacent to the seat or the ground, reachable); the resident rule per territory; the prize paths (a basic in play at the next duel; +2 max life; once only); the phase-one map unchanged. A fuzz of the fifteen lair duels with the post-lords references as pilots, replays byte-exact.

## Part 3 — AI
None expected; the residents are pinned mages and beasts.

## Part 4 — Measure
- **`salvage-WR+lords+lairs` / `salvage-UB+lords+lairs`**: the post-lords references with three basics of their pair in play (three lairs earned across the pair's two territories — a fair mid-journey haul) and **16 life** (two life links). The honest post-lairs yardstick.
- **The scripted phase-two stronghold run** with that deck over twenty seeds: how often it reaches the lord and at what life, and the lord's rate live. The read: ADR-134 stands if the lord holds 50–70% live; if the run still never reaches him, the planner looks at the interior after all.
- **`flood-sim --refs postlairs`** for the ten seats (the courts included — not run since S41), and **`heart-sim --tide 1 --roots 5 --refs postlairs`** at 50/45/55: the fount against a deck that earned its ground. No knob moves; the planner takes both to Chris.
- **The purse**: a read of what the flood's shops can sell for 100 gold across the first town's three visits (the tier-1/2 stock at phase-two prices, the R shelf empty until a lord falls); report only.

## Part 5 — Text (planner; Chris's pen)
- **The lairs' names** (by prize; the same three in every territory, the territory's name prefixed on the map — "the Chalkwater Landing"): the basic lair — **the Landing** (*"Dry ground, held. Whoever holds it holds a foot of the flood."*); the beast's life lair — **the Wellhouse** (*"A spring the water did not take. Something drinks here."*); the mage's life lair — **the Hearthstead** (*"A fire kept lit through the flood. Someone tends it, and does not share."*).
- **The prize lines**: the basic — *"The ground stays under you."*; the life — *"The water gives back a little of what it took."*

## Handoff
The lairs as built with a seed's map, the resident table, the prize paths, the post-lairs references and the four measurements, the purse read, the amended lists' mirror numbers, deviations, concerns, and the implementer's estimate for what remains of phase two (the Calyx's tiles and the flood's art round; the shops' stock; the Chronicle page for the falls).
