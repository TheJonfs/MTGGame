# Session 44 brief — the flood, polished

*Planner → Implementer. 2026-09-29. Follows the running handoff.md (after S43 and the playtest week). A polish session from Chris's first full phase-two run; no new legends, no rows moved. Process rules unchanged: appends to `docs/decision-updates/s44.md`; every AI change carries a ladder delta or reverts.*

## Part 0 — Rulings and ADR appends
- **The playtest week ratified**: the lairs as lair-dungeons (ADR-136 amended); the golds off the shelves and Shadow Summoning at R (superseding ADR-128's T2 placement — recorded); the powers into the flood (ADR-088 applied); the salvage picks locking at the commit; the deep-water threshold at the centre cell (the fords lead there — no rule change); the petals keep three copies and no loom; all five AI corrections (books 69–73).
- **ADR-137 — A flood lair pays one R card and its manalink** (Chris: the dungeons' chests already add the second). A flood-specific roll beside `lairPrizeRoll`.
- **ADR-138 — `floodClockSlack` 1.5 ratified.**
- **ADR-139 — The shelves widen per region**: a territory's towns gain **+2 rows of ordinary stock** (`shopStockSize` + 2; R stays out) once *that* territory's lord has fallen; not cumulative across lords. Tested on Chris's next run.
- **Watch items recorded, nothing built**: quest manalinks vs the lairs (Chris's next run refuses land-granting quests; the option is quests → life links only); the fount's life; the purse; Odile.
- **The sim references drop to 10 life** (the world's phase-two start); re-run `flood-sim --refs postlairs` once as the new baseline.

## Part 1 — The Chronicle page for the falls
A phase-two run's Chronicle section: the flood's entry, then the lords' falls, the courts' falls and the lairs' links in the order they happened (from `gauntlet.flood.falls` and `floodRun.lairs`), each with the pack's fall line; the fount's capstone line last. The cuttings' ledger untouched.

## Part 2 — The Calyx and the lairs, drawn
Through the art skill, in the flood register's palette (the storm-light oil the gate plates kept):
- The Calyx's tiles: deep water, the ford, the High Ground (the island) — feathered like the rest of the map, not flat tones.
- Three lair glyphs (the Landing, the Wellhouse, the Hearthstead) for the map, and three splashes if cheap.
- The five courts' splashes (the High Grounds' woodblock card art re-cropped is fine).
Candidates to Chris; MANIFEST rows.

## Part 3 — The rumours (planner's text; Chris's pen) — `quests.json` `flood.rumors`
Phase-two taverns pour these beside the phase-neutral lines. One per seat, one per lair kind, three for the water.
- *"The Bailiff at Tidelock keeps what comes through the gate. Nothing that goes in comes out the same size."*
- *"They say the Reeve counts every death in the fen and spends them like coin. Do not die near Marrowfen."*
- *"The ford at Emberford is lit from underneath. The Fordkeeper takes his toll in what you cast — and drinks it."*
- *"The Dredger raises what the lake took. Spells, mostly. He can raise them more than once."*
- *"Something is growing in the rows on Harrowmoor. The Reaper says the Sower planted it. The Reaper is what came up."*
- *"There is a court on the water where the fire counts your cards. Bring bodies, they say. Bring many."*
- *"The roots in the shallows take the small things first. Go big or do not go."*
- *"On the Green nothing is sudden. Whatever you mean to do there, you must set down and leave."*
- *"The black tower has counted the dry ground that is left. Half of what you bring must be ground, or the tower will not see you."*
- *"The pyre on the cairn burns what is dear. Bring cheap things. Bring them in numbers."*
- *"A Landing is dry ground, held. Whoever takes one keeps a foot of the flood under them."*
- *"A Wellhouse is a spring the water did not take. Something drinks there before you."*
- *"A Hearthstead is a fire kept lit through the flood. The one who tends it does not share."*
- *"Five holds stand against the water. When all five are broken, the deep water moves."*
- *"The flower stood on something. Nobody has seen what."*
- *"The islands in the middle are the only dry ground that was dry before. The water rose around them, and they did not care."*

## Part 4 — Smalls
- The rail's footer: one sentence per manalink kind (quest links darken with an occupied town; lair links do not).
- `pnpm build:web` + push at the close (Chris).

## Handoff
The Chronicle page, the art candidates, the rumours installed, the roll, the shelves, the references at 10 with the re-baselined `flood-sim`, deviations, concerns — and the implementer's read of what a **tier-3 round** would cost (one or two tier-3 cards per colour that also field as roaming beasts on the flood's map and, optionally, phase one's): the beast rows, the lists, the portraits.
